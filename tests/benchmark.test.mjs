import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateCorpus, score } from "../benchmarks/lib/scoring.mjs";
import { locate, scanners, command } from "../scanners/index.mjs";

const fixture = {
  id: "unicode",
  path: "unicode.txt",
  content: "🔑 abc xyz\n",
  expected: [{ start: 5, end: 8 }],
};
test("exact matching deduplicates detector hits and treats partial overlaps as FP + FN", () => {
  const hit = { path: fixture.path, start: 5, end: 8 };
  assert.equal(score([fixture], [hit, hit]).tp, 1);
  assert.equal(score([fixture], [hit, hit]).fp, 0);
  const partial = score([fixture], [{ ...hit, start: 4 }]);
  assert.deepEqual(
    [partial.tp, partial.fp, partial.fn, partial.f1],
    [0, 1, 1, 0],
  );
});
test("missing detections, false positives on negatives, and undefined denominators", () => {
  const negative = { ...fixture, expected: [] };
  assert.equal(score([fixture], []).recall, 0);
  assert.equal(score([fixture], []).precision, null);
  assert.equal(score([negative], []).tn, 1);
  assert.equal(score([negative], []).f1, null);
  assert.equal(
    score([negative], [{ path: fixture.path, start: 5, end: 8 }]).fp,
    1,
  );
  assert.throws(() =>
    score([fixture], [{ path: "missing", start: 0, end: 1 }]),
  );
});
test("corpus validation rejects traversal, duplicates, and invalid UTF-8 boundaries", () => {
  assert.doesNotThrow(() => validateCorpus({ fixtures: [fixture] }));
  for (const f of [
    { ...fixture, path: "../outside" },
    { ...fixture, expected: [{ start: 1, end: 4 }] },
    { ...fixture, expected: [{ start: 5, end: 99 }] },
  ])
    assert.throws(() => validateCorpus({ fixtures: [f] }));
  assert.throws(() => validateCorpus({ fixtures: [fixture, fixture] }));
});
test("normalization uses UTF-8 bytes and disambiguates repeated values by line", () => {
  assert.deepEqual(
    locate([fixture], "/tmp/bench", "/tmp/bench/unicode.txt", "abc", 1),
    { path: fixture.path, start: 5, end: 8 },
  );
  const repeated = { ...fixture, content: "abc\nabc\n" };
  assert.equal(
    locate([repeated], "/tmp/bench", fixture.path, "abc", 2).start,
    4,
  );
  assert.throws(() => locate([repeated], "/tmp/bench", fixture.path, "abc"));
  assert.throws(() => locate([fixture], "/tmp/bench", "/etc/passwd", "abc"));
});
test("published npm adapter converts UTF-16 offsets and never exports matched values", async () => {
  const corpus = validateCorpus(
    JSON.parse(
      await readFile(
        new URL("../fixtures/accuracy/corpus.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const dir = await mkdtemp(path.join(tmpdir(), "bench-test-"));
  try {
    for (const f of corpus.fixtures)
      await writeFile(path.join(dir, f.path), f.content);
    const results = await scanners[0].scan(dir, corpus.fixtures);
    const unicode = corpus.fixtures.find((f) => f.id === "unicode-prefix");
    assert.ok(
      results.some(
        (r) =>
          r.path === unicode.path &&
          r.start === unicode.expected[0].start &&
          r.end === unicode.expected[0].end,
      ),
    );
    for (const r of results)
      assert.deepEqual(Object.keys(r).sort(), ["end", "path", "start"]);
    assert.doesNotThrow(() => score(corpus.fixtures, results));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("process failure does not disclose stdout or stderr", async () => {
  await assert.rejects(
    command(
      process.execPath,
      ["-e", 'console.error("PRIVATE_SCANNER_OUTPUT"); process.exit(2)'],
      process.cwd(),
    ),
    (error) =>
      !error.message.includes("PRIVATE_SCANNER_OUTPUT") &&
      error.message.includes("suppressed"),
  );
  await assert.rejects(
    command("nonexistent-secret-benchmark-scanner", [], process.cwd()),
    { message: "unavailable" },
  );
});

test("external adapters invoke filesystem scans and normalize controlled process output", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "bench-adapter-test-"));
  const previousPath = process.env.PATH;
  try {
    const script = `#!${process.execPath}
const args = process.argv.slice(2);
if (args[0] === 'version' || args[0] === '--version') { console.log('v1.2.3'); process.exit(0); }
const file = ${JSON.stringify(fixture.path)};
if (args[0] === 'dir') {
  if (!args.includes('--report-format') || !args.includes('--exit-code')) process.exit(2);
  console.log(JSON.stringify([{ File: file, Secret: 'abc', StartLine: 1 }]));
} else if (args[0] === 'filesystem') {
  if (!args.includes('--no-verification') || !args.includes('--no-update') || !args.includes('--results=verified,unknown,unverified')) process.exit(2);
  console.log(JSON.stringify({SourceMetadata:{Data:{Filesystem:{file,line:1}}},Raw:'abc'}));
} else process.exit(2);
`;
    for (const binary of ["gitleaks", "trufflehog"])
      await writeFile(path.join(dir, binary), script, { mode: 0o700 });
    process.env.PATH = `${dir}${path.delimiter}${previousPath}`;
    for (const scanner of scanners.slice(1)) {
      assert.equal(await scanner.version(dir), "1.2.3");
      assert.deepEqual(await scanner.scan(dir, [fixture]), [
        { path: fixture.path, start: 5, end: 8 },
      ]);
    }
  } finally {
    process.env.PATH = previousPath;
    await rm(dir, { recursive: true, force: true });
  }
});
