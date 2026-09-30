#!/usr/bin/env node
// `npm run contribution:readiness [-- <provider>[:<family>]] [--strict]` (#534).
// A guided, advisory next-action list for a dossier, fixture or evidence
// contribution. It AGGREGATES the existing validators and never replaces them:
//   - scripts/scaffold-dossiers.mjs   `run({ check: true })`  (dossiers:check)
//   - scripts/family-status.mjs       `familyStatus`          (family:status)
//   - scripts/check-evidence-arrival.mjs `familyArrivalProblems` (arrival:check)
// Each finding is one of two kinds a contributor must not confuse:
//   evidence missing    : something absent that a contributor can author.
//   support gate failed : content exists, but a validator or the measured
//                         support status rejects it; fix what is there.
// It prints ids, counts, repo paths and npm commands only. It reads committed
// files (plus a local results-output/support-matrix.json when present), never
// a fixture value, protected-holdout data, scorer internals or the network,
// and it exits 0 unless --strict is passed, so CI can show it without gating.
// Passing this summary is never a support decision: the validators above stay
// authoritative and `eval:classify` still measures support.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PATHS, familyStatus } from "./family-status.mjs";
import { run as dossierRun } from "./scaffold-dossiers.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const EVIDENCE_MISSING = "evidence-missing";
export const GATE_FAILED = "support-gate-failed";
const LABELS = { [EVIDENCE_MISSING]: "Evidence missing (author it)", [GATE_FAILED]: "Support gate failed (fix what is there)" };
const MAX_LINE = 220;
const MAX_LISTED = 5;

const clip = (text) => (text.length > MAX_LINE ? `${text.slice(0, MAX_LINE - 1)}...` : text);
const dossierFile = (provider) => `benchmarks/support/dossiers/${provider}.md`;

/** Splits one `dossiers:check` problem ("<provider>: ...") and keeps only its first line. */
function dossierFinding(problem) {
  const [head] = problem.split("\n");
  const at = head.indexOf(": ");
  const provider = head.slice(0, at);
  const detail = head.slice(at + 2);
  const file = dossierFile(provider);
  if (/^no dossier\b/.test(detail)) {
    return { provider, kind: EVIDENCE_MISSING, key: "dossier file is missing", detail: "", fix: { run: "npm run dossiers:scaffold" } };
  }
  if (/^family \S+ has no entry/.test(detail)) {
    const id = detail.split(" ")[1];
    return { provider, family: id, kind: EVIDENCE_MISSING, key: "dossier entry is missing", detail: "", fix: { run: "npm run dossiers:scaffold", update: file } };
  }
  const key = /not a permalink/.test(detail) ? "dossier source link is not immutable" : "dossier fails its schema or taxonomy check";
  return { provider, kind: GATE_FAILED, key, detail: clip(detail), fix: { run: "npm run dossiers:check", update: file } };
}

/**
 * Builds the findings and passes for a scope, from the existing validators.
 * `arrival` is `() => string[]`, the arrival gate's problems for the corpus
 * (injected so tests can use synthetic data); `null` skips that layer.
 */
export function readiness(query = null, { paths = DEFAULT_PATHS, dossierDir = paths.dossiers, arrival = () => [] } = {}) {
  const taxonomy = JSON.parse(readFileSync(paths.taxonomy, "utf8"));
  const providers = [...new Set(taxonomy.families.map((f) => f.provider ?? "generic"))];
  const scoped = query === null ? providers : [query.includes(":") ? query.slice(0, query.indexOf(":")) : query];
  const findings = [];
  const passes = [];
  const problems = [];
  const reports = [];
  for (const provider of scoped) {
    const status = familyStatus(query?.includes(":") ? query : provider, paths);
    if (status.problems.length) { problems.push(...status.problems); continue; }
    reports.push(...status.reports);
  }
  if (problems.length) return { findings, passes, problems, families: [] };

  for (const problem of dossierRun({ dir: dossierDir, check: true, taxonomy }).problems) {
    const f = dossierFinding(problem);
    if (!scoped.includes(f.provider)) continue;
    if (query?.includes(":") && f.family && f.family !== query) continue;
    findings.push(f);
  }

  const arrivalProblems = arrival ? arrival() : [];
  const matrixKnown = reports.some((r) => r.published);
  for (const r of reports) {
    const add = (kind, key, detail, fix) => findings.push({ provider: r.id.split(":")[0], family: r.id, kind, key, detail, fix });
    passes.push(`taxonomy family exists: ${r.id}`);
    if (r.dossier) passes.push(`dossier entry exists: ${r.id}`);
    if (r.dossier?.verdict === "unresearched") {
      add(EVIDENCE_MISSING, "research verdict not recorded", "", { update: dossierFile(r.id.split(":")[0]) });
    }
    let shortfalls = 0;
    for (const d of r.perDetector) {
      if (!d.coverage) {
        shortfalls += 1;
        add(EVIDENCE_MISSING, "fixture assignment missing (no fixture-profile row)", d.id, { update: "benchmarks/fixture-detectors.json", run: `npm run family:status -- ${r.id}` });
        continue;
      }
      for (const row of d.shortfall.rows.filter((x) => x.gap > 0)) {
        shortfalls += 1;
        const key = row.cell === "twinPairs" ? "twin evidence below required floor" : `${row.label} below required floor`;
        add(EVIDENCE_MISSING, key, `${d.id}: ${row.actual}/${row.required}`, { run: `npm run family:status -- ${r.id}`, update: "benchmarks/fixture-detectors.json" });
      }
      for (const p of arrivalProblems.filter((x) => x.startsWith(`${d.id}: missing `))) {
        shortfalls += 1;
        const [head, ...rest] = p.slice(d.id.length + 2).split(" — ");
        add(EVIDENCE_MISSING, `arrival evidence ${head}`, d.id, { run: "npm run arrival:check", note: clip(rest.join(" — ")) });
      }
    }
    if (r.detectors.length && !shortfalls) passes.push(`fixture floors and arrival evidence met: ${r.id}`);
    // Support gate: evidence is complete but the measured status still is not stable.
    if (matrixKnown && r.published && r.published !== "stable" && r.detectors.length && !shortfalls) {
      add(GATE_FAILED, `measured support is ${r.published} although the authored evidence is complete`, "", { note: "status is measured by eval:classify in CI; more offline fixtures will not change it" });
    }
  }
  return { findings, passes, problems, families: reports.map((r) => r.id) };
}

