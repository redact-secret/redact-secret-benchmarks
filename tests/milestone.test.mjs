import test from "node:test";
import assert from "node:assert/strict";
import { buildCorpora } from "../fixtures/generated/build.mjs";
import {
  closedBehaviorIssues,
  milestoneSnapshot,
} from "../fixtures/generated/closed-milestone.mjs";
import { score, validateCorpus } from "../benchmarks/lib/scoring.mjs";
import { normalizeTrufflehog } from "../scanners/index.mjs";

const corpus = buildCorpora()["milestone-6-closed"];
test("closed milestone snapshot maps every reviewed issue without claiming cross-surface validation", () => {
  validateCorpus(corpus);
  assert.equal(corpus.fixtures.length, 92);
  assert.equal(
    corpus.fixtures.reduce((n, f) => n + f.expected.length, 0),
    33,
  );
  assert.deepEqual(
    [...new Set(corpus.fixtures.map((f) => f.issue))].sort((a, b) => a - b),
    closedBehaviorIssues,
  );
  const excluded = milestoneSnapshot.outOfScopeIssues.map((i) => i.issue);
  assert.deepEqual(excluded, [273, 274, 275]);
  assert.equal(new Set([...closedBehaviorIssues, ...excluded]).size, 14);
  assert.match(
    milestoneSnapshot.validation,
    /published npm whole-input detection/i,
  );
  for (const issue of closedBehaviorIssues) {
    const cases = corpus.fixtures.filter((f) => f.issue === issue);
    assert.ok(
      cases.some((f) => !f.expected.length),
      `#${issue}: negative control`,
    );
    assert.ok(
      cases.some((f) => f.expected.length),
      `#${issue}: positive guard`,
    );
  }
});

test("connection-string and quoted positives carry envelopes so whole-URI findings are covered", () => {
  const get = (id) => corpus.fixtures.find((f) => f.id === id);
  const literal = get("issue-255-postgres-literal");
  const [span] = literal.expected;
  assert.ok(span.envelope && Buffer.from(literal.content).subarray(span.envelope.start, span.envelope.end).toString().startsWith("postgres://fixture:"));
  assert.deepEqual(score([literal], [{ path: literal.path, start: span.envelope.start, end: span.envelope.end }]).rows[0].spanOutcomes, ["COVERED"]);
  const quotedSpan = get("issue-257-password-digit").expected[0];
  assert.equal(Buffer.from(get("issue-257-password-digit").content).subarray(quotedSpan.envelope.start, quotedSpan.envelope.end).toString(), 'secret_key="password1"');
  assert.equal(get("issue-262-same-line").expected[0].envelope, undefined);
  assert.equal(corpus.fixtures.filter(f => f.expected.some(r => r.envelope)).length, 21);
});

test("placeholder expectations follow the final decision, not the superseded issue example", () => {
  const get = (id) => corpus.fixtures.find((f) => f.id === id);
  assert.equal(get("issue-257-compound").expected.length, 0);
  assert.match(get("issue-257-compound").content, /REDACTED-EXAMPLE"/);
  assert.equal(get("issue-257-unlisted-word").expected.length, 1);
  assert.equal(get("issue-257-password-digit").expected.length, 1);
  assert.equal(get("issue-257-secret-digit").expected.length, 1);
  assert.equal(get("issue-264-mixed-stars").expected.length, 1);
});

const uri =
  "postgres://fixture:syntheticPassword123@db.example.invalid/example";
const f = {
  id: "postgres",
  path: "postgres.txt",
  content: `🔑\r\n${uri}\n`,
  expected: [],
};
const row = {
  DetectorType: 968,
  Raw: "postgres://fixture:syntheticPassword123@db.example.invalid:5432",
  ExtraData: { database: "example" },
  SourceMetadata: {
    Data: { Filesystem: { file: "/tmp/bench/postgres.txt", line: 2 } },
  },
};
test("Postgres normalization maps an exported canonical URL to its original whole source range", () => {
  const r = normalizeTrufflehog([f], "/tmp/bench", row);
  assert.deepEqual(r, {
    path: f.path,
    start: 6,
    end: 6 + Buffer.byteLength(uri),
  });
  // Expected ranges are deliberately unrelated: normalization must not use them.
  assert.deepEqual(
    normalizeTrufflehog(
      [{ ...f, expected: [{ start: 0, end: 4 }] }],
      "/tmp/bench",
      row,
    ),
    r,
  );
  assert.deepEqual(score([f], [r]).rows[0], { id: f.id, path: f.path, group: undefined, expected: [], actual: [r].map(({ start, end }) => ({ start, end })), flagged: true, findings: 1 });
  assert.deepEqual(
    normalizeTrufflehog([f], "/tmp/bench", {
      ...row,
      ExtraData: undefined,
      SourceMetadata: { Data: { Filesystem: { file: "./postgres.txt" } } },
    }),
    r,
  );
});

test("Postgres normalization rejects wrong identity, malformed output, missing source, and ambiguity", () => {
  for (const variant of [
    { ...row, Raw: null },
    { ...row, Raw: "invalid" },
    { ...row, Raw: "https://example.invalid" },
    { ...row, Raw: "postgres://fixture@db.example.invalid" },
    { ...row, Raw: "postgres://fixture:bad%ZZ@db.example.invalid" },
    { ...row, Raw: row.Raw.replace("5432", "5433") },
    {
      ...row,
      Raw: row.Raw.replace("syntheticPassword123", "differentPassword456"),
    },
    { ...row, ExtraData: { database: "different" } },
    { ...row, SourceMetadata: {} },
    {
      ...row,
      SourceMetadata: {
        Data: { Filesystem: { file: "unknown.txt", line: 2 } },
      },
    },
    {
      ...row,
      SourceMetadata: { Data: { Filesystem: { file: f.path, line: 1 } } },
    },
  ])
    assert.throws(() => normalizeTrufflehog([f], "/tmp/bench", variant));
  assert.throws(() =>
    normalizeTrufflehog([{ ...f, content: `${uri} ${uri}\n` }], "/tmp/bench", {
      ...row,
      SourceMetadata: { Data: { Filesystem: { file: f.path, line: 1 } } },
    }),
  );
  assert.throws(() =>
    normalizeTrufflehog(
      [{ ...f, content: "postgres://bad%ZZ:pass@host.invalid/db\n" }],
      "/tmp/bench",
      row,
    ),
  );
});

test("non-Postgres normalization still preserves exact reported spans", () => {
  const r = normalizeTrufflehog([f], "/tmp/bench", {
    ...row,
    DetectorType: 0,
    Raw: "syntheticPassword123",
  });
  const start = Buffer.byteLength(
    f.content.slice(0, f.content.indexOf("syntheticPassword123")),
  );
  assert.deepEqual(r, { path: f.path, start, end: start + 20 });
});
