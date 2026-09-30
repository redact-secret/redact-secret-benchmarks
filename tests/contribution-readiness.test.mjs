import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { EVIDENCE_MISSING, GATE_FAILED, readiness, renderReadiness } from "../scripts/contribution-readiness.mjs";

// A deliberately incomplete contribution, all synthetic (example.invalid ids, no credential-shaped values).
const taxonomy = {
  schemaVersion: 1,
  sourceNote: "test",
  providers: [{ id: "acme", name: "Acme" }],
  families: [
    { id: "acme:deploy-token", provider: "acme", name: "Deploy token", description: "d", detectors: ["acme-deploy-token"] },
    { id: "acme:new-key", provider: "acme", name: "New key", description: "d", detectors: [], note: "n" },
    { id: "acme:done-token", provider: "acme", name: "Done token", description: "d", detectors: ["acme-done-token"] },
  ],
};

const entry = (id) => `  - id: ${id}
    research:
      verdict: ready
      tier: T1
      sources: ["https://docs.example.invalid/tokens"]
      issues: [redact-secret/redact-secret-benchmarks#1]
      evidence: null
      researchedAt: 2026-09-01
    blockedBy: null`;

// acme:new-key has no dossier entry; the body cites a branch link, so its permalink is not immutable.
const DOSSIER = `---
provider: acme
families:
${entry("acme:deploy-token")}
${entry("acme:done-token")}
---

# Acme

See https://github.com/thirdparty/repo/blob/main/tokens.md for the grammar.
`;

const cells = (over = {}) => ({ totalFixtures: 30, positiveCases: 6, benignControls: 8, twinPairs: 5, positiveContextAxes: 4, controlAxes: 4, ...over });

function workspace({ matrix } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "contribution-readiness-"));
  const paths = {
    taxonomy: join(dir, "taxonomy.json"),
    dossiers: join(dir, "dossiers"),
    detectors: join(dir, "detectors.json"),
    criteria: join(dir, "criteria.json"),
    coverage: join(dir, "coverage.json"),
    matrix: join(dir, "results-output", "support-matrix.json"),
  };
  mkdirSync(paths.dossiers);
  writeFileSync(paths.taxonomy, JSON.stringify(taxonomy));
  writeFileSync(join(paths.dossiers, "acme.md"), DOSSIER);
  writeFileSync(paths.detectors, JSON.stringify({ detectors: [{ id: "acme-deploy-token", title: "t" }, { id: "acme-done-token", title: "t" }] }));
  copyFileSync(new URL("../benchmarks/support/status-criteria.json", import.meta.url), paths.criteria);
  writeFileSync(paths.coverage, JSON.stringify({ families: [
    { family: "acme-deploy-token", tier: "T1", target: "stable-documented", cells: cells({ twinPairs: 2 }) },
    { family: "acme-done-token", tier: "T1", target: "stable-documented", cells: cells() },
  ] }));
  if (matrix) {
    mkdirSync(join(dir, "results-output"));
    writeFileSync(paths.matrix, JSON.stringify({ sourceReport: { generatedAt: "2026-09-29T00:00:00Z" }, families: matrix }));
  }
  return paths;
}

const arrival = () => ['acme-deploy-token: missing differential observation — assign at least one fixture to "acme-deploy-token" in benchmarks/fixture-detectors.json so it is run against the pinned scanners'];
const by = (result, kind) => result.findings.filter((f) => f.kind === kind);

