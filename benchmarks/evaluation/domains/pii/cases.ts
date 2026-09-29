import { hash } from '../../substrate/hash.ts';
import {
  loadPiiBenignCollisionCases, piiBenignCollisionEvidence,
  type PiiBenignCollisionValidationOptions,
} from './benign-collision-evidence.ts';
import { loadPiiContextCases } from './context-evidence.ts';
import type { PiiAuthority, PiiCase } from './types.ts';

const content = 'contact=person@example.invalid';
const value = 'person@example.invalid';
const start = Buffer.byteLength('contact=');

/** Safe schema probe only: deterministic, never issued, and not a support claim. */
export function loadPiiCases(): PiiCase[] {
  const source = { schemaVersion: 1, id: 'pii-schema-probe', contentHash: hash(content) };
  const emailAuthority: PiiAuthority[] = [
    { sourceKind: 'standard', sourceId: 'ietf-rfc-5322', locator: 'https://www.rfc-editor.org/rfc/rfc5322', revision: 'RFC5322', supports: ['lexical', 'validation'] },
    { sourceKind: 'standard', sourceId: 'ietf-rfc-2606', locator: 'https://www.rfc-editor.org/rfc/rfc2606', revision: 'RFC2606', supports: ['reserved-control', 'sensitivity'] },
  ];
  const nationalAuthority: PiiAuthority[] = [{ sourceKind: 'public-authority', sourceId: 'us-ssa-ssn-randomization',
    locator: 'https://www.ssa.gov/employer/randomization.html', revision: '2011', supports: ['lexical', 'allocation', 'reserved-control', 'sensitivity'] }];
  const nationalContent = 'national_id=000-00-0000', nationalValue = '000-00-0000';
  return [{
    id: 'pii-schema-probe', method: 'schema-only', visibility: 'development',
    input: { id: 'pii-schema-probe', path: 'pii/schema-probe.txt', content },
    candidate: { start, end: start + Buffer.byteLength(value) },
    contract: {
      category: 'pii', family: 'pii:global:email', displayName: 'Email address', identityDomain: 'email', scope: 'global',
      typeExpectation: { state: 'valid', validator: null }, sensitivityExpectation: 'non-sensitive',
      context: { obligation: 'none', class: 'non-sensitive', language: 'en' }, authority: emailAuthority,
      referenceEvidence: null, qualificationProfile: { id: 'pii-v1', version: 1 },
    },
    provenance: { source: 'benchmarks/evaluation/domains/pii/cases.ts', sourceHash: hash(source), seed: 'pii-schema-probe/1',
      rationale: 'Exercises the PII domain contract without representing a real person or support claim.', sources: ['benchmark:schema-probe'] },
  }, {
    id: 'pii-jurisdiction-probe', method: 'schema-only', visibility: 'development',
    input: { id: 'pii-jurisdiction-probe', path: 'pii/jurisdiction-probe.txt', content: nationalContent },
    candidate: { start: Buffer.byteLength('national_id='), end: Buffer.byteLength('national_id=') + Buffer.byteLength(nationalValue) },
    contract: {
      category: 'pii', family: 'pii:us:ssn', displayName: 'US Social Security number', identityDomain: 'national-id', scope: 'jurisdiction:US',
      typeExpectation: { state: 'invalid', validator: null }, sensitivityExpectation: 'non-sensitive',
      context: { obligation: 'none', class: 'non-sensitive', language: 'en' }, authority: nationalAuthority, referenceEvidence: null,
      qualificationProfile: { id: 'pii-v1', version: 1 },
    },
    provenance: { source: 'benchmarks/evaluation/domains/pii/cases.ts', sourceHash: hash({ ...source, id: 'pii-jurisdiction-probe', contentHash: hash(nationalContent) }),
      seed: 'pii-jurisdiction-probe/1', rationale: 'Exercises explicit jurisdictional PII without representing a real person or support claim.', sources: ['benchmark:schema-probe'] },
  }];
}

/** Standard domain corpus: fixed schema probes plus every committed context and benign/collision evidence row. */
export function loadPiiDomainCases(value: unknown = piiBenignCollisionEvidence,
  options: PiiBenignCollisionValidationOptions = {}): PiiCase[] {
  return [...loadPiiCases(), ...loadPiiContextCases(), ...loadPiiBenignCollisionCases(value, options)];
}
