// OpenTimestamps client for the browser, built on the codec in ./format. The official
// `opentimestamps` npm package targets Node (request, bitcore-lib, fs) and ships no browser
// bundle, so stamping, upgrading and Bitcoin verification are implemented here directly against
// the public calendar and Esplora HTTP APIs, which allow simple CORS requests.
import { bytesToHex, hexToBytes, type Bytes } from '@/core/hash/sha256'
import {
  addOp,
  leaves,
  mergeTimestamp,
  OP_APPEND,
  OP_SHA256,
  OtsError,
  parseDetached,
  parseTimestamp,
  serializeDetached,
  type Timestamp,
} from './format'

export { OtsError } from './format'

export const OTS_CALENDARS = [
  'https://a.pool.opentimestamps.org',
  'https://b.pool.opentimestamps.org',
  'https://a.pool.eternitywall.com',
]
const ESPLORA = 'https://blockstream.info/api'
const ACCEPT = 'application/vnd.opentimestamps.v1'
const TRUSTED_CALENDAR_HOSTS = [/\.opentimestamps\.org$/, /(^|\.)eternitywall\.com$/]

export type OtsInfo = { digestHex: string; status: 'pending' | 'confirmed'; calendars: string[]; block?: number }
type NetOpts = { fetchImpl?: typeof fetch; timeoutMs?: number; signal?: AbortSignal }

async function call(url: string, init: RequestInit, { fetchImpl = fetch, timeoutMs = 15_000, signal }: NetOpts) {
  signal?.throwIfAborted()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Submits a blinded commitment (sha256(hash ‖ 16 random bytes)) to every calendar, as the
 * reference client does, and returns a detached .ots proof for the SHA-256 hash.
 */
export async function stampHash(
  sha256Hex: string,
  opts: NetOpts & { calendars?: string[] } = {},
): Promise<Bytes> {
  const root: Timestamp = { msg: hexToBytes(sha256Hex), attestations: [], ops: [] }
  const nonce = crypto.getRandomValues(new Uint8Array(16))
  const commitment = addOp(addOp(root, { tag: OP_APPEND, arg: nonce }), { tag: OP_SHA256 })
  const calendars = opts.calendars ?? OTS_CALENDARS
  const results = await Promise.allSettled(
    calendars.map(async (cal) => {
      const res = await call(
        `${cal}/digest`,
        {
          method: 'POST',
          // A CORS-safelisted content type keeps this a simple request: the calendars do not answer preflights.
          headers: { Accept: ACCEPT, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: commitment.msg,
        },
        opts,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return parseTimestamp(new Uint8Array(await res.arrayBuffer()), commitment.msg)
    }),
  )
  opts.signal?.throwIfAborted()
  let merged = 0
  for (const r of results) {
    if (r.status === 'fulfilled') {
      mergeTimestamp(commitment, r.value)
      merged++
    }
  }
  if (merged === 0) throw new OtsError('network', 'No OpenTimestamps calendar answered.')
  return serializeDetached({ hashOp: OP_SHA256, timestamp: root })
}

export function inspectOts(ots: Uint8Array): OtsInfo {
  const file = parseDetached(ots)
  const all = leaves(file.timestamp).map((l) => l.attestation)
  const heights = all.flatMap((a) => (a.kind === 'bitcoin' ? [a.height] : []))
  const calendars = [...new Set(all.flatMap((a) => (a.kind === 'pending' ? [a.uri] : [])))]
  return {
    digestHex: bytesToHex(file.timestamp.msg),
    status: heights.length > 0 ? 'confirmed' : 'pending',
    calendars,
    ...(heights.length > 0 ? { block: Math.min(...heights) } : {}),
  }
}

const isTrustedCalendar = (uri: string) => {
  try {
    const u = new URL(uri)
    return u.protocol === 'https:' && TRUSTED_CALENDAR_HOSTS.some((re) => re.test(u.hostname))
  } catch {
    return false
  }
}

/** Asks each pending calendar for the completed path to a Bitcoin block and merges what it returns. */
export async function upgradeOts(ots: Uint8Array, opts: NetOpts = {}): Promise<{ ots: Bytes; changed: boolean }> {
  const file = parseDetached(ots)
  const before = bytesToHex(serializeDetached(file))
  const pending = leaves(file.timestamp).filter(
    (l) => l.attestation.kind === 'pending' && isTrustedCalendar(l.attestation.uri),
  )
  await Promise.allSettled(
    pending.map(async ({ node, attestation }) => {
      const uri = (attestation as { uri: string }).uri
      const res = await call(`${uri}/timestamp/${bytesToHex(node.msg)}`, { headers: { Accept: ACCEPT } }, opts)
      if (!res.ok) return
      mergeTimestamp(node, parseTimestamp(new Uint8Array(await res.arrayBuffer()), node.msg))
    }),
  )
  const out = serializeDetached(file)
  return { ots: out, changed: bytesToHex(out) !== before }
}

/**
 * Checks the proof's Bitcoin attestation against the block's merkle root from a public
 * Esplora instance. Returns null when the proof has no Bitcoin attestation yet.
 */
export async function verifyOtsOnline(
  ots: Uint8Array,
  opts: NetOpts & { api?: string } = {},
): Promise<{ block: number; blockTime: Date } | null> {
  const api = opts.api ?? ESPLORA
  const btc = leaves(parseDetached(ots).timestamp)
    .flatMap((l) => (l.attestation.kind === 'bitcoin' ? [{ msg: l.msg, height: l.attestation.height }] : []))
    .sort((a, b) => a.height - b.height)
  if (btc.length === 0) return null
  const { msg, height } = btc[0]
  let block: { merkle_root: string; timestamp: number }
  try {
    const hashRes = await call(`${api}/block-height/${height}`, {}, opts)
    if (!hashRes.ok) throw new Error(`HTTP ${hashRes.status}`)
    const blockHash = (await hashRes.text()).trim()
    if (!/^[0-9a-f]{1,64}$/.test(blockHash)) throw new Error('bad block hash')
    const blockRes = await call(`${api}/block/${blockHash}`, {}, opts)
    if (!blockRes.ok) throw new Error(`HTTP ${blockRes.status}`)
    block = await blockRes.json()
  } catch {
    throw new OtsError('network', 'Could not reach the Bitcoin network for verification.')
  }
  // Attestations commit to the merkle root in Bitcoin's internal (little-endian) byte order.
  if (bytesToHex(msg.slice().reverse()) !== block.merkle_root) {
    throw new OtsError('invalid', `The proof does not match Bitcoin block #${height}.`, height)
  }
  return { block: height, blockTime: new Date(block.timestamp * 1000) }
}
