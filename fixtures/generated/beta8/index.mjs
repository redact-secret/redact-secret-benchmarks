import { build207 } from "./207.mjs";
import { build208 } from "./208.mjs";
import { build209 } from "./209.mjs";
import { build210 } from "./210.mjs";
import { build211 } from "./211.mjs";
import { build212 } from "./212.mjs";
import { build213a } from "./213a.mjs";
import { build213c } from "./213c.mjs";
import { build213b } from "./213b.mjs";
import { build213d } from "./213d.mjs";
import { build213e } from "./213e.mjs";
import { build213f } from "./213f.mjs";
import { build259 } from "./259.mjs";
import { build263 } from "./263.mjs";
import { build384a } from "./384a.mjs";
import { build384b } from "./384b.mjs";
import { build384c } from "./384c.mjs";
import { build384d } from "./384d.mjs";
import { build384e } from "./384e.mjs";
import { build434a } from "./434a.mjs";
import { build434b } from "./434b.mjs";
import { build434c } from "./434c.mjs";
import { build434d } from "./434d.mjs";
import { build434e } from "./434e.mjs";
import { build434f } from "./434f.mjs";
import { build434g } from "./434g.mjs";
import { build436a } from "./436a.mjs";
import { build436b } from "./436b.mjs";
import { build436c } from "./436c.mjs";
import { build436d } from "./436d.mjs";
import { build436e } from "./436e.mjs";
import { build436f } from "./436f.mjs";
import { build379 } from "./379.mjs";
import { build948 } from "./948.mjs";

// One corpus per Beta.8 consumer issue (#207–#212), so one issue's edits never
// change another corpus's source hash (and so never re-key its ledger rows).
// A corpus with no fixtures yet is omitted; its category is registered in
// benchmarks/categories.json and corpora/development/manifest.json with its first fixture.
const BUILDERS = { 207: build207, 208: build208, 209: build209, 210: build210, 211: build211, 212: build212, "213a": build213a, "213c": build213c, "213b": build213b, "213d": build213d, "213e": build213e, "213f": build213f, 259: build259, 263: build263, "384a": build384a, "384b": build384b, "384c": build384c, "384d": build384d, "384e": build384e, "434a": build434a, "434b": build434b, "434c": build434c, "434d": build434d, "434e": build434e, "434f": build434f, "434g": build434g, "436a": build436a, "436b": build436b, "436c": build436c, "436d": build436d, "436e": build436e, "436f": build436f, 379: build379, 948: build948 };

export function buildBeta8(tools) {
  const corpora = {};
  for (const [issue, build] of Object.entries(BUILDERS)) {
    const fixtures = build(tools);
    if (fixtures.length) corpora[`beta8-${issue}`] = tools.wrap(fixtures);
  }
  return corpora;
}
