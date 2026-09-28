# #378: untargeted benign corpus, 15 to 120 files, action-split false alarms

**Result:** redact-secret flagged 8 of 120 untargeted controls. 7 of them carry at least
one `redact` finding (gating) and 1 is warn-only. The published package
(`@redact-secret/core@0.1.0-beta.9`) and the candidate built from product `main`
`9ab0fa02f2aeeda16a2c99e04862ebb0f0e9b5e7` produce identical findings, so there is
no regression and no improvement. In the frozen 60-file subset, 3 controls are
flagged and all 3 are gating. No family's support status, benign case count or
benign axis moved in either mode.

This is a file-level count on a project-authored synthetic corpus. The corpus is
also a shadow-scoring tuning category
(`tuning/shadow-scoring-development-v1.json`). It is not a production-population
sample or an independent-sample accuracy estimate, and it is no evidence for any
credential family ([ADR](../../decisions/2026-09-21-add-untargeted-benign-corpus.md)).

## Corpus

- `fixtures/real-world-shapes/corpus.json`: 120 files, 20 per axis over six axes:
  `realworld-config`, `realworld-logs`, `realworld-lockfile` (lockfiles and
  manifests), `realworld-source`, `realworld-docs`, and the new
  `realworld-agent-output` (agent transcripts, CLI/JSON tool output, bot comments).
  The 105 new files were authored locally before any scanner run, and none was
  edited after scanning. Every file is `must-not-flag/T3`, untargeted
  (`fixture-detectors.json` entry `[]`, no `detectors`), in `corpora/development`.
- Independence: no duplicate id, path or bytes. The highest value-normalized
  shingle similarity between any two files is 0.169 (threshold 0.5), which gives
  120 independent shapes. The corpus is balanced at 20 per axis (floor 15, share cap
  0.25). `benchmarks/lib/corpus-independence.ts` implements the checks and
  `tests/real-world-shapes.test.mjs` runs them on every commit.
- Frozen baseline subset: `fixtures/real-world-shapes/frozen-baseline-v1.json`,
  60 files (the first ten per axis in corpus order, chosen before scanning),
  digest `64841e0d52c829b9a6a50037c1d871daa53799e120510af253e6420d0ff05b4f`.
  Tests fail if a member is edited, regrouped or removed.
- Corpus hash (`real-world-shapes`): `7adc76864a1a1f017f1ac3a88de933301819ffe28af154ab9b9ff7e155355de3`.
  Fixture semantic index digest: `4e82ac020b4e9cc0ed9710491a21627aa23c5444ffff49b22cf40bee7410c81e` (3,638 fixtures).
