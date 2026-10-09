import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const script of ['benchmarks/corpora/provider-contracts/build-artifacts.mjs', 'benchmarks/corpora/protocol-credentials/generate.mjs', 'benchmarks/corpora/session-material/build-artifacts.mjs']) {
  test(`${script} refuses default mutation and tracked destinations`, () => {
    for (const args of [[], ['--out', 'benchmarks/corpora/overwrite']]) {
      const run = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
      assert.notEqual(run.status, 0);
      assert.match(run.stderr, /Provide --out|ignored results-output/);
    }
  });
}
