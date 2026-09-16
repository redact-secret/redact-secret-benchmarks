import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initialize,
  scan,
  redact,
  scanAndRedact,
  defaultPlaceholderFormatter,
} from "@redact-secret/core";

const categories = JSON.parse(
  await readFile(
    new URL("../benchmarks/categories.json", import.meta.url),
    "utf8",
  ),
);
await initialize();
for (const category of categories) {
  test(`published npm redaction parity across ${category.id}`, async () => {
    const corpus = JSON.parse(
      await readFile(new URL("../" + category.corpus, import.meta.url), "utf8"),
    );
    assert.ok(corpus.fixtures.length > 0);
    for (const f of corpus.fixtures) {
      const findings = scan(f.content);
      const combined = scanAndRedact(f.content);
      const separate = redact(f.content, findings);
      // Boolean assertions intentionally prevent test output printing input or
      // partially redacted strings on failure. IDs alone identify failures.
      assert.ok(combined.text === separate, `${f.id}: pipeline text mismatch`);
      assert.ok(
        JSON.stringify(combined.findings) === JSON.stringify(findings),
        `${f.id}: pipeline metadata mismatch`,
      );
      let cursor = 0,
        index = 0,
        expected = "";
      for (const finding of findings) {
        if (!["block", "redact"].includes(finding.action)) continue;
        expected +=
          f.content.slice(cursor, finding.start) +
          defaultPlaceholderFormatter(finding, { placeholderIndex: ++index });
        cursor = finding.end;
      }
      expected += f.content.slice(cursor);
      assert.ok(
        separate === expected,
        `${f.id}: replacement or surrounding text mismatch`,
      );
    }
  });
}
