#!/usr/bin/env node
// `npm run family:status -- <provider>[:<family>]` (#477). An offline,
// deterministic report of where each family stands and the one next step. It
// reads only committed files (taxonomy.json, the dossier, benchmarks/detectors.json,
// benchmarks/support/status-criteria.json, docs/generated/fixture-profile-coverage.json)
// plus a local results-output/support-matrix.json when present. It prints
// counts and ids only, never a fixture value, and never touches the network.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "./scaffold-dossiers.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_PATHS = {
  taxonomy: join(root, "benchmarks/support/taxonomy.json"),
  dossiers: join(root, "benchmarks/support/dossiers"),
  detectors: join(root, "benchmarks/detectors.json"),
  criteria: join(root, "benchmarks/support/status-criteria.json"),
  coverage: join(root, "docs/generated/fixture-profile-coverage.json"),
  matrix: join(root, "results-output/support-matrix.json"),
};

/** Fixture cell -> [label, status-criteria key], in the order gaps are worked. */
const CELLS = [
  ["positiveCases", "positive cases", "minimumPositiveCases"],
  ["twinPairs", "negative twin pairs", "minimumTwinPairs"],
  ["benignControls", "benign controls", "minimumBenignCases"],
  ["positiveContextAxes", "positive-context axes", "minimumPositiveAxes"],
  ["controlAxes", "control axes", "minimumControlAxes"],
];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/** Shortfall of one measured cell set against the stable floors that apply to its target profile. */
export function shortfall(cells, target, criteria) {
  const empirical = target === "stable-empirical" || target === "context-constrained-empirical";
  const floors = empirical ? criteria.stable.empirical : criteria.stable.documented;
  const rows = CELLS.map(([cell, label, key]) => {
    const actual = cells?.[cell] ?? 0;
    const required = floors[key].value;
    return { cell, label, actual, required, gap: Math.max(0, required - actual) };
  });
  if (target === "context-constrained-empirical") {
    const required = floors.contextConstrained.minimumFixtures.value;
    const actual = cells?.totalFixtures ?? 0;
    rows.push({ cell: "totalFixtures", label: "total fixtures", actual, required, gap: Math.max(0, required - actual) });
  }
  return { profile: empirical ? "stable.empirical" : "stable.documented", rows };
}

function dossierOf(paths, provider, id) {
  const path = join(paths.dossiers, `${provider ?? "generic"}.md`);
  if (!existsSync(path)) return null;
  const { data } = parseFrontmatter(readFileSync(path, "utf8"));
  const entry = Array.isArray(data?.families) ? data.families.find((f) => f?.id === id) : null;
  return entry ? { verdict: entry.research?.verdict, tier: entry.research?.tier, blockedBy: entry.blockedBy, researchedAt: entry.research?.researchedAt } : null;
}

/** The single next concrete step for one family. */
export function nextStep({ dossier, detectors, missingFromInventory, perDetector }) {
  if (!detectors.length) {
    if (!dossier) return "add a dossier entry: run npm run dossiers:scaffold";
    switch (dossier.verdict) {
      case "unresearched": return "research the provider grammar and record a verdict in the dossier";
      case "not-found": return "no work: no reviewed source establishes the grammar; reopen only with a new source";
      case "rejected": return "no work: deliberately not pursued; reopen only with a new reason";
      case "issuance-gated": return `needs a revoked sample, issuance-gated: ${dossier.blockedBy}`;
      case "date-gated": return `waiting on a date: ${dossier.blockedBy}`;
      case "ready": return "ready for core detector: open a redact-secret detector issue, then map the detector in taxonomy.json";
      default: return "record a research verdict in the dossier";
    }
  }
  const rowless = perDetector.find((d) => !d.coverage);
  if (rowless) return `register a format contract and fixtures for ${rowless.id}: it has no fixture-profile row`;
  const gaps = perDetector.flatMap((d) => d.shortfall.rows.filter((r) => r.gap > 0).map((r) => ({ ...r, detector: d.id })));
  if (gaps.length) {
    const first = gaps[0];
    const more = gaps.length > 1 ? ` (+${gaps.length - 1} more gap${gaps.length > 2 ? "s" : ""})` : "";
    return `add ${first.gap} ${first.label} for ${first.detector} (${first.actual}/${first.required})${more}`;
  }
  if (!dossier || dossier.verdict === "unresearched") return "fixture floors are met: record the research verdict in the dossier";
  if (missingFromInventory.length) return `fixture floors are met and the dossier is researched: ready for core detector (${missingFromInventory.join(", ")} is not in the pinned product inventory)`;
  return "fixture floors are met: nothing to author offline; measured status comes from eval:classify in CI";
}

