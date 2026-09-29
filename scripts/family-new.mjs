#!/usr/bin/env node
// `npm run family:new -- <provider> <family> [--name ..] [--description ..]
// [--source URL]... [--provider-name ..]` (#477). Scaffolds a new credential
// family in one step: a taxonomy.json draft entry, a dossier entry (reusing
// scripts/scaffold-dossiers.mjs, creating the dossier file when absent) and an
// inert fixture stub. It never overwrites or edits an existing entry: every
// collision is checked before anything is written, and one is a refusal.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { familyEntry, familySection, parseFrontmatter, providersWithFamilies, renderStub, validateDossier } from "./scaffold-dossiers.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const GENERIC = "generic";

export const DEFAULT_PATHS = {
  taxonomy: join(root, "benchmarks/support/taxonomy.json"),
  dossiers: join(root, "benchmarks/support/dossiers"),
  fixtures: join(root, "fixtures/generated/families"),
};

/**
 * The seven evidence kinds scripts/check-evidence-arrival.mjs enforces, in the
 * order it lists them. tests/family-tools.test.mjs pins these ids to that
 * script so the checklist cannot drift from the gate.
 */
export const CHECKLIST = [
  ["provider/tool evidence", "record a providerSource, twinSource, candidateSource or corroboration entry in benchmarks/lib/assessment.ts"],
  ["canonical positives", "author positive fixtures carrying the documented shape in realistic contexts"],
  ["negative twins", "author twin fixtures (twinOf + mutation + mutationKind), or record unprobeable with a reason"],
  ["adversarial benign controls", "author non-secret controls: public identifiers, placeholders, references, prose"],
  ["metamorphic cases", "assign fixtures carrying an encoding, whitespace, CRLF, Unicode or chunk-boundary variant"],
  ["mutation cases", "assign fixtures whose prefix, length, alphabet or separator can be mutated"],
  ["differential observation", "assign the fixtures in benchmarks/fixture-detectors.json so the pinned scanners run them"],
];

const titleCase = (slug) => slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const rel = (path) => relative(root, path) || path;

function insertDossierEntry(text, id, name) {
  const lines = text.split("\n");
  const end = lines.indexOf("---", 1);
  const entry = familyEntry(id).split("\n");
  const empty = lines.findIndex((l, i) => i > 0 && i < end && /^families:\s*\[\]\s*$/.test(l));
  if (empty !== -1) lines.splice(empty, 1, "families:", ...entry);
  else {
    let at = end;
    while (at > 1 && (lines[at - 1].trim() === "" || lines[at - 1].trim().startsWith("#"))) at -= 1;
    lines.splice(at, 0, ...entry);
  }
  let out = lines.join("\n");
  const section = familySection({ id, name });
  const marker = "\n## Candidates that are not families yet";
  out = out.includes(marker) ? out.replace(marker, `\n${section}\n${marker}`) : `${out.replace(/\n*$/, "\n")}\n${section}\n`;
  return out;
}

/**
 * Plans every write without touching disk. Returns { problems, writes, id }.
 * A non-empty `problems` means nothing may be written.
 */
