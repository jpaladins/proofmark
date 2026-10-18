<p align="center">
  <img src="public/icon.svg" width="72" height="72" alt="">
</p>

<h1 align="center">ProofMark</h1>

<p align="center">
  Prova di esistenza per archivi ZIP, ancorata alla blockchain Bitcoin con OpenTimestamps e calcolata interamente nel tuo browser.
</p>

<p align="center">
  <a href="https://github.com/jpaladins/proofmark/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/jpaladins/proofmark/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/jpaladins/proofmark/actions/workflows/deploy.yml"><img alt="Deploy" src="https://github.com/jpaladins/proofmark/actions/workflows/deploy.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="Licenza MIT" src="https://img.shields.io/badge/licenza-MIT-047857"></a>
  <img alt="Zero-Knowledge" src="https://img.shields.io/badge/zero--knowledge-il%20file%20non%20lascia%20il%20browser-142033">
</p>

<p align="center"><strong><a href="https://jpaladins.github.io/proofmark/">jpaladins.github.io/proofmark</a></strong></p>

---

## Cosa fa

Trascini l'archivio `.zip` del tuo progetto e ProofMark:

1. calcola l'impronta **SHA-256** nel browser, in un Web Worker e a blocchi, anche per archivi da molti GB;
2. la invia ai calendari **OpenTimestamps**, che la scrivono in un blocco della blockchain **Bitcoin**;
3. ti consegna subito una **ricevuta di registrazione** (PDF + JSON) con la prova `.ots` allegata. La ricevuta non attesta ancora una data;
4. dopo la conferma, di solito entro qualche ora, nella pagina **Verifica** genera l'**attestato di esistenza**. L'attestato riporta la data del blocco Bitcoin, letta dalla blockchain e mai dal file caricato.

La pagina **Verifica** controlla anche l'archivio contro una ricevuta o un attestato. Il confronto con la prova avviene offline; la rete serve solo per leggere la conferma dalla blockchain.

> L'archivio non viene mai caricato. Dal browser esce solo un derivato non reversibile dell'impronta, inviato ai calendari OpenTimestamps.

## Architettura

Il sito è statico al 100%: non c'è codice lato server.

```
Browser
├─ React UI (Vite, TS, Tailwind)
├─ hash.worker.ts   SHA-256 a blocchi (hash-wasm)
├─ core/ots/        client OpenTimestamps ──────▶ calendari OpenTimestamps (CORS)
├─ core/pdf/        ricevuta e attestato (pdf-lib)
└─ flow/verify.ts   verifica ─────────(online)──▶ blockstream.info (blocchi Bitcoin)
```

- `src/core/`: logica pura e testata. Contiene `hash/`, `ots/` (codec e client OpenTimestamps nativi), `pdf/` e `cert/` (modello ricevuta/attestato).
- `src/flow/`: sequenze di certificazione e verifica. `src/ui/`: interfaccia.
- La CSP è inserita come `<meta>` in fase di build (`src/csp.ts`), perché GitHub Pages non permette header personalizzati.

## Sviluppo locale

Requisiti: Node.js 20+ e npm.

```bash
npm ci
npm run dev
```

L'app gira su http://localhost:5173/proofmark/.

| Comando | Cosa fa |
|---|---|
| `npm test -- --run` | Tutti i test (Vitest) |
| `npm run typecheck` | Controllo dei tipi TypeScript |
| `npm run lint` | Lint (oxlint) |
| `npm run build` | Build di produzione in `dist/` |
| `npm run preview` | Serve `dist/` su http://localhost:4173/proofmark/ |
| `PM_SAMPLES=1 npx vitest run scripts` | Genera una ricevuta e un attestato di esempio in `out/` |

## Verifica indipendente (senza ProofMark)

```bash
# 1. impronta dell'archivio
certutil -hashfile archivio.zip SHA256      # Windows
shasum -a 256 archivio.zip                  # macOS / Linux

# 2. prova Bitcoin (client: https://opentimestamps.org)
ots upgrade prova.ots                       # una volta, dopo la conferma
ots verify prova.ots -f archivio.zip
```

## Limiti

- La data è quella del blocco Bitcoin, con una precisione di circa due ore. La conferma arriva di solito entro qualche ora dalla richiesta.
- L'attestato dimostra che l'archivio esisteva non oltre quella data. Non dimostra chi ne sia l'autore: autore e titolo sono dati dichiarati.
- Non è una validazione temporale elettronica qualificata ai sensi del Regolamento (UE) 910/2014 (eIDAS). È un elemento di prova liberamente valutabile.
- Conserva lo `.zip` **esattamente com'è**: ricomprimere gli stessi file produce un'impronta diversa.

## Pubblicazione

Vedi [docs/DEPLOY.md](docs/DEPLOY.md).

## Licenza

[MIT](LICENSE). Font IBM Plex con licenza [SIL OFL 1.1](src/assets/fonts/OFL.txt).
