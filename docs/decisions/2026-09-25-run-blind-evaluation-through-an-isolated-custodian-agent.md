---
decision_id: decision-run-blind-evaluation-through-an-isolated-custodian-agent
status: accepted
scope: benchmarks
title: Run the blind evaluation through an isolated custodian agent and release aggregates only
decided_at: 2026-09-25
---

# Run the blind evaluation through an isolated custodian agent and release aggregates only

## Context

[#142](https://github.com/redact-secret/redact-secret-benchmarks/issues/142)
(epic [#138](https://github.com/redact-secret/redact-secret-benchmarks/issues/138))
asks for a beta.9 evaluation against fixtures that detector implementers
cannot inspect or tune against, held by a named custodian who releases only
an aggregate. The project has one human operator, who also directs every
product-implementing agent. No outside person is available to act as
custodian for beta.9.

The in-repo holdout lifecycle ([`holdout/README.md`](../../holdout/README.md))
keeps protected inputs in an ignored directory inside a checkout, measures
the installed dependency, and publishes pass/fail counts. That is not enough
for #142: it does not measure the exact candidate tarballs, it has no leak,
false-alarm or instability figures with intervals, and fixtures inside a
checkout sit one `git add -f` away from a commit.

## Decision

The user decided the custodian model; the rules are in
[`docs/specs/blind-evaluation.md`](../specs/blind-evaluation.md).

1. **The custodian is an isolated agent session.** It authors and holds the
   synthetic blind fixtures, runs the safety review, freezes and runs the
   candidate, and releases the aggregate. Product-implementing agents and the
   orchestrator never see raw fixtures, expected ranges or per-fixture
   results.
2. **Fixtures live outside every repository**, in the sibling directory
   `redact-secret-blind-fixture` beside the benchmark checkout (mode 0700,
   never a Git repository). The runner defaults to that path and refuses one
   inside the checkout or below any `.git`.
3. **Freeze, then one run.** `npm run blind:run -- freeze` records the
   candidate tarball hashes, adapter configuration, replay count, benchmark
   commit and lockfile, runtime and a corpus commitment. `run` refuses any
   difference. A candidate identity gets one attempt per epoch, spent at
   reservation. A product change after a result needs a new candidate
   identity and a new freeze.
4. **Aggregate only.** The release is `schemas/blind-aggregate-v1.json`, a
   whitelist: measurable share, withheld reasons, instability, leaked spans
   and false alarms with Wilson 95% intervals, lattice outcome counts,
   strata of at least five fixtures, and immutable candidate and benchmark
   identities. No overall score. `npm run blind:check-public` fails CI if a
   corpus, freeze or ledger is tracked or published, or if a committed
   aggregate breaks the whitelist.
5. **State the independence achieved.** Every aggregate records
   `achieved: procedural-separation` and `organisationalIndependence: false`
   with a fixed statement, and reports must repeat it. Blind results are a
   separate evidence class (`custodian-blind`) and are never combined with
   public qualification or external adversarial evidence.
6. **Disclosure rotates the epoch.** Disclosed fixtures go to public
   regression coverage and are replaced under a new epoch; the runner
   refuses changed fixtures under an old epoch label and old fixtures under
   a new one.

## Consequences

- Phase A (this decision) ships the infrastructure. Phase B, the blind run
  against the frozen beta.9 candidate, is the custodian agent's job and is
  not done by any implementing session.
- The result is weaker than the custodian #138 imagined. One person can read
  the private directory, and the custodian agent may share blind spots with
  the product agents. The report says so rather than calling the result
  independent.
- The in-repo holdout lifecycle is unchanged and remains the place for a
  protected corpus a separate human custodian delivers to CI.
- `evidence:query` does not yet list blind aggregates; that is added when
  phase B commits the first one.
