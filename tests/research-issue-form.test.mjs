import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(readFileSync(join(root, "schemas/dossier-v1.json"), "utf8"));
const form = parseYaml(readFileSync(join(root, ".github/ISSUE_TEMPLATE/research-family.yml"), "utf8"));
const fields = form.body.filter((item) => item.id);
const byId = (id) => fields.find((item) => item.id === id);

const research = schema.$defs.research.properties;
const mirrored = ["provider", "families", ...Object.keys(research), "blockedBy"];

test("research form mirrors every dossier frontmatter field", () => {
  const ids = fields.map((item) => item.id);
  for (const id of mirrored) assert.ok(ids.includes(id), `form is missing field ${id}`);
  assert.equal(new Set(ids).size, ids.length, "form field ids are unique");
});

test("research form dropdown options equal the schema enums", () => {
  assert.deepEqual(byId("verdict").attributes.options, research.verdict.enum);
  assert.deepEqual(byId("tier").attributes.options, research.tier.enum.map(String));
});

test("research form requires the credential attestation and states the completion rule", () => {
  const box = fields.find((item) => item.type === "checkboxes");
  assert.equal(box.attributes.options[0].required, true);
  assert.match(box.attributes.options[0].label, /did not paste any real or unrevoked credential/);
  const intro = form.body.find((item) => item.type === "markdown").attributes.value;
  assert.match(intro, /Closes #N/);
  assert.match(intro, /closed only by/);
});
