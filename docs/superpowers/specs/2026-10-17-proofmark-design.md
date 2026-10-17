# ProofMark — Documento di design

*Data: 2026-10-17 · Stato: in attesa di approvazione finale*

## 1. Intento

ProofMark è un'app web gratuita che permette a chiunque di dimostrare che un archivio `.zip` esisteva in una certa data, a fini di prova di anteriorità (paternità d'autore, contestazioni di plagio). Si usa da un link, senza installare nulla. Il file non lascia mai il computer dell'utente: dal browser esce solo l'impronta SHA-256.

Il risultato deve essere credibile per un avvocato o un cliente. Il riferimento è il verbale fornito dall'utente (`Verbale_Acquisizione_Forense_yngbrb.pdf`), un PDF con una marca temporale DigiCert RFC 3161 incorporata come firma PAdES (`/DocTimeStamp`, `SubFilter /ETSI.RFC3161`), che Acrobat mostra come firma valida.

## 2. Obiettivi

1. Caricamento di **un solo file `.zip`** (drag & drop o selezione). Viene certificato l'archivio nel suo insieme, senza elencarne il contenuto.
   Campi facoltativi **"Autore"** e **"Titolo dell'opera"** (testo libero, max 120 caratteri ciascuno), riportati nel PDF e nel JSON come **dichiarati dall'utente e non certificati**.
2. Calcolo dell'SHA-256 nel browser, in un Web Worker, in streaming: deve funzionare anche oltre 1 GB senza bloccare l'interfaccia.
3. Doppio ancoraggio temporale:
   - **DigiCert TSA (RFC 3161)** sull'hash dello ZIP.
   - **OpenTimestamps (Bitcoin)** sull'hash dello ZIP.
4. Output scaricabili:
   - **Attestato PDF** professionale, con QR code di verifica e marca DigiCert incorporata come firma PAdES sul PDF stesso, come nel verbale.
   - **Certificato JSON** leggibile da macchina.
   - I file grezzi **`.tsr`** (token RFC 3161) e **`.ots`** (prova OpenTimestamps), per verifiche indipendenti con `openssl` e `ots`.
5. Sezione **"Verifica"** con due slot (ZIP originale + certificato JSON o PDF): ricalcola l'hash e controlla le prove crittografiche senza rete. Il controllo Bitcoin completo, opzionale, richiede la rete.
6. Interfaccia di livello enterprise/fintech, in italiano, con tema chiaro/scuro, accessibile (WCAG AA).
7. Costo zero per chi pubblica e per chi usa.

## 3. Non-obiettivi

