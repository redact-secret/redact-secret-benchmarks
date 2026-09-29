#!/usr/bin/env node
// Scaffolds one provider dossier per taxonomy.json provider from _TEMPLATE.md
// (#473). Never overwrites an existing dossier. With --check, fails when a
// taxonomy provider has no dossier or a taxonomy family has no `- id:` entry,
// and (#474) validates every dossier's frontmatter against
// schemas/dossier-v1.json, checks provider/family ids against taxonomy.json,
// and enforces the cross-repo permalink rule.
import Ajv2020 from "ajv/dist/2020.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERIC = "generic";
const SCHEMA_PATH = join(root, "schemas/dossier-v1.json");

export function loadTaxonomy(path = join(root, "benchmarks/support/taxonomy.json")) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Groups families by provider id; provider-less families go under "generic". */
export function providersWithFamilies(taxonomy) {
  const names = new Map(taxonomy.providers.map((p) => [p.id, p.name]));
  const groups = new Map();
  for (const family of taxonomy.families) {
    const provider = family.provider ?? GENERIC;
    if (!groups.has(provider)) {
      groups.set(provider, {
        id: provider,
        name: provider === GENERIC ? "Provider-independent credentials" : (names.get(provider) ?? provider),
        families: [],
      });
    }
    groups.get(provider).families.push(family);
  }
  for (const provider of taxonomy.providers) {
    if (!groups.has(provider.id)) groups.set(provider.id, { id: provider.id, name: provider.name, families: [] });
  }
  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function familyEntry(id) {
  return [
    `  - id: ${id}`,
    "    research:",
    "      verdict: unresearched",
    "      tier: null",
    "      sources: []",
    "      issues: []",
    "      evidence: null",
    "      researchedAt: null",
    "    blockedBy: null",
  ].join("\n");
}

function familySection(family) {
  return [
    `### \`${family.id}\` — ${family.name}`,
    "",
    "- **Shape:**",
    "- **Sources:**",
    "- **Issuance:**",
    "- **Collisions:**",
    "- **Current contract in core:**",
  ].join("\n");
}

export function renderStub(provider) {
  const families = provider.families.length
    ? provider.families.map((f) => familyEntry(f.id)).join("\n")
    : "  []";
  const sections = provider.families.length
    ? provider.families.map(familySection).join("\n\n")
    : "<!-- No taxonomy families yet. -->";
  return `---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: ${provider.id}
families:
${families}
---

# ${provider.name}

<!-- What the provider is and which credential kinds it issues. -->

## Families

${sections}

## Candidates that are not families yet

## Open questions

## Research log
`;
}

/** Taxonomy family ids missing from a dossier's `- id:` entries. */
export function missingFamilies(text, provider) {
  const present = new Set([...text.matchAll(/^\s*- id:\s*(\S+)\s*$/gm)].map((m) => m[1]));
  return provider.families.map((f) => f.id).filter((id) => !present.has(id));
}

let compiled;
function schemaValidator() {
  compiled ??= new Ajv2020({ strict: true, strictTypes: false, allErrors: true }).compile(
    JSON.parse(readFileSync(SCHEMA_PATH, "utf8")),
  );
  return compiled;
}

/** Parses the leading `---` YAML block. Returns { data } or { error }. */
export function parseFrontmatter(text) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return { error: "missing YAML frontmatter" };
  const end = lines.indexOf("---", 1);
  if (end === -1) return { error: "missing YAML frontmatter closer" };
  try {
    const data = parseYaml(lines.slice(1, end).join("\n"));
    if (data === null || typeof data !== "object" || Array.isArray(data)) return { error: "frontmatter is not a mapping" };
    return { data };
  } catch (error) {
    return { error: `frontmatter is not valid YAML: ${error.message.split("\n")[0]}` };
  }
}

const REPO_FILE_LINK =
  /https:\/\/(?:github\.com\/([A-Za-z0-9_.-]+)\/[A-Za-z0-9_.-]+\/(?:blob|tree)|raw\.githubusercontent\.com\/([A-Za-z0-9_.-]+)\/[A-Za-z0-9_.-]+)\/([^/\s)>"'`]+)/g;
const OWN_ORG = "redact-secret";

/**
 * Permalink rule: a repo file link for a past state is pinned to a 40-hex
 * commit; a living-doc link into one of our own repos may use `main`. Branch,
 * tag, short-sha and `refs/...` links are rejected, and third-party repos must
 * be pinned to a commit.
 */
export function permalinkProblems(text) {
  const problems = [];
  for (const match of text.matchAll(REPO_FILE_LINK)) {
    const owner = match[1] ?? match[2];
    const ref = match[3];
    if (/^[0-9a-f]{40}$/.test(ref)) continue;
    if (ref === "main" && owner === OWN_ORG) continue;
    problems.push(
      `link ${match[0]} is not a permalink: use a 40-hex commit for past state, or main for a living ${OWN_ORG} doc`,
    );
  }
  return problems;
}

/** Validates one dossier's text against the schema, the taxonomy and the permalink rule. */
export function validateDossier(text, provider, taxonomy) {
  const problems = [];
  const { data, error } = parseFrontmatter(text);
  if (error) return { problems: [error, ...permalinkProblems(text)], ids: null };
  const validate = schemaValidator();
  if (!validate(data)) {
    for (const e of validate.errors) problems.push(`schema: ${e.instancePath || "/"} ${e.message}`);
  }
  if (data.provider !== provider.id) problems.push(`provider is ${JSON.stringify(data.provider)}, expected ${provider.id}`);
  const known = new Set(taxonomy.families.map((f) => f.id));
  const owned = new Set(provider.families.map((f) => f.id));
  const ids = new Set();
  for (const family of Array.isArray(data.families) ? data.families : []) {
    const id = family?.id;
    if (typeof id !== "string") continue;
    if (ids.has(id)) problems.push(`family ${id} is listed twice`);
    ids.add(id);
    if (!known.has(id)) problems.push(`family ${id} is not in taxonomy.json`);
    else if (!owned.has(id)) problems.push(`family ${id} belongs to another provider in taxonomy.json`);
  }
  problems.push(...permalinkProblems(text));
  return { problems, ids };
}

export function run({ dir = join(root, "benchmarks/support/dossiers"), check = false, taxonomy = loadTaxonomy() } = {}) {
  const problems = [];
  let created = 0;
  for (const provider of providersWithFamilies(taxonomy)) {
    const path = join(dir, `${provider.id}.md`);
    if (!existsSync(path)) {
      if (check) {
        problems.push(`${provider.id}: no dossier (${provider.id}.md)`);
        continue;
      }
      writeFileSync(path, renderStub(provider));
      created += 1;
      continue;
    }
    const text = readFileSync(path, "utf8");
    const result = validateDossier(text, provider, taxonomy);
    for (const problem of result.problems) problems.push(`${provider.id}: ${problem}`);
    const missing = result.ids
      ? provider.families.map((f) => f.id).filter((id) => !result.ids.has(id))
      : missingFamilies(text, provider);
    for (const id of missing) {
      problems.push(`${provider.id}: family ${id} has no entry; add under families:\n${familyEntry(id)}`);
    }
  }
  return { created, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const { created, problems } = run({ check });
  if (!check) console.log(`created ${created} dossier stub(s)`);
  for (const problem of problems) console.error(problem);
  if (problems.length) process.exit(1);
}
