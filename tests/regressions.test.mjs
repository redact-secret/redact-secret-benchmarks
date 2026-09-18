import test from "node:test";
import assert from "node:assert/strict";
import { initialize, scan } from "@redact-secret/core";
import { buildCorpora } from "../fixtures/generated/build.mjs";
import { validateCorpus } from "../benchmarks/lib/scoring.ts";

const corpora = buildCorpora();

test("SendGrid matrix contains three exact shapes in ten contexts and eight near misses", () => {
  const { fixtures } = validateCorpus(corpora["sendgrid-regressions"]);
  const positive = fixtures.filter((f) => f.expected.length);
  assert.equal(positive.length, 30);
  assert.equal(fixtures.length - positive.length, 8);
  const values = new Set();
  for (const f of positive) {
    assert.equal(f.expected.length, 1);
    const { start, end } = f.expected[0];
    assert.equal(end - start, 69);
    const value = Buffer.from(f.content).subarray(start, end).toString();
    assert.match(value, /^SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/);
    values.add(value);
  }
  assert.equal(values.size, 3);
  assert.ok([...values].some((v) => v.endsWith("-")));
  assert.ok([...values].some((v) => v.includes("_")));
  for (const f of fixtures.filter((f) => !f.expected.length))
    assert.doesNotMatch(
      f.content.trim(),
      /^SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/,
    );
});

test("issue-inspired reference corpus separates pointers from six literal credential controls", () => {
  const { fixtures, references } = validateCorpus(corpora["reference-syntax"]);
  assert.equal(fixtures.filter((f) => f.expected.length === 0).length, 20);
  assert.equal(fixtures.filter((f) => f.expected.length === 1).length, 6);
  assert.equal(references.length, 4);
  for (const f of fixtures.filter((f) => f.expected.length)) {
    const [r] = f.expected;
    assert.ok(r.end - r.start >= 32);
    assert.equal(f.group, "Literal-secret positive controls");
  }
});

test("SendGrid generic-key control detects the entire token, including a trailing dash", async () => {
  await initialize();
  const fixtures = corpora["sendgrid-regressions"].fixtures.filter((f) =>
    f.id.endsWith("-generic-key"),
  );
  assert.equal(fixtures.length, 3);
  for (const f of fixtures) {
    const actual = scan(f.content).map((r) => ({
      start: Buffer.byteLength(f.content.slice(0, r.start)),
      end: Buffer.byteLength(f.content.slice(0, r.end)),
    }));
    for (const expected of f.expected)
      assert.ok(
        actual.some(
          (r) => r.start === expected.start && r.end === expected.end,
        ),
      );
  }
});

test("positive reference controls remain detectable by the public npm surface", async () => {
  await initialize();
  for (const f of corpora["reference-syntax"].fixtures.filter(
    (f) => f.expected.length,
  )) {
    const actual = scan(f.content).map((r) => ({
      start: Buffer.byteLength(f.content.slice(0, r.start)),
      end: Buffer.byteLength(f.content.slice(0, r.end)),
    }));
    for (const expected of f.expected)
      assert.ok(
        actual.some(
          (r) => r.start === expected.start && r.end === expected.end,
        ),
        f.id,
      );
  }
});
