# Evaluation UI verification

Local verification completed with discovery run `a53dc0ce-f77a-4749-b73a-ca988aa7f949`.

- Development/regression: 1,927 cases / 5,095 variants; all three scanners complete.
- 463 unique failing evaluation case IDs versus 2,907 failed assertions.
- 3,891 review-required assertions; 1,381 review queue entries; no generation errors.
- Twin 56/112, Benign 168/168, Metamorphic 549/2476, Mutation 549/1734, Differential 605/605.
- Separate qualification: public-control Holdout 12/12. Refreshed via `eval:milestone`, `eval:qualify`, and `eval:validate`; only prerequisite issue #1 remains open. Generated evidence replaced the old checked-in snapshot without hand editing it.

Checks passed:

- `npm test`: 154 tests, including publication allowlisting, protected/stale source rejection, schema validation, case/assertion deduplication, T0 review separation, operator-summary consistency and rendered method/holdout boundaries.
- `npm run test:integration`: 6 real-scanner checks.
- `npm run build`: TypeScript and production Vite build. Main catalog bundle still triggers the 500 kB size warning; evaluation code and validation are lazy-loaded.
- `npm run eval`, `npm run eval:publish -- --qualification=docs/qualification/engine-v1.json`, and evidence validation.
- Independent Playwright against production preview: 11 evaluation routes on direct navigation and reload; filters, pagination, polling state, bidirectional detector navigation, absent/stale/malformed evidence, review status separation, no holdout fixture links.
- Desktop 1440×1000 and narrow 390×844 screenshots inspected; no page-wide horizontal overflow. Evidence tables scroll within their containers.
- Public JSON and built assets inspected: no holdout case records, fixture text, private seeds, protected storage references or holdout generator implementation. Strict aggregate schemas also reject injected holdout details.

Reproducible browser checks: `scripts/check-evaluation-ui.mjs`. Local screenshots and route results are in `results-output/ui-verification/` (ignored). Playwright was installed in a temporary directory, not added to application dependencies.

Potential follow-ups: persistent review decisions and links to authored resolutions; automated evaluation publication in hosting CI; reduce the eagerly bundled legacy fixture catalog. The current review queue intentionally remains read-only. Static hosting needs SPA fallback for reloads.
