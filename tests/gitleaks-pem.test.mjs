import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGitleaks, withoutDecodedDuplicates } from "../scanners/index.mjs";

const body = "Public benchmark prose, not a cryptographic key.";
const pem = value => `-----BEGIN PRIVATE KEY-----\n${value}\n-----END PRIVATE KEY-----`;
const original = pem(Buffer.from(body).toString("base64"));
const fixture = { path: "key.txt", content: `🔑\r\n${original}\n`, expected: [] };
const row = { File: "/tmp/bench/key.txt", Secret: pem(body), RuleID: "private-key", StartLine: 2, Tags: ["decoded:base64", "decode-depth:1"] };

test("decoded Gitleaks PEM maps to original bytes independently of ground truth", () => {
  const expected = { path: "key.txt", start: 6, end: 6 + Buffer.byteLength(original) };
  assert.deepEqual(normalizeGitleaks([fixture], "/tmp/bench", row), expected);
  assert.deepEqual(normalizeGitleaks([{ ...fixture, expected: [{ start: 0, end: 4 }] }], "/tmp/bench", row), expected);
  assert.deepEqual(normalizeGitleaks([fixture], "/tmp/bench", { ...row, Secret: original, Tags: [] }), expected);
});

test("decoded Gitleaks normalization rejects unsupported or mismatched findings and missing lines", () => {
  for (const change of [
    { File: "unknown.txt" }, { File: null }, { Secret: null },
    { Secret: pem("different public body") }, { StartLine: 1 },
    { RuleID: "generic-api-key" }, { Tags: ["decoded:base64", "decode-depth:2"] },
  ]) assert.throws(() => normalizeGitleaks([fixture], "/tmp/bench", { ...row, ...change }));
  const singleLineBody = "QUJD";
  const invalid = { ...fixture, content: `🔑\r\n${pem(singleLineBody + "=")}\n` };
  assert.throws(() => normalizeGitleaks([invalid], "/tmp/bench", { ...row, Secret: pem("ABC") }));
  // Repeated bodies cannot be resolved without an explicit source line.
  const repeated = { ...fixture, content: `${original} ${original}` };
  assert.throws(() => normalizeGitleaks([repeated], "/tmp/bench", { ...row, StartLine: undefined }));
});

test("a decoded Gitleaks row that only repeats a plain row's exact location is dropped, nothing else", () => {
  const at = { RuleID: "generic-api-key", File: "/tmp/bench/a.yaml", StartLine: 1, EndLine: 1, StartColumn: 1, EndColumn: 80 };
  const plain = { ...at, Secret: "NTY3.x.y", Tags: [] }, decoded = { ...at, Secret: "567.x.y", Tags: ["decoded:base64", "decode-depth:1"] };
  assert.deepEqual(withoutDecodedDuplicates([plain, decoded]), [plain]);
  // 8.30.1 reports EndColumn 0 on the decoded row after a UTF-8 BOM.
  assert.deepEqual(withoutDecodedDuplicates([plain, { ...decoded, EndColumn: 0 }]), [plain]);
  // No plain row starting there: the decoded row is kept, so normalization still rejects it.
  for (const change of [{ StartColumn: 2 }, { StartLine: 2 }, { File: "/tmp/bench/b.yaml" }, { RuleID: "other-rule" }])
    assert.deepEqual(withoutDecodedDuplicates([plain, { ...decoded, ...change }]), [plain, { ...decoded, ...change }]);
  assert.deepEqual(withoutDecodedDuplicates([decoded]), [decoded]);
  // The PEM path keeps its own reconstruction.
  assert.deepEqual(withoutDecodedDuplicates([{ ...plain, RuleID: "private-key" }, { ...decoded, RuleID: "private-key" }]).length, 2);
});
