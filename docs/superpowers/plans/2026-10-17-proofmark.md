# ProofMark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A free Cloudflare Pages web app that certifies the existence of a `.zip` archive with a DigiCert RFC 3161 timestamp and an OpenTimestamps (Bitcoin) anchor, and emits a PAdES-sealed PDF attestation, a JSON certificate and raw `.tsr`/`.ots` proofs. The app also verifies those proofs, offline where possible.

**Architecture:** A static Vite + React SPA does all the work in the browser: hashing in a Web Worker, ASN.1/CMS with pkijs, PDF with pdf-lib, and OpenTimestamps calls straight to the calendars. A single Cloudflare Pages Function (`/api/tsa`) relays the ~60-byte TimeStampReq to `http://timestamp.digicert.com`, because DigiCert is HTTP-only and sends no CORS headers. Core logic lives in framework-free modules under `src/core/`, and the UI under `src/ui/` only orchestrates them.

**Tech Stack:** Vite, React, TypeScript (strict), Tailwind CSS v4 (`@tailwindcss/vite`), lucide-react, hash-wasm, asn1js + pkijs, opentimestamps, pdf-lib + @pdf-lib/fontkit, qrcode, Vitest + @testing-library/react + jsdom, Cloudflare Pages Functions (wrangler for local dev). Use the latest stable versions at install time.

**Spec:** `docs/superpowers/specs/2026-10-17-proofmark-design.md`. The visual reference for the PDF was an HTML mockup (mockup removed).

## Global Constraints

- The ZIP contents never leave the browser. Outbound network goes only to: `/api/tsa` (same origin), the OpenTimestamps calendars (`https://a.pool.opentimestamps.org`, `https://b.pool.opentimestamps.org`, `https://a.pool.eternitywall.com`, `https://ots.btc.catallaxy.com`), and `https://blockstream.info/api` (optional online Bitcoin check). Enforce this with a CSP in `public/_headers`.
- No analytics, no third-party fonts or CDN. Fonts are self-hosted IBM Plex (OFL).
- All UI and PDF copy is in Italian. Forbidden phrases anywhere: "marca temporale qualificata", "data certa ai sensi di legge". The PDF must say the timestamp is **not** qualified under Reg. (UE) 910/2014 (eIDAS).
- Input: exactly one file, extension `.zip` (case-insensitive) **and** magic bytes `50 4B 03 04` or `50 4B 05 06`.
- Optional fields "Autore" and "Titolo dell'opera": max 120 chars each, always labelled "Dati dichiarati dal richiedente — non verificati né certificati".
- Certificate ID: `PM-` + first 12 hex chars of the SHA-256, uppercased + `-` + `YYYYMMDD` of the TSA genTime in UTC. Revision 2 appends `-R2`.
- Error policy: the first DigiCert stamp (on the ZIP) is mandatory. OpenTimestamps and the PDF seal are optional, with a visible warning when they fail.
- While the Bitcoin proof is pending, show the reminder "Tra qualche ora torna su proofmark.pages.dev/verifica, carica l'archivio e questo PDF e scarica l'attestato aggiornato con la conferma Bitcoin." in PDF page 1 (Bitcoin box), PDF page 2 (warnings), and on the site's completion screen.
- Production URL: `https://proofmark.pages.dev`. License MIT. Theme: slate/graphite with emerald (`#047857`) and blue (`#1d4ed8`) accents, light + dark mode, WCAG AA.
- UI tasks (11, 12, 13) invoke the `frontend-design:frontend-design` skill before writing components.

## Review Focus

1. **Multi-GB ZIP:** memory stays flat and the hash matches `certutil`. Pinned in Task 2 (chunk-boundary test and streaming-only implementation).
2. **Wrong file disguised as ZIP** (`foto.zip` that is really a JPEG, or `ARCHIVIO.ZIP` in uppercase): the first is rejected with a clear message, the second is accepted. Pinned in Task 2.
3. **DigiCert down, slow or returning an error/HTML page:** the flow stops with a "Riprova" message and no partial certificate is produced. Pinned in Tasks 4 and 10.
4. **Verifying a ZIP that differs by one byte:** a red "L'impronta non corrisponde" result, never a crash. Pinned in Task 13.
5. **Author/title with characters the font lacks** (emoji, CJK): PDF generation still succeeds, and unsupported glyphs are replaced with `?`. Pinned in Task 8.

---

### Task 1: Project scaffold, branding assets, git and CI

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test/setup.ts`, `src/App.test.tsx`
- Create: `public/icon.svg`, `public/favicon.ico`, `public/_headers`, `scripts/make-favicon.mjs`
- Create: `.gitignore`, `.editorconfig`, `LICENSE` (MIT), `README.md` (skeleton), `.github/workflows/ci.yml`, `wrangler.toml`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview`, `test`, `typecheck`, `lint`, `pages:dev` (`wrangler pages dev dist`); path alias `@/` → `src/`.

