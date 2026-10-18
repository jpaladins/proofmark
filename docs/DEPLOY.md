# Pubblicare ProofMark su GitHub Pages

ProofMark è un sito statico. Lo pubblica la GitHub Action `.github/workflows/deploy.yml` a ogni push su `main`, all'indirizzo `https://jpaladins.github.io/proofmark/`. Non servono server, account esterni o costi.

## 1. Attiva GitHub Pages (una volta)

Repository `jpaladins/proofmark` → **Settings** → **Pages** → **Build and deployment** → **Source: GitHub Actions**.

In alternativa, con la [GitHub CLI](https://cli.github.com/):

```bash
gh api -X POST repos/jpaladins/proofmark/pages -f build_type=workflow
```

## 2. Pubblica

Ogni push su `main` esegue test e build e pubblica `dist/`. L'avanzamento è visibile nella scheda **Actions** → *Deploy to GitHub Pages*, oppure si può lanciare a mano con **Run workflow**.

Il workflow `.github/workflows/ci.yml` esegue typecheck, lint, test e build su ogni pull request.

## Come funziona sotto il cofano

- **Percorso del sito.** È un *project site*, quindi tutto vive sotto `/proofmark/` (`base` in `vite.config.ts`). L'indirizzo pubblico usato nei PDF, nel QR code e nei promemoria è definito in `src/core/app.ts`.
- **Pagina `/verifica`.** GitHub Pages serve solo file reali. La build copia `index.html` in `verifica/index.html`, così il link del QR code apre direttamente la verifica, e in `404.html` per qualsiasi altro percorso.
- **Sicurezza.** GitHub Pages non permette header personalizzati.
  - La Content-Security-Policy (`src/csp.ts`) viene inserita come `<meta>` nella build.
  - HTTPS e HSTS sono già garantiti da `github.io`.
  - Il sito si collega solo ai calendari OpenTimestamps e a `blockstream.info`.
- **Nessun server.** Non c'è più alcun inoltro lato server: i calendari OpenTimestamps e Blockstream accettano chiamate dirette dal browser.

## Se cambi nome al repository

Aggiorna `BASE` in `vite.config.ts`, `APP_URL` in `src/core/app.ts` e i link nel `README.md`.

> Le ricevute e gli attestati già emessi riportano l'indirizzo stampato e nel QR code. Finché sono in circolazione, mantieni il sito raggiungibile a quell'indirizzo.

## Controllo finale

1. Apri `https://jpaladins.github.io/proofmark/`, certifica un piccolo `.zip` e scarica la ricevuta.
2. Dopo qualche ora apri **Verifica**, carica lo `.zip` e la ricevuta, controlla la conferma Bitcoin e scarica l'attestato.
3. Scansiona il QR code dell'attestato con il telefono: deve aprirsi la pagina Verifica con l'impronta già compilata.
