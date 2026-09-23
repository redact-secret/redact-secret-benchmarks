import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewEntryId } from '../benchmarks/engine/execution.ts';

const entry = (product, peerVersion = '3.97.4') => ({
  variant: 'v1', peer: 'trufflehog', disagreement: 'redact-secret-only',
  evidence: { tools: [
    { id: 'redact-secret', ...product },
    { id: 'trufflehog', version: peerVersion, mode: 'cli', configurationHash: 'peer', configuration: {} },
  ] },
});
const published = { version: '0.1.0-beta.6', mode: 'Published npm package', configurationHash: 'a', configuration: { adapterVersion: 2 } };
const candidate = { version: '0.1.0-beta.7', mode: 'Candidate build', configurationHash: 'b', configuration: { adapterVersion: 1 } };

test('a review id does not depend on the product scanner identity', () => {
  assert.equal(reviewEntryId('case', 'src', entry(published)), reviewEntryId('case', 'src', entry(candidate)));
});

test('a review id still changes with the peer scanner version', () => {
  assert.notEqual(reviewEntryId('case', 'src', entry(published)), reviewEntryId('case', 'src', entry(published, '3.97.5')));
});

test('the legacy id keeps the product identity so the old ledger keys can be reproduced', () => {
  assert.notEqual(reviewEntryId('case', 'src', entry(published), true), reviewEntryId('case', 'src', entry(candidate), true));
});
