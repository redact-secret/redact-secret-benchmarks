import { fixture, synthetic } from "./build.mjs";
import { build384a } from "../generators/credential-regressions/384a.mjs";
import { build384c } from "../generators/credential-regressions/384c.mjs";
import { classifyFixture } from "../../benchmarks/lib/assessment.ts";

// Project-owned twin-scope corpus (#602, docs/specs/qualification-inputs.md): the cross-provider
// twins whose family the public evidence snapshot leaves unnamed, each carried here with its
// parent's family, together with the positive each one twins. The fixtures are not re-authored: they
// are selected from the authored `beta8-384a` and `beta8-384c` builders by id, so bytes, expected
// spans, mutation and contract are the ones the legacy path has always measured, and a twin's
// contract (`assessment.contract`, exported as `grouping.family`) is the family of the positive it
// twins.
//
// The category is measured by the qualification path only (corpora/regression/manifest.json
// `qualificationCategories`). It is deliberately not part of `buildCorpora()`: it is not a generated
// corpus file, a legacy category or a pinned legacy fixture, so the legacy partitions, the catalog,
// the fixture index and the legacy report neither load nor count it, and the legacy path is unchanged.
export const TWIN_SCOPE_CATEGORY = "twin-scope-regressions";

/** Cross-provider prefix twins: the value carries another provider's key class (or another provider's key shape) with the parent's body. */
export const TWIN_SCOPE_TWINS = [
  ["384a", "anthropic-admin01-key-api01-prefix-twin"],
  ["384a", "anthropic-admin01-key-api03-prefix-twin"],
  ["384a", "anthropic-api01-key-admin01-prefix-twin"],
  ["384a", "anthropic-api01-key-api03-prefix-twin"],
  ["384c", "elevenlabs-api-key-stripe-shaped-twin"],
  ["384c", "elevenlabs-api-key-stripe-test-shaped-twin"],
];

const wrap = (fixtures) => ({
  schemaVersion: 2,
  reviewStatus: "draft — independent human review required",
  provenance:
    "Selected by fixtures/generated/twin-scope.mjs from the authored Beta.8 builders; all credential-shaped values are synthetic and never provider-issued. Ground truth comes from construction, not scanner output. No live verification.",
  fixtures,
});

/** The corpus of the twin-scope category, assessed the way the generated corpora are (assessment follows the Beta.8 rules for a copy of a Beta.8 fixture). */
export function buildTwinScopeCorpus() {
  const tools = { fixture, synthetic };
  const authored = { "384a": new Map(build384a(tools).map((f) => [f.id, f])), "384c": new Map(build384c(tools).map((f) => [f.id, f])) };
  const fixtures = [];
  const seen = new Set();
  for (const [slice, id] of TWIN_SCOPE_TWINS) {
    const twin = authored[slice].get(id);
    if (!twin?.twinOf) throw new Error(`twin-scope: ${slice}/${id} is not an authored twin`);
    const parent = authored[slice].get(twin.twinOf);
    if (!parent) throw new Error(`twin-scope: ${slice}/${id} twins ${twin.twinOf}, which is not authored`);
    for (const f of [parent, twin]) if (!seen.has(f.id)) { seen.add(f.id); fixtures.push({ ...structuredClone(f), copyOf: `beta8-${slice}` }); }
  }
  const corpus = wrap(fixtures);
  for (const f of corpus.fixtures) f.assessment = classifyFixture(TWIN_SCOPE_CATEGORY, f);
  return corpus;
}
