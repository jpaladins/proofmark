# English version and English-only GitHub — design

Date: 2026-10-25 · Status: approved in conversation, awaiting written-spec review

## Goal

ProofMark becomes bilingual: **English is the default language** of the site, Italian moves under
`/it/`. Everything visible on GitHub (repository description, README, docs, commit messages, pull
requests) is in **English only**. Documents (receipt and attestation PDF/JSON) come out in the
language of the site that issued them.

Success criteria:

- Every page, message, error and PDF exists in English and Italian; a missing English string is a
  compile error, not a runtime surprise.
- Links and QR codes in PDFs issued before this change keep working.
- Certificates and PDFs issued before this change still verify.
- `git log` on `main`, the PR list and every Markdown file in the repository read in English.

Out of scope: languages other than English and Italian; translating the AGPL `LICENSE` (already
English); changing the visual design.

## Work order

Two pull requests, in this order:

1. **English GitHub** — history rewrite, README/docs translation, repository metadata, PR edits.
   Done first, while no other branch is open, so nothing has to be rebased onto rewritten history.
2. **Bilingual site** — i18n, routing, PDF, tests.

## Part 1 — English GitHub

### Repository metadata

- Description: "Proof of existence for ZIP archives, anchored to the Bitcoin blockchain with
  OpenTimestamps — computed entirely in your browser."
- Topics: `opentimestamps`, `bitcoin`, `proof-of-existence`, `timestamping`, `sha256`, `privacy`.
- Homepage unchanged: `https://jpaladins.github.io/proofmark/`.

### Repository files

Translated to English, Italian versions removed: `README.md`, `docs/DEPLOY.md`, `NOTICE`, and the
existing documents under `docs/superpowers/` (spec and plan of 2026-10-17). The README gets one line
pointing Italian readers to the Italian site (`/proofmark/it/`). Badge labels become English
("license AGPL-3.0", "zero-knowledge · the file never leaves the browser"). Code comments are
already English; any Italian left in comments, workflow names or step names is translated.
`docs/mockups/attestato-preview.html` (an early Italian mockup no code uses) is deleted.

### Commit history

- Safety first: local branch `backup/main-before-english` and a `git bundle` of all refs, stored
  outside the repository.
- `git filter-branch --msg-filter` with a script that maps each existing commit message (by its
  original text) to an English translation written for it; merge commits `Titolo (#N)` map to the
  English PR title. The script fails if it meets a message missing from the map, so nothing stays
  Italian silently.
