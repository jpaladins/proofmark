import { buildTimeStampReq, parseTimeStampResp, randomNonce, TsaError, type TsaResult } from './rfc3161'

export type RequestTimestampOptions = {
  endpoint?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
  nonce?: bigint
  /** Cancels the request; the promise then rejects with the signal's AbortError. */
  signal?: AbortSignal
}

/** Obtains an RFC 3161 token for a SHA-256 hash through the same-origin relay and checks it covers that hash. */
export async function requestTimestamp(sha256Hex: string, opts: RequestTimestampOptions = {}): Promise<TsaResult> {
  const { endpoint = '/api/tsa', timeoutMs = 20_000, fetchImpl = fetch, nonce = randomNonce(), signal } = opts
  signal?.throwIfAborted()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  let body: Uint8Array
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/timestamp-query' },
      body: buildTimeStampReq(sha256Hex, nonce),
      signal: controller.signal,
    })
    if (!res.ok) throw new TsaError('network', `Il servizio di marca temporale ha risposto ${res.status}.`)
    body = new Uint8Array(await res.arrayBuffer())
  } catch (err) {
    if (err instanceof TsaError) throw err
    signal?.throwIfAborted()
    if (controller.signal.aborted) throw new TsaError('timeout', 'Il servizio di marca temporale non risponde.')
    throw new TsaError('network', 'Impossibile contattare il servizio di marca temporale.')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }

  const result = parseTimeStampResp(new Uint8Array(body))
  if (result.info.imprintHex !== sha256Hex.toLowerCase()) {
    throw new TsaError('mismatch', "La marca temporale ricevuta non corrisponde all'impronta inviata.")
  }
  if (result.info.nonce !== nonce) {
    throw new TsaError('mismatch', 'La marca temporale ricevuta non corrisponde alla richiesta (nonce).')
  }
  return result
}
