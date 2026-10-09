# Coverage and evaluation movement map (#887 / #892)

## Sequence and ownership

Map first, credential pair #888/#890 and PII pair #889/#891 in parallel, then #892 navigation/export/compatibility integration. One epic PR targets develop. No pins, authorities, thresholds, owner acceptance, artifacts or scanner selection change.

| Current content | Destination | Preservation |
| --- | --- | --- |
| Credential provider/family names, formats/context and declared scope | /coverage/credential/ | Validated loadCredentialEvaluation, loadProductScope and loadDossiers. Exact declaration source/release/configuration, separate measured qualification. Missing declarations unknown. |
| Credential taxonomy, fixture-bearing and scored counts | Separately labelled coverage context and report links | Taxonomy is not supported count. No supported-only evidence denominator. |
| Credential fixture-kind/T0–T3 table | /report/corpus/ | Full corpus and rows retained. |
| Credential cases/variants by method | /evaluation/qualification/ and /evaluation/method/[method]/ | Existing consumers and exact population/run identity. |
| Credential authored answers/span outcomes/evidence classes/methods/metrics/policy rationale | /evaluation/credential/ | Concise methodology, evidence/eval/core/benchmarks repositories. |
| Credential support distribution and limits | Brief coverage/evaluation summaries plus qualification detail | Protected policy holdout, live validity and production rate remain limited/unmeasured where recorded. |
| Credential findings/scanner operations/optional-profile history/candidate operations | Existing findings, comparison/scanner, qualification and RC pages | Records not deleted; clear links replace long overview sections. |
| PII declared kinds/activation/exact target/language/jurisdiction/context limits | /coverage/pii/ | Existing source-bound catalog and activation consumers, language and jurisdiction separate. |
| PII public/qualification/protected distinctions | Both coverage and evaluation short material limits | Public evidence does not establish protected qualification; no historical transfer. |
| PII identity/sensitivity/expected answers/validators/six methods/metric groups/population policy | /evaluation/pii/ | Concise methodology and explicit pii-evidence/pii-eval/core/benchmarks links. |
| PII population/report/metric selectors, b11, current comparison, local peers, family/view/method coverage, detailed ten metrics | New bounded /evaluation/pii/results/ | Preserve resolvePiiView, PiiStatusExplorer, PiiCoverageExplorer and independently bound populations. |
| PII binding errors/custodian/protected audit/authority/execution provenance | /evaluation/pii/results/ sources/details dialog | Exact identities and unavailable reasons retained. |
| Complete independent PII population, active/proposed full evidence matrix and denominator delta | Keep /evaluation/pii/evidence/ | #861 remains evidence-wide owner. Unsupported/deferred/unrepresentable rows retained. Reciprocal navigation, no second truth source. |

## Compatibility

New /coverage/credential/ and /coverage/pii/ must be exempt from generic legacy /coverage/:id redirect BEFORE that rule, including active CloudFront mirror. If /coverage/ hub replaces root redirect, explicitly adopt that change; otherwise preserve old root and link header to child. Existing /coverage/provider:family and /coverage/detectors/id destinations remain.

Existing /evaluation/pii/ links with recorded length-prefixed family fragments reach /evaluation/pii/results/ preserving query and fragment; current PiiExplorer uses hash selection. Update familyHref for canonical results links while keeping overview compatibility island/no-JS link. Credential detail inventories remain reachable from the methodology links. Corpus/scanner compatibility from #893 stays.

## Files and parallel lanes

Credential lane owns new credential coverage and methodology modules/components/pages/stories/synthetic tests and evaluation/credential/page.tsx. PII lane owns new PII coverage/methodology modules/components/pages/results/stories/tests and evaluation/pii/page.tsx. Parent owns shared routes/site/AppChrome/pages.ts/domains.ts/export scripts/navigation/root redirect and edge mirror changes.

## Acceptance and verification

All exact four routes exported and directly reachable; reciprocal coverage/evaluation links and repository links; header/hub/footer/metadata/sitemap agree. Product capability, evidence inventory, representability, measured outcomes and qualification separate. No proposed/current or stale product/config/run joins. Missing/withheld unavailable, not zero. Independent denominators, no pooled score. Both supported authority branches verified. Existing full matrix publication/export recount retained. Synthetic absence/declaration/configuration/context controls; keyboard and mobile/desktop browser plus layout checks; no changing ledger counts asserted. No expensive scanner or protected execution needed.

## Canonical routes and compatibility

The four entrances export production-origin canonical metadata and appear in
`/sitemap.xml`. Staging continues to use the host's noindex response header.
Coverage navigation enters at `/coverage/credential/`; the historical `/coverage/`
family-inventory redirect remains intact. Exact `/coverage/credential/` and
`/coverage/pii/` paths are exempt from the generic legacy detector redirect in
both the benchmark table and the sites CloudFront function.

Recorded PII family fragments on `/evaluation/pii/` open the same selected result
on `/evaluation/pii/results/`, retaining the query and fragment. Other overview
fragments remain on methodology. A no-script results link is available. Invalid
percent encoding cannot break either page. The complete independent evidence
matrix retains every active-baseline and proposed-snapshot kind, including
unsupported, deferred and unrepresentable kinds, with reciprocal links.
