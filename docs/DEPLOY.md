# Pubblicare ProofMark (GitHub + Cloudflare Pages, gratis)

Servono un account GitHub e un account Cloudflare (piano Free, senza carta di credito).

## 1. Repository su GitHub

Con la [GitHub CLI](https://cli.github.com/):

```bash
gh repo create proofmark --public --source . --remote origin --push
```

Senza CLI: crea un repository **pubblico e vuoto** chiamato `proofmark` su github.com, poi:

```bash
git remote add origin https://github.com/<tuo-utente>/proofmark.git
git push -u origin main
```

> Se il tuo utente GitHub non è `jpaladins`, aggiorna `REPO_URL` in `src/core/app.ts` e i link dei badge nel `README.md`.

Il workflow `.github/workflows/ci.yml` esegue typecheck, lint, test e build su ogni push e pull request.

## 2. Progetto su Cloudflare Pages

1. Dashboard Cloudflare → **Workers & Pages** → **Create** → scheda **Pages** → **Connect to Git**.
2. Autorizza GitHub e scegli il repository `proofmark`.
3. Impostazioni di build:
   - **Project name:** `proofmark` (determina l'indirizzo `proofmark.pages.dev`; se è occupato scegline un altro e aggiorna `APP_URL` in `src/core/app.ts`)
   - **Production branch:** `main`
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `NODE_VERSION` = `22`
4. **Save and Deploy.** La cartella `functions/` viene pubblicata automaticamente come Pages Function (`/api/tsa`).

Da questo momento ogni push su `main` va in produzione e ogni pull request ottiene un'anteprima.

## 3. Limite di richieste per `/api/tsa` (consigliato)

Il piano Free include una regola di rate limiting.

1. Dashboard → **Security** → **WAF** → **Rate limiting rules** → **Create rule**.
2. Configurala così:
   - **Se:** `URI Path` *equals* `/api/tsa`
   - **Soglia:** 20 richieste per 1 minuto, per IP
   - **Azione:** Block per 1 minuto

> La regola WAF richiede un dominio gestito da Cloudflare. Su `*.pages.dev` potrebbe non essere disponibile. In quel caso il servizio funziona lo stesso, protetto dai limiti propri di DigiCert.

## 4. Controllo finale

1. Apri `https://proofmark.pages.dev`, certifica un piccolo `.zip` e scarica l'attestato.
2. Apri il PDF in **Adobe Acrobat Reader** e controlla il pannello Firme: deve comparire una marca temporale del documento emessa da DigiCert.
3. In **Verifica**, carica lo `.zip` e il PDF: tutti i controlli devono risultare superati.