- [ ] **Step 1:** `git init -b main` in the project root, then scaffold with `npm create vite@latest . -- --template react-ts` (keep `docs/`). Add Tailwind v4 via `@tailwindcss/vite` and Vitest with `environment: 'jsdom'` and `setupFiles: ['src/test/setup.ts']` (`@testing-library/jest-dom`).
- [ ] **Step 2: Write the failing test** in `src/App.test.tsx`: `render(<App />)` and expect `screen.getByText('ProofMark')` in the document.
- [ ] **Step 3:** Run `npm test -- --run`. Expected: FAIL (the Vite template does not render "ProofMark").
- [ ] **Step 4:** Replace `App.tsx` with a minimal shell that renders "ProofMark". Create `public/icon.svg` from the shield + clock + three hash nodes in the mockup header (mockup removed) (64×64 viewBox, emerald→blue gradient). Write `scripts/make-favicon.mjs` (devDeps `sharp`, `png-to-ico`) that renders the SVG to 16/32/48 px and writes `public/favicon.ico`, then run it once and commit the output. Link both in `index.html`, along with `<html lang="it">`, the title "ProofMark — Prova di esistenza digitale" and a meta description.
- [ ] **Step 5:** Write `public/_headers` with `/*` → `Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://a.pool.opentimestamps.org https://b.pool.opentimestamps.org https://a.pool.eternitywall.com https://ots.btc.catallaxy.com https://blockstream.info; frame-ancestors 'none'`, plus `Referrer-Policy: no-referrer` and `X-Content-Type-Options: nosniff`.
- [ ] **Step 6:** Write `.github/workflows/ci.yml`: on push/PR to `main`, Node LTS, `npm ci`, `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build`. Deployment itself is done by Cloudflare Pages' Git integration, not by this workflow.
- [ ] **Step 7:** Run `npm test -- --run && npm run build`. Expected: PASS, and `dist/` contains `icon.svg`, `favicon.ico` and `_headers`.
- [ ] **Step 8: Commit** `chore: scaffold ProofMark (Vite, React, TS, Tailwind, Vitest, CI)`.

### Task 2: Streaming SHA-256 worker and ZIP validation

**Files:**
- Create: `src/core/hash/sha256.ts`, `src/core/hash/hash.worker.ts`, `src/core/hash/hashFile.ts`, `src/core/zip/isZip.ts`
- Test: `src/core/hash/sha256.test.ts`, `src/core/zip/isZip.test.ts`

**Interfaces:**
- Produces:
  - `sha256Stream(blob: Blob, onProgress?: (bytesDone: number) => void, chunkSize = 16 * 1024 * 1024): Promise<string>` (lowercase hex). Pure and runs in any context; the worker calls it.
  - `hashFile(file: File, onProgress: (p: { bytesDone: number; total: number; mbPerSec: number; etaSec: number }) => void, signal?: AbortSignal): Promise<string>` runs the worker (`new Worker(new URL('./hash.worker.ts', import.meta.url), { type: 'module' })`).
  - `validateZip(file: File): Promise<{ ok: true } | { ok: false; reason: 'extension' | 'signature' | 'empty' }>`.
  - `hexToBytes(hex: string): Uint8Array`, `bytesToHex(b: Uint8Array): string` exported from `sha256.ts`.

- [ ] **Step 1: Write failing tests:**
  - `sha256Stream(new Blob(['abc']))` → `'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'`;
  - empty blob → `'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'`;
  - **chunk boundary:** a 1,000,003-byte blob with `chunkSize = 4096` equals `crypto.subtle.digest` of the same bytes, and `onProgress` is called with a final value of 1,000,003.
- [ ] **Step 2: Write failing tests for `validateZip`:**
  - `new File([PK0304 + 'x'], 'a.zip')` → ok;
  - `'ARCHIVIO.ZIP'` with PK0304 → ok;
  - `'b.zip'` beginning with `FF D8 FF` → `{ok:false, reason:'signature'}`;
  - `'c.rar'` → `'extension'`;
  - 0 bytes → `'empty'`;
  - `'d.zip'` with `PK0506` (empty archive) → ok.
- [ ] **Step 3:** Run `npm test -- --run src/core`. Expected: FAIL (modules missing).
- [ ] **Step 4:** Implement with `createSHA256()` from `hash-wasm`. Read `blob.slice(off, off + chunkSize).arrayBuffer()` in a loop and never hold the whole file in memory. `validateZip` reads only the first 4 bytes. The worker posts `{type:'progress', bytesDone}` at most every 100 ms and `{type:'done', hex}` / `{type:'error', message}` at the end. `hashFile` computes MB/s and ETA.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6: Commit** `feat(core): streaming SHA-256 worker and ZIP validation`.

### Task 3: RFC 3161 request/response codec with real DigiCert fixtures

**Files:**
- Create: `scripts/make-fixtures.sh`, `src/core/tsa/rfc3161.ts`, `src/core/trust/digicert-trusted-root-g4.pem`, `src/core/trust/index.ts`
- Create (generated): `src/test/fixtures/data.bin`, `src/test/fixtures/data.tsq`, `src/test/fixtures/data.tsr`, `src/test/fixtures/data.sha256`
- Test: `src/core/tsa/rfc3161.test.ts`