- Nessun account, login, database o archiviazione lato server.
- Nessun elenco dei file contenuti nello ZIP (scelta dell'utente: il PDF deve restare leggero).
- Nessuna app desktop per ora. Windows verrà valutato dopo, quindi il codice va tenuto impacchettabile con Tauri.
- Nessuna firma digitale personale dell'autore (CNS/SPID/firma qualificata).

## 4. Anti-obiettivi (fallimento anche se "funziona")

- **Il file o il suo contenuto lascia il browser**, anche solo in parte o per telemetria.
- **Il PDF o l'interfaccia promettono più di quanto valga la prova.** La TSA pubblica di DigiCert *non* è una marca temporale qualificata eIDAS né un servizio accreditato AgID. I testi devono parlare di "prova di esistenza / anteriorità" e "marca temporale RFC 3161", mai di "marca temporale qualificata" o di "data certa ai sensi di legge". Una sezione dei limiti va scritta in chiaro.
- **L'utente non capisce che deve conservare lo ZIP byte per byte.** Se ricomprime i file, l'hash cambia e la prova non vale più. L'avviso deve essere ben visibile sia nella schermata finale sia nel PDF.
- **Si spende denaro.** Tutto deve stare nei piani gratuiti.

## 5. Vincoli e scelte già decise con l'utente

| Tema | Decisione |
|---|---|
| Piattaforma | App web su **Cloudflare Pages** (piano free). Al posto di GitHub Pages, che non permette codice lato server. |
| Inoltro DigiCert | Una **Pages Function** sullo stesso dominio inoltra a `http://timestamp.digicert.com` la sola `TimeStampReq` (~60 byte con l'hash). Serve perché DigiCert funziona solo in HTTP e non abilita il CORS. |
| Input | Solo un file `.zip`. |
| Contenuto del PDF | Delegato al builder: "il più professionale possibile". Vedi §7. |
| Stack | Vite + React + TypeScript + Tailwind CSS + Lucide React (dalla richiesta originale). |
| Repository | GitHub, con README professionale, badge e link alla demo. |

## 6. Architettura

```
Browser (tutto il lavoro)                      Cloudflare Pages
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

- Web Worker dedicato. Legge il `File` a blocchi (`file.stream()` o slice da 8–16 MB) e invia progressi alla UI (percentuale, MB/s, tempo stimato).
- **Nota tecnica:** `crypto.subtle.digest` della Web Crypto API non è incrementale e richiederebbe tutto il file in memoria, quindi non regge file da più di 1 GB. Per lo streaming si usa **`hash-wasm`** (SHA-256 in WASM, incrementale). *Scelta del builder.* Si può aggiungere un self-test all'avvio che confronta il risultato di `hash-wasm` con Web Crypto su un vettore noto.
- Validazione dell'input: estensione `.zip` **e** magic bytes `PK\x03\x04` (o `PK\x05\x06` per ZIP vuoto). Se non corrispondono, il file viene rifiutato con un feedback visivo nella DropZone.

### 6.2 Marca DigiCert (RFC 3161)

- Il client costruisce la `TimeStampReq` in DER: SHA-256, `nonce` casuale a 64 bit, `certReq = true`, così il token include i certificati della catena.
- Pages Function `functions/api/tsa.ts`:
  - accetta solo `POST` con `Content-Type: application/timestamp-query`;
  - corpo ≤ 1 KB, che deve iniziare con `0x30` (SEQUENCE DER);
  - inoltra a `http://timestamp.digicert.com` e restituisce `application/timestamp-reply`;
  - non registra il corpo nei log;
  - rate limit con una regola gratuita di Cloudflare (es. 20 richieste/minuto per IP). *Scelta del builder.*
- Il client analizza la `TimeStampResp`, verifica `status = granted`, `messageImprint` = hash dello ZIP e `nonce` uguale a quello inviato, poi conserva il token (`.tsr`).

### 6.3 OpenTimestamps

- SDK browser `javascript-opentimestamps`, chiamato direttamente verso i calendar pubblici, che abilitano il CORS.
- Alla creazione la prova è "in attesa": la conferma in un blocco Bitcoin arriva tipicamente dopo alcune ore. L'interfaccia e il PDF lo spiegano.
- La sezione Verifica permette di **aggiornare** il file `.ots` quando la conferma è disponibile (richiede rete) e di scaricare la versione completa.

### 6.3.1 Attestato aggiornato (rev. 2)

Il primo PDF non può cambiare, perché è sigillato PAdES. La conferma Bitcoin si ottiene così:

1. L'utente apre **Verifica** e carica lo ZIP + il PDF (o il JSON). L'app estrae l'`.ots`, vede che è "in attesa" e chiede l'aggiornamento ai calendar.
2. **Se la conferma non c'è ancora:** messaggio "Conferma non ancora disponibile, riprova tra qualche ora", con l'orario indicativo.
3. **Se la conferma c'è:** l'app mostra "Confermato nel blocco #N del <data>" e offre:
   - il nuovo `.ots` completo;
   - l'**attestato rev. 2**: stesso ID (suffisso `-R2`), stessa marca DigiCert sull'archivio, sezione Bitcoin con "✅ Confermato — blocco N, data/ora del blocco", `.ots` aggiornato in allegato e nuovo sigillo PAdES sul PDF;
   - il JSON aggiornato (`opentimestamps.status = "confirmed"`, `block`, `blockTime`, `revision: 2`).

**Avvisi obbligatori** finché la prova è in attesa:
- **Nel primo PDF**, sezione Ancoraggio Bitcoin: "Stato all'emissione: in attesa di conferma", più un riquadro evidenziato: "Tra qualche ora torna su proofmark.pages.dev/verifica, carica l'archivio e questo PDF e scarica l'attestato aggiornato con la conferma Bitcoin." Lo stesso promemoria compare anche a pagina 2, tra le avvertenze.
- **Sul sito**, nella schermata di completamento: un banner informativo con lo stesso messaggio e l'orario indicativo ("dopo le 21:30 circa"), più un pulsante "Aggiungi promemoria al calendario" che genera un file `.ics` locale, senza servizi esterni. *Il pulsante `.ics` è una scelta del builder.*

### 6.4 Attestato PDF con PAdES

- Generazione nel browser con **`pdf-lib`** (+ `@pdf-lib/fontkit`), con font incorporati: un sans per il testo e un mono per gli hash, entrambi con licenza OFL.
- Il **`.tsr` e l'`.ots` vengono allegati dentro il PDF** come file incorporati, così il PDF da solo contiene tutte le prove. Pesano pochi KB. *Scelta del builder.*
- Firma del documento: si aggiunge un campo firma con dizionario `/DocTimeStamp`, `SubFilter /ETSI.RFC3161` e `/ByteRange` + `/Contents` segnaposto (~16 KB). Si calcola lo SHA-256 dei byte coperti, si chiede una **seconda** marca a DigiCert tramite la stessa funzione e si inserisce il token nel segnaposto. Risultato atteso: Acrobat mostra una marca temporale valida sul documento, come nel verbale.
- Ci sono quindi **due marche DigiCert**: la prima sull'hash dello ZIP (la prova vera), la seconda sul PDF (che lo rende integro e verificabile in Acrobat).

### 6.5 Verifica

- **Slot 1:** lo ZIP. **Slot 2:** il certificato JSON *oppure* l'attestato PDF, da cui si estraggono gli allegati `.tsr`/`.ots` e i dati.
- Controlli **offline**:
  1. l'hash ricalcolato dello ZIP coincide con quello certificato;
  2. il `messageImprint` del token RFC 3161 coincide con l'hash;
  3. la firma CMS del token è valida (**`pkijs`**);
  4. la catena del certificato del TSA porta a **DigiCert Trusted Root G4**, incluso nell'app come trust anchor fisso;
  5. la prova `.ots` si riferisce all'hash (verifica strutturale).
- Controllo **online opzionale**: verifica dell'attestazione Bitcoin dell'`.ots` (block header da un explorer pubblico con CORS, es. Blockstream Esplora) e aggiornamento della prova.
- L'esito si presenta come lista di controlli con stato verde, giallo o rosso e una spiegazione in linguaggio semplice.

### 6.6 QR code

- Il QR punta a `https://<dominio>/verifica#sha256=<hash>`. L'hash sta nel **frammento** (`#`), che il browser non invia al server. Aprendo il link, la pagina di verifica è precompilata con l'hash atteso e chiede di caricare lo ZIP.

## 7. Contenuto dell'attestato PDF (scelta del builder, delegata dall'utente)

Formato A4, una o due pagine, impaginazione sobria da documento notarile/tecnico.

1. **Intestazione:** logo ProofMark, titolo **"Attestato di Esistenza Digitale"**, sottotitolo "Prova di anteriorità tramite marca temporale RFC 3161 e ancoraggio Bitcoin", ID attestato (es. `PM-` + primi 12 caratteri dell'hash + data), data di emissione.
2. **Dati dichiarati** (solo se compilati): Autore e Titolo dell'opera, in un riquadro con la dicitura "Dati dichiarati dal richiedente — non verificati né certificati". Sono coperti dal sigillo PAdES del PDF ma non dalla marca sull'hash dello ZIP.
3. **Oggetto della certificazione:** nome del file, dimensione in byte e formato leggibile, data di ultima modifica dichiarata dal sistema dell'utente (marcata come "non certificata"), **impronta SHA-256** in monospace, divisa in gruppi da 8 caratteri.
4. **Marca temporale RFC 3161:** autorità (nome dal certificato del TSA, es. "DigiCert SHA256 RSA4096 Timestamp Responder 2026"), data e ora in UTC e Europe/Rome, numero di serie del token, policy OID, algoritmo, nonce, impronta SHA-256 del token.
5. **Ancoraggio blockchain Bitcoin:** protocollo OpenTimestamps, calendar usati, stato al momento dell'emissione ("in attesa di conferma") e istruzioni per l'aggiornamento.
6. **Dichiarazione:** un testo formale che spiega cosa attesta il documento: un file con quell'impronta esisteva non dopo la data indicata. Spiega anche cosa *non* attesta: la paternità in sé, il contenuto, la qualificazione eIDAS.
7. **Come verificare in modo indipendente:** comandi pronti da copiare:
   - Windows: `certutil -hashfile archivio.zip SHA256`
   - macOS/Linux: `shasum -a 256 archivio.zip`
   - `openssl ts -verify -digest <hash> -in prova.tsr -CAfile digicert-root-g4.pem`
   - `ots verify prova.ots`
   - oppure il QR code verso ProofMark.
8. **Avvertenze:** conservare lo ZIP originale senza modificarlo né ricomprimerlo, conservare il PDF e l'`.ots` aggiornato, limiti della prova.
9. **Piè di pagina:** "Documento sigillato con marca temporale RFC 3161 — verificabile in Adobe Acrobat", numero di pagina, URL dell'app. Il QR code sta nell'angolo della prima pagina.

## 8. Certificato JSON

```json
{
  "schema": "proofmark/v1",
  "id": "PM-…",
  "createdAt": "2026-10-17T16:20:58Z",
  "declared": { "author": "…", "title": "…", "note": "dichiarati, non certificati" },
  "file": { "name": "progetto.zip", "size": 123456, "sha256": "…" },
  "rfc3161": { "tsa": "…", "genTime": "…", "serial": "…", "policy": "…", "tokenBase64": "…" },
  "opentimestamps": { "status": "pending", "calendars": ["…"], "otsBase64": "…" },
  "app": { "version": "1.0.0", "url": "https://…" }
}
```

## 9. Esperienza utente

- **Navbar:** icona, nome "ProofMark", badge "Zero-Knowledge: i file vengono elaborati solo nel tuo browser", toggle del tema, voci "Certifica" / "Verifica" / link a GitHub.
- **Certifica:** campi facoltativi Autore e Titolo dell'opera (con nota "dichiarati, non certificati"), poi DropZone con gli stati idle, hover, drag-over, file accettato e file rifiutato (non `.zip`). Sotto, uno stepper a 4 fasi in tempo reale: `1. Calcolo Hash → 2. Marca DigiCert → 3. Ancoraggio Bitcoin → 4. Certificato Generato`, con progressi ed errori recuperabili (es. "riprova la marca DigiCert").
- **Completamento:** scheda con nome e dimensione dell'archivio, hash con copia rapida, data della marca, pulsanti di download (PDF, JSON, `.tsr`, `.ots`) e avviso ben visibile sulla conservazione dello ZIP.
- **Verifica:** due slot e il risultato a checklist.
- Palette ardesia/grafite con accenti verde smeraldo e blu. Dettagli visivi definiti in fase di implementazione con la skill frontend-design.
- **Privacy:** nessuna analytics di terze parti e nessun font caricato da CDN esterni. Una CSP restrittiva in `_headers` limita `connect-src` all'API interna, ai calendar OpenTimestamps e a Blockstream.

## 10. Repository e pubblicazione

- Struttura Vite standard + `functions/` (Cloudflare Pages Functions) + `public/icon.svg`, `public/favicon.ico`.
- Pubblicazione: **integrazione Git nativa di Cloudflare Pages** collegata al repository GitHub, con build `npm run build` e output `dist`. Ogni push su `main` va in produzione e ogni PR ottiene un'anteprima. *Scelta del builder:* più semplice di una GitHub Action con wrangler. Una GitHub Action esegue comunque lint, typecheck e test sulle PR.
- README con badge (build, licenza, deploy), diagramma dell'architettura, sviluppo locale (`npm run dev` + `wrangler pages dev` per la funzione) e link alla demo.
- Licenza: **MIT**, open source, così chiunque può verificare che il file non venga inviato. *Scelta del builder.*

## 11. Comportamento in caso di errore (scelte del builder)

- **La prima marca DigiCert (sullo ZIP) è obbligatoria.** Se fallisce, il flusso si ferma con il pulsante "Riprova" e non viene generato alcun certificato.
- **OpenTimestamps è facoltativo.** Se i calendar non rispondono, il certificato viene generato con la sola marca DigiCert, la sezione Bitcoin riporta "non disponibile" e si può ancorare in seguito dalla Verifica.
- **La seconda marca (PAdES sul PDF) è facoltativa.** Se fallisce, il PDF viene prodotto senza sigillo, con un avviso, e si può rigenerare.
- **Dominio:** `proofmark.pages.dev`, gratuito.

## 12. Lasciato al builder

- Nome definitivo: "ProofMark" è una proposta. Prima del lancio va controllato su EUIPO/TMview e sul dominio `*.pages.dev`.
- Disegno dell'icona (scudo + orologio + nodo hash), tipografia, micro-interazioni.
- Gestione degli errori di rete e dei timeout di DigiCert e OpenTimestamps.
- Strategia di test: unit test su costruzione/parsing di ASN.1, hashing e verifica (con un token reale salvato come fixture); test end-to-end della generazione PDF.
