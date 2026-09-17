import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scanners } from "../../scanners/index.mjs";
import { score } from "../../benchmarks/lib/scoring.mjs";
import { buildCorpora } from '../../fixtures/generated/build.mjs';
import { mkdir } from 'node:fs/promises';

// Constructed locally, never issued by a provider. Never enable verification.
const token =
  "ghp_" +
  createHash("sha256")
    .update("redact-secret-benchmarks:never-issued-positive-control:v1")
    .digest("hex")
    .slice(0, 36);

test('TruffleHog detects source-shaped Anthropic, AWS pairs and Shopify with shop context', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'benchmark-reviewed-'));
  const selected = buildCorpora()['common-formats'].fixtures.filter(f => /^(?:anthropic-token-api03|aws-access-key-pair|shopify-token-shpat)-unicode-crlf$/.test(f.id));
  assert.equal(selected.length, 3);
  try {
    await mkdir(path.join(root, 'cases'));
    for (const f of selected) await writeFile(path.join(root, f.path), f.content, { mode: 0o600 });
    // Remove expectations before calling the adapter: output mapping must be independent.
    const actual = await scanners.find(s => s.id === 'trufflehog').scan(root, selected.map(f => ({ ...f, expected: [] })));
    const result = score(selected, actual);
    assert.deepEqual([result.tp, result.fp, result.fn], [4, 0, 0]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const scanner of scanners) {
  test(`${scanner.name}: released scanner finds a synthetic control and accepts a clean file`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), "benchmark-integration-"));
    const prefix =
      "# Synthetic benchmark value, never issued by GitHub.\n# 🔑 Unicode offset control\r\nGITHUB_TOKEN=";
    const positive = {
      id: "positive",
      path: "positive.env",
      content: prefix + token + "\r\n",
      expected: [
        {
          start: Buffer.byteLength(prefix),
          end: Buffer.byteLength(prefix + token),
        },
      ],
    };
    const negative = {
      id: "negative",
      path: "negative.txt",
      content: "No credentials in this control.\n",
      expected: [],
    };
    try {
      assert.match(await scanner.version(root), /^\d+\.\d+\.\d+/);
      await writeFile(path.join(root, positive.path), positive.content, {
        mode: 0o600,
      });
      const detected = score([positive], await scanner.scan(root, [positive]));
      assert.deepEqual([detected.tp, detected.fp, detected.fn], [1, 0, 0]);
      await rm(path.join(root, positive.path));
      await writeFile(path.join(root, negative.path), negative.content, {
        mode: 0o600,
      });
      assert.deepEqual(await scanner.scan(root, [negative]), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("TruffleHog Postgres output normalizes to the original whole URI without live verification", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "benchmark-postgres-"));
  const value = createHash("sha256")
    .update("never-issued:postgres-control")
    .digest("hex")
    .slice(0, 32);
  const uri = `postgres://fixture:${value}@db.example.invalid/example`;
  const content = `🔑\r\n${uri}\n`;
  const fixture = {
    id: "postgres",
    path: "postgres.txt",
    content,
    expected: [],
  };
  try {
    await writeFile(path.join(root, fixture.path), content, { mode: 0o600 });
    const actual = await scanners
      .find((s) => s.id === "trufflehog")
      .scan(root, [fixture]);
    assert.ok(
      actual.some(
        (r) =>
          r.path === fixture.path &&
          r.start === 6 &&
          r.end === 6 + Buffer.byteLength(uri),
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Gitleaks maps original and base64-decoded PEM findings to one source range", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "benchmark-pem-"));
  const body = Buffer.from("Public benchmark text. This is not cryptographic key material.").toString("base64");
  const pem = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
  const fixture = {
    id: "pem", path: "key.txt", content: `🔑\r\n${pem}\n`,
    expected: [{ start: 6, end: 6 + Buffer.byteLength(pem) }],
  };
  try {
    await writeFile(path.join(root, fixture.path), fixture.content, { mode: 0o600 });
    const findings = await scanners.find(s => s.id === "gitleaks").scan(root, [fixture]);
    const result = score([fixture], findings);
    assert.deepEqual([result.tp, result.fp, result.fn], [1, 0, 0]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
