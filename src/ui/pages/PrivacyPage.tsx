import { Check, Cpu, Globe, LifeBuoy, Lock, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { REPO_URL } from '@/core/app'

const UPDATED = '18 ottobre 2026'

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-14 scroll-mt-24">
      <h2 id={id} className="font-serif text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[1.0625rem] leading-relaxed text-ink-2">{children}</div>
    </section>
  )
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[0.85em] text-ink">{children}</code>
}

const SUMMARY = [
  {
    icon: Cpu,
    title: 'Tutto avviene sul tuo dispositivo',
    text: "L'impronta dell'archivio, la ricevuta, l'attestato e la verifica sono calcolati dal tuo browser.",
  },
  {
    icon: Lock,
    title: 'Il file non lascia mai il tuo dispositivo',
    text: "Né l'archivio né il suo contenuto vengono caricati, nemmeno in parte. ProofMark non ha un server che possa riceverli.",
  },
  {
    icon: ShieldCheck,
    title: 'Nessun dato personale raccolto',
    text: 'Nessun account, nessun cookie, nessuna statistica di utilizzo, nessun tracciamento.',
  },
]

const OUTGOING = [
  {
    who: 'Calendari OpenTimestamps',
    hosts: 'a.pool.opentimestamps.org, b.pool.opentimestamps.org, a.pool.eternitywall.com',
    when: 'Quando certifichi un archivio',
    what: "Un valore di 32 byte calcolato come SHA-256 dell'impronta unita a 16 byte casuali generati sul momento. Non è l'impronta stessa, non permette di risalire al file e, senza la tua ricevuta, non è collegabile al tuo archivio.",
  },
  {
    who: 'Calendari OpenTimestamps',
    hosts: 'alice/bob.btc.calendar.opentimestamps.org, finney.calendar.eternitywall.com',
    when: 'Quando premi «Controlla conferma Bitcoin»',
    what: 'Gli stessi valori derivati contenuti nella tua prova .ots, per chiedere se sono già stati scritti in un blocco.',
  },
  {
    who: 'Blockstream Esplora',
    hosts: 'blockstream.info',
    when: 'Quando premi «Controlla conferma Bitcoin»',
    what: 'Il numero del blocco Bitcoin indicato nella prova, per leggerne l’intestazione pubblica e confermarne la data. Nessun dato tuo.',
  },
  {
    who: 'GitHub Pages',
    hosts: 'jpaladins.github.io',
    when: 'Quando apri il sito',
    what: 'La normale richiesta delle pagine e dei file del sito, come per qualsiasi sito web. Non riceve mai i tuoi archivi né i documenti generati.',
  },
]

