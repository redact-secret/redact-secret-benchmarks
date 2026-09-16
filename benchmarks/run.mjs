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
import { validateCorpus, score } from "./lib/scoring.mjs";

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
const handlers = { accuracy: { validate: validateCorpus, score } };
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
      schemaVersion: 1,
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
        "Exact UTF-8 byte ranges [start, end); identical findings deduplicated.",
      scanners: results,
    };
    const temporary = path.join(
      outputDir,
      `.${category.id}-${process.pid}.json`,
    );
    await writeFile(temporary, JSON.stringify(report, null, 2) + "\n");
    await rename(temporary, path.join(outputDir, `${category.id}.json`));
    console.log(`Updated public/results/${category.id}.json`);
    const percentage = (value) =>
      value == null ? "—" : `${(value * 100).toFixed(1)}%`;
    console.table(
      results.map((result) => ({
        Scanner: result.name,
        Version: result.version ?? "—",
        Status: result.status,
        TP: result.tp ?? "—",
        FP: result.fp ?? "—",
        Missed: result.fn ?? "—",
        Precision: percentage(result.precision),
        Recall: percentage(result.recall),
        F1: percentage(result.f1),
      })),
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
process.exitCode = failed ? 1 : 0;
