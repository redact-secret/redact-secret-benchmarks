# Reference rulesets

Caller-supplied declarative rulesets used as `--ruleset` input to
`npm run eval:candidate` (`benchmarks/candidate.ts`), never as ground-truth
fixtures scored against scanner output.

`ambiguous-names-reference.ruleset` is byte-identical to the `names` fixture's
`ruleset` text in the product repo's
`conformance/fixtures/ruleset-reference.json` (issue #484,
`decision-define-declarative-detector-ruleset-contract`): a names-only ruleset
declaring one caller-supplied ambiguous-bucket name (`corp_token`) alongside
two names already built in (`api_key`, `Auth`), which the contract defines as
a no-op. Used by issue #73 to measure the before/after finding-set impact of
loading it against a pinned candidate build.
