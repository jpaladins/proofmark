import { Cpu, Lock, ShieldCheck } from 'lucide-react'
import { REPO_URL } from '@/core/app'
import { CheckItems, Code, Help, Intro, linkClass, OutgoingTable, Section, Summary, type Outgoing } from './privacyParts'

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

const OUTGOING: Outgoing[] = [
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

const NOT_DONE = [
  'Non carica i tuoi file e non ne legge il contenuto oltre a quanto serve per calcolare l’impronta.',
  'Non ha account, password, database o archivi di alcun tipo: non può conservare i tuoi dati perché non li riceve.',
  'Non usa cookie, statistiche di utilizzo, pixel di tracciamento o servizi pubblicitari.',
  'Non carica font, script o immagini da servizi esterni: tutto ciò che serve è pubblicato insieme al sito.',
]

/** The Privacy page in Italian. */
export function PrivacyContentIt() {
  return (
    <>
      <Intro updated="Ultimo aggiornamento: 18 ottobre 2026" title="Privacy e sicurezza">
        ProofMark è progettato perché tu non debba fidarti di noi. Il lavoro si svolge interamente nel tuo browser, il
        codice è pubblico e le prove si verificano senza ProofMark. Qui trovi, senza giri di parole, cosa succede ai tuoi
        dati.
      </Intro>

      <Summary label="In breve" items={SUMMARY} />

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
        <OutgoingTable
          caption="Servizi esterni contattati dal sito"
          headers={['Servizio', 'Quando', 'Cosa riceve']}
          rows={OUTGOING}
        />
        <p>
          Come qualsiasi servizio online, questi soggetti vedono l'indirizzo IP da cui arriva la richiesta e l'orario. Non
          ricevono il tuo archivio, il suo nome, la sua dimensione, i dati dichiarati né i documenti che generi. Le loro
          condizioni d'uso sono indipendenti da ProofMark; per GitHub vedi l'
          <a className={linkClass} href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement">
            informativa sulla privacy di GitHub
          </a>
          .
        </p>
        <p>
          Il link <strong className="text-ink">Offrimi un caffè</strong> nel footer è un normale collegamento a Ko-fi, un
          servizio esterno per le donazioni: il sito non carica nulla da Ko-fi e non gli invia nulla. Ko-fi vede la tua
          visita solo se apri il link, secondo la sua informativa sulla privacy.
        </p>
      </Section>

      <Section id="non-facciamo" title="Cosa ProofMark non fa">
        <CheckItems items={NOT_DONE} />
        <p>
          Le uniche informazioni salvate nel tuo browser, nella memoria locale, sono la preferenza tra tema chiaro e scuro,
          nella chiave <Code>pm-theme</Code>, e solo se la cambi, e la lingua scelta, nella chiave <Code>pm:lang</Code>, e
          solo se scegli una lingua o chiudi l'avviso che propone la versione italiana. Restano sul tuo dispositivo e puoi
          cancellarle svuotando i dati del sito.
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
            <a className={linkClass} href={REPO_URL}>
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

      <Help>
        Domande o segnalazioni di sicurezza?{' '}
        <a className={linkClass} href={`${REPO_URL}/issues`}>
          Apri una segnalazione su GitHub
        </a>
        . ProofMark non tratta dati personali e non ha un titolare del trattamento per i tuoi file, perché non li riceve
        mai.
      </Help>
    </>
  )
}
