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
   - **Project name:** un nome libero qualsiasi, per esempio `proofmark-jpaladins`. Determina solo l'indirizzo tecnico `*.pages.dev`, perché il sito pubblico usa il dominio personalizzato del passo 3.
   - **Production branch:** `main`
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `NODE_VERSION` = `22`
4. **Save and Deploy.** La cartella `functions/` viene pubblicata automaticamente come Pages Function (`/api/tsa`).

Da questo momento ogni push su `main` va in produzione e ogni pull request ottiene un'anteprima.

## 3. Dominio personalizzato `proofmark.jpaladins.ovh`

Il dominio `jpaladins.ovh` è già gestito da Cloudflare, quindi bastano pochi clic.

1. Progetto Pages → **Custom domains** → **Set up a custom domain**.
2. Inserisci `proofmark.jpaladins.ovh` → **Continue** → **Activate domain**. Cloudflare crea da solo il record `CNAME` verso `<progetto>.pages.dev` e il certificato HTTPS, che di solito è attivo in pochi minuti.
3. Controlla che `https://proofmark.jpaladins.ovh` risponda.

L'indirizzo pubblico è impostato in un solo punto, `APP_HOST` in `src/core/app.ts`. Il QR code, i link nel PDF e il promemoria del calendario lo usano tutti. Se un giorno cambi dominio, modifica quella costante e ripubblica.

> Gli attestati già emessi contengono l'indirizzo stampato nel PDF e nel QR code. Mantieni attivo il dominio finché quegli attestati restano in circolazione.

## 4. Limite di richieste per `/api/tsa` (consigliato)

Ora il traffico passa da una zona Cloudflare tua, quindi la regola di rate limiting del piano Free è disponibile.

1. Dashboard → zona `jpaladins.ovh` → **Security** → **WAF** → **Rate limiting rules** → **Create rule**.
2. Configurala così:
   - **Se:** `Hostname` *equals* `proofmark.jpaladins.ovh` **e** `URI Path` *equals* `/api/tsa`
   - **Soglia:** 20 richieste per 10 secondi, per IP (il piano Free consente periodi di 10 secondi)
   - **Azione:** Block per 10 secondi

> La regola vale solo per `proofmark.jpaladins.ovh`. L'indirizzo tecnico `<progetto>.pages.dev` resta raggiungibile e non ne è coperto. Per un servizio a basso traffico è un rischio accettabile.

### Chiudere anche l'indirizzo `*.pages.dev`

Il binding Rate Limiting dei Workers non è disponibile nelle Pages Functions ([documentazione](https://developers.cloudflare.com/pages/functions/bindings/), verificato il 2026-10-17). La regola WAF qui sopra resta quindi la soluzione principale. Per coprire anche `<progetto>.pages.dev` puoi configurare un **Bulk Redirect** da quell'indirizzo verso `proofmark.jpaladins.ovh`.

### Alternative senza WAF

#### Worker separato con binding Rate Limiting, chiamato tramite Service binding

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

#### Contatore in un Durable Object o in KV

Un Durable Object definito in un Worker separato e collegato a Pages con `durable_objects` offre un conteggio preciso e globale, ma è più complesso. KV è eventualmente consistente, con un ritardo fino a circa 60 secondi, e consuma rapidamente le scritture gratuite giornaliere, quindi non è adatto.

#### Senza nessun limite

Il servizio funziona lo stesso. La Function accetta solo `POST` `application/timestamp-query` fino a 1 KB e ha un timeout verso DigiCert, che applica i propri limiti.

## 5. Controllo finale

1. Apri `https://proofmark.jpaladins.ovh`, certifica un piccolo `.zip` e scarica l'attestato.
2. Apri il PDF in **Adobe Acrobat Reader** e controlla il pannello Firme: deve comparire una marca temporale del documento emessa da DigiCert.
3. In **Verifica**, carica lo `.zip` e il PDF: tutti i controlli devono risultare superati.
