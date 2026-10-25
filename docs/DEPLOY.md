# Publishing ProofMark on GitHub Pages

ProofMark is a static site. The GitHub Action `.github/workflows/deploy.yml` publishes it on every push to `main`, at `https://jpaladins.github.io/proofmark/`. No servers, external accounts or costs are needed.

## 1. Enable GitHub Pages (once)

Repository `jpaladins/proofmark` → **Settings** → **Pages** → **Build and deployment** → **Source: GitHub Actions**.

Alternatively, with the [GitHub CLI](https://cli.github.com/):

```bash
gh api -X POST repos/jpaladins/proofmark/pages -f build_type=workflow
```

## 2. Publish

Every push to `main` runs the tests and the build and publishes `dist/`. Progress is visible in the **Actions** tab → *Deploy to GitHub Pages*, or you can start it by hand with **Run workflow**.

The `.github/workflows/ci.yml` workflow runs typecheck, lint, tests and build on every pull request.

## How it works under the hood

- **Site path.** It is a *project site*, so everything lives under `/proofmark/` (`base` in `vite.config.ts`). The public address used in the PDFs, the QR code and the reminders is defined in `src/core/app.ts`.
- **The `/verifica` page.** GitHub Pages only serves real files. The build copies `index.html` to `verifica/index.html`, so the QR code link opens verification directly, and to `404.html` for any other path.
- **Security.** GitHub Pages does not allow custom headers.
  - The Content-Security-Policy (`src/csp.ts`) is inserted as a `<meta>` tag in the build.
  - HTTPS and HSTS are already guaranteed by `github.io`.
  - The site only connects to the OpenTimestamps calendars and to `blockstream.info`.
- **No server.** There is no server-side forwarding any more: the OpenTimestamps calendars and Blockstream accept direct calls from the browser.

## If you rename the repository

Update `BASE` in `vite.config.ts`, `APP_URL` in `src/core/app.ts` and the links in `README.md`.

> Receipts and attestations already issued carry the address printed on them and in the QR code. As long as they are in circulation, keep the site reachable at that address.

## Final check

1. Open `https://jpaladins.github.io/proofmark/`, certify a small `.zip` and download the receipt.
2. After a few hours open **Verify**, upload the `.zip` and the receipt, check the Bitcoin confirmation and download the attestation.
3. Scan the attestation's QR code with your phone: the Verify page must open with the fingerprint already filled in.