const KINDS = [EVIDENCE_MISSING, GATE_FAILED];

function fixLines(fix) {
  const out = [];
  if (fix.run) out.push(`    run: ${fix.run}`);
  if (fix.update) out.push(`    update: ${fix.update}`);
  if (fix.note) out.push(`    note: ${fix.note}`);
  return out;
}

/** Renders the summary. Scoped output lists every action; unscoped output groups repeats. */
export function renderReadiness({ findings, passes }, { scoped }) {
  const out = ["Benchmark contribution readiness", "(aggregates dossiers:check, family:status and arrival:check; they stay authoritative)", ""];
  if (scoped) for (const p of passes) out.push(`✓ ${p}`);
  else out.push(`✓ ${passes.length} checks pass across the taxonomy`);
  out.push("");
  if (!findings.length) {
    out.push("Nothing needs action from these validators.");
  }
  for (const kind of KINDS) {
    const group = findings.filter((f) => f.kind === kind);
    if (!group.length) continue;
    out.push(`${LABELS[kind]}: ${group.length}`);
    if (scoped) {
      for (const f of group) {
        out.push(`→ ${f.key}${f.family ? ` [${f.family}]` : f.provider ? ` [${f.provider}]` : ""}${f.detail ? ` (${f.detail})` : ""}`);
        out.push(...fixLines(f.fix));
      }
    } else {
      const byKey = new Map();
      for (const f of group) byKey.set(f.key, [...(byKey.get(f.key) ?? []), f]);
      for (const [key, items] of byKey) {
        const subjects = [...new Set(items.map((f) => f.family ?? f.provider))];
        const shown = subjects.slice(0, MAX_LISTED).join(", ");
        out.push(`→ ${key}: ${subjects.length} famil${subjects.length === 1 ? "y" : "ies"} (${shown}${subjects.length > MAX_LISTED ? `, +${subjects.length - MAX_LISTED} more` : ""})`);
        const fix = items[0].fix;
        out.push(...fixLines(fix.run ? { ...fix, run: fix.run.replace(/-- \S+$/, "-- <provider>:<family>") } : fix));
      }
    }
    out.push("");
  }
  out.push("Scope one contribution: npm run contribution:readiness -- <provider>[:<family>]");
  out.push("Authoritative gates: npm run dossiers:check, npm run family:status -- <provider>:<family>, npm run arrival:check, npm run fixtures:check");
  return `${out.join("\n")}\n`;
}

async function loadArrival() {
  try {
    const { checkEvidenceArrival } = await import("./check-evidence-arrival.mjs");
    const problems = await checkEvidenceArrival();
    return () => problems;
  } catch (error) {
    console.error(`arrival layer skipped (run via npm run contribution:readiness so tsx is loaded): ${String(error.message).split("\n")[0]}`);
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const rest = args.filter((a) => a !== "--strict");
  if (rest.length > 1 || rest.some((a) => a.startsWith("-"))) {
    console.error("usage: npm run contribution:readiness -- [<provider>[:<family>]] [--strict]");
    process.exit(2);
  }
  const result = readiness(rest[0] ?? null, { arrival: await loadArrival() });
  if (result.problems.length) {
    for (const problem of result.problems) console.error(problem);
    process.exit(2);
  }
  process.stdout.write(renderReadiness(result, { scoped: rest.length === 1 }));
  if (strict && result.findings.length) process.exit(1);
}