**Interfaces:**
- Produces:
  - `buildTimeStampReq(sha256Hex: string, nonce: bigint): Uint8Array` (DER, SHA-256 OID `2.16.840.1.101.3.4.2.1`, `certReq: true`).
  - `randomNonce(): bigint` (64-bit, from `crypto.getRandomValues`).
  - `parseTimeStampResp(der: Uint8Array): TsaResult`, which throws `TsaError` with `code: 'rejected' | 'malformed'`.
  - `type TsaResult = { token: Uint8Array; info: TokenInfo }`
  - `type TokenInfo = { tsa: string; genTime: Date; serialHex: string; policy: string; nonce?: bigint; imprintHex: string; hashAlg: string }`
  - `parseTimeStampToken(token: Uint8Array): TokenInfo` (`tsa` = CN of the signer certificate).
  - `DIGICERT_ROOT_G4: string` (PEM) from `src/core/trust/index.ts`.

- [ ] **Step 1:** Write `scripts/make-fixtures.sh` (bash, using the openssl and curl that ship with Git for Windows):
  - write `data.bin` = `"ProofMark fixture\n"`;
  - `openssl ts -query -data data.bin -sha256 -cert -out data.tsq`;
  - `curl -sS -H 'Content-Type: application/timestamp-query' --data-binary @data.tsq http://timestamp.digicert.com -o data.tsr`;
  - write the hex digest to `data.sha256`;
  - download `https://cacerts.digicert.com/DigiCertTrustedRootG4.crt`, convert it to PEM, and **abort unless** its SHA-256 fingerprint equals `55:2F:7B:DC:F1:A7:AF:9E:6C:E6:72:01:7F:4F:12:AB:F7:72:40:C7:8E:76:1A:C2:03:D1:D9:D2:0A:C8:99:88` (cross-check this value on digicert.com's root certificates page before committing).
  - Run the script once and commit its outputs.
- [ ] **Step 2: Write failing tests:**
  - `buildTimeStampReq(hex, 42n)` parsed back with `pkijs.TimeStampReq.fromBER` has version 1, imprint equal to `hex`, nonce 42 and certReq true;
  - `parseTimeStampResp(fixture data.tsr)` returns `info.imprintHex === data.sha256`, `info.tsa` contains `'DigiCert'`, `info.hashAlg === 'SHA-256'`, and a `genTime` that is a valid Date;
  - a response with status `rejection` (build one with asn1js: `PKIStatusInfo{status:2}`) throws `TsaError` code `'rejected'`;
  - random bytes throw `'malformed'`.
- [ ] **Step 3:** Run them. Expected: FAIL.
- [ ] **Step 4:** Implement with `pkijs` (`TimeStampReq`, `TimeStampResp`, `ContentInfo`, `SignedData`, `TSTInfo`) and `asn1js`. Call `pkijs.setEngine` with the WebCrypto engine once in `src/core/trust/index.ts`.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6: Commit** `feat(core): RFC 3161 codec with DigiCert fixtures`.

### Task 4: `/api/tsa` Pages Function and client

**Files:**
- Create: `functions/api/tsa.ts`, `src/core/tsa/client.ts`
- Test: `functions/api/tsa.test.ts`, `src/core/tsa/client.test.ts`

**Interfaces:**
- Consumes: `buildTimeStampReq`, `randomNonce`, `parseTimeStampResp` (Task 3).
- Produces:
  - `onRequestPost(ctx: { request: Request }): Promise<Response>` and `onRequest` (returns 405 for other methods) in `functions/api/tsa.ts`;
  - `requestTimestamp(sha256Hex: string, opts?: { endpoint?: string; timeoutMs?: number; fetchImpl?: typeof fetch; nonce?: bigint }): Promise<TsaResult>`. Defaults: endpoint `/api/tsa`, timeout 20000. It throws `TsaError` with code `'network' | 'timeout' | 'rejected' | 'malformed' | 'mismatch'`.

- [ ] **Step 1: Write failing function tests** (stub `globalThis.fetch`):
  - GET → 405;
  - POST with wrong content-type → 415;
  - body of 1025 bytes → 413;
  - body starting with `0x31` → 400;
  - a valid body is forwarded to `http://timestamp.digicert.com` with `Content-Type: application/timestamp-query` and returned with `Content-Type: application/timestamp-reply` and `Cache-Control: no-store`;
  - an upstream 5xx or a non-`application/timestamp-reply` upstream → 502.
- [ ] **Step 2: Write failing client tests** (with `fetchImpl` injected):
  - fixture `data.tsr` resolves when the requested hash equals `data.sha256` and the nonce matches;
  - an imprint mismatch → `'mismatch'`;
  - the fetch rejects → `'network'`;
  - a never-resolving fetch with `timeoutMs: 50` → `'timeout'`;
  - an HTML body → `'malformed'`.
  - For the nonce check, tests pass `opts.nonce` read from the fixture with `parseTimeStampToken`, because the fixture's nonce comes from openssl. Otherwise `requestTimestamp` uses `randomNonce()`.
- [ ] **Step 3:** Run them. Expected: FAIL.
- [ ] **Step 4:** Implement. The function never logs the body, uses a 15 s upstream `AbortSignal.timeout`, and has no CORS headers (same origin). The client verifies `imprintHex === sha256Hex` and, when present, `nonce === sent`.
- [ ] **Step 5:** Run the tests. Expected: PASS. Manual check: `npm run build && npm run pages:dev`, then `curl --data-binary @src/test/fixtures/data.tsq -H 'Content-Type: application/timestamp-query' localhost:8788/api/tsa -o out.tsr && openssl ts -reply -in out.tsr -text` shows `Status: Granted`.
- [ ] **Step 6: Commit** `feat: DigiCert TSA relay function and client`.

### Task 5: Offline token verification

**Files:**
- Create: `src/core/verify/verifyToken.ts`
- Test: `src/core/verify/verifyToken.test.ts`

**Interfaces:**
- Consumes: `parseTimeStampToken`, `DIGICERT_ROOT_G4`.
- Produces:
  - `type Check = { id: 'hash' | 'imprint' | 'signature' | 'chain' | 'ots-hash' | 'bitcoin' | 'pdf-seal'; status: 'ok' | 'warn' | 'fail'; label: string; detail?: string }`
  - `verifyTimestampToken(token: Uint8Array, expectedSha256Hex: string, opts?: { trustPem?: string }): Promise<Check[]>` (default trust = `DIGICERT_ROOT_G4`), which returns the checks `imprint`, `signature` and `chain`.

- [ ] **Step 1: Write failing tests:**
  - the fixture token plus `data.sha256` gives all three checks `ok`;
  - a wrong expected hash gives `imprint` `fail` with label "L'impronta del token non corrisponde all'archivio";
  - a token with one byte flipped inside the signature value gives `signature` `fail` and no throw;
  - verifying with a trust store containing an unrelated self-signed cert (test-only parameter `trustPem`) gives `chain` `fail`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement with `SignedData.verify({ signer: 0, checkChain: true, trustedCerts: [root], data: undefined, extendedMode: true })` and `checkDate` = the token genTime. The DigiCert token also carries a G4 cross-certificate issued by "DigiCert Assured ID Root CA". If pkijs picks that path and fails, retry with `CertificateChainValidationEngine`, passing only the TSA leaf + intermediate (filter out certificates whose subject equals the G4 root subject but are not self-signed).
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): offline RFC 3161 token verification`.

### Task 6: OpenTimestamps adapter

**Files:**
- Create: `src/core/ots/ots.ts`, `src/types/opentimestamps.d.ts`
- Create (fixture): `src/test/fixtures/hello-world.txt`, `src/test/fixtures/hello-world.txt.ots` (copied from the `opentimestamps` npm package's `examples/` directory; Bitcoin-confirmed in block 358391)
- Test: `src/core/ots/ots.test.ts`

**Interfaces:**
- Produces:
  - `OTS_CALENDARS: string[]` (the four URLs in Global Constraints);
  - `stampHash(sha256Hex: string): Promise<Uint8Array>`;
  - `inspectOts(ots: Uint8Array): OtsInfo`;
  - `type OtsInfo = { digestHex: string; status: 'pending' | 'confirmed'; calendars: string[]; block?: number }`;
  - `upgradeOts(ots: Uint8Array): Promise<{ ots: Uint8Array; changed: boolean }>`;
  - `verifyOtsOnline(ots: Uint8Array): Promise<{ block: number; blockTime: Date } | null>` (Bitcoin block headers come from `https://blockstream.info/api`).

