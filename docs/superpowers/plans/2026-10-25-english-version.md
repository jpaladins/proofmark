# English Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make everything on GitHub English-only, then make the site bilingual (English default, Italian under `/it/`) with documents issued in the site's language.

**Architecture:** Typed hand-written dictionaries (`src/i18n` for plain strings shared by core/flows/UI, `src/ui/i18n` for rich `ReactNode` copy). The router derives `{ page, lang }` from the URL; a React context hands `lang` to components; core and flows receive `lang` explicitly. The certificate records `lang` so the attestation matches its receipt.

**Tech Stack:** Vite 8, React 19, TypeScript 6 (strict), Tailwind v4, Vitest 5 + Testing Library (jsdom), pdf-lib, oxlint, `gh` CLI, git.

**Spec:** `docs/superpowers/specs/2026-10-25-english-version-design.md`

## Global Constraints

- No new runtime dependency; CSP in `src/csp.ts` unchanged.
- English is the default: `/proofmark/`, `/proofmark/verify`, `/proofmark/privacy`; Italian: `/proofmark/it/`, `/proofmark/it/verifica`, `/proofmark/it/privacy`.
- Legacy `/proofmark/verifica` → `history.replaceState` to `/proofmark/it/verifica`, fragment kept.
- Certificate format identifiers unchanged: `schema: 'proofmark/v1'`, `kind: 'ricevuta' | 'attestato'`; new optional `lang?: 'en' | 'it'`, missing = `'it'`.
- File names — en: `<base>_receipt.*`, `<base>_attestation.*`; it: `<base>_ricevuta.*`, `<base>_attestato.*`; proof `<base>.ots` in both.
- Storage key for the language choice: `pm:lang`; every `localStorage` access in try/catch.
- Commits, PR titles/bodies, comments and docs in English. **No `Co-Authored-By: Claude` trailer and no "Generated with Claude Code" line** (user instruction). Commit author is the configured git user (jpaladins).
- Every PR is merged only after the user approves it in chat.
- `npx tsc -b && npm run lint && npx vitest run` passes at the end of every task.

## Review Focus

- A QR code in an Italian PDF issued before this change (`…/proofmark/verifica#sha256=<hex>`) must open Italian Verify with the hash pre-filled — test in Task 5.
- A receipt issued in Italian before this change (no `lang`) verified on the English site must yield an Italian attestation named `_attestato.*` — test in Task 7.
- A 255-character archive name must not push English page-2 text into the footer — test in Task 6.
- A browser with storage blocked must still render and switch language (no crash, no notice loop) — test in Task 9.
- A deep link reload on GitHub Pages (`/proofmark/it/privacy`) must serve a built `index.html` with `lang="it"` — test in Task 5.

---

## Part 1 — English GitHub (branch `docs/english-version-spec`, then `main`)

### Task 1: Translate repository documents

**Files:**
- Modify: `README.md`, `docs/DEPLOY.md`, `NOTICE`, `docs/superpowers/specs/2026-10-17-proofmark-design.md`, `docs/superpowers/plans/2026-10-17-proofmark.md`
- Delete: `docs/mockups/attestato-preview.html`

- [ ] **Step 1:** Translate each file to English, keeping structure, commands and links. README: title tagline "Proof of existence for ZIP archives, anchored to the Bitcoin blockchain with OpenTimestamps and computed entirely in your browser."; badges `license-AGPL--3.0` and `zero--knowledge-the%20file%20never%20leaves%20the%20browser`; add under the site link: `Italian version of the site: [jpaladins.github.io/proofmark/it/](https://jpaladins.github.io/proofmark/it/)`. Verification commands use `archive.ots` / `archive.zip`. NOTICE keeps the legal meaning of the 7(b) attribution "Developed by JPaladins" exactly. In the old plan, replace the mockup reference with "(mockup removed)".
- [ ] **Step 2:** Delete the mockup; remove its mention from the first comment line of `src/core/pdf/renderAttestato.ts`.
- [ ] **Step 3:** Check nothing Italian is left in Markdown: `git grep -nI -E "[àèéìòù]| della | per | che " -- '*.md' NOTICE` → only the Italian-site link line and quoted Italian UI strings in the new spec (e.g. "Questo sito è disponibile in italiano").
- [ ] **Step 4:** Commit `docs: translate README, deploy guide, NOTICE and design docs to English`, push, open PR "English documentation and design for the English version" (English body, no Claude line), wait for CI, ask the user to approve the merge, merge with `--merge --subject "English documentation and design for the English version (#15)" --body ""`.

