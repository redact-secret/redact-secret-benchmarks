import assert from 'node:assert/strict';
import test from 'node:test';
import { adoptionReportState } from '../scripts/adoption-report-state.mjs';

// Synthetic only: the product the report states is the one the record's replay scanned, not the registry's current pin.
const registry = (version) => ({ scanners: [{ id: 'redact-secret', version }] });
const record = (product) => ({ state: 'accepted', candidate: { evidenceRelease: 'snapshot-x', engine: { tag: 'v0.1.0-alpha.1' }, ...(product ? { product } : {}) } });

test('a later registry repin does not relabel the product an adoption report measured', () => {
  const state = adoptionReportState(record({ package: 'p', version: '1.0.0-a', integrity: 'sha512-x' }), registry('1.0.0-b'));
  assert.equal(state.product.measured, '@redact-secret/core@1.0.0-a');
});

test('a record that names no product falls back to the registry pin', () => {
  assert.equal(adoptionReportState(record(null), registry('1.0.0-b')).product.measured, '@redact-secret/core@1.0.0-b');
  assert.equal(adoptionReportState(record(null), { scanners: [] }).product.measured, null);
});
