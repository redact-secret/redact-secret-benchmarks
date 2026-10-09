import { validateCurrentQualificationSuite } from '../benchmarks/lib/current-qualification-suite.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runtimeInputPaths, validateCurrentRuntimeInput } from '../benchmarks/lib/current-runtime-inputs.mjs';
import { operationalByteBaseline, validateOperationalByteBaseline } from '../benchmarks/evaluation/domains/pii/operational-byte-baseline.ts';

test('current runtime inputs retain original observations and reject changed measurement or setting identity', async () => {
  assert.deepEqual(Object.keys(runtimeInputPaths).sort(), ['default', 'peer', 'pii-global', 'pii-global-us']);
  for (const [id, path] of Object.entries(runtimeInputPaths)) {
    const data = JSON.parse(await readFile(new URL('../' + path, import.meta.url)));
    assert.equal(validateCurrentRuntimeInput(id, data), data);
    const changed = structuredClone(data);
    changed.observations[0].samples[0].redactMs += 1;
    assert.throws(() => validateCurrentRuntimeInput(id, changed), /source binding mismatch/);
    assert.throws(() => validateCurrentRuntimeInput(id === 'peer' ? 'default' : 'peer', data), /source binding mismatch/);
  }
});

test('frozen operational byte budgets reject changed limits, baseline and source candidate', async () => {
  const input = JSON.parse(await readFile(new URL('../benchmarks/inputs/pii/operational-byte-budget.json', import.meta.url)));
  assert.deepEqual(operationalByteBaseline(), input.data);
  for (const change of [
    v => { v.data.byteComparisons.wasmCommonRaw.baseline += 1; },
    v => { v.data.byteComparisons.wasmCommonRaw.maximumIncrease += 1; },
    v => { v.source.candidate.sourceCommit = 'a'.repeat(40); },
    v => { v.source.sha256 = 'a'.repeat(64); },
  ]) {
    const changed = structuredClone(input); change(changed);
    assert.throws(() => validateOperationalByteBaseline(changed), /source or projection binding mismatch/);
  }
});

test('existing engine qualification keeps its exact frozen suite and rejects a changed scanner pin', async () => {
  const bytes = await readFile(new URL('../benchmarks/inputs/credential/qualification-suite.json', import.meta.url), 'utf8');
  assert.doesNotThrow(() => validateCurrentQualificationSuite(bytes));
  const changed = JSON.parse(bytes); changed.scanners['redact-secret'] = 'different';
  assert.throws(() => validateCurrentQualificationSuite(JSON.stringify(changed)), /source digest mismatch/);
});