### Task 2: Rewrite commit messages on `main` in English

**Files:**
- Create (scratchpad, not in repo): `commit-map.json`, `translate_msg.py`

- [ ] **Step 1:** Backup: `git branch backup/main-before-english main` and `git bundle create <scratchpad>/proofmark-before-english.bundle --all`.
- [ ] **Step 2:** Export messages: `git log main --format='%H%x00%B%x1e'` → write `commit-map.json` as `{ "<exact original message>": "<English message>" }` for every distinct message. Merge commits `X (#N)` become `<English PR title> (#N)`. Keep conventional prefixes (`feat:`, `fix(ui):`…). Messages already English map to themselves.
- [ ] **Step 3:** `translate_msg.py`: reads stdin bytes as UTF-8, strips trailing whitespace, looks up the map (same normalisation applied to keys), writes the translation + `\n`; exits 1 with the message on stderr when missing.
- [ ] **Step 4:** `git filter-branch -f --msg-filter "python <scratchpad>/translate_msg.py" -- main`.
- [ ] **Step 5:** Verify: `git diff backup/main-before-english main` empty; `git rev-list --count` equal on both; `git log main --format=%B | grep -cE "[àèéìòù]"` = 0; `git log main --format=%B | grep -ci "co-authored-by: claude"` = 0; author names/dates unchanged (`git log --format='%an %ad'` diff between the two = empty).
- [ ] **Step 6:** `git push --force-with-lease origin main`; delete remote branches other than `main` and `gh-pages`-like deploy refs (`git push origin --delete fix/pdf-file-names docs/english-version-spec`); `git fetch --prune`; confirm the deploy workflow on the new head succeeds.

### Task 3: English pull requests and repository metadata

- [ ] **Step 1:** For PRs #1–#15: `gh pr edit N --title "<English title>" --body-file <scratchpad>/prN.md` with the title used in Task 2's merge-commit map and an English translation of the current body (`gh pr view N --json body`), without any Claude line.
- [ ] **Step 2:** `gh repo edit jpaladins/proofmark --description "Proof of existence for ZIP archives, anchored to the Bitcoin blockchain with OpenTimestamps — computed entirely in your browser." --add-topic opentimestamps,bitcoin,proof-of-existence,timestamping,sha256,privacy`.
- [ ] **Step 3:** Verify: `gh pr list --state all --json number,title` shows only English titles; `gh repo view --json description,repositoryTopics` matches.

---

## Part 2 — Bilingual site (branch `feat/english-version` from rewritten `main`)

### Task 4: Dictionaries and language helpers

**Files:**
- Create: `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/it.ts`, `src/i18n/index.ts`, `src/i18n/i18n.test.ts`

**Interfaces:**
- Produces: `type Lang = 'en' | 'it'`; `const LANGS: readonly Lang[]`; `type Messages = typeof en` (en is a plain object, no `as const`); `messages(lang: Lang): Messages`; `localeOf(lang: Lang): 'en-GB' | 'it-IT'`; `formatBytes(size: number, lang: Lang): string` (moved from `content.ts`).
- Sections of `Messages` (filled in by later tasks as they move strings): `app`, `header`, `notice`, `footer`, `certify`, `steps`, `verify`, `checks`, `errors`, `privacy` (plain strings only), `pdf`, `ics`, `files` (`{ receipt: string; attestation: string }` = `'receipt' | 'attestation'` / `'ricevuta' | 'attestato'`).

