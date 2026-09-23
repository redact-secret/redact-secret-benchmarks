import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateCorpus, score } from "../benchmarks/lib/scoring.ts";
import { locate, command } from "../scanners/index.mjs";
import {
  buildCorpora,
  fixture,
  synthetic,
} from "../fixtures/generated/build.mjs";

const base = fixture("sample", "Test", [
  "🔑 ",
  { secret: "abc" },
  " ",
  { secret: "xyz" },
  "\r\n",
]);
for (const [name, corpus] of [
  ["null corpus", null],
  ["empty corpus", { fixtures: [] }],
  ["null fixture", { fixtures: [null] }],
  ["numeric id", { fixtures: [{ ...base, id: 123 }] }],
  ["duplicate id", { fixtures: [base, { ...base, path: "other.txt" }] }],
  ...[
    "/absolute",
    "../escape",
    "a/../escape",
    "a/./file",
    "a//file",
    "a\\file",
    "a:file",
    "",
  ].map((path) => [`unsafe path ${path}`, { fixtures: [{ ...base, path }] }]),
  ["duplicate path", { fixtures: [base, { ...base, id: "other" }] }],
  ["non-text content", { fixtures: [{ ...base, content: null }] }],
  ["missing ranges", { fixtures: [{ ...base, expected: null }] }],
  ...[
    null,
    { start: -1, end: 2 },
    { start: 5, end: 5 },
    { start: 5, end: 99 },
    { start: 5.5, end: 8 },
    { start: 1, end: 4 },
  ].map((range, i) => [
    `invalid expected range ${i}`,
    { fixtures: [{ ...base, expected: [range] }] },
  ]),
  [
    "overlapping ranges",
    {
      fixtures: [
        {
          ...base,
          expected: [
            { start: 5, end: 8 },
            { start: 7, end: 10 },
          ],
        },
      ],
    },
  ],
])
  test(`rejects ${name}`, () => assert.throws(() => validateCorpus(corpus)));

for (const [name, findings] of [
  ["non-array", null],
  ["null entry", [null]],
  ["unknown path", [{ path: "other", start: 0, end: 1 }]],
  ...[
    { start: -1, end: 4 },
    { start: 5, end: 5 },
    { start: 5, end: 99 },
    { start: 5.5, end: 8 },
    { start: 1, end: 4 },
    { start: 0, end: 2 },
  ].map((r, i) => [`invalid reported range ${i}`, [{ path: base.path, ...r }]]),
])
  test(`scoring rejects ${name}`, () =>
    assert.throws(() => score([base], findings)));

test("rows carry per-span outcomes and control counts; no value is ever exported", () => {
  const clean = fixture("clean", "Test", ["hello"]);
  const dirty = fixture("dirty", "Test", ["abc"]);
  const first = { path: base.path, start: base.expected[0].start, end: base.expected[0].end };
  const result = score(
    [base, clean, dirty],
    [first, first, { path: dirty.path, start: 0, end: 3 }],
  );
  assert.deepEqual(result.rows.map(r => r.spanOutcomes ?? r.findings), [["EXACT", "MISS"], 0, 1]);
  assert.deepEqual(Object.keys(result), ["rows"]);
  assert.ok(!JSON.stringify(result).includes("abc"));
  assert.deepEqual(
    score(
      [base],
      base.expected.map((r) => ({ path: base.path, start: r.start, end: r.end })),
    ).rows[0].spanOutcomes,
    ["EXACT", "EXACT"],
  );
});

test("ranges at byte zero and EOF, adjacent spans, and LF/CRLF offsets are valid", () => {
  const f = fixture("bounds", "Test", [{ secret: "ab" }, { secret: "cd" }]);
  validateCorpus({ fixtures: [f] });
  assert.deepEqual(
    score(
      [f],
      f.expected.map((r) => ({ path: f.path, start: r.start, end: r.end })),
    ).rows[0].spanOutcomes,
    ["EXACT", "EXACT"],
  );
  const line = fixture("line", "Test", [
    "\ufeff# 🔑\r\n",
    { secret: "abc" },
    "\r\n",
  ]);
  assert.deepEqual(locate([line], "/tmp", line.path, "abc", 2), {
    path: line.path,
    start: 11,
    end: 14,
  });
});

test("normalization rejects absent values, wrong lines, same-line ambiguity and invalid metadata", () => {
  const repeated = fixture("repeated", "Test", ["abc abc\n"]);
  for (const [file, raw, line] of [
    [null, "abc", 1],
    [base.path, "", 1],
    [base.path, "missing", 1],
    [base.path, "abc", 2],
  ]) {
    assert.throws(() => locate([base], "/tmp", file, raw, line));
  }
  assert.throws(() => locate([repeated], "/tmp", repeated.path, "abc", 1));
  assert.equal(locate([base], "/tmp", "./" + base.path, "abc", 1).start, 5);
});

test("Gitleaks environment rule overrides cannot affect benchmark execution", async () => {
  const oldConfig = process.env.GITLEAKS_CONFIG,
    oldToml = process.env.GITLEAKS_CONFIG_TOML;
  try {
    process.env.GITLEAKS_CONFIG = "do-not-use";
    process.env.GITLEAKS_CONFIG_TOML = "do-not-use";
    const output = await command(
      process.execPath,
      [
        "-e",
        "console.log(Boolean(process.env.GITLEAKS_CONFIG || process.env.GITLEAKS_CONFIG_TOML))",
      ],
      process.cwd(),
    );
    assert.equal(output.trim(), "false");
  } finally {
    if (oldConfig === undefined) delete process.env.GITLEAKS_CONFIG;
    else process.env.GITLEAKS_CONFIG = oldConfig;
    if (oldToml === undefined) delete process.env.GITLEAKS_CONFIG_TOML;
    else process.env.GITLEAKS_CONFIG_TOML = oldToml;
  }
});

test("generated corpora are deterministic, valid, and match the checked-in files", async () => {
  assert.equal(synthetic("a", 100), synthetic("a", 100));
  assert.notEqual(synthetic("a", 36), synthetic("b", 36));
  const corpora = buildCorpora();
  assert.deepEqual(
    Object.values(corpora).map((c) => c.fixtures.length),
    [42, 173, 24, 49, 26, 92, 654, 144],
  );
  for (const [id, corpus] of Object.entries(corpora)) {
    assert.equal(corpus.schemaVersion, 2);
    validateCorpus(corpus);
    assert.equal(
      await readFile(
        new URL(`../fixtures/generated/${id}.json`, import.meta.url),
        "utf8",
      ),
      JSON.stringify(corpus, null, 2) + "\n",
    );
    for (const f of corpus.fixtures) {
      for (const r of f.expected)
        assert.ok(Buffer.from(f.content).subarray(r.start, r.end).length > 0);
    }
  }
});

test("all registered categories have valid, nonempty corpora", async () => {
  const registry = JSON.parse(
    await readFile(
      new URL("../benchmarks/categories.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(new Set(registry.map((c) => c.id)).size, registry.length);
  for (const category of registry)
    validateCorpus(
      JSON.parse(
        await readFile(
          new URL("../" + category.corpus, import.meta.url),
          "utf8",
        ),
      ),
    );
});
