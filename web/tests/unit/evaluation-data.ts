/**
 * A small synthetic evaluation report, in the shape `public/results/evaluation-v1.json` has, for the
 * evaluation resolver and page tests. Every id, count and version here is made up: a test asserts what the
 * resolver derives from THESE rows, never a figure the committed ledger or the run holds.
 */
import type { AssertionStatus, EvaluationAssertion, EvaluationCase, EvaluationReport, EvaluationVariant, QualificationEvidence } from '../../../src/evaluation-types';

const variant = (id: string, over: Partial<EvaluationVariant> = {}): EvaluationVariant => ({
  id, kind: 'must-redact', tier: 'T1', strategy: 'authored', operator: 'identity', property: '', relation: '', expectationEffect: '', contractMatch: null, ...over,
});
const assertion = (scanner: string, type: string, status: AssertionStatus, v: string, baseline = ''): EvaluationAssertion => ({ scanner, type, status, variant: v, baseline, candidate: v });
const base = (id: string, method: string, over: Partial<EvaluationCase> = {}): EvaluationCase => ({
  id, method, targets: ['example-token'], taxonomy: '', sourceSlug: `suite-a--${id}`, variants: [variant('canonical')], assertions: [], findings: [], generation: [], comparisons: [], ...over,
});

const PRODUCT_ID = 'redact-secret';

/** One of each case shape the six methods read. `redact-secret` is the product; `peer-b` did not complete. */
export function syntheticReport(over: Partial<EvaluationReport> = {}): EvaluationReport {
  const ids = [PRODUCT_ID, 'peer-a', 'peer-b'];
  const all = (type: string, results: AssertionStatus[], v: string, baseline = '') => ids.map((s, i) => assertion(s, type, s === 'peer-b' ? 'not-measured' : results[i], v, baseline));
  const cases: EvaluationCase[] = [
    // Twin: one pair; the peer fails the relation.
    base('pair-1', 'twin', {
      variants: [variant('canonical'), variant('twin', { kind: 'must-not-flag', operator: 'authored.twin' })],
      assertions: [
        ...all('present-within-envelope', ['pass', 'pass'], 'canonical'),
        ...all('absent', ['pass', 'fail'], 'twin'),
        ...all('must-flip', ['pass', 'fail'], 'twin', 'canonical'),
      ],
    }),
    // Twin: a pair with a T0 side, so it waits for review.
    base('pair-2', 'twin', {
      sourceSlug: 'suite-b--pair-2',
      variants: [variant('canonical'), variant('twin', { kind: 'must-not-flag', tier: 'T0', operator: 'authored.twin' })],
      assertions: ids.map(s => assertion(s, 'must-flip', s === 'peer-b' ? 'not-measured' : 'review-required', 'twin', 'canonical')),
    }),
    // Benign: a targeted control and an untargeted one with a policy action.
    base('control-1', 'benign', {
      taxonomy: 'near-miss', variants: [variant('canonical', { kind: 'must-not-flag', tier: 'T2' })],
      assertions: all('absent', ['pass', 'fail'], 'canonical'),
      findings: [{ scanner: PRODUCT_ID, variant: 'canonical', count: 0, flagged: false }, { scanner: 'peer-a', variant: 'canonical', count: 2, flagged: true }],
    }),
    base('control-2', 'benign', {
      taxonomy: 'realworld-logs', sourceSlug: 'real-world-shapes--control-2', variants: [variant('canonical', { kind: 'must-not-flag', tier: 'T3' })],
      assertions: all('absent', ['fail', 'pass'], 'canonical'),
      findings: [
        { scanner: PRODUCT_ID, variant: 'canonical', count: 1, flagged: true, actionCounts: { warn: 1 } },
        { scanner: 'peer-a', variant: 'canonical', count: 0, flagged: false },
      ],
    }),
    base('control-3', 'benign', {
      taxonomy: 'realworld-logs', sourceSlug: 'real-world-shapes--control-3', variants: [variant('canonical', { kind: 'must-not-flag', tier: 'T3' })],
      assertions: all('absent', ['fail', 'pass'], 'canonical'),
      findings: [{ scanner: PRODUCT_ID, variant: 'canonical', count: 1, flagged: true, actionCounts: { redact: 1 } }, { scanner: 'peer-a', variant: 'canonical', count: 0, flagged: false }],
    }),
    // Metamorphic: two transforms of one source; the second is not applicable elsewhere.
    base('source-1', 'metamorphic', {
      variants: [variant('canonical'), variant('indent', { strategy: 'derived', operator: 'context.indent', relation: 'same-detection' })],
      assertions: [
        ...all('present-within-envelope', ['pass', 'fail'], 'indent'),
        ...all('same-detection', ['pass', 'fail'], 'indent', 'canonical'),
      ],
      generation: [{ operator: 'context.indent', status: 'generated' }, { operator: 'encoding.crlf', status: 'unsupported' }],
    }),
    // Mutation: one valid mutation (scored) and one that breaks the format (deferred).
    base('source-2', 'mutation', {
      variants: [
        variant('canonical'),
        variant('last', { strategy: 'derived', operator: 'lexical.replace-last', relation: 'same-detection', expectationEffect: 'preserve', contractMatch: true }),
        variant('alphabet', { tier: 'T0', strategy: 'review-required', operator: 'lexical.invalid-alphabet', expectationEffect: 'defer', contractMatch: false }),
      ],
      assertions: [
        ...all('present-within-envelope', ['pass', 'pass'], 'last'),
        ...all('same-detection', ['pass', 'fail'], 'last', 'canonical'),
        ...ids.map(s => assertion(s, 'absolute', s === 'peer-b' ? 'not-measured' : 'review-required', 'alphabet')),
      ],
      generation: [{ operator: 'lexical.replace-last', status: 'generated' }, { operator: 'lexical.invalid-alphabet', status: 'generated' }, { operator: 'structural.remove-segment', status: 'unsupported' }],
    }),
    // Differential: both peers compared once; peer-b did not complete.
    base('input-1', 'differential', {
      comparisons: [
        { peer: 'peer-a', variant: 'canonical', status: 'complete', disagreement: 'redact-secret-only', classification: 'unsupported' },
        { peer: 'peer-b', variant: 'canonical', status: 'incomplete', disagreement: 'none', classification: 'unsupported' },
      ],
    }),
    base('input-2', 'differential', {
      sourceSlug: 'suite-b--input-2',
      comparisons: [
        { peer: 'peer-a', variant: 'canonical', status: 'complete', disagreement: 'none', classification: 'compared' },
        { peer: 'peer-b', variant: 'canonical', status: 'incomplete', disagreement: 'none', classification: 'unsupported' },
      ],
    }),
  ];
  const observation = { source: 'fresh' as const, observedAt: '2026-10-01T00:00:00.000Z', sourceRunId: 'run-0' };
  return {
    schemaVersion: 2, accountingVersion: '1.1', reportType: 'evaluation-public', supportClaims: false,
    runId: '0a1b2c3d-0000-4000-8000-000000000000', startedAt: '2026-10-01T00:00:00.000Z', finishedAt: '2026-10-01T00:05:00.000Z',
    provenance: {
      revision: '1a2b3c4d5e6f', dirty: false, casesHash: 'c', lockHash: 'l', methods: [],
      operators: ['authored.twin', 'context.indent', 'encoding.crlf', 'lexical.replace-last', 'lexical.invalid-alphabet', 'structural.remove-segment'].map(id => ({ id, version: 1 })),
    },
    corpusHashes: { 'suite-a': 'a', 'suite-b': 'b', 'real-world-shapes': 'r' },
    scanners: [
      { id: PRODUCT_ID, version: '1.2.3', status: 'complete', mode: 'Published npm package · default detectors', configurationHash: 'h', observation },
      { id: 'peer-a', version: '4.5.6', status: 'complete', mode: 'Directory scan · default rules', configurationHash: 'h', observation: { ...observation, source: 'snapshot', snapshotDigest: 's', inputDigest: 'i' } },
      { id: 'peer-b', version: null, status: 'unavailable', mode: 'Not installed', configurationHash: 'h', observation },
    ],
    cases,
    reviews: [{ id: 'r1', caseId: 'input-1', variant: 'canonical', peer: 'peer-a', disagreement: 'redact-secret-only' }],
    review: { open: 1, resolved: 0, notAssertable: 0, unknown: 0, oldestOpenRun: null },
    byOperator: {},
    qualification: null,
    ...over,
  };
}

