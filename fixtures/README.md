# fixtures

Ground-truth fixture corpus, materialized as real files (schema in the
top-level [README](../README.md#ground-truth-schema-tool-agnostic)).

`accuracy/corpus.json` is a draft starter corpus, pending independent human
review. It contains synthetic, never-issued values and negative controls.
Each fixture adds `content` (materialized verbatim) and a display `group` to
the ground-truth schema. Expected offsets are UTF-8 bytes with an exclusive
end. The runner validates paths, unique identifiers, and range boundaries.

Keep expectations independent of scanner output. Expand coverage and obtain
human review before presenting results as comparative evidence. The `reviewStatus`
field is shown in every report and the dashboard.

Confirmed findings follow the governed
[benchmark-to-product promotion lifecycle](../docs/decisions/2026-09-18-govern-benchmark-promotion.md).
Review and promotion never rewrite an authored expectation to match scanner
output. The benchmark fixture and its evidence remain here; only a minimal
canonical regression and provenance link move into the product repository.

Every fixture must be synthetic or explicitly revoked, never an active
provider-issued credential. The common-format cryptographic controls contain
a parseable key derived from a public test seed and a locally signed JWT;
these have never been deployed and must never be used in a real system.

Corpus schema 2 (measurement protocol v4): every span carries `role`
(`secret` or `companion`) and may carry an authored `envelope` with a reason;
every fixture carries `assessment.kind` (must-redact, must-not-flag, policy),
`assessment.tier` (T1 provider-documented, T2 tool-corroborated, T3 project
policy, T0 pending), a rationale and evidence links. Negative twins declare
`twinOf`, `mutation` and `mutationKind`. Kinds, tiers and contracts are defined
in [`benchmarks/lib/assessment.ts`](../benchmarks/lib/assessment.ts) and
explained in [the corpus audit](../docs/reports/2026-09-17/corpus-audit.md). Historical authored
ranges remain intact even where their input is malformed or policy-specific;
envelopes are never widened in response to scanner output.
