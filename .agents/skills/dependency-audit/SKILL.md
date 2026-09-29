---
name: dependency-audit
description: Scan this repository's npm dependency tree for known vulnerabilities and registry-signature problems with OSV-Scanner and npm audit signatures, separating build/dev tooling from the peer and candidate scanner packages this repository intentionally installs to benchmark them. Use when asked to audit dependencies, before publishing, or for "dependency-audit", "/dependency-audit". Report-only.
---

# dependency-audit

Answer one question: does any dependency this repository installs or runs
have a known vulnerability, a yanked version, or a bad registry signature?
Per the [Boundary rule](../../../AGENTS.md), this is about this repository's
own supply chain — never a statement about a benchmarked scanner's detection
quality.

## Scope

`package.json` (`"private": true`; this repository never publishes its own
package) and `package-lock.json`.

## Run

1. `npm ci` from a clean tree.
2. `osv-scanner scan source -L package-lock.json --format json`. Record the
   OSV-Scanner version and scan time.
3. `npm audit signatures` — verifies registry signatures and provenance
   attestations for every installed package.

## Classify every hit

This repository's runtime `dependencies` are not ordinary third-party
libraries — they are the subjects being benchmarked:

- **Candidate/peer scanner packages** (`@redact-secret/core`, `flare-redact`,
  and anything else installed to run a comparative `eval`): a vulnerability
  here is evidence about that package, not a hole in this repository's own
  code. Still report it — a vulnerable version installed in `package-lock.json`
  still executes inside this repository's CI, with whatever access that job
  has — but classify it separately from an ordinary dependency finding and
  do not phrase it as a claim about the scanner's detection accuracy (that
  belongs to the `known-gaps.json` lifecycle, not here).
- **Build/dev tooling** (`ajv`, `tsx`, `typescript`, `vite`, `@types/node`,
  and anything else under `devDependencies`): a normal supply-chain finding.
  Treat with ordinary urgency scaled by whether it runs in a CI job that also
  holds AWS/GitHub publish credentials (`publish-site.yml`) versus one that
  doesn't (`validate.yml`).
- **Out of scope for this skill:** the ephemeral `package.json` that
  `scanners/candidate.mjs`'s `installCandidate` writes into a temp directory
  for `eval:candidate`/`benchmark:candidate`. Its dependencies are local
  `file:` tarballs, not registry packages — OSV-Scanner and `npm audit
  signatures` don't see them and can't meaningfully score them. That
  candidate-execution trust boundary is covered by `docs/specs/threat-model.md`
  and the `owasp-review`/`vulnerability-test` skills, not this one.
- **Reachable?** State whether the vulnerable function is used by our code or
  scripts. Say "not assessed" when unsure; never guess "not reachable".

## Output

| Class | Package@version | Advisory (OSV/GHSA/CVE) | Severity | Fixed in | Reachable | Action |
| --- | --- | --- | --- | --- | --- | --- |

Then the `npm audit signatures` summary (verified, missing, invalid) and a
verdict: `no known vulnerabilities` or the counts by class.

## Rules

- Do not upgrade anything. A version bump that changes the candidate/peer
  scanner's resolved version can re-key benchmark ledgers (see the Peer
  scanner version note in `AGENTS.md`) — propose it instead of applying it.
- Never paste tokens. If a registry call needs auth, stop and say so.
