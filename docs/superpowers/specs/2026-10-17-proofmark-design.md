# ProofMark — Design document

*Date: 2026-10-17 · Status: awaiting final approval*

## 1. Intent

ProofMark is a free web app that lets anyone prove that a `.zip` archive existed on a certain date, for the purpose of proving prior existence (authorship, plagiarism disputes). It is used from a link, with nothing to install. The file never leaves the user's computer: only the SHA-256 fingerprint leaves the browser.

The result must be credible to a lawyer or a client. The reference is the report supplied by the user (`Verbale_Acquisizione_Forense_yngbrb.pdf`), a PDF with a DigiCert RFC 3161 timestamp embedded as a PAdES signature (`/DocTimeStamp`, `SubFilter /ETSI.RFC3161`), which Acrobat shows as a valid signature.

## 2. Goals

1. Upload of **a single `.zip` file** (drag & drop or selection). The archive is certified as a whole, without listing its contents.
   Optional fields **"Author"** and **"Title of the work"** (free text, max 120 characters each), reported in the PDF and in the JSON as **declared by the user and not certified**.
2. SHA-256 computed in the browser, in a Web Worker, as a stream: it must work beyond 1 GB without freezing the interface.
3. Double timestamp anchoring:
   - **DigiCert TSA (RFC 3161)** on the ZIP hash.
   - **OpenTimestamps (Bitcoin)** on the ZIP hash.
4. Downloadable outputs:
   - A professional **PDF attestation**, with a verification QR code and the DigiCert timestamp embedded as a PAdES signature on the PDF itself, as in the report.
   - A machine-readable **JSON certificate**.
   - The raw **`.tsr`** (RFC 3161 token) and **`.ots`** (OpenTimestamps proof) files, for independent verification with `openssl` and `ots`.
5. A **"Verify"** section with two slots (original ZIP + JSON or PDF certificate): it recomputes the hash and checks the cryptographic proofs without a network. The full Bitcoin check, optional, requires the network.
6. An enterprise/fintech-grade interface, in Italian, with light/dark theme, accessible (WCAG AA).
7. Zero cost for whoever publishes and for whoever uses it.

## 3. Non-goals

