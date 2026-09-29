import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadTaxonomy, permalinkProblems, providersWithFamilies, run, validateDossier } from "../scripts/scaffold-dossiers.mjs";

const taxonomy = {
  providers: [
    { id: "acme", name: "Acme" },
    { id: "empty", name: "Empty" },
  ],
  families: [
    { id: "acme:deploy-token", provider: "acme", name: "Deploy token" },
    { id: "generic:jwt", provider: null, name: "JSON Web Token" },
  ],
};

test("scaffold creates one stub per provider, including generic and family-less providers", () => {
  const dir = mkdtempSync(join(tmpdir(), "dossiers-"));
  assert.deepEqual(run({ dir, taxonomy }), { created: 3, problems: [] });
  assert.deepEqual(readdirSync(dir).sort(), ["acme.md", "empty.md", "generic.md"]);
  const acme = readFileSync(join(dir, "acme.md"), "utf8");
  assert.match(acme, /^provider: acme$/m);
  assert.match(acme, /^ {2}- id: acme:deploy-token$/m);
  assert.match(acme, /verdict: unresearched/);
});

test("scaffold never overwrites and reports a family missing from an existing dossier", () => {
  const dir = mkdtempSync(join(tmpdir(), "dossiers-"));
  writeFileSync(join(dir, "acme.md"), "hand written\n");
  const { created, problems } = run({ dir, taxonomy });
  assert.equal(created, 2);
  assert.equal(readFileSync(join(dir, "acme.md"), "utf8"), "hand written\n");
  assert.ok(problems.some((p) => /acme:deploy-token has no entry/.test(p)));
  assert.ok(problems.some((p) => /missing YAML frontmatter/.test(p)));
});

test("--check reports missing dossiers without writing", () => {
  const dir = mkdtempSync(join(tmpdir(), "dossiers-"));
  const { created, problems } = run({ dir, taxonomy, check: true });
  assert.equal(created, 0);
  assert.equal(problems.length, 3);
  assert.deepEqual(readdirSync(dir), []);
});

test("committed dossiers cover every taxonomy provider and family", () => {
  assert.deepEqual(run({ check: true }).problems, []);
  assert.ok(providersWithFamilies(loadTaxonomy()).length > 0);
});

// --- #474: schema, taxonomy and permalink validation ---------------------

const acme = providersWithFamilies(taxonomy).find((p) => p.id === "acme");
const PIN = "0123456789abcdef0123456789abcdef01234567";
const CORE = "https://github.com/redact-secret/redact-secret/blob";

function dossier({ id = "acme:deploy-token", research = {}, blockedBy = "null", extra = "" } = {}) {
  const r = {
    verdict: "ready",
    tier: "T1",
    sources: ["https://example.com/docs"],
    issues: ["redact-secret/redact-secret#1"],
    evidence: `${CORE}/${PIN}/docs/audits/evidence/1/README.md`,
    researchedAt: "2026-09-29",
    ...research,
  };
  return `---
provider: acme
families:
  - id: ${id}
    research:
      verdict: ${r.verdict}
      tier: ${r.tier}
      sources: ${JSON.stringify(r.sources)}
      issues: ${JSON.stringify(r.issues)}
      evidence: ${r.evidence}
      researchedAt: ${r.researchedAt}
    blockedBy: ${blockedBy}
---

# Acme
${extra}`;
}

const problemsOf = (text) => validateDossier(text, acme, taxonomy).problems;

test("a well-formed researched dossier passes", () => {
  assert.deepEqual(problemsOf(dossier()), []);
});

test("a dossier family id missing from taxonomy.json fails", () => {
  const problems = problemsOf(dossier({ id: "acme:not-a-family" }));
  assert.ok(problems.some((p) => /acme:not-a-family is not in taxonomy\.json/.test(p)), problems.join("\n"));
});

test("a dossier naming another provider's family fails", () => {
  const problems = problemsOf(dossier({ id: "generic:jwt" }));
  assert.ok(problems.some((p) => /belongs to another provider/.test(p)), problems.join("\n"));
});

test("an invalid verdict fails the schema", () => {
  const problems = problemsOf(dossier({ research: { verdict: "maybe" } }));
  assert.ok(problems.some((p) => /^schema: .*verdict/.test(p)), problems.join("\n"));
});

test("a branch-URL link fails the permalink rule, in frontmatter and body", () => {
  const branch = `${CORE}/develop/docs/specs/detector-families.md`;
  const inBody = problemsOf(dossier({ extra: `\nSee [spec](${branch}).\n` }));
  assert.ok(inBody.some((p) => /not a permalink/.test(p)), inBody.join("\n"));
  const inEvidence = problemsOf(dossier({ research: { evidence: branch } }));
  assert.ok(inEvidence.some((p) => /not a permalink/.test(p)), inEvidence.join("\n"));
  assert.ok(inEvidence.some((p) => /^schema: .*evidence/.test(p)), inEvidence.join("\n"));
});

test("permalink rule: 40-hex and own-org main pass; short sha, refs and third-party main fail", () => {
  assert.deepEqual(permalinkProblems(`${CORE}/${PIN}/a.md ${CORE}/main/a.md`), []);
  assert.equal(permalinkProblems(`${CORE}/0123456/a.md`).length, 1);
  assert.equal(permalinkProblems(`${CORE}/refs/heads/x/a.md`).length, 1);
  assert.equal(permalinkProblems("https://github.com/gitleaks/gitleaks/blob/master/a.go").length, 1);
  assert.equal(permalinkProblems("https://raw.githubusercontent.com/gitleaks/gitleaks/main/a.go").length, 1);
});

test("schema rejects inconsistent verdict fields and unknown fields", () => {
  assert.ok(problemsOf(dossier({ research: { verdict: "unresearched" } })).length > 0, "unresearched with a tier");
  assert.ok(problemsOf(dossier({ research: { issues: [] } })).length > 0, "researched without an issue");
  assert.ok(problemsOf(dossier({ research: { verdict: "issuance-gated" } })).length > 0, "gated without blockedBy");
  assert.deepEqual(problemsOf(dossier({ research: { verdict: "issuance-gated" }, blockedBy: "needs a minted sample" })), []);
  const withStatus = dossier().replace("blockedBy: null", "blockedBy: null\n    status: stable");
  assert.ok(problemsOf(withStatus).length > 0, "a measured-status field is not allowed");
});

test("run --check surfaces a failing dossier on disk", () => {
  const dir = mkdtempSync(join(tmpdir(), "dossiers-"));
  run({ dir, taxonomy });
  writeFileSync(join(dir, "acme.md"), dossier({ id: "acme:not-a-family" }));
  const { problems } = run({ dir, taxonomy, check: true });
  assert.ok(problems.some((p) => /acme:not-a-family is not in taxonomy\.json/.test(p)));
  assert.ok(problems.some((p) => /acme:deploy-token has no entry/.test(p)));
});