export function planFamilyNew(args, paths = DEFAULT_PATHS) {
  const { provider, family, name, description, sources = [], providerName } = args;
  const problems = [];
  if (!provider || !SLUG.test(provider)) problems.push(`provider must be a lowercase slug, got ${JSON.stringify(provider)}`);
  if (!family || !SLUG.test(family)) problems.push(`family must be a lowercase slug, got ${JSON.stringify(family)}`);
  for (const source of sources) if (!/^https:\/\/[^\s]+$/.test(source)) problems.push(`--source must be an https URL, got ${JSON.stringify(source)}`);
  if (problems.length) return { problems, writes: [], id: null };

  const id = `${provider}:${family}`;
  const taxonomy = JSON.parse(readFileSync(paths.taxonomy, "utf8"));
  const dossierPath = join(paths.dossiers, `${provider}.md`);
  const stubPath = join(paths.fixtures, `${provider}--${family}.mjs`);

  if (taxonomy.families.some((f) => f.id === id)) problems.push(`refusing to overwrite: ${id} is already in ${rel(paths.taxonomy)}`);
  if (existsSync(stubPath)) problems.push(`refusing to overwrite: fixture stub ${rel(stubPath)} already exists`);
  const dossierText = existsSync(dossierPath) ? readFileSync(dossierPath, "utf8") : null;
  if (dossierText !== null) {
    const { data } = parseFrontmatter(dossierText);
    const listed = Array.isArray(data?.families) && data.families.some((f) => f?.id === id);
    if (listed || new RegExp(`^\\s*- id:\\s*${id}\\s*$`, "m").test(dossierText)) {
      problems.push(`refusing to overwrite: ${rel(dossierPath)} already has an entry for ${id}`);
    }
  }
  const isGeneric = provider === GENERIC;
  const known = isGeneric || taxonomy.providers.some((p) => p.id === provider);
  if (!known && !providerName) problems.push(`provider ${provider} is not in taxonomy.json: pass --provider-name "<display name>" to add it`);
  if (problems.length) return { problems, writes: [], id };

  const entry = {
    id,
    provider: isGeneric ? null : provider,
    name: name ?? titleCase(family),
    description: description ?? "TODO: describe the credential kind in words; do not paste a value.",
    detectors: [],
    ...(sources.length ? { sources } : {}),
    note: "Draft scaffolded by family:new: no detector is mapped yet. Replace this note with the dossier verdict once research records one.",
  };
  if (!known) taxonomy.providers.push({ id: provider, name: providerName });
  let at = taxonomy.families.length;
  for (let i = taxonomy.families.length - 1; i >= 0; i -= 1) {
    if ((taxonomy.families[i].provider ?? GENERIC) === provider) { at = i + 1; break; }
  }
  taxonomy.families.splice(at, 0, entry);

  const group = providersWithFamilies(taxonomy).find((p) => p.id === provider);
  const dossier = dossierText === null ? renderStub(group) : insertDossierEntry(dossierText, id, entry.name);
  const check = validateDossier(dossier, group, taxonomy);
  if (check.problems.length) return { problems: check.problems.map((p) => `dossier ${provider}: ${p}`), writes: [], id };

  const stub = `// Fixture stub for ${id}, scaffolded by \`npm run family:new\` (#477).
// Inert: nothing imports this file until you wire it (see fixtures/generated/beta8/index.mjs
// for how corpora are registered; a corpus with no fixtures is omitted).
//
// Author values from a synthetic() seed or independent construction, never from
// a provider-issued credential or scanner output, and never paste a secret-shaped
// literal here. Evidence checklist (scripts/check-evidence-arrival.mjs):
${CHECKLIST.map(([kind, todo], i) => `//   ${i + 1}. ${kind}: ${todo}`).join("\n")}

export const FAMILY = { id: ${JSON.stringify(id)}, detectors: [] };

/** Returns the fixtures for ${id}. Empty until authored. */
export function build(_tools) {
  return [];
}
`;
  return {
    problems: [],
    id,
    writes: [
      { path: paths.taxonomy, content: `${JSON.stringify(taxonomy, null, 2)}\n` },
      { path: dossierPath, content: dossier },
      { path: stubPath, content: stub },
    ],
  };
}

export function runFamilyNew(args, paths = DEFAULT_PATHS) {
  const plan = planFamilyNew(args, paths);
  if (plan.problems.length) return { ...plan, written: [] };
  for (const write of plan.writes) {
    mkdirSync(dirname(write.path), { recursive: true });
    writeFileSync(write.path, write.content);
  }
  return { ...plan, written: plan.writes.map((w) => w.path) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        name: { type: "string" },
        description: { type: "string" },
        source: { type: "string", multiple: true },
        "provider-name": { type: "string" },
      },
    });
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  const [provider, family, ...extra] = parsed.positionals;
  if (!provider || !family || extra.length) {
    console.error('usage: npm run family:new -- <provider> <family> [--name "Name"] [--description "..."] [--source URL]... [--provider-name "Name"]');
    process.exit(2);
  }
  const result = runFamilyNew({
    provider, family, name: parsed.values.name, description: parsed.values.description,
    sources: parsed.values.source ?? [], providerName: parsed.values["provider-name"],
  });
  if (result.problems.length) {
    for (const problem of result.problems) console.error(problem);
    process.exit(1);
  }
  console.log(`scaffolded ${result.id}:`);
  for (const path of result.written) console.log(`  wrote ${rel(path)}`);
  console.log("\nNew detector family checklist (enforced by npm run arrival:check once a detector is registered):");
  CHECKLIST.forEach(([kind, todo], i) => console.log(`  ${i + 1}. ${kind}: ${todo}`));
  console.log(`\nNext: npm run dossiers:check, then npm run family:status -- ${result.id}`);
  console.log("taxonomy.json changed, so its digest in benchmarks/fixture-index.json is stale: run npm run fixture-index:generate.");
}
