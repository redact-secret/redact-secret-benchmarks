import assert from 'node:assert/strict';
import test from 'node:test';
import { createCoverageRow, validateCoverageMatrix, COVERAGE_STATES } from '../scripts/lib/pii-coverage-model.mjs';
import { summarizeCoverage, validateCoverageSummary } from '../scripts/lib/pii-coverage-summary.mjs';

const identity = { snapshotId: 'synthetic-snapshot', snapshotCommitment: '1'.repeat(64), productCommitment: '2'.repeat(64), mappingRevision: 2, mappingCommitment: '3'.repeat(64), protocol: 'synthetic-protocol', population: '5'.repeat(64), visibility: 'public', role: 'active', bindingCommitment: '4'.repeat(64) };
function row(overrides = {}) {
  const input = { kindKey: 'synthetic-email', label: 'Synthetic email', domains: ['PII'], jurisdictions: ['US'],
    evidence: { availability: 'accepted', authoredCases: 2, importedCases: 2, fixtures: 2, variants: 2, occurrences: null, acceptedCases: 2 },
    capability: { state: 'declared', source: 'synthetic-capability', productCommitment: identity.productCommitment },
    mapping: { state: 'faithful', losses: [], requiredAxes: ['identity'], representableAxes: ['identity'] },
    observation: { status: 'valid', identity, source: 'synthetic-run', axes: [{ axis: 'identity', eligible: 2, measured: 2, satisfied: 2, missed: 0, unresolved: 0, withheld: 0 }] },
    applicability: { state: 'applicable', source: 'synthetic-contract' }, reasons: [], ...overrides };
  return createCoverageRow(input, identity);
}
const matrix = rows => ({ schemaVersion: 1, identity, rows });

test('synthetic precedence controls every summary state while preserving independent facts', () => {
  const controls = [
    row(),
    row({ observation: { status: 'valid', identity, source: 'run', axes: [{ axis: 'identity', eligible: 2, measured: 1, satisfied: 0, missed: 1, unresolved: 0, withheld: 0 }] }, mapping: { state: 'partial', losses: ['contexts-not-carried'], requiredAxes: ['identity', 'context'], representableAxes: ['identity'] } }),
    row({ mapping: { state: 'partial', losses: ['contexts-not-carried'], requiredAxes: ['identity', 'context'], representableAxes: ['identity'] } }),
    row({ observation: { status: 'absent', identity: null, source: null, axes: [] } }),
    row({ capability: { state: 'unknown', source: null, productCommitment: null } }),
    row({ capability: { state: 'explicitly-absent', source: 'contract', productCommitment: identity.productCommitment }, mapping: { state: 'partial', losses: ['contexts-not-carried'], requiredAxes: ['identity', 'context'], representableAxes: ['identity'] }, observation: { status: 'valid', identity, source: 'run', axes: [{ axis: 'identity', eligible: 2, measured: 2, satisfied: 1, missed: 1, unresolved: 0, withheld: 0 }] } }),
    row({ mapping: { state: 'not-representable', losses: ['phi-domain-not-carried'], requiredAxes: ['domain'], representableAxes: [] } }),
    row({ evidence: { availability: 'deferred', authoredCases: 2, importedCases: null, fixtures: 2, variants: null, occurrences: null, acceptedCases: 0 } }),
    row({ applicability: { state: 'not-applicable', source: 'explicit-contract' } }),
  ];
  assert.deepEqual(controls.map(value => value.state), COVERAGE_STATES);
  assert.ok(controls[1].reasons.includes('recorded-miss'));
  assert.ok(controls[1].reasons.includes('mapping-loss'));
  assert.ok(controls[5].reasons.includes('recorded-miss'));
  assert.ok(controls[5].reasons.includes('product-excluded'));
  assert.ok(controls[5].reasons.includes('mapping-loss'));
});