test("an incomplete contribution yields concrete next actions, each with a command or file", () => {
  const result = readiness("acme", { paths: workspace(), arrival });
  assert.deepEqual(result.problems, []);
  const keys = result.findings.map((f) => f.key);
  assert.ok(keys.includes("dossier source link is not immutable"));
  assert.ok(keys.includes("dossier entry is missing"));
  assert.ok(keys.includes("twin evidence below required floor"));
  assert.ok(keys.includes("arrival evidence missing differential observation"));
  for (const f of result.findings) assert.ok(f.fix.run || f.fix.update || f.fix.note, `${f.key} has no next action`);
  const missing = result.findings.find((f) => f.key === "dossier entry is missing");
  assert.equal(missing.family, "acme:new-key");
  assert.equal(missing.fix.run, "npm run dossiers:scaffold");
  const text = renderReadiness(result, { scoped: true });
  assert.match(text, /twin evidence below required floor \[acme:deploy-token\] \(acme-deploy-token: 2\/5\)\n {4}run: npm run family:status -- acme:deploy-token\n {4}update: benchmarks\/fixture-detectors\.json/);
  assert.match(text, /run: npm run dossiers:check\n {4}update: benchmarks\/support\/dossiers\/acme\.md/);
  assert.match(text, /✓ taxonomy family exists: acme:done-token/);
  assert.match(text, /✓ fixture floors and arrival evidence met: acme:done-token/);
});

test("evidence missing is kept apart from a failed support gate", () => {
  const result = readiness("acme", { paths: workspace(), arrival });
  assert.deepEqual(by(result, GATE_FAILED).map((f) => f.key), ["dossier source link is not immutable"]);
  assert.ok(by(result, EVIDENCE_MISSING).length >= 3);
  assert.ok(by(result, GATE_FAILED).every((f) => !/below required floor|is missing/.test(f.key)));
});

test("a complete family with a non-stable measured status is a support gate failure, not missing evidence", () => {
  const paths = workspace({ matrix: [{ family: "acme:done-token", status: "provisional" }, { family: "acme:deploy-token", status: "provisional" }] });
  const done = readiness("acme:done-token", { paths, arrival });
  assert.deepEqual(by(done, EVIDENCE_MISSING), []);
  // The provider-wide dossier link problem is real for this family too; the measured-status finding is the addition.
  assert.deepEqual(by(done, GATE_FAILED).map((f) => f.key), ["dossier source link is not immutable", "measured support is provisional although the authored evidence is complete"]);
  // The incomplete family lacks authoring, not measurement.
  const incomplete = readiness("acme:deploy-token", { paths, arrival });
  assert.ok(by(incomplete, GATE_FAILED).every((f) => !/measured support/.test(f.key)));
  // No local matrix means no support-gate claim at all.
  assert.ok(by(readiness("acme:done-token", { paths: workspace(), arrival }), GATE_FAILED).every((f) => !/measured support/.test(f.key)));
});

test("scope narrows to one family and an unknown scope is a problem", () => {
  const paths = workspace();
  const one = readiness("acme:deploy-token", { paths, arrival });
  assert.deepEqual(one.families, ["acme:deploy-token"]);
  assert.ok(one.findings.every((f) => f.family === undefined || f.family === "acme:deploy-token"));
  assert.match(readiness("nope", { paths, arrival }).problems[0], /no taxonomy family matches/);
});

test("unscoped output groups repeated actions and stays compact", () => {
  const text = renderReadiness(readiness(null, { paths: workspace(), arrival }), { scoped: false });
  assert.match(text, /Evidence missing \(author it\): \d+/);
  assert.match(text, /Support gate failed \(fix what is there\): 1/);
  assert.match(text, /npm run family:status -- <provider>:<family>/);
  assert.ok(text.split("\n").length < 40);
});

test("output carries ids, counts, paths and commands only, and never a secret-shaped value", () => {
  const text = renderReadiness(readiness("acme", { paths: workspace(), arrival }), { scoped: true });
  assert.doesNotMatch(text, /[A-Za-z0-9_-]{32,}/);
  assert.doesNotMatch(text, /holdout|scorer|-----BEGIN/i);
});

test("the committed tree runs advisory-only: exit 0 without --strict, usage errors exit 2", () => {
  const run = (...args) => spawnSync(process.execPath, ["--import", "tsx", "scripts/contribution-readiness.mjs", ...args], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  const ok = run("aws:iam-user-access-key");
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^Benchmark contribution readiness/);
  assert.equal(run("bogus-provider").status, 2);
  assert.equal(run("--nope").status, 2);
});
