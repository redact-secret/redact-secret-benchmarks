// The v2 candidate-report validator, the measure script and the Linux producer must name the same artifact roster
// (redact-secret#937 adds the two `_pii` browser Wasm builds). A mismatch only shows at the end of an official candidate run.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const text = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const IDS = ['browser-common-pii-wasm', 'browser-common-wasm', 'browser-full-pii-wasm', 'browser-full-wasm', 'candidate-inventory',
  'cli-linux-x64', 'node-forced-wasm', 'node-native', 'python-wheel-install', 'rust-release-helper'];

test('validator, measure script and producer name the same ten candidate artifacts', () => {
  const validator = text('benchmarks/evaluation/domains/pii/profile-cost-v2.ts'), measure = text('scripts/measure-pii-profile-cost-v2.mjs'),
    producer = text('scripts/prepare-pii-profile-cost-linux-v2.mjs');
  for (const id of IDS) {
    assert.ok(validator.includes(`'${id}'`), `validator lacks ${id}`);
    assert.ok(measure.includes(`'${id}'`), `measure script lacks ${id}`);
  }
  for (const id of ['browser-full-wasm', 'browser-common-wasm', 'browser-full-pii-wasm', 'browser-common-pii-wasm'])
    assert.ok(producer.includes(`id: '${id}'`), `producer lacks ${id}`);
});
