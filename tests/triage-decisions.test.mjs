import test from 'node:test';
import assert from 'node:assert/strict';
import { decideAll } from '../benchmarks/qualification/triage-decisions.ts';

const rc = (over) => ({ id: over.id ?? over.key, key: over.key ?? over.id, kind: 'core-positive-miss', seedCase: 'x--y', family: null, tier: 'T1', evidenceClass: 'provider-documented', restsOnMaintainerOnlyDecision: false, addedInThisSnapshot: true, occurrences: [{}], ...over });
const exact = { measurement: { type: 'positive', span_outcomes: ['EXACT'] } };
const miss = { measurement: { type: 'positive', span_outcomes: ['MISS'] } };
const decide = (list, ctx = {}) => Object.fromEntries(decideAll(list, ctx).map(r => [r.id, r.decision]));

test('a peer divergence is justified only when the reference matches the evidence, and a root cause no rule decides stays open (#698)', () => {
  const d = decide([
    rc({ id: 'a', kind: 'gate-peer-differential-unsettled', peer: 'gitleaks', disagreement: 'reference-only', occurrences: [{ observed: { reference: exact, peer: miss } }] }),
    rc({ id: 'b', kind: 'gate-peer-differential-unsettled', peer: 'gitleaks', disagreement: 'reference-only', occurrences: [{ observed: { reference: miss, peer: exact } }] }),
    rc({ id: 'c', kind: 'gate-peer-differential-unsettled', tier: 'T0', peer: 'gitleaks', disagreement: 'peer-only', occurrences: [{ observed: { reference: { measurement: { type: 'pending' } }, peer: miss } }] }),
    rc({ id: 'd', seedCase: 'unknown-family--z' }),
  ]);
  assert.equal(d.a.classification, 'justified-peer-divergence');
  assert.equal(d.a.ledger.proposal, 'resolved');
  assert.equal(d.b.classification, null);
  assert.equal(d.b.status, 'open');
  assert.equal(d.c.ledger.proposal, 'not-assertable');
  assert.equal(d.d.status, 'open');
});

test('a fix is claimed only when the candidate replay shows it, and encoded and fragmented carriers are scope facts (#698)', () => {
  const amqp = rc({ id: 'q', seedCase: 'generic-connection-grammar-authored--amqp-uri-all-sub-delimiters' });
  assert.equal(decide([amqp]).q.status, 'open');
  assert.equal(decide([amqp], { candidate: { commit: 'c', fixed: [amqp.seedCase], stillFailing: [] } }).q.status, 'fixed-in-candidate');
  const d = decide([rc({ id: 'e', seedCase: 'base64-hex-representation-projections--k' }), rc({ id: 'f', seedCase: 'line-break-and-fragment-authored--key-split-x' })]);
  assert.equal(d.e.classification, 'unsupported-or-feature-scope');
  assert.equal(d.f.classification, 'unsupported-or-feature-scope');
});
