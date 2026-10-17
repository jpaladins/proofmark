// Minimal OpenTimestamps proof codec, mirroring python-opentimestamps' serialization
// (opentimestamps/core/timestamp.py, op.py, notary.py). Supports every operation and the
// pending + Bitcoin attestations; unknown attestations are kept verbatim.
import { ripemd160, sha1 } from '@noble/hashes/legacy.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import type { Bytes } from '@/core/hash/sha256'

export type OtsErrorCode = 'malformed' | 'network' | 'invalid'

export class OtsError extends Error {
  readonly code: OtsErrorCode
  constructor(code: OtsErrorCode, message: string) {
    super(message)
    this.name = 'OtsError'
    this.code = code
  }
}

export type Op = { tag: number; arg?: Bytes }
export type Attestation =
  | { kind: 'pending'; uri: string }
  | { kind: 'bitcoin'; height: number }
  | { kind: 'unknown'; tag: Bytes; payload: Bytes }
export type Timestamp = { msg: Bytes; attestations: Attestation[]; ops: { op: Op; next: Timestamp }[] }
export type DetachedFile = { hashOp: number; timestamp: Timestamp }

const MAGIC = new Uint8Array([
  0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72,
  0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
])
const MAJOR_VERSION = 1
const TAG_PENDING = new Uint8Array([0x83, 0xdf, 0xe3, 0x0d, 0x2e, 0xf9, 0x0c, 0x8e])
const TAG_BITCOIN = new Uint8Array([0x05, 0x88, 0x96, 0x0d, 0x73, 0xd7, 0x19, 0x01])
const MAX_MSG = 4096
const MAX_PAYLOAD = 8192
const MAX_URI = 1000

export const OP_SHA1 = 0x02
export const OP_RIPEMD160 = 0x03
export const OP_SHA256 = 0x08
export const OP_KECCAK256 = 0x67
export const OP_APPEND = 0xf0
export const OP_PREPEND = 0xf1
export const OP_REVERSE = 0xf2
export const OP_HEXLIFY = 0xf3
const BINARY_OPS = new Set([OP_APPEND, OP_PREPEND])
const UNARY_OPS = new Set([OP_SHA1, OP_RIPEMD160, OP_SHA256, OP_KECCAK256, OP_REVERSE, OP_HEXLIFY])
const DIGEST_LENGTH: Record<number, number> = { [OP_SHA1]: 20, [OP_RIPEMD160]: 20, [OP_SHA256]: 32, [OP_KECCAK256]: 32 }

const bad = (why: string) => new OtsError('malformed', `Prova OpenTimestamps non valida: ${why}.`)
const bytes = (u: Uint8Array): Bytes => new Uint8Array(u)
const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i])

export function applyOp(op: Op, msg: Bytes): Bytes {
  switch (op.tag) {
    case OP_SHA1:
      return bytes(sha1(msg))
    case OP_RIPEMD160:
      return bytes(ripemd160(msg))
    case OP_SHA256:
      return bytes(sha256(msg))
    case OP_KECCAK256:
      return bytes(keccak_256(msg))
    case OP_APPEND:
      return concat(msg, op.arg!)
    case OP_PREPEND:
      return concat(op.arg!, msg)
    case OP_REVERSE:
      return bytes(msg.slice().reverse())
    case OP_HEXLIFY:
      return new TextEncoder().encode([...msg].map((b) => b.toString(16).padStart(2, '0')).join(''))
    default:
      throw bad(`operazione sconosciuta 0x${op.tag.toString(16)}`)
  }
}

export function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

