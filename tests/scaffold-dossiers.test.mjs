import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadTaxonomy, providersWithFamilies, run } from "../scripts/scaffold-dossiers.mjs";

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
  assert.equal(problems.length, 1);
  assert.match(problems[0], /acme:deploy-token has no entry/);
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
