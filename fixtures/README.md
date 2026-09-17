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

Every fixture must be synthetic or explicitly revoked, never an active
provider-issued credential. The common-format cryptographic controls contain
a parseable key derived from a public test seed and a locally signed JWT;
these have never been deployed and must never be used in a real system.

Every fixture also requires `assessment.cohort`, a rationale and source links
for reviewed formats. The three measurement purposes and unscored review queue
are defined in [the corpus audit](../docs/corpus-audit.md). Historical authored
ranges remain intact even where their input is malformed or policy-specific.