- [ ] **Step 1: Failing tests** in `i18n.test.ts`:
  - `messages('en').files` → `{ receipt: 'receipt', attestation: 'attestation' }`; `messages('it').files` → `{ receipt: 'ricevuta', attestation: 'attestato' }`.
  - `formatBytes(4, 'en')` → `'4 bytes'`, `formatBytes(1536, 'en')` → `'1.5 KB'`, `formatBytes(1536, 'it')` → `'1,5 KB'`, `formatBytes(4, 'it')` → `'4 byte'`.
  - "English dictionary has no Italian": walk `messages('en')` recursively, call functions with sample args (`1`, `'x'`), and assert no value matches `/\b(della|degli|archivio|ricevuta|attestato|verifica)\b/i`.
- [ ] **Step 2:** Run `npx vitest run src/i18n` → FAIL (module missing).
- [ ] **Step 3:** Implement with only `app` and `files` sections populated; `it.ts` is `export const it: Messages = { … }`.
- [ ] **Step 4:** Run → PASS. Commit `feat(i18n): typed English and Italian dictionaries`.

### Task 5: Bilingual routes, build copies, language context

**Files:**
- Modify: `src/pages.ts`, `src/ui/router.ts`, `vite.config.ts`, `src/App.tsx`, `src/test/setup.ts` (if it pins the URL)
- Create: `src/ui/LangContext.tsx`, `src/ui/router.test.ts`, `scripts/build.test.ts` (or extend the existing build check)

**Interfaces:**
- Produces in `src/pages.ts`: `type PageId = 'certify' | 'verify' | 'privacy'`; `const ROUTES: Record<Lang, Record<PageId, string>>` = en `{ certify: '/', verify: '/verify', privacy: '/privacy' }`, it `{ certify: '/it/', verify: '/it/verifica', privacy: '/it/privacy' }`; `const LEGACY: Record<string, { page: PageId; lang: Lang }>` = `{ '/verifica': { page: 'verify', lang: 'it' } }`; `allPaths(): { path: string; lang: Lang }[]` (routes + legacy).
- Produces in `router.ts`: `toUrl(page: PageId, lang: Lang): string`; `routeOf(pathname: string): { page: PageId; lang: Lang; legacy: boolean }`; `navigate(page: PageId, lang: Lang): void`; `useRoute(): { page; lang; navigate: (page: PageId, lang?: Lang) => void; hashParams: URLSearchParams }` (default `lang` = current). On a legacy match `useRoute` calls `history.replaceState` to `toUrl(page, lang) + location.hash` once.
- Produces `LangContext.tsx`: `LangProvider` (value from `useRoute().lang`, sets `document.documentElement.lang` and `document.title = messages(lang).app.title`), `useLang(): Lang`, `useT(): Messages`.

- [ ] **Step 1: Failing tests** `router.test.ts` (BASE stubbed to `/proofmark/`):
  - `routeOf('/proofmark/')` → `{ page: 'certify', lang: 'en', legacy: false }`; `'/proofmark/verify'` → verify/en; `'/proofmark/it/'` and `'/proofmark/it'` → certify/it; `'/proofmark/it/verifica/'` → verify/it; `'/proofmark/verifica'` → verify/it, `legacy: true`; `'/proofmark/it/nope'` → certify/it; `'/proofmark/nope'` → certify/en.
  - `toUrl` round-trips for every `ROUTES` entry; `toUrl('certify','en')` = `/proofmark/`, `toUrl('certify','it')` = `/proofmark/it/`.
  - Rendering `<App />` at `/proofmark/verifica#sha256=<64 hex>` ends at `location.pathname === '/proofmark/it/verifica'` with the same hash, and the Italian Verify page shows the hash field pre-filled (as the current QR test does).
