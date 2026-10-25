<p align="center">
  <img src="public/icon.svg" width="72" height="72" alt="">
</p>

<h1 align="center">ProofMark</h1>

<p align="center">
  Proof of existence for ZIP archives, anchored to the Bitcoin blockchain with OpenTimestamps and computed entirely in your browser.
</p>

<p align="center">
  <a href="https://github.com/jpaladins/proofmark/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/jpaladins/proofmark/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/jpaladins/proofmark/actions/workflows/deploy.yml"><img alt="Deploy" src="https://github.com/jpaladins/proofmark/actions/workflows/deploy.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-047857"></a>
  <img alt="Zero-Knowledge" src="https://img.shields.io/badge/zero--knowledge-the%20file%20never%20leaves%20the%20browser-142033">
</p>

<p align="center"><strong><a href="https://jpaladins.github.io/proofmark/">jpaladins.github.io/proofmark</a></strong></p>

Italian version of the site: [jpaladins.github.io/proofmark/it/](https://jpaladins.github.io/proofmark/it/)

---

## What it does

You drag in your project's `.zip` archive and ProofMark:

1. computes the **SHA-256** fingerprint in the browser, in a Web Worker and in chunks, even for archives of many GB;
2. sends it to the **OpenTimestamps** calendars, which write it into a block of the **Bitcoin** blockchain;
3. immediately hands you a **registration receipt** (PDF + JSON) with the `.ots` proof attached. The receipt does not yet attest to a date;
4. once confirmed, usually within a few hours, you generate the **attestation of existence** on the **Verify** page. The attestation reports the date of the Bitcoin block, read from the blockchain and never from the uploaded file.

The **Verify** page also checks the archive against a receipt or an attestation. The comparison with the proof happens offline; the network is only needed to read the confirmation from the blockchain.

> The archive is never uploaded. Only a non-reversible derivative of the fingerprint leaves the browser, sent to the OpenTimestamps calendars.

## Languages

The site comes in English (the default) and Italian.

| Page | English | Italian |
|---|---|---|
| Certify | `/proofmark/` | `/proofmark/it/` |
| Verify | `/proofmark/verify` | `/proofmark/it/verifica` |
| Privacy | `/proofmark/privacy` | `/proofmark/it/privacy` |

- Old `/proofmark/verifica` links, such as the QR codes in Italian PDFs issued earlier, redirect to `/proofmark/it/verifica` and keep their `#sha256=` fragment.
- The **EN | IT** switch in the header remembers the choice in `localStorage` (`pm:lang`). English pages show a notice to browsers whose first language is Italian.
- Receipts and attestations come out in the language of the site that issued the receipt.

## Certificate format

Receipts and attestations are a PDF plus a JSON file. The JSON identifies itself with `schema: "proofmark/v1"` and `kind: "ricevuta" | "attestato"`; these identifiers are the same in both languages.

- The optional `lang` field (`"en"` or `"it"`) records the language of the document. When it is missing, as in every certificate issued before the English version, the language is Italian.
- Downloads are named `<name>_receipt.pdf` / `.json` and `<name>_attestation.pdf` / `.json` in English, `<name>_ricevuta` and `<name>_attestato` in Italian. The proof is always `<name>.ots`.

## Architecture

The site is 100% static: there is no server-side code.

```
Browser
├─ React UI (Vite, TS, Tailwind)
├─ hash.worker.ts   chunked SHA-256 (hash-wasm)
├─ core/ots/        OpenTimestamps client ──────▶ OpenTimestamps calendars (CORS)
├─ core/pdf/        receipt and attestation (pdf-lib)
└─ flow/verify.ts   verification ─────(online)──▶ blockstream.info (Bitcoin blocks)
```

- `src/core/`: pure, tested logic. Contains `hash/`, `ots/` (native OpenTimestamps codec and client), `pdf/` and `cert/` (receipt/attestation model).
- `src/flow/`: certification and verification sequences. `src/ui/`: user interface.
- The CSP is inserted as a `<meta>` tag at build time (`src/csp.ts`), because GitHub Pages does not allow custom headers.

## Local development

Requirements: Node.js 20+ and npm.

```bash
npm ci
npm run dev
```

The app runs at http://localhost:5173/proofmark/.

| Command | What it does |
|---|---|
| `npm test -- --run` | All tests (Vitest) |
| `npm run typecheck` | TypeScript type check |
| `npm run lint` | Lint (oxlint) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves `dist/` at http://localhost:4173/proofmark/ |
| `PM_SAMPLES=1 npx vitest run scripts` | Generates a sample receipt and attestation in `out/` |

## Independent verification (without ProofMark)

```bash
# 1. fingerprint of the archive
certutil -hashfile archive.zip SHA256      # Windows
shasum -a 256 archive.zip                  # macOS / Linux

# 2. Bitcoin proof: the .ots file has the same name as the archive (client: https://opentimestamps.org)
ots upgrade archive.ots                    # once, after confirmation
ots verify archive.ots -f archive.zip
```

## Limitations

- The date is that of the Bitcoin block, with a precision of about two hours. Confirmation usually arrives within a few hours of the request.
- The attestation proves that the archive existed no later than that date. It does not prove who its author is: author and title are declared data.
- It is not a qualified electronic time stamp under Regulation (EU) 910/2014 (eIDAS). It is a piece of evidence that can be freely assessed.
- Keep the `.zip` **exactly as it is**: recompressing the same files produces a different fingerprint.

## Publishing

See [docs/DEPLOY.md](docs/DEPLOY.md).

## License

Copyright © 2026 [JPaladins](https://github.com/jpaladins).

ProofMark is free software, distributed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only).

- You may use, study, modify and redistribute it.
- Anyone who distributes a copy, even a modified one, **or makes it available as an online site or service** must make the source code available under the same license.
- Under section 7(b) of the license, every copy or modified version must keep the attribution **"Developed by JPaladins"**, linked to https://github.com/jpaladins, visible on every page (see [NOTICE](NOTICE)).

The IBM Plex fonts are distributed separately under the [SIL OFL 1.1](src/assets/fonts/OFL.txt) license.
