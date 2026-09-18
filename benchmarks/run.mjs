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
import { scanners } from "../scanners/index.mjs";
import { validateCorpus } from "./lib/scoring.mjs";
import { classifyFixture, validateAssessment, validateContracts } from './lib/assessment.mjs';
import { scoreReport } from './lib/reporting.mjs';
import { validateStructures } from './lib/validate-structures.mjs';

export const MATCHING = "Per-span outcome lattice over UTF-8 [start, end). Envelope-relative coverage. Identical findings deduplicated. No cross-tier aggregation; no precision, recall or F1. T0 observations unscored. AWS RawV2 secret components and Shopify composite token mapped from scanner output, never ground truth.";

const root = fileURLToPath(new URL("../", import.meta.url));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const registry = JSON.parse(
  await readFile(path.join(root, "benchmarks/categories.json"), "utf8"),
);
const args = process.argv.slice(2);
const requested = args.find((a) => a.startsWith("--category="))?.split("=")[1];
if (
  args.some((a) => a !== "--strict" && !a.startsWith("--category=")) ||
  (requested && !registry.some((c) => c.id === requested))
) {
  console.error("Usage: npm run bench -- [--category=accuracy] [--strict]");
  process.exit(1);
}
validateContracts();
const handlers = { accuracy: { validate: validateCorpus, score: scoreReport } };
const outputDir = path.join(root, "public/results");
await mkdir(outputDir, { recursive: true });
const startedAt = new Date().toISOString();
// One run, one id (§2.7): every report written by this invocation carries it.
const runId = `${startedAt}-${randomBytes(3).toString("hex")}`;
const lockHash = hash(await readFile(path.join(root, "package-lock.json")));
let revision = "unknown",
  dirty = null;
try {
  revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  dirty = Boolean(execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim());
} catch {}
const write = async (name, report) => {
  const temporary = path.join(outputDir, `.${name}-${process.pid}.json`);
  await writeFile(temporary, JSON.stringify(report, null, 2) + "\n");
  await rename(temporary, path.join(outputDir, `${name}.json`));
};
let failed = false;
const scannerVersions = {};
const categories = [];
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
        results.push({
          ...base,
          version,
          status: "complete",
          durationMs: Math.round((performance.now() - start) * 100) / 100,
          ...handlers[category.kind].score(corpus.fixtures, findings),
        });
        console.log(`${category.id} / ${scanner.name}: complete`);
      } catch (error) {
        const unavailable = error.message === "unavailable";
        results.push({
          ...base,
          version,
          status: unavailable ? "unavailable" : "error",
          message: unavailable
            ? "Install the released binary and add it to PATH."
            : "Scanner execution or normalization failed. Check the adapter and installed version; raw scanner output is suppressed.",
        });
        console.log(
          `${category.id} / ${scanner.name}: ${unavailable ? "unavailable" : "error"}`,
        );
        if (!unavailable || args.includes("--strict")) failed = true;
      }
    }
    const report = {
      schemaVersion: 4,
      runId,
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
    categories.push(category.id);
    console.log(`Updated public/results/${category.id}.json`);
    console.table(
      results.flatMap((result) => Object.entries(result.groups ?? { unavailable: {} }).map(([group, m]) => ({
        Scanner: result.name,
        Group: group,
        Status: result.status,
        Files: m.files ?? "—",
        "Leaked spans": m.spans != null ? `${m.leakedSpans} / ${m.spans}` : "—",
        "False alarms": m.flaggedFiles != null ? `${m.flaggedFiles} / ${m.files}` : "—",
        Collateral: m.collateralRatio != null ? m.collateralRatio.toFixed(3) : "—",
        Twins: m.twins?.pairs ? `${m.twins.discriminated} / ${m.twins.pairs}` : "—",
      }))),
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
await write("run", {
  schemaVersion: 4,
  runId,
  startedAt,
  finishedAt: new Date().toISOString(),
  categories,
  partial: categories.length !== registry.length,
  scannerVersions,
  lockHash,
  revision,
  dirty,
});
console.log(`Run ${runId}: ${categories.length} of ${registry.length} suites`);
process.exitCode = failed ? 1 : 0;
