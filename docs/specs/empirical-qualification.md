# Empirical qualification and safe observation metadata

Issue: [#177](https://github.com/redact-secret/redact-secret-benchmarks/issues/177).
Decision: [qualify T2 families empirically](../decisions/2026-09-24-qualify-t2-empirically.md).

`benchmarks/support/empirical-observations.json` is the only committed input
for provider-issued observations. Its schema is
`schemas/empirical-observations-v1.json`; validation and deterministic summary
logic live in `benchmarks/support/empirical.ts`.

The record stores provider and family identity, dates, issuance route, a
pseudonymous subject, length, prefix, segment lengths, alphabet classes,
separators, checksum behavior, revocation state, uncertainty, supported
contexts, corroboration classes, and unresolved contradictions. Every
observation declares `rawValueRetained: false`. The schema has no credential,
hash, sample, log, screenshot, or free-form value field.

Raw credentials must stay in a local, non-recording inspection process. They
must never enter Git, GitHub, CI, snapshots, benchmark output, shell history,
or an AI prompt. Revoke an observed credential after inspection when the
provider permits it. Synthetic fixtures must be separately authored from the
reviewed structural contract; never modify, encode, hash, truncate, or
otherwise derive one from an observed value.

Capture one observation locally with the interactive-only workflow:

```console
npm run observations:capture -- \
  --provider=example --family=example-token \
  --issued-at=2026-09-23 --issuance-route=dashboard \
  --subject-kind=project --subject-id=subject-project-a \
  --prefix=ex_ --checksum-behavior=unknown \
  --revoked-after-observation=true
```

The command accepts the credential only at a hidden terminal prompt. It rejects
credential arguments and piped input, so the raw value does not enter shell
history or CI. Standard output contains one schema-valid observation with only
the approved metadata; `--debug` emits fixed lifecycle messages to standard
error. Review the JSON before adding it to the matching family in
`empirical-observations.json`. Use a pseudonym such as `subject-project-a`, not
an account, organization, user, or project identifier. If revocation is not
available, record `false` and document that limitation in the family uncertainty.

The declared prefix must be known independently and shorter than the entire
credential. This prevents capture from treating an arbitrary credential slice
as safe. The command computes total and segment lengths, observed character
classes, and separators; checksum behavior remains an explicit maintainer
observation. Capture output is evidence metadata, not a fixture source.

Qualification fails closed. Missing metadata, fewer than five observations,
fewer than two subjects or issuance dates, fewer than two corroboration
classes, any contradiction, missing uncertainty or context limits, an
incomplete fixture profile, or any critical twin, benign, mutation,
metamorphic, or differential failure keeps the family provisional.
Contradictions stay committed and visible in the family record; while that
array is non-empty, the observed grammar cannot freeze as empirically stable.
Resolve the discrepancy in the evidence rather than deleting the dissenting
observation.

The 40-fixture profile has 10 positive/context fixtures, 14 non-twin benign
controls, and eight twin pairs, spanning six positive-context axes and five
control axes. Opaque values instead use the 48-fixture context-constrained
profile: no bare-value claim, 10 context-twin pairs, six confusion axes, and an
explicit supported context. Wilson bounds elsewhere in the benchmark remain
corpus-relative uncertainty summaries; they are not population error
probabilities and do not replace these profile cells.