class Reader {
  private pos = 0
  private readonly buf: Uint8Array
  constructor(buf: Uint8Array) {
    this.buf = buf
  }
  get done() {
    return this.pos === this.buf.length
  }
  byte(): number {
    if (this.pos >= this.buf.length) throw bad('fine inattesa dei dati')
    return this.buf[this.pos++]
  }
  take(n: number): Bytes {
    if (this.pos + n > this.buf.length) throw bad('fine inattesa dei dati')
    const out = bytes(this.buf.subarray(this.pos, this.pos + n))
    this.pos += n
    return out
  }
  varuint(): number {
    let value = 0
    let shift = 0
    for (;;) {
      const b = this.byte()
      value += (b & 0x7f) * 2 ** shift
      if (!(b & 0x80)) return value
      shift += 7
      if (shift > 49) throw bad('intero troppo grande')
    }
  }
  varbytes(max: number): Bytes {
    const len = this.varuint()
    if (len > max) throw bad('campo troppo lungo')
    return this.take(len)
  }
}

class Writer {
  private chunks: number[] = []
  byte(b: number) {
    this.chunks.push(b)
  }
  put(u: Uint8Array) {
    for (const b of u) this.chunks.push(b)
  }
  varuint(n: number) {
    do {
      let b = n % 128
      n = Math.floor(n / 128)
      if (n > 0) b |= 0x80
      this.chunks.push(b)
    } while (n > 0)
  }
  varbytes(u: Uint8Array) {
    this.varuint(u.length)
    this.put(u)
  }
  bytes(): Bytes {
    return Uint8Array.from(this.chunks)
  }
}

function readOp(r: Reader, tag: number): Op {
  if (BINARY_OPS.has(tag)) {
    const arg = r.varbytes(MAX_MSG)
    if (arg.length === 0) throw bad('argomento vuoto')
    return { tag, arg }
  }
  if (UNARY_OPS.has(tag)) return { tag }
  throw bad(`operazione sconosciuta 0x${tag.toString(16)}`)
}

function readAttestation(r: Reader): Attestation {
  const tag = r.take(8)
  const payload = r.varbytes(MAX_PAYLOAD)
  const p = new Reader(payload)
  if (equal(tag, TAG_PENDING)) {
    const uri = new TextDecoder().decode(p.varbytes(MAX_URI))
    if (!/^[A-Za-z0-9.\-_/:]+$/.test(uri)) throw bad('URI del calendario non valido')
    return { kind: 'pending', uri }
  }
  if (equal(tag, TAG_BITCOIN)) return { kind: 'bitcoin', height: p.varuint() }
  return { kind: 'unknown', tag, payload }
}

function readTimestamp(r: Reader, msg: Bytes, depth = 0): Timestamp {
  if (depth > 256) throw bad('struttura troppo profonda')
  const ts: Timestamp = { msg, attestations: [], ops: [] }
  const handle = (tag: number) => {
    if (tag === 0x00) {
      ts.attestations.push(readAttestation(r))
    } else {
      const op = readOp(r, tag)
      const next = applyOp(op, msg)
      if (next.length > MAX_MSG) throw bad('messaggio troppo lungo')
      ts.ops.push({ op, next: readTimestamp(r, next, depth + 1) })
    }
  }
  let tag = r.byte()
  while (tag === 0xff) {
    handle(r.byte())
    tag = r.byte()
  }
  handle(tag)
  return ts
}

function writeAttestation(w: Writer, a: Attestation) {
  const p = new Writer()
  if (a.kind === 'pending') {
    w.put(TAG_PENDING)
    p.varbytes(new TextEncoder().encode(a.uri))
  } else if (a.kind === 'bitcoin') {
    w.put(TAG_BITCOIN)
    p.varuint(a.height)
  } else {
    w.put(a.tag)
    p.put(a.payload)
  }
  w.varbytes(p.bytes())
}

function writeOp(w: Writer, op: Op) {
  w.byte(op.tag)
  if (op.arg) w.varbytes(op.arg)
}

