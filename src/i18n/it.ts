import type { Messages } from './index.ts'

export const it: Messages = {
  app: {
    title: 'ProofMark — Prova di esistenza digitale',
    description:
      "Certifica l'esistenza di un archivio ZIP sulla blockchain Bitcoin con OpenTimestamps. Il file non lascia mai il tuo browser.",
  },
  files: { receipt: 'ricevuta', attestation: 'attestato' },
  cert: { declaredNote: 'dichiarati dal richiedente, non certificati' },
  pdf: {
    tagline: 'PROVA DI ESISTENZA DIGITALE',
    receipt: {
      docLabel: 'Ricevuta n.',
      title: 'Ricevuta di registrazione',
      subtitle: "Impronta dell'archivio inviata alla blockchain Bitcoin tramite OpenTimestamps",
      heroHeading: 'Registrazione inviata: la data non è ancora attestata',
      heroBody:
        "L'impronta è stata inviata ai calendari OpenTimestamps, che la scriveranno in un blocco Bitcoin entro qualche ora. Solo allora potrai scaricare l'attestato con la data certificata dalla blockchain.",
      statement:
        "La presente ricevuta documenta che l'impronta crittografica SHA-256 sopra indicata è stata inviata ai calendari OpenTimestamps per la registrazione sulla blockchain Bitcoin. Non attesta ancora alcuna data: la data di esistenza sarà quella del blocco Bitcoin che conterrà la prova, riportata nell'attestato. L'impronta è stata calcolata esclusivamente sul dispositivo del richiedente: il contenuto del file non è mai stato trasmesso a ProofMark né a terzi.",
      keepTogether: "Conserva insieme: l'archivio .zip originale, questa ricevuta e il file .ots con lo stesso nome dell'archivio.",
      warningsBody:
        "Se estrai i file e li ricomprimi, anche senza modificarli, l'impronta cambia e questo documento non sarà più riconducibile all'archivio.",
      proves: "Solo che l'impronta è stata inviata per la registrazione. La data sarà dimostrata dall'attestato.",
    },
    attestation: {
      docLabel: 'Attestato n.',
      title: 'Attestato di Esistenza Digitale',
      subtitle: 'Prova di anteriorità tramite ancoraggio sulla blockchain Bitcoin (OpenTimestamps)',
      heroHeading: (moment) => `Esistenza attestata al ${moment}`,
      stampKicker: 'Esistenza attestata al',
      heroBody: (block) =>
        `Un archivio con l'impronta SHA-256 riportata sotto esisteva non oltre questa data, come risulta dal blocco Bitcoin #${block} che ne contiene la prova.`,
      statement: (moment, block) =>
        `Il presente attestato documenta che un file avente l'impronta crittografica SHA-256 sopra indicata esisteva in data non successiva al ${moment}, data del blocco Bitcoin #${block} che ne contiene la prova. L'impronta è stata calcolata esclusivamente sul dispositivo del richiedente: il contenuto del file non è mai stato trasmesso a ProofMark né a terzi. L'attestato non certifica la paternità, il contenuto o l'originalità dell'opera, né i dati dichiarati dal richiedente.`,
      keepTogether: "Conserva insieme: l'archivio .zip originale, questo attestato e il file .ots con lo stesso nome dell'archivio.",
      warningsBody:
        "Se estrai i file e li ricomprimi, anche senza modificarli, l'impronta cambia e questo attestato non sarà più riconducibile all'archivio.",
      proves: 'Che il file esisteva non oltre la data del blocco Bitcoin indicato e che da allora non è stato alterato.',
    },
    issued: (date, time, offset) => `Emesso il ${date} alle ${time} (${offset})`,
    dateAtTime: (date, time) => `${date} alle ${time}`,
    qrCaption: 'Scansiona per verificare',
    declared: {
      tag: 'Dati dichiarati dal richiedente — non verificati né certificati',
      author: 'Autore',
      title: "Titolo dell'opera",
    },
    subject: {
      fileName: 'Nome del file',
      size: 'Dimensione',
      exactBytes: (count) => `(${count} byte)`,
      lastModified: "Ultima modifica (dal sistema dell'utente)",
      lastModifiedNote: '— informazione non certificata',
      algorithm: 'Algoritmo di impronta',
    },
    bitcoin: {
      confirmedPill: 'Confermato',
      pendingPill: 'In attesa di conferma',
      status: 'Stato',
      confirmedStatus: 'Confermato sulla blockchain Bitcoin',
      pendingStatus: 'In attesa di conferma in un blocco Bitcoin',
      block: 'Blocco',
      blockDate: 'Data del blocco',
      precision: 'Precisione',
      precisionValue: "Circa due ore: è l'orario registrato dai miner nell'intestazione del blocco.",
      protocol: 'Protocollo',
      calendars: 'Calendari',
      requested: 'Richiesta inviata il',
      requestedNote: '(orologio del dispositivo, non certificato)',
      reminderHeading: "Ottieni l'attestato.",
    },
    pendingReminder: (verifyAddress) =>
      `Tra qualche ora torna su ${verifyAddress}, carica l'archivio e questa ricevuta e scarica l'attestato con la data certificata dalla blockchain.`,
    verify: {
      intro: 'La verifica non richiede ProofMark: bastano strumenti standard e i file allegati a questo PDF.',
      hashStep: "1. Ricalcola l'impronta dell'archivio",
      windowsComment: '# Windows (Prompt dei comandi o PowerShell)',
      unixComment: '# macOS / Linux',
      otsStep: "2. Verifica l'ancoraggio Bitcoin (client OpenTimestamps: opentimestamps.org)",
      upgradeComment: '# dopo la conferma, una volta',
      otherStep: '3. Oppure',
      otherText: (verifyAddress) => `scansiona il QR code o vai su ${verifyAddress} e carica l'archivio con questo PDF.`,
      attachmentsLabel: 'File allegati a questo PDF:',
    },
    warnings: {
      heading: "Conserva l'archivio esattamente com'è.",
      pending: (verifyAddress) =>
        `Questa ricevuta non attesta una data. Dopo qualche ora torna su ${verifyAddress}, carica l'archivio e questa ricevuta e scarica l'attestato. Conserva poi anche l'attestato e la sua prova Bitcoin aggiornata (.ots).`,
      copies: 'Fai più copie su supporti diversi (disco esterno, cloud).',
      noRename: "Non rinominare l'archivio: il nome non incide sull'impronta, ma semplifica la verifica.",
    },
    limits: {
      proves: 'Cosa dimostra',
      notProves: 'Cosa non dimostra',
      notProvesValue: "Chi è l'autore, l'originalità dell'opera o la veridicità dei dati dichiarati.",
      blockchain: 'Blockchain',
      blockchainValue:
        'La prova è ancorata alla blockchain Bitcoin, un registro pubblico che nessuno può modificare a posteriori. Chiunque può verificarla con OpenTimestamps senza fidarsi di ProofMark.',
      value: 'Valore',
      valueValue:
        'Elemento di prova liberamente valutabile. Non è una validazione temporale elettronica qualificata ai sensi del Regolamento (UE) 910/2014 (eIDAS). Per esigenze legali specifiche rivolgiti a un professionista.',
    },
    footer: {
      proof: 'La prova crittografica è il file .ots allegato a questo PDF, verificabile con OpenTimestamps',
      generated: (version) => `Generato localmente nel browser · ProofMark v${version} · open source (AGPL-3.0)`,
    },
    sections: {
      declared: 'Dati dichiarati',
      subject: 'Oggetto della certificazione',
      bitcoin: 'Ancoraggio Bitcoin',
      statement: 'Dichiarazione',
      verify: 'Come verificare in modo indipendente',
      warnings: 'Avvertenze importanti',
      limits: 'Natura e limiti della prova',
    },
    pageOf: (page, total) => `Pagina ${page} di ${total}`,
    page2Heading: 'Istruzioni di verifica e avvertenze',
    attachments: { ots: 'Prova OpenTimestamps (blockchain Bitcoin)', json: 'Certificato ProofMark (JSON)' },
    metaSubject: (fileName, sha256) => `Prova di esistenza dell'archivio ${fileName} (SHA-256 ${sha256})`,
  },
}
