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
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { scanners } from "../scanners/index.mjs";
import { validateCorpus } from "./lib/scoring.mjs";
import { classifyFixture, validateAssessment } from './lib/cohorts.mjs';
import { scoreCohorts } from './lib/reporting.mjs';
import { validateStructures } from './lib/validate-structures.mjs';

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
const handlers = { accuracy: { validate: validateCorpus, score: scoreCohorts } };
const outputDir = path.join(root, "public/results");
await mkdir(outputDir, { recursive: true });
let failed = false;
for (const category of registry.filter(
  (c) => !requested || c.id === requested,
)) {
  if (!/^[a-z0-9-]+$/.test(category.id) || !handlers[category.kind])
    throw new Error("Invalid category registration");
  const source = await readFile(path.join(root, category.corpus), "utf8");
  const corpus = handlers[category.kind].validate(JSON.parse(source));
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
    let revision = "unknown",
      dirty = null;
    try {
      revision = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      dirty = Boolean(
        execFileSync("git", ["status", "--porcelain"], {
          cwd: root,
          encoding: "utf8",
        }).trim(),
      );
    } catch {}
    const report = {
      schemaVersion: 3,
      category: category.id,
      generatedAt: new Date().toISOString(),
      reviewStatus: corpus.reviewStatus,
      ...(corpus.scope ? { scope: corpus.scope } : {}),
      ...(corpus.references ? { references: corpus.references } : {}),
      ...(corpus.milestoneReview ? { milestoneReview: corpus.milestoneReview } : {}),
      corpusHash: hash(source),
      lockHash: hash(await readFile(path.join(root, "package-lock.json"))),
      revision,
      dirty,
      runtime: { node: process.version, platform: platform(), arch: arch() },
      fixtureCount: corpus.fixtures.length,
      expectedCount: corpus.fixtures.reduce((n, f) => n + f.expected.length, 0),
      matching:
        "Cohort-separated UTF-8 ranges [start, end). No mixed overall score. Identical findings deduplicated. Containment is separate from exact masking. AWS RawV2 secret components and Shopify composite token mapped from scanner output, never ground truth. Unreviewed observations are unscored.",
      scanners: results,
    };
    const temporary = path.join(
      outputDir,
      `.${category.id}-${process.pid}.json`,
    );
    await writeFile(temporary, JSON.stringify(report, null, 2) + "\n");
    await rename(temporary, path.join(outputDir, `${category.id}.json`));
    console.log(`Updated public/results/${category.id}.json`);
    console.table(
      results.flatMap((result) => Object.entries(result.cohorts ?? { unavailable: {} }).map(([cohort, metrics]) => ({
        Scanner: result.name,
        Cohort: cohort,
        Version: result.version ?? "—",
        Status: result.status,
        Files: metrics.fixtureCount ?? '—',
        Contained: metrics.contained ?? "—",
        Broader: metrics.broader ?? "—",
        ExactTP: metrics.tp ?? "—",
        ExactFP: metrics.fp ?? "—",
        ExactFN: metrics.fn ?? "—",
      }))),
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
process.exitCode = failed ? 1 : 0;