/** Builds one report per matching family, in taxonomy order. */
export function familyStatus(query, paths = DEFAULT_PATHS) {
  const taxonomy = readJson(paths.taxonomy);
  const [providerPart, familyPart] = query.includes(":") ? [query.slice(0, query.indexOf(":")), query] : [query, null];
  const families = taxonomy.families.filter((f) => (familyPart ? f.id === familyPart : (f.provider ?? "generic") === providerPart));
  if (!families.length) return { problems: [`no taxonomy family matches ${JSON.stringify(query)}: use <provider> or <provider>:<family>`], reports: [] };

  const inventory = new Set(readJson(paths.detectors).detectors.map((d) => d.id));
  const criteria = readJson(paths.criteria);
  const coverage = new Map(readJson(paths.coverage).families.map((f) => [f.family, f]));
  const matrix = existsSync(paths.matrix) ? readJson(paths.matrix) : null;
  const published = new Map((matrix?.families ?? []).map((f) => [f.family, f.status]));

  const reports = families.map((family) => {
    const detectors = family.detectors ?? [];
    const dossier = dossierOf(paths, family.provider, family.id);
    const perDetector = detectors.map((id) => {
      const row = coverage.get(id) ?? null;
      return { id, coverage: row, shortfall: shortfall(row?.cells, row?.target, criteria) };
    });
    const missingFromInventory = detectors.filter((d) => !inventory.has(d));
    return {
      id: family.id,
      dossier,
      detectors,
      missingFromInventory,
      perDetector,
      published: published.get(family.id) ?? null,
      publishedSource: matrix ? matrix.sourceReport?.generatedAt ?? "unknown" : null,
      next: nextStep({ dossier, detectors, missingFromInventory, perDetector }),
    };
  });
  return { problems: [], reports };
}

export function renderReports(reports) {
  const out = [];
  for (const r of reports) {
    out.push(r.id);
    out.push(
      r.dossier
        ? `  dossier: verdict=${r.dossier.verdict} tier=${r.dossier.tier ?? "-"} researchedAt=${r.dossier.researchedAt ?? "-"} blockedBy=${r.dossier.blockedBy ?? "-"}`
        : "  dossier: no entry",
    );
    out.push(`  taxonomy: in taxonomy.json; detectors: ${r.detectors.length ? r.detectors.join(", ") : "none mapped"}`);
    for (const id of r.missingFromInventory) out.push(`  detectors.json: ${id} is not in the pinned product inventory (arrival family)`);
    for (const d of r.perDetector) {
      if (!d.coverage) { out.push(`  fixtures[${d.id}]: no fixture-profile row`); continue; }
      const total = d.coverage.cells.totalFixtures;
      out.push(`  fixtures[${d.id}]: ${total} total; target ${d.coverage.target}; floors ${d.shortfall.profile}`);
      for (const row of d.shortfall.rows) out.push(`    ${row.label}: ${row.actual}/${row.required}${row.gap ? ` (short ${row.gap})` : ""}`);
    }
    out.push(`  published support: ${r.published ? `${r.published} (local matrix, generatedAt ${r.publishedSource})` : "no local support matrix"}`);
    out.push(`  next: ${r.next}`);
    out.push("");
  }
  return out.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const query = process.argv[2];
  if (!query || process.argv.length > 3) {
    console.error("usage: npm run family:status -- <provider>[:<family>]");
    process.exit(2);
  }
  const { problems, reports } = familyStatus(query);
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  process.stdout.write(renderReports(reports));
}
