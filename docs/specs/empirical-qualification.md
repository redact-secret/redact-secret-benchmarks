# Empirical qualification and safe observation metadata

Issue: [#177](https://github.com/redact-secret/redact-secret-benchmarks/issues/177).
Decisions: [qualify T2 families empirically](../decisions/2026-09-24-qualify-t2-empirically.md),
amended by [qualify empirical stable by corroboration](../decisions/2026-09-24-qualify-empirical-stable-by-corroboration.md).

`benchmarks/support/empirical-observations.json` is the only committed input
for T2 empirical evidence: one record per T2 family, holding its corroboration
references, contradictions, uncertainty, supported contexts and mode, plus any
provider-issued observations. Its schema is
`schemas/empirical-observations-v1.json`; validation and deterministic summary
logic live in `benchmarks/support/empirical.ts`, and the route decision in
`empiricalRoute()` (`benchmarks/support/status.ts`).

## Corroboration records (required unless observed)

Each `corroboration` entry is one verified source: `class`, `owner`,
`reference` (an `https://` URL), `observedAt` (the date it was re-read) and
`supports` (the structural claim it corroborates, which must be the shape the
contract freezes). The five classes are:

- `peer-scanner-rule`: a secret-scanner rule source.
- `provider-owned-code`: the provider's SDK, CLI, server or RFC.
- `provider-example`: a provider documentation page, changelog or staff
  answer on the provider's own site that shows the shape by example.
- `independent-implementation`: third-party code that parses or validates the
  value.
- `independent-research`: a dated research pass of this project.

GitHub references of the three code classes must be pinned to a tag or a
commit. The validator refuses a branch URL, a duplicated reference and a
class outside the list.

The corroborated route needs at least 3 references, 3 distinct owners, and 2
classes other than `independent-research`, which summarises other sources and
so counts only as a reference and an owner. Record every contradiction the
research found:

- `unresolved` blocks.
- `bounded` means the contract deliberately excludes the disputed shape;
  `bound` says how.
- `settled` means a `provider-owned-code` or `provider-example` reference of
  the same record decides it; name that reference in `settledBy` and say what
  it decides in `bound`. A tool, blog or proposal cannot settle anything.

Carry every bound and caveat into `uncertainty` and `supportedContexts`.

## Provider-issued observations (optional, #205)

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

## Qualification

Qualification fails closed. A family stays provisional on any of these:

- missing metadata;
- neither route met: fewer than 3 references, 3 owners or 2 non-summary
  classes, and fewer than 5 observations, 2 subjects or 2 issuance dates;
- any unresolved contradiction;
- missing uncertainty or context limits;
- an incomplete fixture profile (the record's `mode` implicitly claims
  `stable-empirical` or `context-constrained-empirical`, both enforced);
- any critical twin, benign, mutation, metamorphic or differential failure.

Observations, when present, are validated exactly as #205 defines. A partial
observation set neither qualifies a family nor blocks it. The evidence basis
reads `empirically-observed` only once the observation bar is met, and
`independently-corroborated` otherwise. The tier stays T2 either way.

Contradictions stay committed and visible in the family record. Resolve a
discrepancy in the evidence rather than deleting the dissenting observation or
source.

The 40-fixture profile has 10 positive/context fixtures, 14 non-twin benign
controls, and eight twin pairs, spanning six positive-context axes and five
control axes. Opaque values instead use the 48-fixture context-constrained
profile: no bare-value claim, 10 context-twin pairs, six confusion axes, and an
explicit supported context. Wilson bounds elsewhere in the benchmark remain
corpus-relative uncertainty summaries; they are not population error
probabilities and do not replace these profile cells.