- [ ] **Step 1: Spike the import.** Add `opentimestamps` and check that `import OpenTimestamps from 'opentimestamps'` bundles under Vite and runs in the browser (`npm run build` plus a dev-page `console.log(OpenTimestamps.DetachedTimestampFile)`). If it needs Node built-ins, add `vite-plugin-node-polyfills` (buffer, crypto, stream). If it still fails, load the package's prebuilt browser bundle (`opentimestamps.min.js`) via `?url` and a dynamic `<script>`. Record the approach used in a comment at the top of `ots.ts`.
- [ ] **Step 2: Write failing tests:**
  - `inspectOts(hello-world.txt.ots)` has `digestHex` = SHA-256 of `hello-world.txt`, `status: 'confirmed'`, `block: 358391`;
  - `stampHash` with a mocked calendar fetch (record one real calendar response as a fixture `calendar-response.bin`, or mock at the library's HTTP layer) returns bytes whose `inspectOts` gives `status: 'pending'` and the same digest;
  - an invalid ots throws `OtsError('malformed')`.
- [ ] **Step 3:** Run them. Expected: FAIL.
- [ ] **Step 4:** Implement with `DetachedTimestampFile.fromHash(new Ops.OpSHA256(), bytes)`, `OpenTimestamps.stamp(detached, { calendars: OTS_CALENDARS })`, `OpenTimestamps.upgrade` and `OpenTimestamps.verify`. Use Blockstream for headers.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6: Commit** `feat(core): OpenTimestamps adapter`.

### Task 7: Certificate model and JSON

**Files:**
- Create: `src/core/cert/certificate.ts`
- Test: `src/core/cert/certificate.test.ts`

**Interfaces:**
- Consumes: `TokenInfo`, `OtsInfo`, `bytesToHex`.
- Produces:
  - ```ts
    type Certificate = {
      schema: 'proofmark/v1'; id: string; revision: 1 | 2; createdAt: string;
      declared?: { author?: string; title?: string; note: 'dichiarati dal richiedente, non certificati' };
      file: { name: string; size: number; lastModified: string; sha256: string };
      rfc3161: { tsa: string; genTime: string; serial: string; policy: string; nonce?: string; tokenBase64: string };
      opentimestamps: { status: 'pending' | 'confirmed' | 'unavailable'; calendars: string[]; otsBase64?: string; block?: number; blockTime?: string };
      app: { version: string; url: 'https://proofmark.pages.dev' };
    }
    ```
  - `makeCertificateId(sha256Hex: string, genTime: Date, revision: 1 | 2): string`
  - `buildCertificate(input: { file: File; sha256: string; tsa: TsaResult; ots?: Uint8Array; otsInfo?: OtsInfo; declared?: { author?: string; title?: string } }): Certificate`
  - `upgradeCertificate(cert: Certificate, ots: Uint8Array, confirmed: { block: number; blockTime: Date }): Certificate` (revision 2, id with `-R2`)
  - `serializeCertificate(c: Certificate): string` (2-space JSON)
  - `parseCertificate(json: string): Certificate`, which throws `CertError('schema' | 'json')`

- [ ] **Step 1: Write failing tests:**
  - `makeCertificateId('9f2c41a7e03b…', new Date('2026-10-17T16:20:58Z'), 1)` → `'PM-9F2C41A7E03B-20261017'`, and revision 2 → `'…-20261017-R2'`;
  - `declared` is omitted when both fields are blank, and values are trimmed and cut to 120 chars;
  - parse(serialize(c)) deep-equals c;
  - `parseCertificate('{"schema":"other"}')` throws `'schema'`;
  - `upgradeCertificate` sets `status: 'confirmed'` and the block, and keeps `rfc3161` unchanged.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Validation in `parseCertificate` is hand-written (no schema library); it checks the required fields and their types.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): certificate model and JSON`.

### Task 8: PDF attestation renderer and attachment reader

**Files:**
- Create: `src/core/pdf/renderAttestato.ts`, `src/core/pdf/layout.ts` (drawing helpers: section headers, key/value rows, boxes, wrapped text), `src/core/pdf/copy.ts` (all Italian strings), `src/core/pdf/fonts.ts`, `src/core/pdf/attachments.ts`
- Create: `src/assets/fonts/IBMPlexSans-{Regular,Medium,SemiBold}.ttf`, `IBMPlexSerif-SemiBold.ttf`, `IBMPlexMono-{Regular,Medium}.ttf` (copied from the `@ibm/plex` npm package, OFL), plus `src/assets/fonts/OFL.txt`
- Test: `src/core/pdf/renderAttestato.test.ts`

**Interfaces:**
- Consumes: `Certificate`, `qrcode`.
- Produces:
  - `renderAttestato(cert: Certificate, proofs: { tsr: Uint8Array; ots?: Uint8Array }, opts?: { sealPlaceholder?: boolean }): Promise<PDFDocument>`. It returns the **unsaved** `PDFDocument`, so Task 9 can add the seal before saving. It attaches `prova.tsr`, `prova.ots` (if present) and `certificato.json`.
  - `extractAttachments(pdf: Uint8Array): Promise<Record<string, Uint8Array>>` reads the `/Names /EmbeddedFiles` tree.
  - `verifyUrl(sha256Hex: string): string` → `https://proofmark.pages.dev/verifica#sha256=<hex>`.