- No accounts, login, database or server-side storage.
- No list of the files contained in the ZIP (user's choice: the PDF must stay light).
- No desktop app for now. Windows will be evaluated later, so the code must be kept packageable with Tauri.
- No personal digital signature of the author (CNS/SPID/qualified signature).

## 4. Anti-goals (failure even if it "works")

- **The file or its contents leave the browser**, even partially or through telemetry.
- **The PDF or the interface promise more than the proof is worth.** DigiCert's public TSA is *not* an eIDAS qualified timestamp nor an AgID-accredited service. The texts must speak of "proof of existence / prior existence" and "RFC 3161 timestamp", never of "qualified timestamp" or "certain date in the eyes of the law". A limitations section must be written in plain terms.
- **The user does not understand that they must keep the ZIP byte for byte.** If they recompress the files, the hash changes and the proof is no longer valid. The warning must be clearly visible both on the final screen and in the PDF.
- **Money is spent.** Everything must fit in the free tiers.

## 5. Constraints and choices already agreed with the user

| Topic | Decision |
|---|---|
| Platform | Web app on **Cloudflare Pages** (free tier). Instead of GitHub Pages, which does not allow server-side code. |
| DigiCert forwarding | A **Pages Function** on the same domain forwards only the `TimeStampReq` (~60 bytes with the hash) to `http://timestamp.digicert.com`. Needed because DigiCert only works over HTTP and does not enable CORS. |
| Input | A `.zip` file only. |
| PDF content | Delegated to the builder: "as professional as possible". See §7. |
| Stack | Vite + React + TypeScript + Tailwind CSS + Lucide React (from the original request). |
| Repository | GitHub, with a professional README, badges and a link to the demo. |

## 6. Architecture

```
Browser (all the work)                         Cloudflare Pages
┌───────────────────────────────────┐          ┌──────────────────────────────┐
│ React UI                          │          │ static assets (dist/)        │
│  ├─ DropZone (.zip only)          │          │                              │
│  ├─ hash.worker.ts (SHA-256 stream)│         │ functions/api/tsa.ts         │
│  ├─ tsa.ts  ── TimeStampReq ──────┼── POST ─▶│  validates, forwards ────────┼──▶ timestamp.digicert.com (HTTP)
│  ├─ ots.ts  ── direct (CORS ok) ──┼──────────┼──────────────────────────────┼──▶ OpenTimestamps calendars
│  ├─ pdf/   (pdf-lib + PAdES)      │          └──────────────────────────────┘
│  └─ verify/ (pkijs, offline)      │
└───────────────────────────────────┘
```

### 6.1 Hashing

- Dedicated Web Worker. It reads the `File` in chunks (`file.stream()` or 8–16 MB slices) and sends progress to the UI (percentage, MB/s, estimated time).
- **Technical note:** the Web Crypto API's `crypto.subtle.digest` is not incremental and would require the whole file in memory, so it cannot handle files larger than 1 GB. For streaming, **`hash-wasm`** (SHA-256 in WASM, incremental) is used. *Builder's choice.* A startup self-test can be added that compares the `hash-wasm` result with Web Crypto on a known vector.
- Input validation: `.zip` extension **and** magic bytes `PK\x03\x04` (or `PK\x05\x06` for an empty ZIP). If they do not match, the file is rejected with visual feedback in the DropZone.

### 6.2 DigiCert timestamp (RFC 3161)

- The client builds the `TimeStampReq` in DER: SHA-256, random 64-bit `nonce`, `certReq = true`, so the token includes the chain's certificates.
- Pages Function `functions/api/tsa.ts`:
  - accepts only `POST` with `Content-Type: application/timestamp-query`;
  - body ≤ 1 KB, which must start with `0x30` (DER SEQUENCE);
  - forwards to `http://timestamp.digicert.com` and returns `application/timestamp-reply`;
  - does not log the body;
  - rate limit with a free Cloudflare rule (e.g. 20 requests/minute per IP). *Builder's choice.*
- The client parses the `TimeStampResp`, checks `status = granted`, `messageImprint` = ZIP hash and `nonce` equal to the one sent, then keeps the token (`.tsr`).

### 6.3 OpenTimestamps

- Browser SDK `javascript-opentimestamps`, called directly against the public calendars, which enable CORS.
- When created the proof is "pending": confirmation in a Bitcoin block typically arrives after a few hours. The interface and the PDF explain this.
- The Verify section lets the user **upgrade** the `.ots` file when confirmation is available (requires the network) and download the complete version.

### 6.3.1 Updated attestation (rev. 2)

The first PDF cannot change, because it is sealed with PAdES. The Bitcoin confirmation is obtained as follows:

1. The user opens **Verify** and uploads the ZIP + the PDF (or the JSON). The app extracts the `.ots`, sees that it is "pending" and asks the calendars for the upgrade.
2. **If the confirmation is not there yet:** message "Confirmation not available yet, try again in a few hours", with the indicative time.
3. **If the confirmation is there:** the app shows "Confirmed in block #N of <date>" and offers:
   - the new, complete `.ots`;
   - the **rev. 2 attestation**: same ID (suffix `-R2`), same DigiCert timestamp on the archive, Bitcoin section with "✅ Confirmed — block N, block date/time", updated `.ots` attached and a new PAdES seal on the PDF;
   - the updated JSON (`opentimestamps.status = "confirmed"`, `block`, `blockTime`, `revision: 2`).

**Mandatory notices** while the proof is pending:
- **In the first PDF**, Bitcoin anchoring section: "Status at issuance: pending confirmation", plus a highlighted box: "In a few hours, go back to proofmark.pages.dev/verifica, upload the archive and this PDF and download the updated attestation with the Bitcoin confirmation." The same reminder also appears on page 2, among the warnings.
- **On the site**, on the completion screen: an informational banner with the same message and the indicative time ("after about 21:30"), plus an "Add reminder to calendar" button that generates a local `.ics` file, with no external services. *The `.ics` button is the builder's choice.*

### 6.4 PDF attestation with PAdES

- Generated in the browser with **`pdf-lib`** (+ `@pdf-lib/fontkit`), with embedded fonts: a sans for the text and a mono for the hashes, both OFL-licensed.
- The **`.tsr` and `.ots` are attached inside the PDF** as embedded files, so the PDF alone contains all the proofs. They weigh a few KB. *Builder's choice.*
- Document signature: a signature field is added with a `/DocTimeStamp` dictionary, `SubFilter /ETSI.RFC3161` and placeholder `/ByteRange` + `/Contents` (~16 KB). The SHA-256 of the covered bytes is computed, a **second** timestamp is requested from DigiCert through the same function, and the token is inserted into the placeholder. Expected result: Acrobat shows a valid timestamp on the document, as in the report.
- There are therefore **two DigiCert timestamps**: the first on the ZIP hash (the real proof), the second on the PDF (which makes it tamper-evident and verifiable in Acrobat).

### 6.5 Verification

- **Slot 1:** the ZIP. **Slot 2:** the JSON certificate *or* the PDF attestation, from which the `.tsr`/`.ots` attachments and the data are extracted.
- **Offline** checks:
  1. the recomputed hash of the ZIP matches the certified one;
  2. the `messageImprint` of the RFC 3161 token matches the hash;
  3. the CMS signature of the token is valid (**`pkijs`**);
  4. the TSA certificate chain leads to **DigiCert Trusted Root G4**, included in the app as a fixed trust anchor;
  5. the `.ots` proof refers to the hash (structural check).
- **Optional online** check: verification of the `.ots` Bitcoin attestation (block header from a public explorer with CORS, e.g. Blockstream Esplora) and upgrade of the proof.
- The outcome is presented as a list of checks with green, yellow or red status and a plain-language explanation.

### 6.6 QR code

- The QR points to `https://<domain>/verifica#sha256=<hash>`. The hash is in the **fragment** (`#`), which the browser does not send to the server. When the link is opened, the verification page is prefilled with the expected hash and asks for the ZIP to be uploaded.

## 7. Content of the PDF attestation (builder's choice, delegated by the user)

A4 format, one or two pages, sober layout in the style of a notarial/technical document.

1. **Header:** ProofMark logo, title **"Digital Existence Attestation"**, subtitle "Proof of prior existence through an RFC 3161 timestamp and Bitcoin anchoring", attestation ID (e.g. `PM-` + first 12 characters of the hash + date), issue date.
2. **Declared data** (only if filled in): Author and Title of the work, in a box labelled "Data declared by the requester — not verified or certified". They are covered by the PDF's PAdES seal but not by the timestamp on the ZIP hash.
3. **Subject of the certification:** file name, size in bytes and in readable format, last-modified date as declared by the user's system (marked "not certified"), **SHA-256 fingerprint** in monospace, split into groups of 8 characters.
4. **RFC 3161 timestamp:** authority (name from the TSA certificate, e.g. "DigiCert SHA256 RSA4096 Timestamp Responder 2026"), date and time in UTC and Europe/Rome, token serial number, policy OID, algorithm, nonce, SHA-256 fingerprint of the token.
5. **Bitcoin blockchain anchoring:** OpenTimestamps protocol, calendars used, status at the time of issuance ("pending confirmation") and upgrade instructions.
6. **Declaration:** a formal text explaining what the document attests: a file with that fingerprint existed no later than the indicated date. It also explains what it does *not* attest: authorship itself, the content, eIDAS qualification.
7. **How to verify independently:** ready-to-copy commands:
   - Windows: `certutil -hashfile archive.zip SHA256`
   - macOS/Linux: `shasum -a 256 archive.zip`
   - `openssl ts -verify -digest <hash> -in proof.tsr -CAfile digicert-root-g4.pem`
   - `ots verify proof.ots`
   - or the QR code to ProofMark.
8. **Warnings:** keep the original ZIP without modifying or recompressing it, keep the PDF and the upgraded `.ots`, limits of the proof.
9. **Footer:** "Document sealed with RFC 3161 timestamp — verifiable in Adobe Acrobat", page number, app URL. The QR code sits in the corner of the first page.

## 8. JSON certificate

```json
{
  "schema": "proofmark/v1",
  "id": "PM-…",
  "createdAt": "2026-10-17T16:20:58Z",
  "declared": { "author": "…", "title": "…", "note": "declared, not certified" },
  "file": { "name": "project.zip", "size": 123456, "sha256": "…" },
  "rfc3161": { "tsa": "…", "genTime": "…", "serial": "…", "policy": "…", "tokenBase64": "…" },
  "opentimestamps": { "status": "pending", "calendars": ["…"], "otsBase64": "…" },
  "app": { "version": "1.0.0", "url": "https://…" }
}
```

## 9. User experience

- **Navbar:** icon, name "ProofMark", badge "Zero-Knowledge: files are processed only in your browser", theme toggle, "Certify" / "Verify" items / link to GitHub.
- **Certify:** optional Author and Title of the work fields (with the note "declared, not certified"), then a DropZone with the idle, hover, drag-over, file accepted and file rejected (not `.zip`) states. Below, a real-time 4-stage stepper: `1. Hash computation → 2. DigiCert timestamp → 3. Bitcoin anchoring → 4. Certificate generated`, with progress and recoverable errors (e.g. "retry the DigiCert timestamp").
- **Completion:** card with the archive's name and size, hash with quick copy, timestamp date, download buttons (PDF, JSON, `.tsr`, `.ots`) and a clearly visible warning about keeping the ZIP.
- **Verify:** two slots and the checklist result.
- Slate/graphite palette with emerald green and blue accents. Visual details defined during implementation with the frontend-design skill.
- **Privacy:** no third-party analytics and no fonts loaded from external CDNs. A restrictive CSP in `_headers` limits `connect-src` to the internal API, the OpenTimestamps calendars and Blockstream.

## 10. Repository and publishing

- Standard Vite structure + `functions/` (Cloudflare Pages Functions) + `public/icon.svg`, `public/favicon.ico`.
- Publishing: **Cloudflare Pages' native Git integration** linked to the GitHub repository, with build `npm run build` and output `dist`. Every push to `main` goes to production and every PR gets a preview. *Builder's choice:* simpler than a GitHub Action with wrangler. A GitHub Action still runs lint, typecheck and tests on PRs.
- README with badges (build, license, deploy), architecture diagram, local development (`npm run dev` + `wrangler pages dev` for the function) and a link to the demo.
- License: **MIT**, open source, so anyone can verify that the file is not sent. *Builder's choice.*

## 11. Error behavior (builder's choices)

- **The first DigiCert timestamp (on the ZIP) is mandatory.** If it fails, the flow stops with a "Retry" button and no certificate is generated.
- **OpenTimestamps is optional.** If the calendars do not respond, the certificate is generated with the DigiCert timestamp only, the Bitcoin section reports "not available" and anchoring can be done later from Verify.
- **The second timestamp (PAdES on the PDF) is optional.** If it fails, the PDF is produced without a seal, with a warning, and can be regenerated.
- **Domain:** `proofmark.pages.dev`, free.

## 12. Left to the builder

- Final name: "ProofMark" is a proposal. Before launch it must be checked on EUIPO/TMview and on the `*.pages.dev` domain.
- Icon design (shield + clock + hash node), typography, micro-interactions.
- Handling of network errors and DigiCert and OpenTimestamps timeouts.
- Test strategy: unit tests on ASN.1 construction/parsing, hashing and verification (with a real token saved as a fixture); end-to-end test of PDF generation.

---

## 13. Revision of 2026-10-18: Bitcoin only, publishing on GitHub Pages

Decided with the user. This section **replaces** the parts of the document that talk about DigiCert, Cloudflare Pages and the PAdES seal.

- **No more DigiCert RFC 3161 timestamp.** The user has doubts about its value. The Pages Function `/api/tsa`, the RFC 3161 client and verification, the DigiCert root certificate and the PDF's PAdES seal are removed. The only proof of date is the Bitcoin anchoring through OpenTimestamps, which becomes **mandatory**: if no calendar responds, certification stops with "Retry".
- **Two distinct documents.**
  1. **Registration receipt**, issued immediately. It contains the fingerprint and the request time taken from the device clock (declared, not certified). The status is "pending Bitcoin confirmation", with the reminder to come back in a few hours. **It does not attest to any date.**
  2. **Digital Existence Attestation**, issued by the Verify page after confirmation: "Existence attested at Bitcoin block #N of <block date>". The block number and date come only from the online verification of the proof (Esplora), never from the uploaded JSON. The attestation has the same ID as the receipt.
- **Precision.** The date is that of the block, with a tolerance of about two hours. The PDF states this.
- **Unsigned PDF.** The cryptographic proof is the attached `proof.ots` file, verifiable by anyone with OpenTimestamps.
- **Publishing.** GitHub Pages at `https://jpaladins.github.io/proofmark/` (base `/proofmark/`), through the GitHub Action `deploy.yml`. No custom domain.
  - The `/verifica` path uses a copy of `index.html` at `verifica/index.html` and as `404.html`.
  - The CSP lives in a `<meta>` tag, because GitHub Pages does not support custom headers.
- **3-stage stepper:** `1. Hash computation → 2. Bitcoin anchoring → 3. Receipt generated`.
