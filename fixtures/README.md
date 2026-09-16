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

Every fixture must be unmistakably synthetic or explicitly revoked. No real,
active, or reconstructable credential may appear in this directory, in a
commit message, or in any file this directory's tooling produces.