test('no usable run never implies measured support; unknown remains unknown', () => {
  for (const status of ['absent', 'invalid', 'stale', 'identity-mismatch', 'withheld']) {
    const value = row({ observation: { status, identity: null, source: null, axes: [] } });
    assert.equal(value.state, 'supported-unmeasured');
    assert.notEqual(value.state, 'measured-supported');
  }
  assert.equal(row({ observation: { status: 'valid', identity, source: 'run', axes: [] } }).state, 'supported-unmeasured');
  for (const status of ['absent', 'invalid', 'stale', 'identity-mismatch', 'withheld']) {
    const value = row({ applicability: { state: 'unknown', source: null }, observation: { status, identity: null, source: null, axes: [] } });
    assert.equal(value.state, 'supported-unmeasured');
    assert.ok(value.reasons.includes('applicability-unknown'));
  }
  assert.equal(row({ applicability: { state: 'unknown', source: null } }).state, 'measurement-unavailable');
  assert.equal(row({ evidence: { availability: 'unknown', authoredCases: 0, importedCases: null, fixtures: 0, variants: null, occurrences: null, acceptedCases: 0 } }).state, 'measurement-unavailable');
});

test('closed validation refuses unknown enums, identity mismatch, dropped reasons and impossible counts', () => {
  const mutations = [value => { value.state = 'stable'; }, value => { value.extra = true; }, value => { value.capability.state = 'supported'; },
    value => { value.observation.identity.productCommitment = 'another-product'; }, value => { value.capability.productCommitment = 'another-product'; },
    value => { value.reasons = ['recorded-miss']; }, value => { value.observation.axes[0].satisfied = 3; }, value => { value.applicability = { state: 'not-applicable', source: null }; }];
  for (const mutate of mutations) { const value = structuredClone(row()); mutate(value); assert.throws(() => validateCoverageMatrix(matrix([value]))); }
  const partial = row({ mapping: { state: 'partial', losses: ['contexts-not-carried'], requiredAxes: ['context'], representableAxes: [] } });
  partial.reasons = [];
  assert.throws(() => validateCoverageMatrix(matrix([partial])), /reason omitted/);
  assert.throws(() => validateCoverageMatrix(matrix([row(), row()])), /duplicate kind/);
  const noProduct = { ...identity, productCommitment: null };
  const unboundProduct = structuredClone(row());
  unboundProduct.capability = { state: 'unknown', source: null, productCommitment: null };
  unboundProduct.observation.identity = noProduct;
  assert.throws(() => createCoverageRow(unboundProduct, noProduct), /observation exact identity binding/);
});

test('full required axes, unresolved and withheld prevent a complete claim', () => {
  assert.equal(row({ observation: { status: 'valid', identity, source: 'run', axes: [{ axis: 'identity', eligible: 0, measured: 0, satisfied: 0, missed: 0, unresolved: 0, withheld: 0 }] } }).state, 'measured-partial');
  assert.equal(row({ observation: { status: 'valid', identity, source: 'run', axes: [{ axis: 'identity', eligible: 2, measured: 2, satisfied: 1, missed: 0, unresolved: 1, withheld: 0 }] } }).state, 'measured-partial');
  assert.equal(row({ observation: { status: 'valid', identity, source: 'run', axes: [{ axis: 'identity', eligible: 2, measured: 1, satisfied: 1, missed: 0, unresolved: 0, withheld: 1 }] } }).state, 'measured-partial');
});

test('summary partition, slices, metric grains and filters recount full inventory', () => {
  const supported = row({ domains: ['PII', 'PHI'], jurisdictions: ['US', 'GB'] });
  const unsupported = row({ kindKey: 'synthetic-other', capability: { state: 'explicitly-absent', source: 'contract', productCommitment: identity.productCommitment } });
  const data = matrix([supported, unsupported]);
  const summary = summarizeCoverage(data, { kindKeys: [supported.kindKey] });
  assert.equal(summary.discoveredKinds, 2);
  assert.equal(Object.values(summary.states).reduce((a, b) => a + b, 0), 2);
  assert.equal(summary.view.selectedKinds, 1);
  assert.equal(summary.descriptiveCoverage.denominator, 2);
  assert.equal(summary.descriptiveCoverage.numerator, 1);
  assert.equal(summary.domainSlices.PII, 2); assert.equal(summary.domainSlices.PHI, 1);
  assert.equal(summary.sliceMembership.cannotSumAsUniqueKinds, true);
  assert.equal(summary.metrics[0].effectiveN, 2);
  assert.equal(summary.grainMemberships.occurrences.count, null);
  validateCoverageSummary(summary, data, { kindKeys: [supported.kindKey] });
  assert.throws(() => validateCoverageSummary({ ...summary, discoveredKinds: 1 }, data), /does not recount/);
  assert.throws(() => summarizeCoverage(data, { kindKeys: ['missing'] }), /filter/);
});

