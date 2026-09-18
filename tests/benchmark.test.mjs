import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateCorpus, score } from "../benchmarks/lib/scoring.ts";
import { locate, scanners, command } from "../scanners/index.mjs";

const fixture = {
  id: "unicode",
  path: "unicode.txt",
  content: "🔑 abc xyz\n",
  expected: [{ start: 5, end: 8, role: "secret" }],
};
const outcome = (fixtures, findings) => score(fixtures, findings).rows[0];
test("lattice scoring deduplicates detector hits and grades a wider finding as OVERBROAD, not as a miss", () => {
  const hit = { path: fixture.path, start: 5, end: 8 };
  assert.deepEqual(outcome([fixture], [hit, hit]).actual, [{ start: 5, end: 8 }]);
  assert.deepEqual(outcome([fixture], [hit, hit]).spanOutcomes, ["EXACT"]);
  const wider = outcome([fixture], [{ ...hit, start: 4 }]);
  assert.deepEqual([wider.spanOutcomes, wider.leakedBytes, wider.collateralBytes], [["OVERBROAD"], 0, 1]);
  const shorter = outcome([fixture], [{ ...hit, end: 7 }]);
  assert.deepEqual([shorter.spanOutcomes, shorter.leakedBytes], [["PARTIAL"], 1]);
});
test("missing detections, false alarms on controls, and no scanner-wide rates", () => {
  const negative = { ...fixture, expected: [] };
  assert.deepEqual(outcome([fixture], []).spanOutcomes, ["MISS"]);
  assert.equal(outcome([fixture], []).leakedBytes, 3);
  assert.deepEqual(outcome([negative], []), { id: "unicode", path: "unicode.txt", group: undefined, expected: [], actual: [], flagged: false, findings: 0 });
  assert.equal(outcome([negative], [{ path: fixture.path, start: 5, end: 8 }]).findings, 1);
  assert.deepEqual(Object.keys(score([fixture], [])), ["rows"]);
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
    assert.deepEqual(score(corpus.fixtures, results).rows.find(r => r.id === "unicode-prefix").spanOutcomes, ["EXACT"]);
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