export function PrivacyPage() {
  return (
    <article className="max-w-3xl">
      <p className="text-sm text-muted">Ultimo aggiornamento: {UPDATED}</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Privacy e sicurezza</h1>
      <p className="mt-5 max-w-[62ch] text-lg leading-relaxed text-ink-2">
        ProofMark è progettato perché tu non debba fidarti di noi. Il lavoro si svolge interamente nel tuo browser, il
        codice è pubblico e le prove si verificano senza ProofMark. Qui trovi, senza giri di parole, cosa succede ai tuoi
        dati.
      </p>

      <ul className="mt-10 grid gap-6 border-y border-line py-8 sm:grid-cols-3" aria-label="In breve">
        {SUMMARY.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <Icon aria-hidden className="size-6 text-emerald" />
            <p className="mt-3 font-semibold text-ink">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{text}</p>
          </li>
        ))}
      </ul>

      <Section id="locale" title="Cosa succede sul tuo dispositivo">
        <p>
          Quando trascini un archivio .zip, il browser lo legge dal disco a blocchi e ne calcola l'impronta SHA-256 in un
          processo separato (un Web Worker), così la pagina resta reattiva anche con file di molti gigabyte. L'impronta è
          una sequenza di 64 caratteri che identifica in modo univoco quel file esatto: cambia del tutto se cambia anche un
          solo byte, e dall'impronta è impossibile ricostruire il contenuto.
        </p>
        <p>
          Sempre nel browser vengono generati la ricevuta e l'attestato in PDF, il certificato JSON e il promemoria per il
          calendario. I file che scarichi sono creati in memoria e salvati direttamente sul tuo disco: non passano da alcun
          server. Anche autore e titolo dell'opera, se li inserisci, finiscono solo dentro questi documenti.
        </p>
        <p>
          Anche la verifica avviene in locale: l'archivio non lascia mai il tuo dispositivo. ProofMark ne ricalcola
          l'impronta e la confronta con quella della ricevuta o dell'attestato e con la prova Bitcoin allegata. Per questa
          parte non serve nemmeno la connessione.
        </p>
      </Section>

      <Section id="rete" title="Cosa esce dal tuo browser, e verso chi">
        <p>
          ProofMark non ha un server proprio: è un sito statico. Le uniche connessioni di rete sono quelle elencate qui
          sotto, e il browser stesso blocca qualsiasi altra destinazione (vedi «Sicurezza»).
        </p>
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Servizi esterni contattati dal sito</caption>
            <thead className="hidden bg-sunken text-ink sm:table-header-group">
              <tr>
                <th scope="col" className="w-[34%] px-4 py-3 font-semibold">Servizio</th>
                <th scope="col" className="w-[24%] px-4 py-3 font-semibold">Quando</th>
                <th scope="col" className="px-4 py-3 font-semibold">Cosa riceve</th>
              </tr>
            </thead>
            <tbody>
              {OUTGOING.map((row) => (
                <tr key={row.hosts} className="block border-t border-line first:border-t-0 sm:table-row">
                  <th scope="row" className="block px-4 pt-4 align-top font-normal sm:table-cell sm:py-4">
                    <span className="flex items-center gap-1.5 font-semibold text-ink">
                      <Globe aria-hidden className="size-4 shrink-0 text-muted" />
                      {row.who}
                    </span>
                    <span className="mt-1 block break-words font-mono text-xs text-muted">{row.hosts}</span>
                  </th>
                  <td className="block px-4 pt-2 align-top text-ink-2 sm:table-cell sm:py-4">{row.when}</td>
                  <td className="block px-4 pb-4 pt-2 align-top text-ink-2 sm:table-cell sm:py-4">{row.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Come qualsiasi servizio online, questi soggetti vedono l'indirizzo IP da cui arriva la richiesta e l'orario. Non
          ricevono il tuo archivio, il suo nome, la sua dimensione, i dati dichiarati né i documenti che generi. Le loro
          condizioni d'uso sono indipendenti da ProofMark; per GitHub vedi l'
          <a
            className="font-medium text-blue underline underline-offset-4 hover:text-ink"
            href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement"
          >
            informativa sulla privacy di GitHub
          </a>
          .
        </p>
      </Section>

      <Section id="non-facciamo" title="Cosa ProofMark non fa">
        <ul className="space-y-2">
          {[
            'Non carica i tuoi file e non ne legge il contenuto oltre a quanto serve per calcolare l’impronta.',
            'Non ha account, password, database o archivi di alcun tipo: non può conservare i tuoi dati perché non li riceve.',
            'Non usa cookie, statistiche di utilizzo, pixel di tracciamento o servizi pubblicitari.',
            'Non carica font, script o immagini da servizi esterni: tutto ciò che serve è pubblicato insieme al sito.',
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <Check aria-hidden className="mt-1 size-4 shrink-0 text-emerald" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p>
          L'unica informazione salvata nel tuo browser è la preferenza tra tema chiaro e scuro, nella chiave{' '}
          <Code>pm-theme</Code> della memoria locale, e solo se la cambi. Resta sul tuo dispositivo e puoi cancellarla
          svuotando i dati del sito.
        </p>
      </Section>

      <Section id="sicurezza" title="Sicurezza">
        <p>
          <strong className="text-ink">Il browser blocca ogni altra destinazione.</strong> Il sito dichiara una Content
          Security Policy che consente connessioni solo verso i domini elencati sopra (opentimestamps.org, eternitywall.com
          e blockstream.info) e permette di eseguire solo il codice pubblicato con il sito. Anche un errore nel codice non
          potrebbe inviare il tuo file altrove: sarebbe il browser stesso a impedirlo.
        </p>
        <p>
          <strong className="text-ink">Connessione cifrata.</strong> Il sito è servito solo in HTTPS, con HSTS attivo, e
          tutte le connessioni verso i servizi esterni sono cifrate.
        </p>
        <p>
          <strong className="text-ink">Prove che non dipendono da noi.</strong> La data di un attestato viene dalla
          blockchain Bitcoin, un registro pubblico che nessuno, nemmeno ProofMark, può modificare a posteriori. La verifica
          legge la data dalla blockchain, mai dal documento caricato: un attestato con una data alterata viene segnalato
          come non valido. Ricevuta e attestato in PDF non sono firmati; la prova crittografica è il file{' '}
          <Code>.ots</Code> allegato, con lo stesso nome dell'archivio, che chiunque può controllare con gli strumenti ufficiali di OpenTimestamps.
        </p>
        <p>
          <strong className="text-ink">Codice aperto.</strong> Tutto il codice è pubblico con licenza AGPL-3.0 ed è lo stesso che
          viene pubblicato sul sito, tramite un processo automatico visibile su GitHub.
        </p>
      </Section>

      <Section id="verificalo" title="Verificalo da solo">
        <p>Non devi crederci sulla parola. Puoi controllare tutto con il tuo browser:</p>
        <ol className="list-decimal space-y-2 pl-6 marker:text-muted">
          <li>
            Apri gli strumenti per sviluppatori (<Code>F12</Code>) e la scheda <em>Rete</em>, poi certifica un archivio:
            vedrai solo le richieste ai calendari OpenTimestamps, ciascuna di 32 byte.
          </li>
          <li>
            Dopo aver aperto il sito, scollega la connessione e usa la pagina Verifica: il confronto tra archivio e prova
            funziona lo stesso.
          </li>
          <li>
            Leggi il codice su{' '}
            <a className="font-medium text-blue underline underline-offset-4 hover:text-ink" href={REPO_URL}>
              GitHub
            </a>
            : la parte che contatta la rete è in <Code>src/core/ots/</Code>, la policy di sicurezza in{' '}
            <Code>src/csp.ts</Code>.
          </li>
        </ol>
      </Section>

      <Section id="limiti" title="Cosa resta da sapere">
        <ul className="list-disc space-y-2 pl-6 marker:text-muted">
          <li>
            Ricevute e attestati contengono impronta, nome e dimensione del file e gli eventuali dati dichiarati. Quando li
            condividi, chi li riceve vede queste informazioni.
          </li>
          <li>
            Chi possiede già lo stesso identico file può riconoscere che il tuo attestato si riferisce a quel file: è proprio
            ciò che rende la prova utile in una contestazione.
          </li>
          <li>
            Per ottenere la conferma Bitcoin i calendari OpenTimestamps devono essere raggiungibili. Una volta che la tua
            prova .ots è completa, non dipende più da loro né da ProofMark.
          </li>
          <li>Conserva l'archivio originale, la ricevuta o l'attestato e la prova .ots: ProofMark non ne tiene copie.</li>
        </ul>
      </Section>

      <aside className="mt-14 flex gap-3 rounded-xl border border-line bg-surface p-5 text-sm leading-relaxed text-ink-2">
        <LifeBuoy aria-hidden className="mt-0.5 size-5 shrink-0 text-ink" />
        <p>
          Domande o segnalazioni di sicurezza?{' '}
          <a className="font-medium text-blue underline underline-offset-4 hover:text-ink" href={`${REPO_URL}/issues`}>
            Apri una segnalazione su GitHub
          </a>
          . ProofMark non tratta dati personali e non ha un titolare del trattamento per i tuoi file, perché non li riceve
          mai.
        </p>
      </aside>
    </article>
  )
}
