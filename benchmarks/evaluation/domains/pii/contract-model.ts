import { hash } from '../../substrate/hash.ts';
import { generatedVariant } from '../../substrate/variant-lifecycle.ts';
import { isPiiJurisdiction } from './jurisdictions.ts';
import { PII_AUTHORITY_SUPPORTS, PII_IDENTITY_DOMAINS, type PiiAuthority, type PiiCase, type PiiContract, type PiiFinding, type PiiOutcome, type PiiRangeOutcome, type PiiVariant } from './types.ts';

const slug = (value: unknown) => typeof value === 'string' && /^[a-z][a-z0-9-]{1,79}$/.test(value);
const locator = (value: unknown) => typeof value === 'string' && /^(?:https:\/\/[a-z0-9.-]+\/[a-zA-Z0-9._~!$&'()*+,;=:@\/-]+|(?:section|clause|annex):[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119})$/.test(value);
const family = (value: unknown) => typeof value === 'string' && /^pii:(?:global|[a-z]{2}):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export function validatePiiAuthority(authority: PiiAuthority) {
  if (!authority || !['standard', 'public-authority'].includes(authority.sourceKind) || !slug(authority.sourceId) || !locator(authority.locator) ||
      typeof authority.revision !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(authority.revision) ||
      !Array.isArray(authority.supports) || authority.supports.length === 0 || new Set(authority.supports).size !== authority.supports.length ||
      authority.supports.some(item => !PII_AUTHORITY_SUPPORTS.includes(item)))
    throw new Error('Invalid PII authority provenance');
  return authority;
}

export function validatePiiContract(contract: PiiContract) {
  if (!contract || contract.category !== 'pii' || !family(contract.family) || typeof contract.displayName !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9 ()/.+-]{0,79}$/.test(contract.displayName) || !PII_IDENTITY_DOMAINS.includes(contract.identityDomain) ||
      !['valid', 'invalid'].includes(contract.typeExpectation?.state) ||
      !['sensitive', 'non-sensitive', 'not-established'].includes(contract.sensitivityExpectation) ||
      !['none', 'reinforcing', 'required-for-sensitive-classification'].includes(contract.context?.obligation) ||
      !['sensitive', 'neutral', 'non-sensitive'].includes(contract.context?.class) || !slug(contract.context?.language) ||
      !Array.isArray(contract.authority) || contract.authority.length === 0 ||
      contract.qualificationProfile?.id !== 'pii-v1' || contract.qualificationProfile.version !== 1)
    throw new Error('Invalid PII contract');
  for (const authority of contract.authority) validatePiiAuthority(authority);
  const jurisdiction = contract.scope === 'global' ? null : /^jurisdiction:([A-Z]{2})$/.exec(contract.scope)?.[1] ?? null;
  if (contract.scope !== 'global' && (!jurisdiction || !isPiiJurisdiction(jurisdiction))) throw new Error('Invalid PII scope');
  const familyScope = contract.family.split(':')[1];
  if ((contract.scope === 'global' && familyScope !== 'global') || (jurisdiction && familyScope !== jurisdiction.toLowerCase())) throw new Error('PII family and scope disagree');
  if (!contract.authority.some(row => row.supports.some(item => ['lexical', 'validation', 'allocation'].includes(item)))) throw new Error('PII identity lacks normative authority');
  if (jurisdiction && !contract.authority.some(row => row.supports.includes('allocation'))) throw new Error('Jurisdictional PII lacks allocation authority');
  if (contract.sensitivityExpectation !== 'not-established' && !contract.authority.some(row => row.supports.includes('sensitivity') ||
      (contract.sensitivityExpectation === 'non-sensitive' && row.supports.includes('reserved-control')))) throw new Error('Resolved PII sensitivity lacks authority');
  if (contract.typeExpectation.validator !== null && !slug(contract.typeExpectation.validator)) throw new Error('Invalid PII validator identity');
  if (contract.referenceEvidence !== null && (!slug(contract.referenceEvidence?.id) || !Number.isInteger(contract.referenceEvidence.version) || contract.referenceEvidence.version < 1))
    throw new Error('Invalid PII reference evidence');
  return contract;
}

export function validatePiiCase(c: PiiCase) {
  if (!c || !slug(c.id) || !slug(c.method) || !['development', 'regression', 'holdout'].includes(c.visibility) ||
      !c.input || !slug(c.input.id) || !/^pii\/[a-z0-9/_-]+\.txt$/.test(c.input.path) || typeof c.input.content !== 'string' ||
      !Number.isInteger(c.candidate?.start) || !Number.isInteger(c.candidate?.end) || c.candidate.start < 0 || c.candidate.end <= c.candidate.start ||
      c.candidate.end > Buffer.byteLength(c.input.content) || !c.provenance?.source || !c.provenance.sourceHash || !c.provenance.seed ||
      !c.provenance.rationale || !Array.isArray(c.provenance.sources)) throw new Error('Invalid PII case');
  validatePiiContract(c.contract);
  return c;
}

export function piiVariant(c: PiiCase, id = 'authored', input = c.input, contract = c.contract, strategy: PiiVariant['strategy'] = 'authored',
  options: { candidate?: PiiCase['candidate']; operator?: string; operatorVersion?: number; typeEffect?: PiiVariant['transformation']['expectationEffect']['type'];
    sensitivityEffect?: PiiVariant['transformation']['expectationEffect']['sensitivity']; evidence?: Record<string, unknown> } = {}): PiiVariant {
  validatePiiCase(c);
  const candidate = { ...(options.candidate ?? c.candidate) };
  validatePiiCase({ ...structuredClone(c), input: structuredClone(input), contract: structuredClone(contract), candidate });
  const transformation = { method: c.method, methodVersion: 1, operator: options.operator ?? 'authored', operatorVersion: options.operatorVersion ?? 1,
    expectationEffect: { type: options.typeEffect ?? 'preserve', sensitivity: options.sensitivityEffect ?? 'preserve' } };
  const base = generatedVariant({ caseId: c.id, id, fixture: structuredClone(input), strategy, transformation,
    seed: c.provenance.seed, sourceHash: c.provenance.sourceHash, identity: hash });
  return { ...base, contract: structuredClone(contract), candidate, ...(options.evidence ? { evidence: structuredClone(options.evidence) } : {}) };
}

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;
export function rangeOutcome(candidate: { start: number; end: number }, finding?: PiiFinding): PiiRangeOutcome {
  if (!finding) return 'miss';
  if (finding.start === candidate.start && finding.end === candidate.end) return 'exact';
  if (finding.start <= candidate.start && finding.end >= candidate.end) return 'overbroad';
  return overlaps(candidate, finding) ? 'partial' : 'miss';
}

export function interpretPiiOutcome(variant: PiiVariant, scanner: { id: string; status: string; findings?: PiiFinding[] }): PiiOutcome {
  if (scanner.status !== 'complete') return {
    scanner: scanner.id, variant: variant.id,
    typeIdentity: { axis: 'type-identity', status: 'not-measured', state: 'not-measured', reason: scanner.status },
    sensitivityContext: { axis: 'sensitivity-context', status: 'not-measured', state: 'not-measured', reason: scanner.status },
    range: 'not-applicable', observed: { findingCount: 0, families: [], jurisdictions: [] },
  };
  const findings = (scanner.findings ?? []).filter(f => f.path === variant.fixture.path && overlaps(variant.candidate, f));
  const finding = findings[0], expected = variant.contract;
  const expectedJurisdiction = expected.scope.startsWith('jurisdiction:') ? expected.scope.slice('jurisdiction:'.length) : null;
  let typeIdentity: PiiOutcome['typeIdentity'];
  if (expected.typeExpectation.state === 'invalid') typeIdentity = findings.length
    ? { axis: 'type-identity', status: 'fail', state: 'invalid-accepted', reason: 'A mechanically invalid candidate was classified.' }
    : { axis: 'type-identity', status: 'pass', state: 'invalid-correct', reason: 'The invalid candidate was rejected.' };
  else if (!finding) typeIdentity = { axis: 'type-identity', status: 'fail', state: 'miss', reason: 'No finding overlaps the expected occurrence.' };
  else if (!finding.family) typeIdentity = {
    axis: 'type-identity', status: 'not-measured', state: 'not-measured', reason: 'The scanner did not provide PII family identity.',
  };
  else if (finding.family !== expected.family) typeIdentity = {
    axis: 'type-identity', status: 'fail', state: expectedJurisdiction && finding.jurisdiction && finding.jurisdiction !== expectedJurisdiction ? 'wrong-jurisdiction' : 'wrong-family',
    reason: 'The observed identity does not match the authored family or jurisdiction.',
  };
  else if (expectedJurisdiction && !finding.jurisdiction) typeIdentity = {
    axis: 'type-identity', status: 'not-measured', state: 'not-measured', reason: 'The scanner did not provide jurisdiction identity.',
  };
  else if (expectedJurisdiction && finding.jurisdiction !== expectedJurisdiction) typeIdentity = {
    axis: 'type-identity', status: 'fail', state: 'wrong-jurisdiction', reason: 'The observed jurisdiction does not match the authored scope.',
  };
  else typeIdentity = { axis: 'type-identity', status: 'pass', state: 'correct', reason: 'The authored PII identity was observed.' };

  let sensitivityContext: PiiOutcome['sensitivityContext'];
  if (expected.sensitivityExpectation === 'not-established') sensitivityContext = {
    axis: 'sensitivity-context', status: 'review-required', state: 'unresolved', reason: 'Sensitivity is not established by this scaffold.',
  };
  else if (expected.sensitivityExpectation === 'sensitive') sensitivityContext = finding?.sensitive === true
    ? { axis: 'sensitivity-context', status: 'pass', state: 'correct', reason: 'The sensitive occurrence was flagged.' }
    : { axis: 'sensitivity-context', status: 'fail', state: 'miss', reason: 'Sensitive treatment was not established.' };
  else sensitivityContext = finding?.sensitive === true
    ? { axis: 'sensitivity-context', status: 'fail', state: 'false-positive', reason: 'A non-sensitive occurrence was flagged.' }
    : { axis: 'sensitivity-context', status: 'pass', state: 'correct', reason: 'The non-sensitive occurrence remained unflagged.' };
  return { scanner: scanner.id, variant: variant.id, typeIdentity, sensitivityContext, range: rangeOutcome(variant.candidate, finding),
    observed: { findingCount: findings.length, families: [...new Set(findings.flatMap(f => f.family ? [f.family] : []))].sort(),
      jurisdictions: [...new Set(findings.flatMap(f => f.jurisdiction ? [f.jurisdiction] : []))].sort() } };
}