- [ ] **Step 2:** Build test: after `npm run build`, `dist/` contains `index.html`, `verify/index.html`, `privacy/index.html`, `it/index.html`, `it/verifica/index.html`, `it/privacy/index.html`, `verifica/index.html`, `404.html`; `it/**` and `verifica/` have `<html lang="it">` and the Italian `<title>`; the others `lang="en"`.
- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement. `index.html` becomes English (`lang="en"`, title "ProofMark — Digital proof of existence", description "Prove that a ZIP archive existed, anchored to the Bitcoin blockchain with OpenTimestamps. Your file never leaves your browser."); the plugin rewrites `lang`, `<title>` and the description from `messages(lang).app` for each emitted copy. `App` switches on `page` and wraps in `LangProvider`. Update existing UI tests' start URLs to `/proofmark/it/…` and nav expectations to the new Italian paths, so the current Italian suite keeps passing unchanged in wording.
- [ ] **Step 5:** Run all checks → PASS. Commit `feat(router): English default routes with Italian under /it/`.

### Task 6: PDF and file names per language

**Files:**
- Modify: `src/core/cert/certificate.ts`, `src/core/cert/fileNames.ts`, `src/core/app.ts`, `src/core/pdf/content.ts`, `src/core/pdf/renderAttestato.ts`, `src/i18n/en.ts`, `src/i18n/it.ts`, tests `certificate.test.ts`, `fileNames.test.ts`, `content.test.ts`, `renderAttestato.test.ts`, `src/test/certFixtures.ts`, `scripts/` sample renderer

**Interfaces:**
- Consumes: `Lang`, `messages`, `localeOf`, `formatBytes(size, lang)` (Task 4).
- Produces: `Certificate.lang?: Lang`; `certLang(c: Pick<Certificate,'lang'>): Lang` (= `c.lang ?? 'it'`); `buildCertificate({ …, lang: Lang })` sets it; `confirmCertificate` keeps it; `declaredNote(lang): string` replaces `DECLARED_NOTE` (it `'dichiarati dal richiedente, non certificati'`, en `'declared by the applicant, not certified'`); `verifyUrlFor(lang: Lang): string` in `app.ts` (`${APP_URL}/verify` | `${APP_URL}/it/verifica`) and `verifyDisplayFor(lang)`; `proofFileNames(cert)` picks the suffix from `messages(certLang(cert)).files`; `verifyUrl(sha256Hex, lang)` in `renderAttestato.ts`; `buildAttestatoContent(cert, opts)` reads `certLang(cert)`; `PENDING_REMINDER` becomes `messages(lang).pdf.pendingReminder`.

- [ ] **Step 1: Failing tests:**
  - `certificate.test.ts`: `buildCertificate({ …, lang: 'en' }).lang === 'en'` and `declared.note === 'declared by the applicant, not certified'`; `confirmCertificate` preserves `lang`; `parseCertificate` of a JSON without `lang` succeeds and `certLang` → `'it'`; serialize/parse round-trips `lang: 'en'`.
  - `fileNames.test.ts`: en receipt → `le-stagioni-del-vetro_v3_receipt.pdf/.json`, en attestation → `hello-world_attestation.*`; no `lang` → `_ricevuta`/`_attestato` (existing cases).
  - `content.test.ts`: duplicate the existing Italian cases with English fixtures (`pendingCert({ lang: 'en' })`): title `'Registration receipt'`, docLabel `'Receipt no.'`, hero heading `'Registration sent: the date is not attested yet'`; attestation title `'Certificate of Digital Existence'`, docLabel `'Attestation no.'`, heading `'Existence attested on 28 May 2015, 15:41:18 UTC'`, stamp `{ kicker: 'Existence attested on', date: '28 May 2015', time: '17:41:18 UTC+2' }`; brand credit `'BY JPALADINS'`; reminder body contains `jpaladins.github.io/proofmark/verify`; Italian reminder contains `jpaladins.github.io/proofmark/it/verifica`; commands contain `ots verify "le-stagioni-del-vetro_v3.ots"`; English text keeps the eIDAS limit (`'910/2014'` present) and never contains `'qualified timestamp'`, `'legally certain date'` or `'digicert'` (case-insensitive).
  - `renderAttestato.test.ts`: the existing overflow/worst-case tests parametrised with `describe.each(['it','en'])`; English attachments named `<base>.ots` and `<base>_receipt.json`; the QR payload of an English receipt starts with `https://jpaladins.github.io/proofmark/verify#sha256=`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement: move every string in `content.ts` into `messages(lang).pdf` (functions for interpolated text), date formatters take `localeOf(lang)`; `sections`, `limits`, `footer`, `warnings`, `verify.steps` all from the dictionary. English copy is a faithful translation of the Italian, same structure and claims.
