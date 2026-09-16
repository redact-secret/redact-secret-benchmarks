import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildCorpora } from "../fixtures/generated/build.mjs";

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const registry = await read("../benchmarks/detectors.json");
const assignments = await read("../benchmarks/fixture-detectors.json");
const { fixtures } = buildCorpora()["detector-coverage"];

test("every registered detector has positive contexts and independent negative controls", () => {
  assert.deepEqual(
    [...new Set(fixtures.flatMap(f => f.detectors))].sort(),
    registry.detectors.map(d => d.id).sort(),
  );
  for (const detector of registry.detectors) {
    const selected = fixtures.filter(f => f.detectors.includes(detector.id));
    assert.ok(selected.filter(f => f.expected.length === 0).length >= 2, detector.id);
    for (const suffix of ["-bare", "-quoted", "-unicode-crlf"])
      assert.ok(selected.some(f => f.id.endsWith(suffix) && f.expected.length), `${detector.id}: ${suffix}`);
    for (const f of selected)
      assert.deepEqual(assignments[`detector-coverage--${f.id}`], f.detectors, f.id);
  }
});

test("context wrapping preserves secret bytes and URI ranges exclude public components", () => {
  const bytes = f => f.expected.map(r => Buffer.from(f.content).subarray(r.start, r.end).toString());
  for (const f of fixtures.filter(f => f.id.endsWith("-bare"))) {
    const stem = f.id.slice(0, -5);
    for (const suffix of ["-quoted", "-unicode-crlf"])
      assert.ok(JSON.stringify(bytes(f)) === JSON.stringify(bytes(fixtures.find(x => x.id === stem + suffix))), f.id);
    if (f.detectors.includes("connection-string") || f.detectors.includes("otpauth-uri")) {
      assert.equal(f.expected.length, 1);
      assert.match(bytes(f)[0], /^[A-Za-z0-9]+$/, f.id);
      assert.ok(f.expected[0].start > 0 && f.expected[0].end < Buffer.byteLength(f.content), f.id);
    }
  }
});

test("PEM and JWT fixtures contain public synthetic material rather than working credentials", () => {
  const pem = fixtures.filter(f => f.detectors.includes("private-key") && f.id.endsWith("-bare"));
  assert.equal(pem.length, 6);
  for (const f of pem) {
    const body = f.content.split("\n")[1];
    assert.equal(Buffer.from(body, "base64").toString(), "Public benchmark text. This is not cryptographic key material.");
  }
  const jwt = fixtures.find(f => f.id === "jwt-expired-fabricated-bare");
  const payload = JSON.parse(Buffer.from(jwt.content.split(".")[1], "base64url").toString());
  assert.equal(payload.exp, 1);
  assert.equal(payload.iss, "https://example.invalid");
});