- [ ] **Step 1: Write failing tests:**
  - a sample pending certificate renders 2 pages, A4 (595.28×841.89);
  - `extractAttachments(await doc.save())` has keys `prova.tsr`, `prova.ots` and `certificato.json`, and `certificato.json` parses to the same id;
  - the title metadata is `'Attestato di Esistenza Digitale — PM-…'`;
  - a confirmed revision-2 certificate renders without the pending reminder (assert via `copy.ts`: the renderer calls `drawPendingReminder` only for `status === 'pending'`; spy on the exported helper);
  - **Review Focus 5:** author `'Zoë Łukasz 😀 山田'` renders without throwing;
  - `copy.ts` contains neither "marca temporale qualificata" nor "data certa ai sensi di legge" (string scan).
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement, reproducing the visual mockup (mockup removed) section by section: header with logo (draw the icon as vector paths), ID and issue date (Europe/Rome via `Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome' })`); title; green existence box + QR (`qrcode.toDataURL`, error correction M, embedded PNG); 1 Dati dichiarati (only if present); 2 Oggetto, with the hash in 8-char groups in Plex Mono; 3 RFC 3161 and 4 Bitcoin side by side, with the amber reminder box when pending; 5 Dichiarazione; page 2: 6 Come verificare (the commands from the mockup (mockup removed), with the real file name and hash), 7 Avvertenze (pending reminder first when pending), 8 Natura e limiti; footer on both pages. Take all copy from the mockup (mockup removed), put it in `copy.ts`, and use status "Stato all'emissione" for revision 1. Sanitise text with `font.hasGlyph`-style filtering (use `fontkit`'s `font.glyphForCodePoint(cp).id === 0` → `?`).
- [ ] **Step 4:** Run the tests. Expected: PASS. Then write a dev-only script `scripts/render-sample.ts` (run with `npx tsx`) that saves `out/sample.pdf`, open it in the browser pane and compare it with the mockup (mockup removed) by eye.
- [ ] **Step 5: Commit** `feat(pdf): attestation renderer with embedded proofs`.

### Task 9: PAdES document timestamp (seal) and seal verification

**Files:**
- Create: `src/core/pdf/pades.ts`, `src/test/testTsa.ts` (test-only: pkijs self-signed CA + TSA cert; `makeTestTsa(): Promise<{ trustPem: string; timestamp(sha256Hex): Promise<{ token: Uint8Array }> }>` that signs a real TSTInfo)
- Test: `src/core/pdf/pades.test.ts`

**Interfaces:**
- Consumes: `renderAttestato` (unsaved `PDFDocument`), `requestTimestamp`-shaped function, `parseTimeStampToken`, `verifyTimestampToken`.
- Produces:
  - `sealPdf(doc: PDFDocument, timestamp: (sha256Hex: string) => Promise<{ token: Uint8Array }>): Promise<Uint8Array>`
  - `verifyPdfSeal(pdf: Uint8Array, opts?: { trustPem?: string }): Promise<Check>` returns id `'pdf-seal'`: `ok` if the ByteRange covers the whole file except `/Contents` and the token imprint equals SHA-256 of the covered bytes, `warn` if there is no seal, `fail` otherwise.

- [ ] **Step 1: Write failing tests** (using `makeTestTsa()`, which also captures the requested hash):
  - the sealed PDF contains `/Type /DocTimeStamp`, `/SubFilter /ETSI.RFC3161` and a `/ByteRange [0 a b c]` with `b + c === pdf.length` and `pdf[a] === 0x3c` ('<');
  - the captured hash equals the SHA-256 of `pdf[0..a) ‖ pdf[b..b+c)`;
  - `verifyPdfSeal(pdf, { trustPem })` → `ok`;
  - an unsealed PDF → `warn`;
  - a sealed PDF with one byte changed inside the covered range → `fail`;
  - `extractAttachments` still works on the sealed PDF.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement this algorithm (not determined by the tests):
  ```
  1. In doc: create a /Sig value dict { /Type /DocTimeStamp /Filter /Adobe.PPKLite /SubFilter /ETSI.RFC3161
     /ByteRange [0 /********** /********** /**********]  (fixed-width placeholder)
     /Contents <000…0> (16384 bytes → 32768 hex zeros) }
     a widget annotation /FT /Sig /T (ProofMark) /Rect [0 0 0 0] /F 132 /P page1 /V sigDict,
     added to page1 /Annots and to AcroForm { /Fields [widget] /SigFlags 3 }.
  2. bytes = await doc.save({ useObjectStreams: false })
  3. Locate "/Contents <" of the sig dict → a = index of '<', b = index after matching '>'.
  4. Write ByteRange "[0 a b len-b]" into the placeholder, padded with spaces to the same width.
  5. hash = sha256(bytes[0..a) ‖ bytes[b..len)); token = await timestamp(hash)
  6. If token hex > 32768 chars throw; else write hex (uppercase) into the Contents, right-padded with '0'.
  ```
- [ ] **Step 4:** Run the tests. Expected: PASS. Manual: seal `out/sample.pdf` via the real `/api/tsa` (`pages:dev`) and open it in Adobe Acrobat Reader. The signature panel must show a valid timestamp by DigiCert. **The human partner checks this in Acrobat**, because the chain to G4 may show as "unknown" until Acrobat's AATL updates. Note the result in the PR.
- [ ] **Step 5: Commit** `feat(pdf): PAdES DocTimeStamp seal and verification`.

### Task 10: Certification flow (state machine)

**Files:**
- Create: `src/flow/certify.ts`, `src/flow/useCertify.ts`
- Test: `src/flow/certify.test.ts`

**Interfaces:**
- Consumes: `hashFile`, `requestTimestamp`, `stampHash`, `inspectOts`, `buildCertificate`, `renderAttestato`, `sealPdf`, `serializeCertificate`.
- Produces:
  - `type StepId = 'hash' | 'tsa' | 'ots' | 'cert'`
  - `type StepState = { status: 'idle' | 'active' | 'done' | 'warn' | 'error'; message?: string; progress?: number }`
  - `type CertifyResult = { certificate: Certificate; pdf: Uint8Array; pdfSealed: boolean; json: string; tsr: Uint8Array; ots?: Uint8Array; reminderAfter?: Date }`
  - `runCertification(input: { file: File; declared?: { author?: string; title?: string } }, deps: CertifyDeps, onStep: (id: StepId, s: StepState) => void, signal?: AbortSignal): Promise<CertifyResult>`. `CertifyDeps` bundles the consumed functions so tests can inject fakes.
  - `useCertify(): { steps: Record<StepId, StepState>; result?: CertifyResult; error?: string; start(file, declared): void; retry(): void; reset(): void }`. `retry` resumes from the failed step and reuses the hash.

- [ ] **Step 1: Write failing tests** with fake deps:
  - happy path: steps go `hash active → done → tsa done → ots done → cert done`, `pdfSealed: true`, `reminderAfter` = genTime + 3 h;
  - **Review Focus 3:** TSA throws `TsaError('timeout')` → `tsa: error` with message "DigiCert non risponde. Riprova tra qualche istante.", no result, and `ots`/`cert` stay `idle`;
  - OTS throws → `ots: warn` ("Ancoraggio Bitcoin non disponibile: potrai aggiungerlo dalla sezione Verifica"), the certificate is still produced with `opentimestamps.status: 'unavailable'`;
  - the seal fails → `cert: warn`, `pdfSealed: false`, and the PDF is the unsealed save;
  - abort during hash → rejects with `AbortError` and no further deps are called.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Error messages come from a single map `TSA_ERROR_COPY: Record<TsaError['code'], string>` in `certify.ts`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(flow): certification state machine`.

### Task 11: Design system, layout, header and routing

Invoke `frontend-design:frontend-design` first. The aesthetic is enterprise/fintech (Vercel/Stripe/Proton), consistent with the mockup (mockup removed).

**Files:**
- Create: `src/ui/theme.ts` (light/dark tokens as CSS variables in `src/index.css` via Tailwind v4 `@theme`), `src/ui/useTheme.ts`, `src/ui/router.ts`, `src/ui/components/{Header,Button,Card,Badge,Alert,ThemeToggle,Logo}.tsx`, `src/ui/pages/{CertifyPage,VerifyPage}.tsx` (stubs), `src/ui/Layout.tsx`
- Modify: `src/App.tsx`
- Test: `src/ui/ui.test.tsx`

**Interfaces:**
- Produces:
  - `useRoute(): { path: '/' | '/verifica'; navigate(p): void; hashParams: URLSearchParams }`, based on the History API, with unknown paths falling back to `/`. Cloudflare Pages serves `index.html` for unknown paths when there is no `404.html`.
  - `useTheme(): { theme: 'light' | 'dark' | 'system'; setTheme }` persisted in `localStorage` key `pm-theme`, with try/catch.
  - Components: `Button` (`variant: 'primary' | 'secondary' | 'ghost'`), `Alert` (`tone: 'info' | 'success' | 'warning' | 'danger'`), `Badge`, `Card`.

- [ ] **Step 1: Write failing tests:**
  - the header shows "ProofMark" and the badge text "Zero-Knowledge: i file vengono elaborati solo nel tuo browser";
  - the nav links "Certifica" and "Verifica" switch the page (the heading changes) and update `location.pathname`;
  - `ThemeToggle` adds/removes the `dark` class on `<html>`;
  - `/verifica#sha256=abc` exposes `hashParams.get('sha256') === 'abc'`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Requirements: keyboard focus rings, `prefers-reduced-motion` respected, AA contrast in both themes, lucide-react icons.
- [ ] **Step 4:** Run the tests. Expected: PASS, then check visually in the browser pane (`npm run dev`) in both themes and at 375 px.
- [ ] **Step 5: Commit** `feat(ui): design system, header, routing, theming`.

### Task 12: Certify page (fields, DropZone, Stepper, result card)

Invoke `frontend-design:frontend-design` first.

**Files:**
- Create: `src/ui/components/{DeclaredFields,DropZone,Stepper,CertificateCard,CopyButton,PendingBanner}.tsx`, `src/ui/download.ts`, `src/ui/ics.ts`
- Modify: `src/ui/pages/CertifyPage.tsx`
- Test: `src/ui/certify.test.tsx`, `src/ui/ics.test.ts`

**Interfaces:**
- Consumes: `useCertify`, `validateZip`, `CertifyResult`.
- Produces:
  - `downloadBytes(bytes: Uint8Array | string, filename: string, mime: string): void`
  - `buildReminderIcs(opts: { at: Date; certId: string; fileName: string }): string`
  - Download file names: `<base>_attestato.pdf`, `<base>_certificato.json`, `<base>.tsr`, `<base>.ots`, where `<base>` is the ZIP name without `.zip`.

- [ ] **Step 1: Write failing tests:**
  - dropping `foto.zip` that holds JPEG bytes shows the rejected state with "Il file non è un archivio ZIP valido" and does not call `start`;
  - dropping `foto.png` shows "Carica un file .zip";
  - a valid zip calls `start(file, { author, title })` with the trimmed field values;
  - author longer than 120 chars is blocked by `maxLength` and a counter is shown;
  - the stepper renders the 4 labels "Calcolo Hash", "Marca DigiCert", "Ancoraggio Bitcoin", "Certificato Generato" with `aria-current="step"` on the active step;
  - the result card shows the hash, a copy button (mock `navigator.clipboard.writeText` called with the hash) and the 4 download buttons;
  - `PendingBanner` is shown when `ots` status is pending, with the global reminder text and the time "dopo le HH:MM circa";
  - `buildReminderIcs` contains `BEGIN:VCALENDAR`, `DTSTART:` in UTC basic format, `SUMMARY:ProofMark — conferma Bitcoin` and the URL `https://proofmark.pages.dev/verifica`;
  - the "Conserva l'archivio esattamente com'è" warning is always visible on the result card.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. DropZone states: idle, hover, drag-over, accepted, rejected (shake animation disabled under reduced motion). The stepper shows progress %, MB/s and ETA during hashing, and a "Riprova" button on error.
- [ ] **Step 4:** Run the tests. Expected: PASS. Then do a manual end-to-end check with `npm run build && npm run pages:dev`: certify a real small ZIP, download all 4 files, run `certutil -hashfile x.zip SHA256` and compare, and run `openssl ts -verify -digest <hash> -in x.tsr -CAfile src/core/trust/digicert-trusted-root-g4.pem` → `Verification: OK`.
- [ ] **Step 5: Commit** `feat(ui): certification page`.

### Task 13: Verify page and revision-2 attestation

Invoke `frontend-design:frontend-design` first.

**Files:**
- Create: `src/flow/verify.ts`, `src/ui/components/{VerifySlots,CheckList}.tsx`
- Modify: `src/ui/pages/VerifyPage.tsx`
- Test: `src/flow/verify.test.ts`, `src/ui/verify.test.tsx`

**Interfaces:**
- Consumes: `hashFile`, `parseCertificate`, `extractAttachments`, `verifyTimestampToken`, `verifyPdfSeal`, `inspectOts`, `upgradeOts`, `verifyOtsOnline`, `upgradeCertificate`, `renderAttestato`, `sealPdf`.
- Produces:
  - `loadEvidence(file: File): Promise<{ cert: Certificate; tsr: Uint8Array; ots?: Uint8Array; pdf?: Uint8Array }>` accepts `.json` or `.pdf` and throws `EvidenceError('format' | 'missing')`.
  - `verifyOffline(zipSha256: string, ev): Promise<Check[]>` returns, in order, `hash`, `imprint`, `signature`, `chain`, `ots-hash` and, if a PDF was given, `pdf-seal`.
  - `checkBitcoin(ev): Promise<{ check: Check; upgraded?: { ots: Uint8Array; block: number; blockTime: Date } }>`
  - `buildRevision2(ev, upgraded): Promise<{ pdf: Uint8Array; json: string; ots: Uint8Array }>`

- [ ] **Step 1: Write failing flow tests:**
  - the matching hash plus fixture evidence gives `hash: ok`;
  - **Review Focus 4:** a hash differing in one char gives `hash: fail` labelled "L'impronta non corrisponde: l'archivio è diverso da quello certificato", and the remaining checks still run;
  - a PDF without `prova.tsr` → `EvidenceError('missing')`;
  - a `.txt` evidence file → `'format'`;
  - pending ots with upgrade unchanged → `bitcoin: warn` "Conferma non ancora disponibile, riprova tra qualche ora";
  - an upgraded ots plus `verifyOtsOnline` → `bitcoin: ok` "Confermato nel blocco #N del <data>" and `upgraded` set;
  - `buildRevision2` gives a certificate id ending in `-R2` and `revision: 2`.
- [ ] **Step 2: Write failing UI tests:**
  - two slots labelled "1. Archivio .zip" and "2. Attestato PDF o certificato JSON";
  - the "Verifica" button is disabled until both are filled;
  - with `#sha256=<hex>` in the URL, the expected hash is pre-shown, and dropping only the ZIP compares against it;
  - the results render as a list with a status icon and a text label for each check (not colour alone);
  - the "Scarica attestato aggiornato" button appears only when `upgraded` is set.
- [ ] **Step 3:** Run them. Expected: FAIL.
- [ ] **Step 4:** Implement. The offline checks run without the network. The Bitcoin check runs only when the user clicks "Controlla conferma Bitcoin (richiede connessione)".
- [ ] **Step 5:** Run the tests. Expected: PASS. Manual: verify the files downloaded in Task 12, then modify one byte of the ZIP and confirm the red result.
- [ ] **Step 6: Commit** `feat: verification page and revision-2 attestation`.

### Task 14: README, deployment and final verification

**Files:**
- Modify: `README.md`
- Create: `docs/DEPLOY.md`

- [ ] **Step 1:** Write `README.md` with:
  - badges: CI (`github.com/<user>/proofmark/actions/workflows/ci.yml/badge.svg`), license MIT, "Cloudflare Pages" deploy status, "Zero-Knowledge";
  - a one-paragraph description and a live demo link `https://proofmark.pages.dev`;
  - an architecture diagram (the spec's §6 ASCII);
  - how the proofs work;
  - local development (`npm ci`, `npm run dev`, `npm run build && npm run pages:dev` for the TSA function);
  - independent verification commands;
  - limits (not eIDAS-qualified);
  - license.
- [ ] **Step 2:** Write `docs/DEPLOY.md` with the user-run steps:
  - `gh repo create proofmark --public --source . --remote origin --push`, or the manual `git remote add origin https://github.com/<user>/proofmark.git && git push -u origin main`;
  - in the Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick the repo, framework preset "Vite", build `npm run build`, output `dist`, project name `proofmark`;
  - Security → WAF → Rate limiting rule: path `/api/tsa`, 20 requests / 1 minute per IP, action Block;
  - checking the site at `https://proofmark.pages.dev`.
- [ ] **Step 3:** Final verification:
  - run `npm run typecheck && npm run lint && npm test -- --run && npm run build`. Expected: all green;
  - with `npm run pages:dev`, run the full flow in the browser pane: certify, download, verify OK, then a one-byte change gives FAIL;
  - check the CSP: the console shows no violations, and the network panel shows requests only to the allowed origins;
  - confirm that a 2 GB ZIP hashes without increasing memory (the human partner can run this locally).
- [ ] **Step 4: Commit** `docs: README and deployment guide`.
