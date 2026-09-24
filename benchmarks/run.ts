import type { Category, AccountedGroup, Published } from './types.ts';
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  rm,
  rename,
} from "node:fs/promises";
import { tmpdir, platform, arch } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { scanners as registered } from "../scanners/index.mjs";
import { installCandidate, loadCandidate, removeCandidate } from "../scanners/candidate.mjs";
import { validateCorpus } from "./lib/scoring.ts";
import { classifyFixture, validateAssessment, validateContracts } from './lib/assessment.ts';
import { scoreReport } from './lib/reporting.ts';
import { validateStructures } from './lib/validate-structures.ts';
import { ACCOUNTING_VERSION, validateAccounting } from './lib/accounting.ts';
import { summarizeRun } from './lib/run-summary.ts';

export const MATCHING = "Per-span outcome lattice over UTF-8 [start, end). Envelope-relative coverage. Identical findings deduplicated. No cross-tier aggregation; no precision, recall or F1. T0 observations unscored. AWS RawV2 secret components and Shopify composite token mapped from scanner output, never ground truth.";

const root = fileURLToPath(new URL("../", import.meta.url));
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const registry: Category[] = JSON.parse(
  await readFile(path.join(root, "benchmarks/categories.json"), "utf8"),
);
const args = process.argv.slice(2);
const requested = args.find((a) => a.startsWith("--category="))?.split("=")[1];
// Staging (#201): the same four flags as eval:candidate/eval:classify swap only
// the redact-secret scanner for a candidate build; peers stay the pinned ones.
const CANDIDATE_KEYS = ["candidate-package", "candidate-node-package", "candidate-wasm-package", "candidate-source-commit"] as const;
const candidateOptions: Partial<Record<(typeof CANDIDATE_KEYS)[number], string>> = {};
for (const a of args) {
  const match = /^--(candidate-package|candidate-node-package|candidate-wasm-package|candidate-source-commit)=(.+)$/.exec(a);
  if (match) candidateOptions[match[1] as (typeof CANDIDATE_KEYS)[number]] = match[2];
}
const candidateCount = Object.keys(candidateOptions).length;
if (
  args.some((a) => a !== "--strict" && !a.startsWith("--category=") && !/^--candidate-(package|node-package|wasm-package|source-commit)=./.test(a)) ||
  (requested && !registry.some((c) => c.id === requested)) ||
  (candidateCount !== 0 && candidateCount !== CANDIDATE_KEYS.length) ||
  args.filter((a) => a.startsWith("--candidate-")).length !== candidateCount ||
  (candidateCount && !/^[a-f0-9]{40}$/.test(candidateOptions["candidate-source-commit"]!))
) {
  console.error("Usage: npm run bench -- [--category=accuracy] [--strict] [--candidate-package=<core.tgz> --candidate-node-package=<node.tgz> --candidate-wasm-package=<wasm.tgz> --candidate-source-commit=<40-hex>]");
  process.exit(1);
}
validateContracts();
// Floors and interval parameters are suite configuration, covered by suiteHash, never a code edit.
const accounting = validateAccounting(JSON.parse(await readFile(path.join(root, 'qualification/suite-v1.json'), 'utf8')).accounting);
const shown = (rate: Published | 'insufficient-coverage' | undefined, digits = 3) => (rate == null ? '—' : typeof rate === 'string' ? rate : `${rate.point.toFixed(digits)}${rate.bound == null ? '' : ` (${rate.direction === 'upper' ? '≤' : '≥'} ${rate.bound.toFixed(digits)})`}`);
const installation = candidateCount ? await installCandidate({
  core: path.resolve(candidateOptions["candidate-package"]!),
  node: path.resolve(candidateOptions["candidate-node-package"]!),
  wasm: path.resolve(candidateOptions["candidate-wasm-package"]!),
}) : undefined;
// Every report and run.json name the candidate, so no page can read these numbers as the released package's.
const candidate = installation ? { sourceCommit: candidateOptions["candidate-source-commit"]!, packageName: installation.packageName, declaredVersion: installation.declaredVersion } : undefined;
let scanners = registered;
if (installation) {
  const build = await loadCandidate(installation, undefined, { actions: true });
  scanners = registered.map((s) => (s.id !== "redact-secret" ? s : {
    ...s,
    mode: `Candidate build · redact-secret main ${candidate!.sourceCommit.slice(0, 7)} · unreleased · default detectors`,
    version: async () => build.version,
    scan: build.scan,
  }));
}
const handlers: Record<string, { validate: typeof validateCorpus; score: typeof scoreReport }> = { accuracy: { validate: validateCorpus, score: scoreReport } };
const outputDir = path.join(root, "public/results");
await mkdir(outputDir, { recursive: true });
const startedAt = new Date().toISOString();
// One run, one id (§2.7): every report written by this invocation carries it.
const runId = `${startedAt}-${randomBytes(3).toString("hex")}`;
const lockHash = hash(await readFile(path.join(root, "package-lock.json")));
let revision = "unknown",
  dirty: boolean | null = null;