test('empty and unsupported-only summaries remain honest; no population pooling', () => {
  assert.equal(summarizeCoverage(matrix([])).descriptiveCoverage.value, null);
  const only = summarizeCoverage(matrix([row({ capability: { state: 'explicitly-absent', source: 'contract', productCommitment: identity.productCommitment } })]));
  assert.equal(only.states['product-not-supported'], 1); assert.equal(only.descriptiveCoverage.value, 0);
  const other = row(); other.observation.identity = { ...identity, population: '6'.repeat(64), visibility: 'protected' };
  assert.throws(() => summarizeCoverage(matrix([other])), /exact identity/);
});

test('unusable observations never enter summary metric quantities', () => {
  const value = row({ observation: { status: 'invalid', identity: null, source: null, axes: [{ axis: 'identity', eligible: 2, measured: 2, satisfied: 2, missed: 0, unresolved: 0, withheld: 0 }] } });
  assert.equal(value.state, 'supported-unmeasured');
  assert.deepEqual(summarizeCoverage(matrix([value])).metrics, []);
  const bad = structuredClone(matrix([row()])); bad.identity.snapshotCommitment = 'wrong';
  assert.throws(() => validateCoverageMatrix(bad), /SHA-256/);
});

test('exhaustive synthetic axes retain deterministic precedence and independent facts', () => {
  let combinations = 0;
  for (const availability of ['accepted', 'deferred', 'unknown'])
    for (const capability of ['declared', 'explicitly-absent', 'unknown'])
      for (const mapping of ['faithful', 'partial', 'not-representable', 'unknown'])
        for (const status of ['valid', 'absent', 'stale', 'invalid', 'identity-mismatch', 'withheld'])
          for (const applicability of ['applicable', 'not-applicable', 'unknown']) {
            const value = row({
              evidence: { availability, authoredCases: 2, importedCases: null, fixtures: 2, variants: null, occurrences: null, acceptedCases: availability === 'accepted' ? 2 : 0 },
              capability: { state: capability, source: capability === 'unknown' ? null : 'explicit-contract', productCommitment: capability === 'unknown' ? null : identity.productCommitment },
              mapping: { state: mapping, losses: mapping === 'faithful' ? [] : ['contexts-not-carried'], requiredAxes: ['identity'], representableAxes: mapping === 'not-representable' ? [] : ['identity'] },
              observation: { status, identity: status === 'valid' ? identity : null, source: status === 'valid' ? 'run' : null, axes: [{ axis: 'identity', eligible: 2, measured: 2, satisfied: 1, missed: 1, unresolved: 0, withheld: 0 }] },
              applicability: { state: applicability, source: applicability === 'unknown' ? null : 'explicit-contract' },
            });
            assert.ok(COVERAGE_STATES.includes(value.state));
            assert.ok(value.reasons.includes('recorded-miss'));
            if (mapping !== 'faithful') assert.ok(value.reasons.includes('mapping-loss'));
            if (applicability === 'not-applicable') assert.equal(value.state, 'not-applicable');
            else if (capability === 'explicitly-absent') assert.equal(value.state, 'product-not-supported');
            assert.notEqual(value.state, 'measured-supported');
            assert.equal(value.observation.axes[0].satisfied, 1); assert.equal(value.observation.axes[0].missed, 1);
            combinations++;
          }
  assert.equal(combinations, 648);
});
