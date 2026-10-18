// Content-Security-Policy for the published site. GitHub Pages cannot send custom headers, so the
// build injects it as a <meta http-equiv> tag (vite.config.ts); only meta-compatible directives here.
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://*.opentimestamps.org https://*.eternitywall.com https://blockstream.info",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')