function writeTimestamp(w: Writer, ts: Timestamp) {
  const { attestations, ops } = ts
  if (attestations.length === 0 && ops.length === 0) throw bad('nodo vuoto')
  if (ops.length === 0) {
    attestations.slice(0, -1).forEach((a) => {
      w.byte(0xff)
      w.byte(0x00)
      writeAttestation(w, a)
    })
    w.byte(0x00)
    writeAttestation(w, attestations[attestations.length - 1])
    return
  }
  for (const a of attestations) {
    w.byte(0xff)
    w.byte(0x00)
    writeAttestation(w, a)
  }
  ops.forEach(({ op, next }, i) => {
    if (i < ops.length - 1) w.byte(0xff)
    writeOp(w, op)
    writeTimestamp(w, next)
  })
}

/** Parses a serialized timestamp (e.g. a calendar response) whose starting message is `msg`. */
export function parseTimestamp(data: Uint8Array, msg: Bytes): Timestamp {
  const r = new Reader(data)
  const ts = readTimestamp(r, msg)
  if (!r.done) throw bad('dati in eccesso')
  return ts
}

export function serializeTimestamp(ts: Timestamp): Bytes {
  const w = new Writer()
  writeTimestamp(w, ts)
  return w.bytes()
}

export function parseDetached(data: Uint8Array): DetachedFile {
  if (data.length < MAGIC.length || !equal(data.subarray(0, MAGIC.length), MAGIC)) {
    throw bad('intestazione mancante')
  }
  const r = new Reader(data.subarray(MAGIC.length))
  if (r.varuint() !== MAJOR_VERSION) throw bad('versione non supportata')
  const hashOp = r.byte()
  const len = DIGEST_LENGTH[hashOp]
  if (!len) throw bad('algoritmo di impronta non supportato')
  const timestamp = readTimestamp(r, r.take(len))
  if (!r.done) throw bad('dati in eccesso')
  return { hashOp, timestamp }
}

export function serializeDetached(file: DetachedFile): Bytes {
  const w = new Writer()
  w.put(MAGIC)
  w.varuint(MAJOR_VERSION)
  w.byte(file.hashOp)
  w.put(file.timestamp.msg)
  writeTimestamp(w, file.timestamp)
  return w.bytes()
}

/** Every attestation in the tree, with the message it commits to. */
export function leaves(ts: Timestamp): { msg: Bytes; attestation: Attestation; node: Timestamp }[] {
  const out: { msg: Bytes; attestation: Attestation; node: Timestamp }[] = []
  const walk = (t: Timestamp) => {
    for (const attestation of t.attestations) out.push({ msg: t.msg, attestation, node: t })
    for (const { next } of t.ops) walk(next)
  }
  walk(ts)
  return out
}

const sameOp = (a: Op, b: Op) => a.tag === b.tag && equal(a.arg ?? new Uint8Array(), b.arg ?? new Uint8Array())
const sameAttestation = (a: Attestation, b: Attestation) =>
  equal(serializeAttestationKey(a), serializeAttestationKey(b))

function serializeAttestationKey(a: Attestation): Bytes {
  const w = new Writer()
  writeAttestation(w, a)
  return w.bytes()
}

/** Merges `other` (a timestamp for the same message) into `target`, in place. */
export function mergeTimestamp(target: Timestamp, other: Timestamp): void {
  if (!equal(target.msg, other.msg)) throw bad('impossibile unire prove di messaggi diversi')
  for (const a of other.attestations) {
    if (!target.attestations.some((b) => sameAttestation(a, b))) target.attestations.push(a)
  }
  for (const edge of other.ops) {
    const existing = target.ops.find((e) => sameOp(e.op, edge.op))
    if (existing) mergeTimestamp(existing.next, edge.next)
    else target.ops.push(edge)
  }
}

/** Adds an operation edge to `ts` and returns the resulting child timestamp. */
export function addOp(ts: Timestamp, op: Op): Timestamp {
  const existing = ts.ops.find((e) => sameOp(e.op, op))
  if (existing) return existing.next
  const next: Timestamp = { msg: applyOp(op, ts.msg), attestations: [], ops: [] }
  ts.ops.push({ op, next })
  return next
}
