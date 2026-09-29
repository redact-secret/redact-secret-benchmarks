#!/usr/bin/env node
// Scaffolds one provider dossier per taxonomy.json provider from _TEMPLATE.md
// (#473). Never overwrites an existing dossier. With --check, fails when a
// taxonomy provider has no dossier or a taxonomy family has no `- id:` entry.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERIC = "generic";

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
    for (const id of missingFamilies(readFileSync(path, "utf8"), provider)) {
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
