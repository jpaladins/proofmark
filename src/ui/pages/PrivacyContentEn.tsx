import { Cpu, Lock, ShieldCheck } from 'lucide-react'
import { REPO_URL } from '@/core/app'
import { CheckItems, Code, Help, Intro, linkClass, OutgoingTable, Section, Summary, type Outgoing } from './privacyParts'

const SUMMARY = [
  {
    icon: Cpu,
    title: 'Everything happens on your device',
    text: "The archive's fingerprint, the receipt, the attestation and the verification are all computed by your browser.",
  },
  {
    icon: Lock,
    title: 'The file never leaves your device',
    text: 'Neither the archive nor its content is uploaded, not even in part. ProofMark has no server that could receive it.',
  },
  {
    icon: ShieldCheck,
    title: 'No personal data collected',
    text: 'No account, no cookies, no usage statistics, no tracking.',
  },
]

const OUTGOING: Outgoing[] = [
  {
    who: 'OpenTimestamps calendars',
    hosts: 'a.pool.opentimestamps.org, b.pool.opentimestamps.org, a.pool.eternitywall.com',
    when: 'When you certify an archive',
    what: 'A 32-byte value computed as the SHA-256 of the fingerprint combined with 16 random bytes generated on the spot. It is not the fingerprint itself, it cannot be traced back to the file and, without your receipt, it cannot be linked to your archive.',
  },
  {
    who: 'OpenTimestamps calendars',
    hosts: 'alice/bob.btc.calendar.opentimestamps.org, finney.calendar.eternitywall.com',
    when: 'When you press “Check Bitcoin confirmation”',
    what: 'The same derived values contained in your .ots proof, to ask whether they have already been written into a block.',
  },
  {
    who: 'Blockstream Esplora',
    hosts: 'blockstream.info',
    when: 'When you press “Check Bitcoin confirmation”',
    what: 'The number of the Bitcoin block named in the proof, to read its public header and confirm its date. None of your data.',
  },
  {
    who: 'GitHub Pages',
    hosts: 'jpaladins.github.io',
    when: 'When you open the site',
    what: "The usual request for the site's pages and files, as for any website. It never receives your archives or the documents you generate.",
  },
]

const NOT_DONE = [
  'It does not upload your files, and it reads their content only as far as needed to compute the fingerprint.',
  'It has no accounts, passwords, databases or storage of any kind: it cannot keep your data because it never receives it.',
  'It uses no cookies, usage statistics, tracking pixels or advertising services.',
  'It loads no fonts, scripts or images from external services: everything it needs is published with the site.',
]

