import { hash } from '../../substrate/hash.ts';
import type { PiiCase } from './types.ts';

const content = 'subject_id=SYNTHETIC-PERSON-ID-001';
const value = 'SYNTHETIC-PERSON-ID-001';
const start = Buffer.byteLength('subject_id=');

/** Safe schema probe only: deterministic, never issued, and not a support claim. */
export function loadPiiCases(): PiiCase[] {
  const source = { schemaVersion: 1, id: 'pii-schema-probe', contentHash: hash(content) };
  return [{
    id: 'pii-schema-probe', method: 'schema-only', visibility: 'development',
    input: { id: 'pii-schema-probe', path: 'pii/schema-probe.txt', content },
    candidate: { start, end: start + Buffer.byteLength(value) },
    contract: {
      category: 'personal-identifier', family: 'synthetic-person-id', scope: { kind: 'global' },
      typeExpectation: { state: 'valid', validator: null }, sensitivityExpectation: 'unresolved',
      context: { obligation: 'required', class: 'neutral', language: 'en' },
      authority: { kind: 'official-test-source', reference: 'benchmark:schema-probe', observedAt: '2026-09-26' },
      referenceEvidence: null, qualificationProfile: { id: 'pii-v1', version: 1 },
    },
    provenance: { source: 'benchmarks/evaluation/domains/pii/cases.ts', sourceHash: hash(source), seed: 'pii-schema-probe/1',
      rationale: 'Exercises the PII domain contract without representing a real person or support claim.', sources: ['benchmark:schema-probe'] },
  }];
}