- Author, dates and trees are unchanged (only messages change); verify with
  `git diff backup/main-before-english main` = empty and the same commit count (59 + the PR's own).
- Force-push `main`, delete stale remote branches (e.g. `origin/fix/pdf-file-names`).
- No `Co-Authored-By: Claude` lines are reintroduced.

### Pull requests

`gh pr edit` on PRs #1–#14 sets an English title and body. Merge commit subjects in the rewritten
history match those titles.

### From now on

Commit messages, PR titles/bodies, code comments and docs are written in English.

## Part 2 — Bilingual site

### Approach

Hand-written, typed dictionaries — no i18n library. Chosen over i18next (≈40 KB, string keys whose
misses only show at runtime) and over duplicated pages per language (every change made twice).

```
src/i18n/
  types.ts     Lang = 'en' | 'it'; Messages type (derived from en.ts)
  en.ts        all English strings (source of truth for the shape)
  it.ts        all Italian strings, `satisfies Messages`
  index.ts     messages(lang), formatting helpers (dates, sizes) per locale
  LangContext  React context + useT() hook returning Messages for the current page
```

Strings that take values are functions (`(n: number) => string`), so interpolation and plurals are
type-checked. Messages are grouped by area (`header`, `certify`, `verify`, `privacy`, `pdf`,
`errors`, `ics`, …).

### URLs and routing

| Page    | English (default)   | Italian                  |
| ------- | ------------------- | ------------------------ |
| Home    | `/proofmark/`       | `/proofmark/it/`         |
| Verify  | `/proofmark/verify` | `/proofmark/it/verifica` |
| Privacy | `/proofmark/privacy`| `/proofmark/it/privacy`  |

- `src/pages.ts` becomes a table of routes: page id (`certify` | `verify` | `privacy`) × language →
  path. The router returns `{ page, lang }`; `toUrl(page, lang)` builds links.
- **Legacy path**: `/proofmark/verifica` (printed in QR codes of PDFs already issued) is recognised
  as Italian Verify and replaced (`history.replaceState`) by `/proofmark/it/verifica`, keeping the
  `#sha256=` fragment. Unknown paths fall back to the home page of the language implied by the
  prefix.
- The build plugin emits a copy of `index.html` for every path in the table plus `verifica/` and
  `404.html`; each copy gets the right `<html lang>`, `<title>` and meta description. At runtime
  `document.documentElement.lang` and `document.title` follow the current page.
- **Language switch** (EN | IT) in the header, on desktop and mobile: goes to the same page in the
  other language, keeps the fragment, saves the choice in `localStorage` (`pm:lang`; wrapped in
  try/catch like the theme).
- **Italian notice**: on English pages, when `navigator.languages` prefers Italian and no choice is
  saved, a slim bar "Questo sito è disponibile in italiano · Passa all'italiano · ✕" is shown.
  Choosing either language or closing it saves the choice and hides it. No automatic redirect.

### Documents

- `Certificate` gets `lang?: 'en' | 'it'`. New certificates always set it; a missing `lang` means
  Italian (every certificate issued so far). The attestation keeps the receipt's `lang`.
- Format identifiers do not change: `schema: 'proofmark/v1'`, `kind: 'ricevuta' | 'attestato'`, field
  names. Only the human text `declared.note` is written in the certificate's language
  ("declared by the applicant, not certified"); the parser accepts either.
- `buildAttestatoContent(cert, …)` takes its strings from `messages(cert.lang ?? 'it').pdf`; dates use
  the matching locale (`en-GB`: "28 May 2015, 17:41:18 UTC+2"; `it-IT` unchanged).
- The QR code and printed address point to Verify in the document's language
  (`…/proofmark/verify` or `…/proofmark/it/verifica`), with the same `#sha256=` fragment.
- File names from `proofFileNames`:

  |             | English                                | Italian                              |
  | ----------- | -------------------------------------- | ------------------------------------ |
  | Receipt     | `<name>_receipt.pdf` / `.json`         | `<name>_ricevuta.pdf` / `.json`      |
  | Attestation | `<name>_attestation.pdf` / `.json`     | `<name>_attestato.pdf` / `.json`     |
  | Proof       | `<name>.ots`                           | `<name>.ots`                         |

  The PDF attachments and commands use the same names, in both languages.
- The calendar reminder (`ics.ts`) is written in the page language and links to Verify in that
  language.
- Verify accepts PDFs and JSON in either language (attachments are already picked by extension).

### Errors

Core errors (`CertError`, `OtsError`) keep their `code` and carry an English developer message that
the UI never shows. The flows (`runCertification`, `loadEvidence`, `verifyOffline`, `checkBitcoin`)
take the page `lang` and write every user-facing text they produce (step messages, check labels and
details, `CertifyError` / `EvidenceError` messages) from `messages(lang)`; the UI shows those as it
does today. Dates inside check labels use the same locale.

### Rich page text

Plain strings live in `src/i18n/` and are shared by core, flows and UI. Paragraphs with inline
markup (links, `<Code>`, emphasis) live in `src/ui/i18n/{en,it}.tsx` as `ReactNode` values; the long
Privacy page is two content components (`PrivacyContentEn.tsx`, `PrivacyContentIt.tsx`) rendered by
`PrivacyPage` according to the language.

### Testing

- Router: every path ↔ `{ page, lang }`; `toUrl` round-trips; `/verifica#sha256=…` →
  `/it/verifica#sha256=…`; trailing slashes; unknown paths.
- Dictionaries: completeness is enforced by `satisfies Messages`; a test checks that no Italian
  string is left in `en.ts` for a few telltale words and that functions return non-empty strings.
- PDF: the existing layout/overflow tests (worst-case 255-character names, long declared data) run
  for both languages; attachment names and commands per language; certificates without `lang` render
  in Italian.
- Certificate: `lang` round-trips; old certificates without `lang` parse; attestation keeps `lang`.
- UI: certify and verify flows in English and Italian; language switch keeps page and fragment;
  Italian notice shows/hides and remembers the choice.
- Build: `npm run build` emits `index.html`, `verify/`, `privacy/`, `it/index.html`, `it/verifica/`,
  `it/privacy/`, `verifica/`, `404.html` with the right `lang`.
- Before merging: manual check in the browser of both languages, desktop and mobile width.
