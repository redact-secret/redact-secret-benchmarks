import { build207 } from "./207.mjs";
import { build208 } from "./208.mjs";
import { build209 } from "./209.mjs";
import { build210 } from "./210.mjs";
import { build211 } from "./211.mjs";
import { build212 } from "./212.mjs";
import { build213a } from "./213a.mjs";

// One corpus per Beta.8 consumer issue (#207–#212), so one issue's edits never
// change another corpus's source hash (and so never re-key its ledger rows).
// A corpus with no fixtures yet is omitted; its category is registered in
// benchmarks/categories.json and corpora/development/manifest.json with its first fixture.
const BUILDERS = { 207: build207, 208: build208, 209: build209, 210: build210, 211: build211, 212: build212, "213a": build213a };

export function buildBeta8(tools) {
  const corpora = {};
  for (const [issue, build] of Object.entries(BUILDERS)) {
    const fixtures = build(tools);
    if (fixtures.length) corpora[`beta8-${issue}`] = tools.wrap(fixtures);
  }
  return corpora;
}
