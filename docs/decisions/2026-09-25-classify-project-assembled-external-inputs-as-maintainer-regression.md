---
decision_id: decision-classify-project-assembled-external-inputs-as-maintainer-regression
status: proposed
scope: benchmarks
title: Classify a pack the project assembles from external inputs as maintainer regression
decided_at: 2026-09-25
---

# Classify a pack the project assembles from external inputs as maintainer regression

## Context

[#140](https://github.com/redact-secret/redact-secret-benchmarks/issues/140)
asks for the first externally authored adversarial suite. No outside author
has submitted a pack. What the project can do alone is collect inputs that
others wrote in public, with no knowledge of redact-secret: IETF RFC
examples, vendor documentation, other scanners' test cases, and adversarial
string lists. It can then set the actions and ranges itself. The intake
contract ([decision](2026-09-22-define-external-adversarial-intake.md))
defines authorship by the person who submits the pack and sets its
expectations. It does not say who wrote the input text.

## Options

1. **Call it externally authored because the inputs are external.** This is
   the cheapest path to a public-adversarial result. But the choice of
   excerpts, the compositions, and every action and range still come from
   inside the project, where the detector source can be read. That is the
   overfitting risk the class exists to exclude.
2. **Call it maintainer regression, and keep the external provenance on
   every fixture.** Nothing is overstated, and the inputs still give harder
   cases than the project would write itself. #140's "externally authored"
   goal stays open.
3. **Do not assemble a pack until an outside author submits one.** Nothing
   is measured, and the intake and first-run tooling go untested on a real
   pack.

## Decision (proposed)

Option 2 is the default until a maintainer rules otherwise:

- A pack whose selection, composition, actions or ranges come from the
  project names the project as author (`affiliation: project-maintainer`).
  The validator then gives it `maintainer-regression`, even when every input
  is external. Where each input came from is recorded per fixture
  (`sources.json`), with source, pinned revision, license, and whether it is
  `verbatim` or `composed`.
- Test data from evaluated scanners (Gitleaks, TruffleHog, flare-redact) is
  not used as input, because it encodes those scanners' own expected output.
  Corpora mined from real repositories (SecretBench, FPSecretBench, Leaky
  Repo) are not used, because the contract rejects real-derived material.
- Such packs are for evaluation only. They are public, so they are not
  protected holdout, and nobody should tune detector features, weights or
  thresholds against them (#256).

`beta9-external-inputs` is the first pack under this rule.

## Consequences

- #140's acceptance criterion for an externally authored suite needs a pack
  from an outside author: a researcher, another scanner's maintainer, or a
  custodian. The intake contract, the first-run runner
  (`scripts/freeze-adversarial-first-run.mjs`) and the scoring
  (`benchmarks/lib/adversarial-first-run.ts`) are ready for that pack.
- A maintainer may later decide that transcribing an outside author's own
  labels is not authorship. Those labels include the secret values that
  detect-secrets asserts and Nosey Parker's negative examples. Under that
  ruling, a pack made only of such transcriptions could be re-attributed.
  The expectations digest does not cover authorship fields, so the frozen
  first run would stay valid.