export function syntheticQualification(): QualificationEvidence {
  const counts = (pass: number, fail: number, review = 0) => ({ pass, fail, 'review-required': review });
  return {
    reportType: 'qualification', supportClaims: false, status: 'execution-qualified', scope: 'engine-conformance', runId: '9f8e7d6c-0000-4000-8000-000000000000', finishedAt: '2026-09-29T19:00:12.235Z',
    milestone: { status: 'closed', checkedAt: '2026-09-22T00:00:00Z', openPrerequisites: [] },
    holdout: {
      caseCount: 12, variantCount: 12, generationErrors: 0, methodology: 'frozen-candidate-canonical-cases-aggregate-only', independence: 'public-control', status: 'complete',
      candidate: { sourceHash: 's'.repeat(64), lockHash: 'l'.repeat(64), candidateArtifactHash: 'c'.repeat(64) },
      corpus: { id: 'public-controls', revision: 1, purpose: 'public-conformance', corpusHash: 'h'.repeat(64), seedHash: 'd'.repeat(64), lifecycle: 'sealed-at-execution' },
      planHash: 'p'.repeat(64),
      scanners: [
        { id: PRODUCT_ID, version: '1.2.3', status: 'complete', assertions: counts(12, 0), byStratum: { 'must-redact:T1': counts(6, 0), 'must-not-flag:T3': counts(6, 0) } },
        { id: 'peer-a', version: '4.5.6', status: 'complete', assertions: counts(10, 1, 1), byStratum: { 'must-redact:T1': counts(5, 1), 'must-not-flag:T3': counts(5, 0, 1) } },
        { id: 'peer-b', version: null, status: 'unavailable', assertions: counts(0, 0), byStratum: {} },
      ],
    },
  };
}
