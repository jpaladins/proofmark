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

## 3. Limite di richieste per `/api/tsa`

`/api/tsa` inoltra a DigiCert circa 60 byte per richiesta, quindi un abuso costa poco a noi, ma potrebbe portare DigiCert a bloccare gli IP di Cloudflare. Un limite di **20 richieste al minuto per IP** è più che sufficiente per un uso normale, perché ogni certificazione fa da 1 a 3 richieste.

**Il binding Rate Limiting dei Workers non è disponibile per le Pages Functions.** La documentazione ufficiale lo descrive solo per i Workers ([Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)). Non compare né tra i [binding delle Pages Functions](https://developers.cloudflare.com/pages/functions/bindings/) né tra le chiavi accettate dal [`wrangler.toml` di Pages](https://developers.cloudflare.com/pages/functions/wrangler-configuration/) (verificato il 2026-10-17). Per questo il codice non contiene alcun limite. Ecco le opzioni possibili, dalla più semplice:

### Opzione A: regola WAF su un dominio personalizzato (consigliata)

Il piano Free include una regola di rate limiting, ma solo per le zone gestite da Cloudflare, e `*.pages.dev` non è una tua zona.

1. Aggiungi un dominio a Cloudflare e collegalo al progetto: **Workers & Pages** → `proofmark` → **Custom domains**.
2. Nella zona del dominio vai su **Security** → **WAF** → **Rate limiting rules** → **Create rule**:
   - **Se:** `URI Path` *equals* `/api/tsa`
   - **Soglia:** 20 richieste per 1 minuto, per IP
   - **Azione:** Block per 1 minuto
3. Aggiorna `APP_URL` in `src/core/app.ts` con il nuovo dominio.

L'indirizzo `proofmark.pages.dev` resta comunque raggiungibile senza limite. Per chiuderlo, configura un **Bulk Redirect** da `proofmark.pages.dev` verso il dominio personalizzato. In alternativa, nella Function puoi rifiutare con `403` le richieste il cui `Host` non è il dominio personalizzato.

### Opzione B: Worker separato con binding Rate Limiting, chiamato tramite Service binding

Le Pages Functions supportano i **Service binding** (chiave `services`). Il binding `ratelimits` può quindi stare in un piccolo Worker separato (ad esempio `proofmark-ratelimit`), che espone un controllo `limit({ key })`. La Function `/api/tsa` lo interroga con la chiave `CF-Connecting-IP` prima di inoltrare la richiesta a DigiCert:

```toml
# wrangler.toml del Worker
[[ratelimits]]
name = "TSA_LIMITER"
namespace_id = "1001"
  [ratelimits.simple]
  limit = 20
  period = 60
```

```toml
# wrangler.toml di Pages
[[services]]
binding = "RATE_LIMITER"
service = "proofmark-ratelimit"
```

Funziona anche su `*.pages.dev` e resta nel piano Free, ma richiede un secondo deploy da mantenere. Il contatore è applicato **per singolo data center Cloudflare** ed è volutamente approssimativo ("eventually consistent"): serve contro gli abusi, non come conteggio preciso.

### Opzione C: contatore in un Durable Object o in KV

Un Durable Object definito in un Worker separato e collegato a Pages con `durable_objects` offre un conteggio preciso e globale, ma è più complesso. KV è eventualmente consistente, con un ritardo fino a circa 60 secondi, e consuma rapidamente le scritture gratuite giornaliere, quindi non è adatto.

### Senza nessuna opzione

Il servizio funziona lo stesso. La Function accetta solo `POST` `application/timestamp-query` fino a 1 KB e ha un timeout verso DigiCert, che applica i propri limiti.

## 4. Controllo finale

1. Apri `https://proofmark.pages.dev`, certifica un piccolo `.zip` e scarica l'attestato.
2. Apri il PDF in **Adobe Acrobat Reader** e controlla il pannello Firme: deve comparire una marca temporale del documento emessa da DigiCert.
3. In **Verifica**, carica lo `.zip` e il PDF: tutti i controlli devono risultare superati.