- Review status stays **draft, independent human review required**.

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret-benchmarks` | `a50645833545489cfdb2b1dfc76c8d440313ee04`, clean |
| Published baseline | `@redact-secret/core@0.1.0-beta.9` (the version `package.json` pins) |
| Candidate | product `main` `9ab0fa02f2aeeda16a2c99e04862ebb0f0e9b5e7`, clean, `0.1.0-beta.10`; core `4c1a81b0a96e9d3343a696a7d2e60e9080ed95ccff20ec9acbe140619324aebf`, node (darwin-arm64) `0627b0fcb06f59c8cc1cb5621f19af341c9aa1df19bdfaa7b128ad1832a856bb`, wasm `5508eec4473b30aba98c967b8fd31c677280db9dd506e680e206bdef085fea0c` |
| Peers | gitleaks 8.30.1, trufflehog 3.97.4 (read-only binaries from `peers:provision`, archive SHA-256 `57e2a41c1e196cf96cae49ca2151f5e9207be2f5c41349b5ea49cb5dcfc606b7`; not the self-updating Homebrew binary; snapshots refreshed in this change), flare-redact 1.6.1 |
| Lockfile | `97692c4cd77c448583d28ea071290d574a7cbf71ef6962853e490732f4af5aec` |
| `eval:candidate` | run `e5092e9c-3681-4b08-83dc-06f29eab899f`, `complete`, 3,638/3,638 fixtures, corpus hash `b6b5472709ac99ef1bdafdbf141a30fe8d7bbef36aba07b3c56e43a7ddaccb15` |

## Action split (file level)

A file is flagged when it has any finding and gating when at least one finding is
`redact` or `block`. `warn` is shown but is not a false alarm under product ADR
`2026-09-20-warn-unconditionally-on-high-signal-contextual-names`. Peers report no
action, so their flags are shown as any-action only.

| Scanner (mode) | Subset | Controls | Flagged | Gating | Warn-only |
| --- | --- | ---: | ---: | ---: | ---: |
| redact-secret (published 0.1.0-beta.9) | frozen | 60 | 3 | 3 | 0 |
| | added | 60 | 5 | 4 | 1 |
| | full | 120 | 8 | 7 | 1 |
| redact-secret (candidate main `9ab0fa0`) | frozen | 60 | 3 | 3 | 0 |
| | added | 60 | 5 | 4 | 1 |
| | full | 120 | 8 | 7 | 1 |
| gitleaks 8.30.1 | full (frozen / added) | 120 | 4 (3 / 1) | n/a | n/a |
| trufflehog 3.97.4 | full (frozen / added) | 120 | 1 (0 / 1) | n/a | n/a |
| flare-redact 1.6.1 | full (frozen / added) | 120 | 3 (1 / 2) | n/a | n/a |

Candidate vs published, per fixture: 0 regressions, 0 improvements. The findings
are byte-identical in type, confidence and action.

Every redact-secret finding is `generic-token` `contextual_secret`. The gating
(`redact`, high confidence) spans fall on non-secret references and identifiers
that sit under credential-like names: Kubernetes secret object and key names,
reverse-DNS keychain item identifiers, a templated secret-manager lookup, a variable
lookup expression, and a placeholder constant identifier. The warn-only file is a
Terraform `(sensitive value)` marker. The 7 gating files are recorded as an
`observed` false-positive known gap (`benchmarks/known-gaps.json`) for independent
review. None was relabelled or edited.

## Per-family movement

`eval:classify` ran on develop `0a73b7db198c628dde74fb815d3029eb6c0acf42` (before)
and on `a50645833545489cfdb2b1dfc76c8d440313ee04` (after), both clean, trufflehog
3.97.4:

- published mode: stable 61 / provisional 23 / pending 2 of 86 families, before and after;
- candidate mode (`9ab0fa0` artifacts above): stable 64 / provisional 20 / pending 2 of 86, before and after;
- per family: 0 changes in status, qualification profile, `benignCases`,
  `benignFalseAlarms`, `benignAxes`, `benignAxisIds`, `totalFixtures`, `positiveCases`
  or `twinPairs`.

## Commands

```sh
export PATH=<dir from `npm run peers:provision -- --dir <dir>`>:$PATH   # trufflehog 3.97.4
npm run peers:snapshots:refresh
npm run bench -- --strict --category=real-world-shapes                  # published
npm run eval:classify
# in redact-secret at 9ab0fa02f2aeeda16a2c99e04862ebb0f0e9b5e7:
npm run benchmark:candidate -- --benchmark-ref a50645833545489cfdb2b1dfc76c8d440313ee04 \
  --benchmark-repo <abs path to redact-secret-benchmarks> --output-dir <abs dir>
npm run bench -- --strict --category=real-world-shapes --candidate-package=<core.tgz> \
  --candidate-node-package=<node.tgz> --candidate-wasm-package=<wasm.tgz> \
  --candidate-source-commit=9ab0fa02f2aeeda16a2c99e04862ebb0f0e9b5e7
npm run eval:classify -- <same four candidate flags>
node --import tsx scripts/report-untargeted-action-split.mjs \
  --baseline <published real-world-shapes.json> --candidate <candidate real-world-shapes.json>
```

The machine-readable summary is in
[`378-untargeted-benign-corpus.json`](378-untargeted-benign-corpus.json). It holds
fixture ids, action tallies and identities only, never matched text.
