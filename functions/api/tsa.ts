// Cloudflare Pages Function: relays an RFC 3161 TimeStampReq (≈60 bytes containing only a
// SHA-256 hash) to DigiCert's public TSA, which is HTTP-only and sends no CORS headers.
// The request body is never logged or stored.

const UPSTREAM = 'http://timestamp.digicert.com'
const TSQ = 'application/timestamp-query'
const TSR = 'application/timestamp-reply'
const MAX_BODY = 1024
const UPSTREAM_TIMEOUT_MS = 15_000

type Context = { request: Request }

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

/** Reads at most `max` bytes of the body; returns null as soon as it grows past that. */
async function readCapped(request: Request, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const out = new Uint8Array(max)
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return out.slice(0, length)
    if (length + value.length > max) {
      await reader.cancel()
      return null
    }
    out.set(value, length)
    length += value.length
  }
}

export async function onRequestPost({ request }: Context): Promise<Response> {
  const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase()
  if (type !== TSQ) return text(415, 'Content-Type must be application/timestamp-query')

  const declared = Number(request.headers.get('Content-Length') ?? '0')
  if (declared > MAX_BODY) return text(413, 'Request too large')
  const body = await readCapped(request, MAX_BODY)
  if (!body) return text(413, 'Request too large')
  if (body.length < 2 || body[0] !== 0x30) return text(400, 'Body must be a DER-encoded TimeStampReq')

  let upstream: Response
  try {
    upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': TSQ },
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    return text(502, 'Timestamp authority unreachable')
  }
  const upstreamType = (upstream.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase()
  if (!upstream.ok || upstreamType !== TSR) return text(502, 'Timestamp authority error')

  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: { 'Content-Type': TSR, 'Cache-Control': 'no-store' },
  })
}

export async function onRequest({ request }: Context): Promise<Response> {
  if (request.method === 'POST') return onRequestPost({ request })
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
}
