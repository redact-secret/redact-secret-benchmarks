import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
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
test("a claim map disambiguates the same value repeated on one line across calls, in document order, without weakening an unclaimed single call", () => {
  const sameLine = { ...fixture, content: "abc abc\n" };
  // No claim map: still ambiguous, still throws -- a claim never substitutes
  // for scanner-reported position on a single isolated call.
  assert.throws(() => locate([sameLine], "/tmp/bench", fixture.path, "abc", 1));
  // Gitleaks-shaped case: one locate() call per physical occurrence, sharing
  // one claim map, resolves each row to a distinct byte offset in order.
  const claim = new Map();
  assert.equal(locate([sameLine], "/tmp/bench", fixture.path, "abc", 1, claim).start, 0);
  assert.equal(locate([sameLine], "/tmp/bench", fixture.path, "abc", 1, claim).start, 4);
  // A third row beyond the number of real occurrences is still ambiguous.
  assert.throws(() => locate([sameLine], "/tmp/bench", fixture.path, "abc", 1, claim));
  // TruffleHog-shaped case: one deduplicated row for two occurrences claims
  // the leftmost (lowest-offset) one, never guessing when unclaimed.
  const single = new Map();
  assert.equal(locate([sameLine], "/tmp/bench", fixture.path, "abc", 1, single).start, 0);
});
for (const id of ["redact-secret", "flare-redact"]) {
  test(`${id}: published npm adapter converts UTF-16 offsets and never exports matched values`, async () => {
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
      const results = await scanners.find((s) => s.id === id).scan(dir, corpus.fixtures);
      const unicode = corpus.fixtures.find((f) => f.id === "unicode-prefix");
      assert.ok(
        results.some(
          (r) =>
            r.path === unicode.path &&
            r.start === unicode.expected[0].start &&
            r.end === unicode.expected[0].end,
        ),
      );
      // #95: redact-secret's `scan()` always reports an `action` per finding; other adapters carry no
      // such concept (docs/specs/decisions/2026-09-21-add-untargeted-benign-corpus.md, Decision 3).
      const expectedKeys = id === "redact-secret" ? ["action", "end", "family", "path", "start"] : ["end", "family", "path", "start"];
      for (const r of results) {
        assert.deepEqual(Object.keys(r).sort(), expectedKeys);
        assert.match(r.family, /^[a-z][a-z0-9-]+$/);
        if (id === "redact-secret") assert.match(r.action, /^(redact|warn|block|allow)$/);
      }
      assert.doesNotThrow(() => score(corpus.fixtures, results));
      assert.deepEqual(score(corpus.fixtures, results).rows.find(r => r.id === "unicode-prefix").spanOutcomes, ["EXACT"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}
test("flare-redact converts UTF-16 offsets to exact UTF-8 byte ranges across the existing Unicode and CRLF fixtures", async () => {
  const { buildCorpora } = await import("../fixtures/generated/build.mjs");
  const selected = buildCorpora()["common-formats"].fixtures.filter((f) =>
    /^(?:github-token-ghp|anthropic-token-api03|aws-access-key-pair|private-key-ed25519|jwt-eddsa)-unicode-crlf$/.test(f.id),
  );
  assert.equal(selected.length, 5);
  const dir = await mkdtemp(path.join(tmpdir(), "flare-redact-unicode-crlf-"));
  try {
    await mkdir(path.join(dir, "cases"));
    for (const f of selected) await writeFile(path.join(dir, f.path), f.content, { mode: 0o600 });
    const actual = await scanners.find((s) => s.id === "flare-redact").scan(dir, selected.map((f) => ({ ...f, expected: [] })));
    const { rows } = score(selected, actual);
    // A wrong UTF-16 -> UTF-8 conversion would show up as PARTIAL/OVERBROAD
    // (an off-by-one at the multi-byte prefix or a CRLF byte) rather than EXACT.
    // aws-access-key-pair contributes two expected spans (id + secret).
    assert.deepEqual(rows.flatMap((r) => r.spanOutcomes), ["EXACT", "EXACT", "EXACT", "EXACT", "EXACT", "EXACT"]);
    assert.deepEqual(rows.map((r) => r.collateralBytes), [0, 0, 0, 0, 0]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("flare-redact runs secrets-only: an ordinary email address in a must-not-flag control is never reported", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "flare-redact-pii-"));
  const negative = { id: "email-only", path: "email.txt", content: "Contact: person@example.com\n" };
  try {
    await writeFile(path.join(dir, negative.path), negative.content, { mode: 0o600 });
    assert.deepEqual(await scanners.find((s) => s.id === "flare-redact").scan(dir, [negative]), []);
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
    for (const scanner of scanners.filter((s) => ["gitleaks", "trufflehog"].includes(s.id))) {
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
