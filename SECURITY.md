# Security policy

ProofMark runs entirely in the browser: archives are never uploaded, and the only data that leaves the device is a
non-reversible derivative of the SHA-256 fingerprint, sent to the OpenTimestamps calendars.

## Reporting a vulnerability

Please report vulnerabilities **privately** through
[GitHub's private vulnerability reporting](https://github.com/jpaladins/proofmark/security/advisories/new)
(the **Report a vulnerability** button on the repository's *Security* tab), not in a public issue.

Include what you found, how to reproduce it and the impact you expect. You will get an answer as soon as possible, and
the fix will be published together with a security advisory that credits you, unless you prefer otherwise.

Questions that are not security issues are welcome as [issues](https://github.com/jpaladins/proofmark/issues).

## Scope

- The site published at https://jpaladins.github.io/proofmark/ and the code in this repository.
- The receipts and attestations it generates (PDF, JSON and `.ots` files).

The OpenTimestamps calendars, Blockstream's block explorer and GitHub Pages are third-party services; report issues
in them to their maintainers.