- [ ] **Step 4:** Run all checks → PASS. Render samples (`PM_SAMPLES=1 npx vitest run scripts`, add `sample-receipt-en.pdf`, `sample-attestation-en.pdf`) and inspect both pages visually. Commit `feat(pdf): receipts and attestations in English or Italian`.

### Task 7: Flows and reminder in the page language

**Files:**
- Modify: `src/flow/certify.ts`, `src/flow/useCertify.ts`, `src/flow/verify.ts`, `src/core/ots/ots.ts`, `src/core/ots/format.ts`, `src/core/cert/certificate.ts` (error texts), `src/ui/ics.ts`, dictionaries, tests `certify.test.ts`, `verify.test.ts`, `ots.test.ts`, `format.test.ts`, `certificate.test.ts`, ics test

**Interfaces:**
- Produces: `runCertification(input: { …; lang: Lang }, deps, onStep, signal)`; `useCertify(deps?)` start function takes `lang`; `loadEvidence(file: File, lang: Lang)`; `verifyOffline(zipSha256, ev, lang)`; `checkBitcoin(ev, lang, deps?)`; `buildReminderIcs({ at, certId, fileName, lang })`. `OTS_ERROR`, `OTS_MISMATCH`, `PDF_ERROR` constants removed in favour of `messages(lang).errors.*`. `OtsError`/`CertError` messages become English developer text; `OtsError('invalid')` gets a `height?: number` field used by `checkBitcoin` for the localized detail.
- The attestation language: `buildAttestato` keeps `ev.cert.lang` (no `lang` parameter).

- [ ] **Step 1: Failing tests:**
  - `certify.test.ts`: with `lang: 'en'` the ots failure message is `'Could not reach the Bitcoin calendars. Check your connection and try again.'`, the done message `'3 calendars'`, and the certificate has `lang: 'en'`; existing Italian expectations pass with `lang: 'it'`.
  - `verify.test.ts`: `verifyOffline(…, 'en')` ok label `"The archive's fingerprint matches the certificate"`; `checkBitcoin(…, 'en')` ok label `'Confirmed in block #358391 on 28 May 2015, 17:41 UTC+2'` (pin TZ as existing tests do); `loadEvidence(txtFile, 'en')` message `'Upload a ProofMark receipt, attestation PDF or JSON certificate.'`; an Italian legacy receipt (no `lang`) passed to `buildAttestato` yields `certificate.lang === undefined`→`certLang` `'it'` and an Italian PDF (content title `'Attestato di Esistenza Digitale'`).
  - ics test: en `SUMMARY:ProofMark — Bitcoin confirmation`, `URL:https://jpaladins.github.io/proofmark/verify`, `PRODID:-//ProofMark//Reminder//EN`; it keeps today's text and points to `/it/verifica`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run all checks → PASS. Commit `feat(flow): verification and certification messages in the page language`.

### Task 8: Pages and components in both languages

**Files:**
- Create: `src/ui/i18n/en.tsx`, `src/ui/i18n/it.tsx` (`type UiRich = typeof enRich`, `useRich(): UiRich`), `src/ui/pages/PrivacyContentEn.tsx`, `src/ui/pages/PrivacyContentIt.tsx`, `src/ui/en.test.tsx`
- Modify: `src/ui/Layout.tsx`, `src/ui/components/*.tsx`, `src/ui/pages/CertifyPage.tsx`, `src/ui/pages/VerifyPage.tsx`, `src/ui/pages/PrivacyPage.tsx`, `src/ui/formatEta.ts`, `src/ui/useTheme.ts` (aria labels only via `useT`)

**Interfaces:**
- Consumes: `useT()`, `useLang()` (Task 5), flow signatures with `lang` (Task 7), `proofFileNames` (Task 6).
- Produces: `formatEta(sec: number, lang: Lang): string`; `NavLink` takes `page: PageId`; skip-link target id `content` (was `contenuto`).

