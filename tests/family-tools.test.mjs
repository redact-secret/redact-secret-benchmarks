import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { CHECKLIST, planFamilyNew, runFamilyNew } from "../scripts/family-new.mjs";
import { familyStatus, renderReports } from "../scripts/family-status.mjs";
import { familyArrivalProblems } from "../scripts/check-evidence-arrival.mjs";
import { run as dossierRun } from "../scripts/scaffold-dossiers.mjs";

const taxonomy = () => ({
  schemaVersion: 1,
  sourceNote: "test",
  providers: [{ id: "acme", name: "Acme" }],
  families: [
    { id: "acme:deploy-token", provider: "acme", name: "Deploy token", description: "d", detectors: ["acme-deploy-token"] },
    { id: "acme:legacy-key", provider: "acme", name: "Legacy key", description: "d", detectors: [], note: "n" },
  ],
});

const DOSSIER = `---
provider: acme
families:
  - id: acme:deploy-token
    research:
      verdict: ready
      tier: T1
      sources: ["https://docs.example.invalid/tokens"]
      issues: [redact-secret/redact-secret-benchmarks#1]
      evidence: null
      researchedAt: 2026-09-01
    blockedBy: null
  - id: acme:legacy-key
    research:
      verdict: issuance-gated
      tier: T2
      sources: []
      issues: [redact-secret/redact-secret-benchmarks#1]
      evidence: null
      researchedAt: 2026-09-01
    blockedBy: needs a revoked sample
---

# Acme

## Families

### \`acme:deploy-token\` — Deploy token

## Candidates that are not families yet

## Research log
`;

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), "family-tools-"));
  const paths = {
    taxonomy: join(dir, "taxonomy.json"),
    dossiers: join(dir, "dossiers"),
    fixtures: join(dir, "fixtures", "families"),
    detectors: join(dir, "detectors.json"),
    criteria: join(dir, "criteria.json"),
    coverage: join(dir, "coverage.json"),
    matrix: join(dir, "results-output", "support-matrix.json"),
  };
  mkdirSync(paths.dossiers);
  writeFileSync(paths.taxonomy, `${JSON.stringify(taxonomy(), null, 2)}\n`);
  writeFileSync(join(paths.dossiers, "acme.md"), DOSSIER);
  writeFileSync(paths.detectors, JSON.stringify({ detectors: [{ id: "acme-deploy-token", title: "t" }] }));
  copyFileSync(new URL("../benchmarks/support/status-criteria.json", import.meta.url), paths.criteria);
  const cells = { totalFixtures: 20, positiveCases: 4, benignControls: 8, twinPairs: 3, positiveContextAxes: 4, controlAxes: 4 };
  writeFileSync(paths.coverage, JSON.stringify({ families: [{ family: "acme-deploy-token", tier: "T1", target: "stable-documented", cells }] }));
  return paths;
}