/** The Privacy page in English. */
export function PrivacyContentEn() {
  return (
    <>
      <Intro updated="Last updated: 18 October 2026" title="Privacy & security">
        ProofMark is designed so that you do not have to trust us. The work happens entirely in your browser, the code is
        public and the proofs can be verified without ProofMark. Here is, in plain words, what happens to your data.
      </Intro>

      <Summary label="In short" items={SUMMARY} />

      <Section id="local" title="What happens on your device">
        <p>
          When you drag in a .zip archive, the browser reads it from disk in chunks and computes its SHA-256 fingerprint in
          a separate process (a Web Worker), so the page stays responsive even with files of many gigabytes. The
          fingerprint is a sequence of 64 characters that uniquely identifies that exact file: it changes completely if even
          a single byte changes, and the content cannot be reconstructed from it.
        </p>
        <p>
          The PDF receipt and attestation, the JSON certificate and the calendar reminder are also generated in the
          browser. The files you download are created in memory and saved straight to your disk: they pass through no
          server. The author and title of the work, if you enter them, end up only inside these documents too.
        </p>
        <p>
          Verification is local as well: the archive never leaves your device. ProofMark computes its fingerprint again and
          compares it with the one in the receipt or attestation and with the attached Bitcoin proof. This part does not
          even need a connection.
        </p>
      </Section>

      <Section id="network" title="What leaves your browser, and to whom">
        <p>
          ProofMark has no server of its own: it is a static site. The only network connections are those listed below,
          and the browser itself blocks any other destination (see “Security”).
        </p>
        <OutgoingTable
          caption="External services contacted by the site"
          headers={['Service', 'When', 'What it receives']}
          rows={OUTGOING}
        />
        <p>
          Like any online service, these parties see the IP address the request comes from and the time. They do not
          receive your archive, its name, its size, the declared data or the documents you generate. Their terms of use are
          independent of ProofMark; for GitHub, see the{' '}
          <a className={linkClass} href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement">
            GitHub privacy statement
          </a>
          .
        </p>
      </Section>

      <Section id="not-done" title="What ProofMark does not do">
        <CheckItems items={NOT_DONE} />
        <p>
          The only information saved in your browser is your choice between the light and dark theme, under the{' '}
          <Code>pm-theme</Code> key in local storage, and only if you change it. It stays on your device and you can delete
          it by clearing the site's data.
        </p>
      </Section>

      <Section id="security" title="Security">
        <p>
          <strong className="text-ink">The browser blocks every other destination.</strong> The site declares a Content
          Security Policy that allows connections only to the domains listed above (opentimestamps.org, eternitywall.com
          and blockstream.info) and lets only the code published with the site run. Even a bug in the code could not send
          your file elsewhere: the browser itself would prevent it.
        </p>
        <p>
          <strong className="text-ink">Encrypted connection.</strong> The site is served only over HTTPS, with HSTS
          enabled, and all connections to external services are encrypted.
        </p>
        <p>
          <strong className="text-ink">Proofs that do not depend on us.</strong> The date of an attestation comes from the
          Bitcoin blockchain, a public ledger that no one, not even ProofMark, can change after the fact. Verification reads
          the date from the blockchain, never from the uploaded document: an attestation with an altered date is reported as
          invalid. The PDF receipt and attestation are not signed; the cryptographic proof is the attached{' '}
          <Code>.ots</Code> file, with the same name as the archive, which anyone can check with the official
          OpenTimestamps tools.
        </p>
        <p>
          <strong className="text-ink">Open source.</strong> All the code is public under the AGPL-3.0 licence and is the
          same code published on the site, through an automated process visible on GitHub.
        </p>
      </Section>

      <Section id="check-it" title="Check it yourself">
        <p>You do not have to take our word for it. You can check everything with your browser:</p>
        <ol className="list-decimal space-y-2 pl-6 marker:text-muted">
          <li>
            Open the developer tools (<Code>F12</Code>) and the <em>Network</em> tab, then certify an archive: you will see
            only the requests to the OpenTimestamps calendars, each of 32 bytes.
          </li>
          <li>
            After opening the site, disconnect from the network and use the Verify page: the comparison between archive and
            proof still works.
          </li>
          <li>
            Read the code on{' '}
            <a className={linkClass} href={REPO_URL}>
              GitHub
            </a>
            : the part that talks to the network is in <Code>src/core/ots/</Code>, the security policy in{' '}
            <Code>src/csp.ts</Code>.
          </li>
        </ol>
      </Section>

      <Section id="limits" title="What else to know">
        <ul className="list-disc space-y-2 pl-6 marker:text-muted">
          <li>
            Receipts and attestations contain the fingerprint, name and size of the file and any declared data. When you
            share them, whoever receives them sees this information.
          </li>
          <li>
            Anyone who already has the very same file can recognise that your attestation refers to it: that is exactly
            what makes the proof useful in a dispute.
          </li>
          <li>
            To get the Bitcoin confirmation, the OpenTimestamps calendars must be reachable. Once your .ots proof is
            complete, it no longer depends on them or on ProofMark.
          </li>
          <li>Keep the original archive, the receipt or attestation and the .ots proof: ProofMark keeps no copies.</li>
        </ul>
      </Section>

      <Help>
        Questions or security reports?{' '}
        <a className={linkClass} href={`${REPO_URL}/issues`}>
          Open an issue on GitHub
        </a>
        . ProofMark processes no personal data and has no data controller for your files, because it never receives them.
      </Help>
    </>
  )
}