- [ ] **Step 1: Failing tests** `en.test.tsx` at `/proofmark/`: header shows `'Zero-Knowledge: files are processed only in your browser'`, nav links `'Certify'` (`/proofmark/`) and `'Verify'` (`/proofmark/verify`); footer `'Privacy & security'` → `/proofmark/privacy`; certify flow with fakes downloads `opera_receipt.pdf`, `opera_receipt.json`, `opera.ots`; verify flow with an English receipt fake shows the English check labels and downloads `opera_attestation.pdf`; Privacy page h1 `'Privacy & security'`. The existing Italian suites (start URL `/proofmark/it/…`) stay green with unchanged Italian strings.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Move every UI string to `src/i18n` (plain) or `src/ui/i18n` (rich); pages pass `useLang()` to flows. **Step 4:** Run all checks → PASS. `grep -rnE "[àèéìòù]" src/ui --include=*.tsx | grep -v i18n/ | grep -v PrivacyContentIt | grep -v test` → empty. Commit `feat(ui): English and Italian pages`.

### Task 9: Language switch and Italian notice

**Files:**
- Create: `src/ui/components/LangSwitch.tsx`, `src/ui/components/ItalianNotice.tsx`, `src/ui/useLangChoice.ts`, `src/ui/lang.test.tsx`
- Modify: `src/ui/components/Header.tsx`, `src/ui/Layout.tsx`

**Interfaces:**
- Produces: `useLangChoice(): { saved: Lang | undefined; save: (l: Lang) => void }` (key `pm:lang`, try/catch, in-memory fallback when storage throws); `LangSwitch` — two links `EN` / `IT` (`aria-label` "English" / "Italiano", `aria-current` on the active one, `hreflang`), href `toUrl(page, other) + location.hash`, click saves and navigates; `ItalianNotice` — rendered by `Layout` only when `lang === 'en'`, `saved === undefined` and `navigator.languages[0]` starts with `it`; text "Questo sito è disponibile in italiano." with link "Passa all'italiano" (saves `it`, navigates to the same page in Italian) and a close button `aria-label="Chiudi"` (saves `en`).

- [ ] **Step 1: Failing tests** `lang.test.tsx`:
  - On `/proofmark/verify#sha256=<hex>` clicking `IT` → `/proofmark/it/verifica#sha256=<hex>` and `localStorage['pm:lang'] === 'it'`; clicking `EN` back → `/proofmark/verify`.
  - Notice visible with `navigator.languages = ['it-IT','en']` and empty storage; hidden after "Chiudi" and after reload (re-render) with `pm:lang = 'en'`; hidden on Italian pages; hidden for `['en-US']`.
  - With `Storage.prototype.getItem/setItem` throwing: page renders, notice shows, "Chiudi" hides it for the session without throwing.
  - At 320px viewport class assertions are not testable — covered by the manual check in Task 10.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; the switch sits before `ThemeToggle` in the header and stays one compact pill on phones (`EN | IT`, text-xs). **Step 4:** Run all checks → PASS. Commit `feat(ui): language switch and Italian notice`.

### Task 10: Docs, manual check, PR

- [ ] **Step 1:** README: document the two languages, the URL table and the `lang` field in the certificate format section.
- [ ] **Step 2:** `npm run build && npx vite preview` and check in the browser pane, at 1280px and 375px, in light and dark: `/proofmark/`, `/proofmark/verify`, `/proofmark/privacy`, the three `/it/` pages, `/proofmark/verifica#sha256=…` redirect, switch, notice (`navigator.languages` stubbed via devtools is fine), a full certify run with a small zip producing an English receipt, and verify of that receipt. Open the downloaded PDFs. Stop the preview server afterwards.
- [ ] **Step 3:** Commit, push `feat/english-version`, open PR "English version of the site" (English body, no Claude line), wait for CI, ask the user to approve the merge; after merging, watch the deploy and compare live `renderAttestato-*.js` hash with the local build, then open `https://jpaladins.github.io/proofmark/` and `/it/`.