test("family:new scaffolds taxonomy, dossier and fixture stub, and the result passes dossiers:check", () => {
  const paths = workspace();
  const result = runFamilyNew({ provider: "acme", family: "admin-key", sources: ["https://docs.example.invalid/keys"] }, paths);
  assert.deepEqual(result.problems, []);
  assert.equal(result.written.length, 3);
  const tax = JSON.parse(readFileSync(paths.taxonomy, "utf8"));
  const added = tax.families.find((f) => f.id === "acme:admin-key");
  assert.deepEqual(added.detectors, []);
  assert.deepEqual(added.sources, ["https://docs.example.invalid/keys"]);
  assert.match(added.note, /no detector is mapped/);
  assert.equal(tax.families.at(-1).id, "acme:admin-key");
  const dossier = readFileSync(join(paths.dossiers, "acme.md"), "utf8");
  assert.match(dossier, /^ {2}- id: acme:admin-key$/m);
  assert.match(dossier, /### `acme:admin-key`/);
  assert.match(readFileSync(join(paths.fixtures, "acme--admin-key.mjs"), "utf8"), /return \[\];/);
  assert.deepEqual(dossierRun({ dir: paths.dossiers, check: true, taxonomy: tax }).problems, []);
});

test("family:new creates a dossier and a provider for a new provider only when named", () => {
  const paths = workspace();
  assert.match(planFamilyNew({ provider: "globex", family: "api-key" }, paths).problems[0], /--provider-name/);
  const result = runFamilyNew({ provider: "globex", family: "api-key", providerName: "Globex" }, paths);
  assert.deepEqual(result.problems, []);
  const tax = JSON.parse(readFileSync(paths.taxonomy, "utf8"));
  assert.ok(tax.providers.some((p) => p.id === "globex" && p.name === "Globex"));
  assert.match(readFileSync(join(paths.dossiers, "globex.md"), "utf8"), /^provider: globex$/m);
  assert.deepEqual(dossierRun({ dir: paths.dossiers, check: true, taxonomy: tax }).problems, []);
});

test("family:new refuses to overwrite an existing entry and writes nothing", () => {
  const paths = workspace();
  const before = readFileSync(paths.taxonomy, "utf8");
  const result = runFamilyNew({ provider: "acme", family: "deploy-token" }, paths);
  assert.ok(result.problems.some((p) => /already in .*taxonomy\.json/.test(p)));
  assert.deepEqual(result.written, []);
  assert.equal(readFileSync(paths.taxonomy, "utf8"), before);
  assert.equal(readFileSync(join(paths.dossiers, "acme.md"), "utf8"), DOSSIER);

  // A dossier entry or fixture stub that exists without a taxonomy row is refused too.
  const stray = workspace();
  writeFileSync(join(stray.dossiers, "acme.md"), DOSSIER.replace("acme:legacy-key", "acme:stray-key"));
  assert.ok(planFamilyNew({ provider: "acme", family: "stray-key" }, stray).problems.some((p) => /already has an entry/.test(p)));
  const withStub = workspace();
  runFamilyNew({ provider: "acme", family: "admin-key" }, withStub);
  const tax = JSON.parse(readFileSync(withStub.taxonomy, "utf8"));
  tax.families = tax.families.filter((f) => f.id !== "acme:admin-key");
  writeFileSync(withStub.taxonomy, `${JSON.stringify(tax, null, 2)}\n`);
  const again = planFamilyNew({ provider: "acme", family: "admin-key" }, withStub);
  assert.ok(again.problems.some((p) => /fixture stub .* already exists/.test(p)));
  assert.ok(again.problems.some((p) => /already has an entry for acme:admin-key/.test(p)));
});

test("family:new rejects malformed ids and non-https sources", () => {
  const paths = workspace();
  assert.ok(planFamilyNew({ provider: "Acme", family: "x" }, paths).problems.length);
  assert.ok(planFamilyNew({ provider: "acme", family: "x", sources: ["http://plain.invalid"] }, paths).problems.length);
});

test("the printed checklist names exactly the seven evidence kinds the arrival gate enforces", () => {
  const gate = familyArrivalProblems("x", [], { tier: "T0" }).map((p) => p.split("missing ")[1].split(" — ")[0]);
  assert.deepEqual(CHECKLIST.map(([kind]) => kind).sort(), gate.sort());
});

test("family:status reports the shortfall against status-criteria and one next step, counts only", () => {
  const paths = workspace();
  const { problems, reports } = familyStatus("acme:deploy-token", paths);
  assert.deepEqual(problems, []);
  const [report] = reports;
  const gaps = Object.fromEntries(report.perDetector[0].shortfall.rows.map((r) => [r.cell, r.gap]));
  assert.deepEqual(gaps, { positiveCases: 2, twinPairs: 2, benignControls: 0, positiveContextAxes: 0, controlAxes: 0 });
  assert.equal(report.next, "add 2 positive cases for acme-deploy-token (4/6) (+1 more gap)");
  const text = renderReports(reports);
  assert.match(text, /positive cases: 4\/6 \(short 2\)/);
  assert.match(text, /dossier: verdict=ready tier=T1/);
  assert.doesNotMatch(text, /content|value/i);
});

test("family:status covers detector-less families by dossier verdict and by provider", () => {
  const paths = workspace();
  const { reports } = familyStatus("acme", paths);
  assert.deepEqual(reports.map((r) => r.id), ["acme:deploy-token", "acme:legacy-key"]);
  assert.equal(reports[1].next, "needs a revoked sample, issuance-gated: needs a revoked sample");
  assert.deepEqual(familyStatus("acme:none", paths).reports, []);
  assert.match(familyStatus("nope", paths).problems[0], /no taxonomy family matches/);
});

test("family:status is deterministic for identical inputs and reads a local support matrix", () => {
  const paths = workspace();
  const first = renderReports(familyStatus("acme", paths).reports);
  assert.equal(renderReports(familyStatus("acme", paths).reports), first);
  assert.match(first, /published support: no local support matrix/);
  mkdirSync(join(paths.matrix, ".."), { recursive: true });
  writeFileSync(paths.matrix, JSON.stringify({ sourceReport: { generatedAt: "2026-09-29T00:00:00Z" }, families: [{ family: "acme:deploy-token", status: "provisional" }] }));
  assert.match(renderReports(familyStatus("acme:deploy-token", paths).reports), /published support: provisional/);
});

test("family:status runs on the committed tree for every taxonomy family", () => {
  const taxonomyJson = JSON.parse(readFileSync(new URL("../benchmarks/support/taxonomy.json", import.meta.url), "utf8"));
  for (const provider of new Set(taxonomyJson.families.map((f) => f.provider ?? "generic"))) {
    const { problems, reports } = familyStatus(provider);
    assert.deepEqual(problems, []);
    for (const report of reports) assert.ok(report.next.length > 0);
  }
});
