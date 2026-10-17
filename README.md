<p align="center">
  <img src="public/icon.svg" width="72" height="72" alt="">
</p>

<h1 align="center">ProofMark</h1>

<p align="center">
  Prova di esistenza per archivi ZIP: marca temporale RFC 3161 di DigiCert e ancoraggio sulla blockchain Bitcoin, calcolati interamente nel tuo browser.
</p>

<p align="center">
  <a href="https://github.com/jpaladins/proofmark/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/jpaladins/proofmark/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="Licenza MIT" src="https://img.shields.io/badge/licenza-MIT-047857"></a>
  <a href="https://proofmark.pages.dev"><img alt="Cloudflare Pages" src="https://img.shields.io/badge/deploy-Cloudflare%20Pages-1d4ed8"></a>
  <img alt="Zero-Knowledge" src="https://img.shields.io/badge/zero--knowledge-il%20file%20non%20lascia%20il%20browser-142033">
</p>

<p align="center"><strong><a href="https://proofmark.pages.dev">Demo: proofmark.pages.dev</a></strong></p>

---

## Cosa fa

Trascini l'archivio `.zip` del tuo progetto. ProofMark:

1. calcola l'impronta **SHA-256** nel browser, in un Web Worker e a blocchi, anche per archivi da molti GB;
2. fa marcare l'impronta da **DigiCert** con una marca temporale **RFC 3161**;
3. la registra sulla blockchain **Bitcoin** tramite **OpenTimestamps**;
4. genera un **attestato PDF** sigillato con una seconda marca DigiCert (PAdES, verificabile in Adobe Acrobat) che contiene in allegato le prove grezze, più un **certificato JSON**.

La sezione **Verifica** ricalcola l'impronta e controlla firme, catena di certificati e sigillo del PDF **senza connessione**. La rete serve solo per la conferma Bitcoin e per scaricare l'**attestato aggiornato (rev. 2)** quando il blocco è stato minato.

> L'archivio non viene mai caricato: dal browser escono soltanto l'impronta (32 byte) verso DigiCert e un suo derivato non reversibile verso i calendari OpenTimestamps.

## Architettura

```
Browser (tutto il lavoro)                      Cloudflare Pages
┌────────────────────────────────────┐         ┌──────────────────────────────┐
│ React UI (Vite, TS, Tailwind)      │         │ asset statici (dist/)        │
│  ├─ hash.worker.ts  SHA-256 stream │         │                              │
│  ├─ tsa/   TimeStampReq ───────────┼─ POST ─▶│ functions/api/tsa.ts ────────┼─▶ timestamp.digicert.com
│  ├─ ots/   OpenTimestamps ─────────┼─────────┼──────────────────────────────┼─▶ calendari OpenTimestamps
│  ├─ pdf/   pdf-lib + sigillo PAdES │         └──────────────────────────────┘
│  └─ verify/ pkijs, offline ────────┼──── (opzionale) ───────────────────────▶ blockstream.info (blocchi)
└────────────────────────────────────┘
```

- **`functions/api/tsa.ts`**: l'unico codice lato server. Inoltra a DigiCert la richiesta RFC 3161 (circa 60 byte), perché DigiCert risponde solo in HTTP e senza CORS. Accetta solo `application/timestamp-query` fino a 1 KB e non registra nulla.
- **`src/core/`**: logica pura e testata.
  - `hash/`: SHA-256 a blocchi con `hash-wasm`.
  - `tsa/`: codifica RFC 3161 con `pkijs`.
  - `verify/`: verifica di firma CMS e catena fino a *DigiCert Trusted Root G4*, incluso e verificato tramite fingerprint.
  - `ots/`: client OpenTimestamps nativo.
  - `pdf/`: attestato e sigillo PAdES.
  - `cert/`: modello del certificato.
- **`src/flow/`**: sequenza di certificazione e verifica.
- **`src/ui/`**: interfaccia.
- **CSP restrittiva** in `public/_headers`: script solo dal sito, connessioni solo verso `/api/tsa`, calendari OpenTimestamps e Blockstream.

## Sviluppo locale

Requisiti: Node.js 20+ e npm.

```bash
npm ci
npm run dev
```

`npm run dev` avvia solo il frontend. Per provare anche la marca DigiCert serve la Pages Function:

```bash
npm run build
npm run pages:dev
```

L'app è poi disponibile su http://localhost:8788.

| Comando | Cosa fa |
|---|---|
| `npm test -- --run` | Tutti i test (Vitest) |
| `npm run typecheck` | Controllo dei tipi TypeScript |
| `npm run lint` | Lint (oxlint) |
| `npm run build` | Build di produzione in `dist/` |
| `bash scripts/make-fixtures.sh` | Rigenera le fixture DigiCert reali e verifica il fingerprint della radice |
| `PM_SAMPLES=1 npx vitest run scripts` | Genera attestati di esempio in `out/` (uno sigillato con DigiCert reale) |

## Verifica indipendente (senza ProofMark)

```bash
# 1. impronta dell'archivio
certutil -hashfile archivio.zip SHA256      # Windows
shasum -a 256 archivio.zip                  # macOS / Linux

# 2. marca DigiCert (prova.tsr è allegata al PDF e inclusa nel JSON)
openssl ts -verify -digest <impronta> -in prova.tsr -CAfile DigiCertTrustedRootG4.pem

# 3. ancoraggio Bitcoin
ots upgrade prova.ots
ots verify prova.ots -f archivio.zip
```

## Limiti

- La TSA pubblica di DigiCert **non** è un prestatore qualificato ai sensi del Regolamento (UE) 910/2014 (eIDAS). L'attestato è un elemento di prova di anteriorità liberamente valutabile, non una validazione temporale elettronica qualificata.
- L'attestato dimostra che l'archivio esisteva non oltre una certa data. Non dimostra chi ne sia l'autore. Autore e titolo sono dati dichiarati dall'utente.
- Conserva lo `.zip` **esattamente com'è**: ricomprimere gli stessi file produce un'impronta diversa.

## Pubblicazione

Vedi [docs/DEPLOY.md](docs/DEPLOY.md).

## Licenza

[MIT](LICENSE). Font IBM Plex con licenza [SIL OFL 1.1](src/assets/fonts/OFL.txt).
