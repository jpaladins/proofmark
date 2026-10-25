// English dictionary: the source of truth for the shape of `Messages`. Italian must match it.
export const en = {
  app: {
    title: 'ProofMark — Digital proof of existence',
    description:
      'Prove that a ZIP archive existed, anchored to the Bitcoin blockchain with OpenTimestamps. Your file never leaves your browser.',
  },
  files: { receipt: 'receipt', attestation: 'attestation' },
  /** Human text stored in the certificate JSON, in the certificate's language. */
  cert: { declaredNote: 'declared by the applicant, not certified' },
  /** Every string printed on the receipt and attestation PDF. Addresses and dates are passed in already formatted. */
  pdf: {
    tagline: 'DIGITAL PROOF OF EXISTENCE',
    receipt: {
      docLabel: 'Receipt no.',
      title: 'Registration receipt',
      subtitle: 'Fingerprint of the archive sent to the Bitcoin blockchain via OpenTimestamps',
      heroHeading: 'Registration sent: the date is not attested yet',
      heroBody:
        'The fingerprint has been sent to the OpenTimestamps calendars, which will write it into a Bitcoin block within a few hours. Only then can you download the attestation with the date certified by the blockchain.',
      statement:
        "This receipt documents that the SHA-256 cryptographic fingerprint shown above was sent to the OpenTimestamps calendars for registration on the Bitcoin blockchain. It does not attest any date yet: the date of existence will be that of the Bitcoin block that will contain the proof, shown in the attestation. The fingerprint was computed solely on the applicant's device: the content of the file was never transmitted to ProofMark or to third parties.",
      keepTogether: 'Keep together: the original .zip archive, this receipt and the .ots file with the same name as the archive.',
      warningsBody:
        'If you extract the files and compress them again, even without changing them, the fingerprint changes and this document can no longer be traced back to the archive.',
      proves: 'Only that the fingerprint was sent for registration. The date will be proved by the attestation.',
    },
    attestation: {
      docLabel: 'Attestation no.',
      title: 'Certificate of Digital Existence',
      subtitle: 'Proof of prior existence by anchoring to the Bitcoin blockchain (OpenTimestamps)',
      heroHeading: (moment: string) => `Existence attested on ${moment}`,
      stampKicker: 'Existence attested on',
      heroBody: (block: number) =>
        `An archive with the SHA-256 fingerprint shown below existed no later than this date, as shown by Bitcoin block #${block}, which contains the proof.`,
      statement: (moment: string, block: number) =>
        `This attestation documents that a file with the SHA-256 cryptographic fingerprint shown above existed no later than ${moment}, the date of Bitcoin block #${block}, which contains the proof. The fingerprint was computed solely on the applicant's device: the content of the file was never transmitted to ProofMark or to third parties. The attestation does not certify the authorship, content or originality of the work, nor the data declared by the applicant.`,
      keepTogether:
        'Keep together: the original .zip archive, this attestation and the .ots file with the same name as the archive.',
      warningsBody:
        'If you extract the files and compress them again, even without changing them, the fingerprint changes and this attestation can no longer be traced back to the archive.',
      proves: 'That the file existed no later than the date of the Bitcoin block shown and has not been altered since.',
    },
    issued: (date: string, time: string, offset: string) => `Issued on ${date} at ${time} (${offset})`,
    dateAtTime: (date: string, time: string) => `${date} at ${time}`,
    qrCaption: 'Scan to verify',
    declared: {
      tag: 'Data declared by the applicant — neither verified nor certified',
      author: 'Author',
      title: 'Title of the work',
    },
    subject: {
      fileName: 'File name',
      size: 'Size',
      exactBytes: (count: string) => `(${count} bytes)`,
      lastModified: "Last modified (from the user's system)",
      lastModifiedNote: '— not certified',
      algorithm: 'Fingerprint algorithm',
    },
    bitcoin: {
      confirmedPill: 'Confirmed',
      pendingPill: 'Awaiting confirmation',
      status: 'Status',
      confirmedStatus: 'Confirmed on the Bitcoin blockchain',
      pendingStatus: 'Awaiting confirmation in a Bitcoin block',
      block: 'Block',
      blockDate: 'Block date',
      precision: 'Precision',
      precisionValue: 'About two hours: it is the time recorded by the miners in the block header.',
      protocol: 'Protocol',
      calendars: 'Calendars',
      requested: 'Request sent on',
      requestedNote: '(device clock, not certified)',
      reminderHeading: 'Get the attestation.',
    },
    /** Printed on the receipt and shown on the result page: when and where to get the attestation. */
    pendingReminder: (verifyAddress: string) =>
      `In a few hours, come back to ${verifyAddress}, upload the archive and this receipt, and download the attestation with the date certified by the blockchain.`,
    verify: {
      intro: 'Verification does not need ProofMark: standard tools and the files attached to this PDF are enough.',
      hashStep: '1. Compute the fingerprint of the archive again',
      windowsComment: '# Windows (Command Prompt or PowerShell)',
      unixComment: '# macOS / Linux',
      otsStep: '2. Verify the Bitcoin anchoring (OpenTimestamps client: opentimestamps.org)',
      upgradeComment: '# once, after the confirmation',
      otherStep: '3. Or',
      otherText: (verifyAddress: string) => `scan the QR code or go to ${verifyAddress} and upload the archive with this PDF.`,
      attachmentsLabel: 'Files attached to this PDF:',
    },
    warnings: {
      heading: 'Keep the archive exactly as it is.',
      pending: (verifyAddress: string) =>
        `This receipt does not attest a date. After a few hours, come back to ${verifyAddress}, upload the archive and this receipt and download the attestation. Then keep the attestation and its updated Bitcoin proof (.ots) as well.`,
      copies: 'Make several copies on different media (external drive, cloud).',
      noRename: 'Do not rename the archive: the name does not affect the fingerprint, but it makes verification easier.',
    },
    limits: {
      proves: 'What it proves',
      notProves: 'What it does not prove',
      notProvesValue: 'Who the author is, the originality of the work or the truthfulness of the declared data.',
      blockchain: 'Blockchain',
      blockchainValue:
        'The proof is anchored to the Bitcoin blockchain, a public ledger that no one can change after the fact. Anyone can verify it with OpenTimestamps without trusting ProofMark.',
      value: 'Legal value',
      valueValue:
        'Evidence to be freely assessed. It is not a qualified electronic time stamp under Regulation (EU) 910/2014 (eIDAS). For specific legal needs, consult a professional.',
    },
    footer: {
      proof: 'The cryptographic proof is the .ots file attached to this PDF, verifiable with OpenTimestamps',
      generated: (version: string) => `Generated locally in the browser · ProofMark v${version} · open source (AGPL-3.0)`,
    },
    sections: {
      declared: 'Declared data',
      subject: 'Subject of the certification',
      bitcoin: 'Bitcoin anchoring',
      statement: 'Statement',
      verify: 'How to verify independently',
      warnings: 'Important warnings',
      limits: 'Nature and limits of the proof',
    },
    pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
    page2Heading: 'Verification instructions and warnings',
    attachments: { ots: 'OpenTimestamps proof (Bitcoin blockchain)', json: 'ProofMark certificate (JSON)' },
    metaSubject: (fileName: string, sha256: string) => `Proof of existence of the archive ${fileName} (SHA-256 ${sha256})`,
  },
  /** User-facing failures and results of the certification and verification flows. */
  errors: {
    hashRead: 'Could not read the archive. Try again.',
    ots: 'Could not reach the Bitcoin calendars. Check your connection and try again.',
    otsMismatch: 'The proof received does not match the archive. Try again.',
    pdf: 'Could not generate the PDF receipt. Try again.',
    unexpected: 'An unexpected error occurred. Try again.',
    evidence: {
      wrongType: 'Upload a ProofMark receipt, attestation PDF or JSON certificate.',
      certificateJson: 'The certificate is not a valid JSON file.',
      certificateInvalid: 'This certificate cannot be read.',
      pdfUnreadable: 'The PDF cannot be read.',
      pdfMissingProofs: 'This PDF does not contain ProofMark proofs (an .ots file and a JSON certificate).',
    },
  },
  flow: {
    calendars: (count: number) => (count === 1 ? '1 calendar' : `${count} calendars`),
    /** Dates in check labels: the date, then the time, then the UTC offset. */
    blockMoment: (date: string, time: string, offset: string) => `${date}, ${time} ${offset}`,
    checks: {
      hashOk: "The archive's fingerprint matches the certificate",
      hashFail: 'The fingerprint does not match: the archive is different from the certified one',
      hashFailDetail: (archive: string, certificate: string) => `Archive: ${archive}\nCertificate: ${certificate}`,
      otsUnreadable: 'Bitcoin proof cannot be read',
      otsMatches: 'The Bitcoin proof refers to this archive',
      otsOther: 'The Bitcoin proof refers to a different fingerprint',
      receiptPending: 'Receipt: the date is not attested yet. Check the Bitcoin confirmation.',
      attestationBlockOk: (block: number) =>
        `The proof contains the attestation in Bitcoin block #${block}. Check the confirmation to verify the date.`,
      attestationBlockDiffers: 'The certificate declares a different block from the one in the proof',
      bitcoinPending: 'Confirmation not available yet, try again in a few hours',
      dateMismatch: "The certificate's date does not match the blockchain",
      dateMismatchDetail: (block: number, moment: string) => `Blockchain: block #${block} on ${moment}`,
      confirmed: (block: number, moment: string) => `Confirmed in block #${block} on ${moment}`,
      bitcoinInvalid: 'The Bitcoin proof does not match the blockchain',
      bitcoinInvalidDetail: (height: number) => `The proof does not match Bitcoin block #${height}.`,
      bitcoinUnreachable: 'Could not reach the Bitcoin network. Try again later.',
    },
  },
  /** Reminder calendar event for the Bitcoin confirmation. */
  reminder: {
    prodId: '-//ProofMark//Reminder//EN',
    summary: 'ProofMark — Bitcoin confirmation',
    description: (verifyUrl: string, fileName: string, certId: string) =>
      `Open ${verifyUrl}, upload the archive ${fileName} and the attestation ${certId}, and download the attestation updated with the Bitcoin confirmation.`,
  },
}
