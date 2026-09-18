# Corpus routing

`development/manifest.json` and `regression/manifest.json` explicitly partition
the categories in `benchmarks/categories.json`. Each category appears exactly
once. `loadCases()` validates this partition and reads only these two manifests.

Existing fixture sources stay under `fixtures/`; generators and authored data
are not duplicated just to move them into this directory. The category catalog
resolves their paths. New sources should be assigned to one manifest before
they enter normal evaluation.

Holdout has its own `holdout/manifest.json`, ignored `holdout/generated/` inputs,
and opt-in entry point. It never belongs in either development manifest.