try {
  revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  dirty = Boolean(execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim());
} catch {}
const write = async (name: string, report: unknown) => {
  const temporary = path.join(outputDir, `.${name}-${process.pid}.json`);
  await writeFile(temporary, JSON.stringify(report, null, 2) + "\n");
  await rename(temporary, path.join(outputDir, `${name}.json`));
};
let failed = false;
const scannerVersions: Record<string, string> = {};
const categories = [];
const published: unknown[] = [];
for (const category of registry.filter(
  (c) => !requested || c.id === requested,
)) {
  if (!/^[a-z0-9-]+$/.test(category.id) || !handlers[category.kind])
    throw new Error("Invalid category registration");
  const source = await readFile(path.join(root, category.corpus), "utf8");
  const corpus = handlers[category.kind].validate(JSON.parse(source));
  if (corpus.schemaVersion !== 2) throw new Error(`Corpus schema 2 required: ${category.id}; regenerate fixtures`);
  for (const f of corpus.fixtures) {
    validateAssessment(f);
    if (JSON.stringify(f.assessment) !== JSON.stringify(classifyFixture(category.id, f))) throw new Error(`Stale fixture assessment: ${f.id}; regenerate fixtures`);
  }
  validateStructures(corpus.fixtures);
  const scratch = await mkdtemp(path.join(tmpdir(), "secret-benchmark-"));
  try {
    for (const f of corpus.fixtures) {
      const target = path.join(scratch, f.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, f.content, { mode: 0o600 });
    }
    const results = [];
    for (const scanner of scanners) {
      const base = { id: scanner.id, name: scanner.name, mode: scanner.mode };
      let version = null;
      try {
        version = await scanner.version(scratch);
        scannerVersions[scanner.id] = version;
        const start = performance.now();
        const findings = await scanner.scan(scratch, corpus.fixtures);
        // An observation is only truth if it repeats over the same scratch tree (engine v1.1 §8).
        const tuples = (list: typeof findings) => list.map((f: { path: string; start: number; end: number }) => `${f.path}:${f.start}:${f.end}`).sort().join('\n');
        for (let replay = 1; replay < accounting.replays; replay++)
          if (tuples(await scanner.scan(scratch, corpus.fixtures)) !== tuples(findings)) throw new Error('unstable');
        results.push({
          ...base,
          version,
          status: "complete",
          durationMs: Math.round((performance.now() - start) * 100) / 100,
          replays: { count: accounting.replays, agreed: true },
          ...handlers[category.kind].score(corpus.fixtures, findings, accounting),
        });
        console.log(`${category.id} / ${scanner.name}: complete`);
      } catch (error) {
        const unavailable = error instanceof Error && error.message === "unavailable";
        const unstable = error instanceof Error && error.message === "unstable";
        results.push({
          ...base,
          version,
          status: unavailable ? "unavailable" : unstable ? "unstable" : "error",
          ...(unstable ? { replays: { count: accounting.replays, agreed: false } } : {}),
          message: unavailable
            ? "Install the released binary and add it to PATH."
            : unstable ? "Replays over identical input disagreed; findings discarded. Never re-rolled for a greener result."
            : "Scanner execution or normalization failed. Check the adapter and installed version; raw scanner output is suppressed.",
        });
        console.log(
          `${category.id} / ${scanner.name}: ${unavailable ? "unavailable" : unstable ? "unstable" : "error"}`,
        );
        if (!unavailable || args.includes("--strict")) failed = true;
      }
    }
    const report = {
      schemaVersion: 5,
      accountingVersion: ACCOUNTING_VERSION,
      accounting,
      runId,
      ...(candidate ? { candidate } : {}),
      category: category.id,
      generatedAt: new Date().toISOString(),
      reviewStatus: corpus.reviewStatus,
      ...(corpus.scope ? { scope: corpus.scope } : {}),
      ...(corpus.references ? { references: corpus.references } : {}),
      ...(corpus.milestoneReview ? { milestoneReview: corpus.milestoneReview } : {}),
      corpusHash: hash(source),
      lockHash,
      revision,
      dirty,
      runtime: { node: process.version, platform: platform(), arch: arch() },
      fixtureCount: corpus.fixtures.length,
      expectedCount: corpus.fixtures.reduce((n, f) => n + f.expected.length, 0),
      matching: MATCHING,
      scanners: results,
    };
    await write(category.id, report);
    published.push(report);
    categories.push(category.id);
    console.log(`Updated public/results/${category.id}.json`);
    console.table(
      results.flatMap((result) => Object.entries<AccountedGroup>(('groups' in result ? result.groups : undefined) ?? { unavailable: { files: 0 } }).map(([group, m]) => ({
        Scanner: result.name,
        Group: group,
        Status: result.status,
        Files: m.files ?? "—",
        "Leaked spans": m.spans != null ? `${m.leakedSpans} / ${m.spans}` : "—",
        "Leak rate (bound)": shown(m.leakedSpanRate),
        "False alarms": m.flaggedFiles != null ? `${m.flaggedFiles} / ${m.files}` : "—",
        "Alarm rate (bound)": shown(m.falseAlarmRate),
        Collateral: shown(m.collateralRatio),
        Measurable: shown(m.measurableShare),
        Twins: m.twins?.pairs ? `${m.twins.discriminated} / ${m.twins.pairs} of ${m.twins.positives}` : "—",
        "Twin rate": shown(m.twins?.rate),
      }))),
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
await removeCandidate(installation);
// Cross-suite and per-detector groups, accounted once here so the site reads bounds instead of deriving them.
if (published.length) await write('summary', summarizeRun(published as Parameters<typeof summarizeRun>[0], JSON.parse(await readFile(path.join(root, 'benchmarks/fixture-detectors.json'), 'utf8'))));
await write("run", {
  schemaVersion: 5,
  accountingVersion: ACCOUNTING_VERSION,
  runId,
  startedAt,
  finishedAt: new Date().toISOString(),
  categories,
  partial: categories.length !== registry.length,
  scannerVersions,
  ...(candidate ? { candidate } : {}),
  lockHash,
  revision,
  dirty,
});
console.log(`Run ${runId}: ${categories.length} of ${registry.length} suites`);
process.exitCode = failed ? 1 : 0;
