import { isPiiContextVocabulary } from './context-vocabulary.ts';
import { hash } from '../../substrate/hash.ts';
import oracleData from './identity-oracle-v1.json';
import networkAddressPlan from './network-address-qualification-v1.json';
import emailPlan from './email-qualification-v1.json';
import paymentCardPlan from './payment-card-qualification-v1.json';
import ibanPlan from './iban-qualification-v1.json';
import usSsnPlan from './us-ssn-qualification-v1.json';
import phonePlan from './phone-qualification-v1.json';
import { usSsnAllocationV1 } from './validators.ts';

/**
 * Evaluation-only identity/sensitivity oracle (benchmarks #423, core #901).
 *
 * A public PII finding means the product decided an occurrence is sensitive, and nothing more. This
 * oracle keeps two separate things that the public stream cannot express:
 *
 * - **Authored truth.** For every qualification-plan case, the identity (`valid` / `invalid` /
 *   `not-established`) and sensitivity (`sensitive` / `non-sensitive` / `not-established`) that the
 *   frozen family contract and its named authority assign to the authored candidate. A reference
 *   validator (Luhn, ISO 13616 mod-97, SSA allocation, NANP structure, IP syntax) is re-applied to the
 *   authored candidate, never to detector output.
 * - **Product identity observation.** Whether the product itself recognized a no-finding candidate as a
 *   family identity and with which sensitivity. The installed artifacts expose no such surface, and the
 *   core adds none publicly. Until the non-public seam in redact-secret/redact-secret#910 exists, this
 *   axis is a typed `not-measured`. It is never inferred from the absence of a public finding.
 *
 * The public projection carries only aggregate counts, fixed labels, provenance commitments and
 * unavailable reasons: no case id, value, span, score, threshold or feature.
 */

export const PII_ORACLE_IDENTITY_STATES = ['valid', 'invalid', 'not-established'] as const;
export const PII_ORACLE_SENSITIVITY_STATES = ['sensitive', 'non-sensitive', 'not-established'] as const;
/** Bases an identity label may cite. */
export const PII_ORACLE_IDENTITY_BASES = ['contract-grammar', 'reference-validator', 'authority-published-value'] as const;
/** Bases that can establish sensitivity: the contract's context rule, or an authority-reserved value. */
export const PII_ORACLE_SENSITIVITY_BASES = ['contract-context-rule', 'authority-reserved-value'] as const;
/** Signals that are named so they can be rejected: none of them establishes sensitivity. */
export const PII_ORACLE_INSUFFICIENT_SENSITIVITY_BASES = ['validator-hit', 'context-keyword', 'public-absence', 'public-finding'] as const;
/** The vocabulary the authored oracle and its plans were frozen against; product evidence may report a later one. */
export const PII_ORACLE_CONTEXT_VOCABULARY = 'pii-context/v1';
export const PII_PRODUCT_IDENTITY_FORMAT = 'redact-secret/pii-identity-evaluation/1';
export const PII_PRODUCT_IDENTITY_SEAM_ISSUE = 'redact-secret/redact-secret#910';
export const PII_ORACLE_UNAVAILABLE_REASON = Object.freeze({ code: 'product-identity-seam-unavailable', issue: PII_PRODUCT_IDENTITY_SEAM_ISSUE });

export type PiiOracleIdentity = typeof PII_ORACLE_IDENTITY_STATES[number];
export type PiiOracleSensitivity = typeof PII_ORACLE_SENSITIVITY_STATES[number];
export interface PiiOracleLabel {
  caseId: string; candidate: { start: number; end: number } | null;
  identity: PiiOracleIdentity; identityBasis: string[];
  sensitivity: PiiOracleSensitivity; sensitivityBasis: string[];
}
export interface PiiOracleFamily {
  family: string; findingType: string; familyContractVersion: number; plan: string; planCommitment: string;
  referenceValidator: { id: string; version: number } | null; labels: PiiOracleLabel[];
}
export interface PiiIdentityOracle {
  schemaVersion: 1; reportType: 'pii-identity-oracle'; oracleVersion: 1; supportClaims: false; evidenceKind: 'authored-truth';
  contextVocabulary: string; rationale: string; families: PiiOracleFamily[];
}
type PlanCase = { id: string; input: string; expected: { publicFinding: boolean; sensitive?: boolean; start?: number; end?: number } };
export type PiiOraclePlan = { family: string; findingType: string; familyContractVersion?: number; cases: PlanCase[] };

const exact = (value: unknown, keys: readonly string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
const commitment = (value: Record<string, unknown>) => {
  const { artifactCommitment: _artifactCommitment, ...rest } = value; return hash(JSON.stringify(canonical(rest)));
};
export const piiIdentityOracleCommitment = (oracle: unknown) => hash(JSON.stringify(canonical(oracle)));
export const piiOraclePlanCommitment = (plan: unknown) => hash(JSON.stringify(plan));

// ---------------------------------------------------------------------------------------------------------------
// Reference validators over the authored candidate. They return only valid/invalid and never see detector output.
// ---------------------------------------------------------------------------------------------------------------
const luhn = (value: string) => {
  const digits = value.replace(/[ -]/g, '');
  if (!/^\d{8,19}$/.test(digits)) return false;
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0;
};
const ibanMod97 = (value: string) => {
  const compact = value.replace(/ /g, '');
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return false;
  const rearranged = `${compact.slice(4)}${compact.slice(0, 4)}`;
  let remainder = 0;
  for (const char of rearranged) {
    const chunk = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of chunk) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
};
const nanpStructure = (value: string) => {
  // #426: phone-v1 also accepts `+1-NXX-NXX-XXXX`, `(NXX) NXX-XXXX` and the `extension` marker; the first pattern is
  // the original one, so every #423 label keeps its verdict.
  const match = /^(?:\+?1 ?)?(\d{3})[- ]?(\d{3})[- ]?(\d{4})(?: (?:ext\.?|extension) \d{1,6})?$/.exec(value) ??
    /^(?:\+1-(\d{3})-(\d{3})-\d{4}|\((\d{3})\) (\d{3})-\d{4})(?: (?:ext\.?|extension) \d{1,6})?$/.exec(value);
  if (!match) return false;
  const [area, office] = match.slice(1).filter(Boolean);
  const n11 = (code: string) => code.slice(1) === '11';
  return /^[2-9]/.test(area) && /^[2-9]/.test(office) && !n11(area) && !n11(office);
};
const ipv4 = (value: string) => {
  const parts = value.split('.');
  return parts.length === 4 && parts.every(part => /^(?:0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
};
const ipv6 = (value: string) => {
  if (!/^[0-9A-Fa-f:.]+$/.test(value) || value.split('::').length > 2) return false;
  let text = value;
  if (text.includes('.')) {
    const lastColon = text.lastIndexOf(':');
    if (!ipv4(text.slice(lastColon + 1))) return false;
    text = `${text.slice(0, lastColon + 1)}0:0`;
  }
  const [head, rest] = text.includes('::') ? text.split('::') : [text, null];
  const groups = (part: string) => part === '' ? [] : part.split(':');
  const left = groups(head), right = rest === null ? [] : groups(rest);
  if ([...left, ...right].some(group => !/^[0-9A-Fa-f]{1,4}$/.test(group))) return false;
  const count = left.length + right.length;
  return rest === null ? count === 8 : count < 8;
};
const ipAddress = (value: string) => ipv4(value) || ipv6(value);
const usSsn = (value: string) => {
  const compact = /^\d{3}-\d{2}-\d{4}$/.test(value) ? value.replace(/-/g, '') : value;
  return usSsnAllocationV1.validate(compact).state === 'valid';
};
export const PII_ORACLE_REFERENCE_VALIDATORS: Readonly<Record<string, { version: number; family: string; validate: (value: string) => boolean }>> =
  Object.freeze({
    luhn: { version: 1, family: 'pii:global:payment-card', validate: luhn },
    'iban-mod97': { version: 1, family: 'pii:global:iban', validate: ibanMod97 },
    'us-ssn-allocation': { version: 1, family: 'pii:us:ssn', validate: usSsn },
    'nanp-structure': { version: 1, family: 'pii:global:phone', validate: nanpStructure },
    'ip-address-syntax': { version: 1, family: 'pii:global:network-address', validate: ipAddress },
  });

// ---------------------------------------------------------------------------------------------------------------
// Label rules
// ---------------------------------------------------------------------------------------------------------------
const LEGAL_COMBINATIONS: ReadonlySet<string> = new Set(['valid/sensitive', 'valid/non-sensitive', 'valid/not-established',
  'invalid/not-established', 'not-established/not-established']);

/**
 * Reject a sensitivity claim that no admissible basis supports. A validator hit, a context keyword, a public
 * finding or public absence may accompany a claim; none of them can carry it alone.
 */
export function assertPiiSensitivityClaim(claim: { identity: string; sensitivity: string; sensitivityBasis: readonly string[] }) {
  const basis = claim.sensitivityBasis;
  if (!Array.isArray(basis) || new Set(basis).size !== basis.length ||
      basis.some(entry => !(PII_ORACLE_SENSITIVITY_BASES as readonly string[]).includes(entry) &&
        !(PII_ORACLE_INSUFFICIENT_SENSITIVITY_BASES as readonly string[]).includes(entry)))
    throw new Error('Invalid PII sensitivity basis');
  if (basis.includes('public-absence')) throw new Error('Public absence is not evidence of PII sensitivity');
  if (claim.sensitivity === 'not-established') {
    if (basis.length) throw new Error('A not-established sensitivity cites no basis');
    return true;
  }
  if (claim.identity !== 'valid') throw new Error('Impossible PII oracle state: sensitivity established without a valid identity');
  const required = claim.sensitivity === 'sensitive' ? 'contract-context-rule' : 'authority-reserved-value';
  if (!basis.includes(required)) throw new Error(`PII ${claim.sensitivity} claim lacks its admissible basis`);
  if (claim.sensitivity === 'non-sensitive' && basis.includes('contract-context-rule'))
    throw new Error('A context rule cannot establish non-sensitivity');
  return true;
}

export function validatePiiOracleLabel(label: unknown, referenceValidator: PiiOracleFamily['referenceValidator'], input?: string) {
  if (!exact(label, ['caseId', 'candidate', 'identity', 'identityBasis', 'sensitivity', 'sensitivityBasis'])) throw new Error('Invalid PII oracle label');
  const row = label as PiiOracleLabel;
  if (typeof row.caseId !== 'string' || !/^[a-z0-9][a-z0-9-]{1,79}$/.test(row.caseId) ||
      !(PII_ORACLE_IDENTITY_STATES as readonly string[]).includes(row.identity) ||
      !(PII_ORACLE_SENSITIVITY_STATES as readonly string[]).includes(row.sensitivity) ||
      !Array.isArray(row.identityBasis) || new Set(row.identityBasis).size !== row.identityBasis.length ||
      row.identityBasis.some(entry => !(PII_ORACLE_IDENTITY_BASES as readonly string[]).includes(entry)))
    throw new Error('Invalid PII oracle label');
  if (!LEGAL_COMBINATIONS.has(`${row.identity}/${row.sensitivity}`))
    throw new Error(`Impossible PII oracle state: ${row.identity}/${row.sensitivity}`);
  assertPiiSensitivityClaim(row);
  if (row.identity === 'not-established') {
    if (row.identityBasis.length || row.candidate !== null) throw new Error('A not-established identity has no candidate or basis');
  } else {
    if (!row.identityBasis.length || !exact(row.candidate, ['start', 'end']) || !Number.isInteger(row.candidate!.start) ||
        !Number.isInteger(row.candidate!.end) || row.candidate!.start < 0 || row.candidate!.end <= row.candidate!.start)
      throw new Error('An established identity label needs an authored candidate and basis');
    if (referenceValidator) {
      const validator = PII_ORACLE_REFERENCE_VALIDATORS[referenceValidator.id];
      if (!validator || validator.version !== referenceValidator.version) throw new Error('Unknown PII reference validator');
      if (input !== undefined) {
        const bytes = new TextEncoder().encode(input);
        if (row.candidate!.end > bytes.length) throw new Error('PII oracle candidate exceeds its case');
        const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(row.candidate!.start, row.candidate!.end));
        const verdict = validator.validate(value), cites = row.identityBasis.includes('reference-validator');
        // valid: the reference validator accepts the authored candidate and the label cites it.
        // invalid: either the validator rejects it (and the label cites that), or the validator accepts it and a
        // contract rule beyond the validator (issuer range, country length, spelling) rejects it.
        const agrees = row.identity === 'valid' ? verdict && cites :
          verdict ? !cites && row.identityBasis.includes('contract-grammar') : cites;
        if (!agrees) throw new Error(`PII oracle identity disagrees with the reference validator: ${row.caseId}`);
      }
    } else if (row.identityBasis.includes('reference-validator')) throw new Error('PII oracle label cites a missing reference validator');
  }
  return row;
}

/**
 * Bind one oracle family to its exact plan: same plan commitment, family, finding type, contract version and
 * one label per authored case, in plan order. It also enforces the plan's legacy `sensitive` label, which the
 * installed-surface check never read: `sensitive:true` must be an oracle `sensitive` label, `sensitive:false`
 * must be `non-sensitive` or `not-established` (the oracle says which), and a public-finding expectation must
 * be exactly the oracle's sensitive case with the same authored range.
 */
export function validatePiiOracleFamily(entry: unknown, plan: PiiOraclePlan) {
  if (!exact(entry, ['family', 'findingType', 'familyContractVersion', 'plan', 'planCommitment', 'referenceValidator', 'labels']))
    throw new Error('Invalid PII oracle family');
  const row = entry as PiiOracleFamily;
  if (row.family !== plan.family || row.findingType !== plan.findingType || row.familyContractVersion !== (plan.familyContractVersion ?? 1) ||
      !digest(row.planCommitment) || row.planCommitment !== piiOraclePlanCommitment(plan) || typeof row.plan !== 'string')
    throw new Error('PII oracle family is not bound to this exact plan');
  if (row.referenceValidator !== null && (!exact(row.referenceValidator, ['id', 'version']) ||
      PII_ORACLE_REFERENCE_VALIDATORS[row.referenceValidator.id]?.family !== row.family))
    throw new Error('PII oracle reference validator does not belong to this family');
  if (!Array.isArray(row.labels) || JSON.stringify(row.labels.map(label => label?.caseId)) !== JSON.stringify(plan.cases.map(item => item.id)))
    throw new Error('PII oracle labels are not one-to-one with the authored cases');
  const legacy = { sensitiveTrue: 0, sensitiveFalseNonSensitive: 0, sensitiveFalseNotEstablished: 0, unlabeled: 0 };
  plan.cases.forEach((item, index) => {
    const label = validatePiiOracleLabel(row.labels[index], row.referenceValidator, item.input);
    const expected = item.expected;
    if (expected.publicFinding) {
      if (label.sensitivity !== 'sensitive' || expected.sensitive === false || label.candidate?.start !== expected.start || label.candidate?.end !== expected.end)
        throw new Error(`PII plan public-finding expectation disagrees with the oracle: ${item.id}`);
    } else if (label.sensitivity === 'sensitive') throw new Error(`PII plan expects absence for an oracle-sensitive case: ${item.id}`);
    if (expected.sensitive === true) {
      if (label.sensitivity !== 'sensitive') throw new Error(`PII plan sensitive:true disagrees with the oracle: ${item.id}`);
      legacy.sensitiveTrue += 1;
    } else if (expected.sensitive === false) {
      if (expected.publicFinding) throw new Error(`PII plan sensitive:false contradicts its public finding: ${item.id}`);
      if (label.sensitivity === 'non-sensitive') legacy.sensitiveFalseNonSensitive += 1; else legacy.sensitiveFalseNotEstablished += 1;
    } else if (expected.sensitive === undefined) legacy.unlabeled += 1;
    else throw new Error(`Invalid PII plan sensitive label: ${item.id}`);
  });
  return { family: row, legacy };
}

export const PII_ORACLE_PLANS: Readonly<Record<string, PiiOraclePlan>> = Object.freeze({
  'pii:global:network-address': networkAddressPlan as PiiOraclePlan, 'pii:global:email': emailPlan as PiiOraclePlan,
  'pii:global:payment-card': paymentCardPlan as PiiOraclePlan, 'pii:global:iban': ibanPlan as PiiOraclePlan,
  'pii:us:ssn': usSsnPlan as PiiOraclePlan, 'pii:global:phone': phonePlan as PiiOraclePlan,
});

export function validatePiiIdentityOracle(value: unknown, plans: Readonly<Record<string, PiiOraclePlan>> = PII_ORACLE_PLANS) {
  if (!exact(value, ['schemaVersion', 'reportType', 'oracleVersion', 'supportClaims', 'evidenceKind', 'contextVocabulary', 'rationale', 'families']))
    throw new Error('Invalid PII identity oracle');
  const oracle = value as PiiIdentityOracle;
  if (oracle.schemaVersion !== 1 || oracle.reportType !== 'pii-identity-oracle' || oracle.oracleVersion !== 1 || oracle.supportClaims !== false ||
      oracle.evidenceKind !== 'authored-truth' || oracle.contextVocabulary !== PII_ORACLE_CONTEXT_VOCABULARY ||
      typeof oracle.rationale !== 'string' || !Array.isArray(oracle.families) ||
      JSON.stringify(oracle.families.map(row => row?.family).sort()) !== JSON.stringify(Object.keys(plans).sort()))
    throw new Error('Invalid PII identity oracle');
  for (const row of oracle.families) validatePiiOracleFamily(row, plans[row.family]);
  return oracle;
}

export const piiIdentityOracle = Object.freeze(structuredClone(oracleData)) as unknown as PiiIdentityOracle;

// ---------------------------------------------------------------------------------------------------------------
// Product identity observation (non-public seam, redact-secret/redact-secret#910). Admitted only in exact form.
// ---------------------------------------------------------------------------------------------------------------
export interface PiiProductIdentityEvidence {
  format: typeof PII_PRODUCT_IDENTITY_FORMAT; family: string; contextVocabulary: string; activationIdentity: string;
  sourceCommit: string; artifactSetCommitment: string;
  observations: Array<{ id: string; family: string; identity: 'established' | 'unmatched'; sensitivity: PiiOracleSensitivity }>;
  artifactCommitment: string;
}
export function validatePiiProductIdentityEvidence(value: unknown, binding: { family: string; sourceCommit: string;
  artifactSetCommitment: string; caseIds: readonly string[] }) {
  if (!exact(value, ['format', 'family', 'contextVocabulary', 'activationIdentity', 'sourceCommit', 'artifactSetCommitment', 'observations', 'artifactCommitment']))
    throw new Error('Invalid PII product identity evidence');
  const evidence = value as PiiProductIdentityEvidence;
  if (evidence.format !== PII_PRODUCT_IDENTITY_FORMAT || evidence.family !== binding.family ||
      !isPiiContextVocabulary(evidence.contextVocabulary) || typeof evidence.activationIdentity !== 'string' ||
      !evidence.activationIdentity.endsWith(`;vocabulary=${evidence.contextVocabulary}`) ||
      !(/;families=([^;]*)/.exec(evidence.activationIdentity)?.[1].split(',') ?? []).includes(binding.family) ||
      evidence.sourceCommit !== binding.sourceCommit || evidence.artifactSetCommitment !== binding.artifactSetCommitment ||
      !Array.isArray(evidence.observations) || evidence.artifactCommitment !== commitment(evidence as unknown as Record<string, unknown>))
    throw new Error('PII product identity evidence is not bound to this candidate');
  if (JSON.stringify(evidence.observations.map(row => row?.id)) !== JSON.stringify(binding.caseIds))
    throw new Error('PII product identity evidence is not one-to-one with the authored cases');
  for (const row of evidence.observations) {
    if (!exact(row, ['id', 'family', 'identity', 'sensitivity']) || row.family !== binding.family ||
        !['established', 'unmatched'].includes(row.identity) || !(PII_ORACLE_SENSITIVITY_STATES as readonly string[]).includes(row.sensitivity))
      throw new Error('Invalid PII product identity observation');
    if (row.identity === 'unmatched' && row.sensitivity !== 'not-established')
      throw new Error('Impossible PII product identity observation: sensitivity without an established identity');
  }
  return evidence;
}

// ---------------------------------------------------------------------------------------------------------------
// Evaluation and public projection
// ---------------------------------------------------------------------------------------------------------------
export const PII_ORACLE_PUBLIC_OUTCOMES = ['detected', 'missed', 'absent', 'false-alarm'] as const;
export const PII_ORACLE_IDENTITY_ONLY_OUTCOMES = ['correct', 'identity-missed', 'identity-over-accepted', 'sensitivity-mismatch'] as const;

export interface PiiIdentityOracleProjection {
  schemaVersion: 1; reportType: 'pii-identity-oracle-projection'; supportClaims: false; family: string;
  binding: { oracleCommitment: string; planCommitment: string; familyContractVersion: number; contextVocabulary: string;
    productSourceCommit: string; candidateArtifactCommitment: string; productIdentityCommitment: string | null };
  authoredTruth: { evidenceKind: 'authored-truth'; cells: Array<{ identity: PiiOracleIdentity; sensitivity: PiiOracleSensitivity; cases: number }> };
  publicStream: Array<{ sensitivity: PiiOracleSensitivity; outcome: typeof PII_ORACLE_PUBLIC_OUTCOMES[number]; cases: number }>;
  identityOnly: { status: 'not-measured'; eligibleCases: number; reason: { code: string; issue: string } } |
    { status: 'measured'; eligibleCases: number; outcomes: Array<{ outcome: typeof PII_ORACLE_IDENTITY_ONLY_OUTCOMES[number]; cases: number }> };
  gateStatus: 'met' | 'not-met' | 'unresolved';
  artifactCommitment: string;
}

const CELLS = PII_ORACLE_IDENTITY_STATES.flatMap(identity => PII_ORACLE_SENSITIVITY_STATES
  .filter(sensitivity => LEGAL_COMBINATIONS.has(`${identity}/${sensitivity}`)).map(sensitivity => ({ identity, sensitivity })));
const PUBLIC_CELLS = PII_ORACLE_SENSITIVITY_STATES.flatMap(sensitivity => (sensitivity === 'sensitive' ? ['detected', 'missed'] : ['absent', 'false-alarm'])
  .map(outcome => ({ sensitivity, outcome: outcome as typeof PII_ORACLE_PUBLIC_OUTCOMES[number] })));

/**
 * Evaluate one family. `publicObservations` are the installed-artifact observations (one per case, per lane; lanes
 * must agree). `productIdentity` is the #910 seam output, or null while it does not exist.
 */
export function evaluatePiiIdentityOracle(input: {
  plan: PiiOraclePlan; oracle?: PiiIdentityOracle; productSourceCommit: string; candidateArtifactCommitment: string;
  artifactSetCommitment?: string; publicObservations: ReadonlyArray<ReadonlyArray<{ id: string; publicFinding: boolean }>>;
  productIdentity?: unknown;
}) {
  const oracle = validatePiiIdentityOracle(input.oracle ?? piiIdentityOracle);
  const familyEntry = oracle.families.find(row => row.family === input.plan.family);
  if (!familyEntry) throw new Error('PII oracle has no entry for this family');
  validatePiiOracleFamily(familyEntry, input.plan);
  if (!digest(input.candidateArtifactCommitment) || typeof input.productSourceCommit !== 'string' || !/^[a-f0-9]{40}$/.test(input.productSourceCommit))
    throw new Error('PII oracle evaluation needs an exact candidate binding');
  const caseIds = input.plan.cases.map(row => row.id);
  if (!input.publicObservations.length || input.publicObservations.some(lane => JSON.stringify(lane.map(row => row.id)) !== JSON.stringify(caseIds)))
    throw new Error('PII public observations are not one-to-one with the authored cases');
  const found = caseIds.map((_, index) => {
    const values = new Set(input.publicObservations.map(lane => lane[index].publicFinding));
    if (values.size !== 1) throw new Error('PII public observations disagree across installed lanes');
    return [...values][0];
  });
  const labels = familyEntry.labels;
  const publicOutcome = labels.map((label, index) => label.sensitivity === 'sensitive' ? (found[index] ? 'detected' : 'missed') :
    (found[index] ? 'false-alarm' : 'absent'));
  const eligible = labels.map((label, index) => label.sensitivity !== 'sensitive' && !found[index]);
  let product: PiiProductIdentityEvidence | null = null;
  if (input.productIdentity !== undefined && input.productIdentity !== null) {
    if (!digest(input.artifactSetCommitment)) throw new Error('PII product identity evidence needs the candidate artifact set');
    product = validatePiiProductIdentityEvidence(input.productIdentity, { family: input.plan.family, sourceCommit: input.productSourceCommit,
      artifactSetCommitment: input.artifactSetCommitment!, caseIds });
    // Source/artifact equivalence: the seam's sensitive decision must be the installed artifact's public finding.
    product.observations.forEach((row, index) => {
      if ((row.sensitivity === 'sensitive') !== found[index]) throw new Error('PII product identity seam disagrees with the installed artifact');
    });
  }
  const identityOutcomes = product ? labels.flatMap((label, index) => {
    if (!eligible[index]) return [];
    const observed = product!.observations[index];
    if (label.identity === 'valid' && observed.identity !== 'established') return ['identity-missed'];
    if (label.identity !== 'valid' && observed.identity === 'established') return ['identity-over-accepted'];
    if (label.identity === 'valid' && observed.sensitivity !== label.sensitivity) return ['sensitivity-mismatch'];
    return ['correct'];
  }) : [];
  const eligibleCases = eligible.filter(Boolean).length;
  const identityOnly: PiiIdentityOracleProjection['identityOnly'] = product ? { status: 'measured', eligibleCases,
    outcomes: PII_ORACLE_IDENTITY_ONLY_OUTCOMES.map(outcome => ({ outcome, cases: identityOutcomes.filter(value => value === outcome).length })) } :
    { status: 'not-measured', eligibleCases, reason: { ...PII_ORACLE_UNAVAILABLE_REASON } };
  const gateStatus = !product ? 'unresolved' as const : identityOutcomes.every(value => value === 'correct') ? 'met' as const : 'not-met' as const;
  const projection: PiiIdentityOracleProjection = {
    schemaVersion: 1, reportType: 'pii-identity-oracle-projection', supportClaims: false, family: input.plan.family,
    binding: { oracleCommitment: piiIdentityOracleCommitment(oracle), planCommitment: familyEntry.planCommitment,
      familyContractVersion: familyEntry.familyContractVersion, contextVocabulary: oracle.contextVocabulary,
      productSourceCommit: input.productSourceCommit, candidateArtifactCommitment: input.candidateArtifactCommitment,
      productIdentityCommitment: product ? product.artifactCommitment : null },
    authoredTruth: { evidenceKind: 'authored-truth', cells: CELLS.map(cell => ({ ...cell,
      cases: labels.filter(label => label.identity === cell.identity && label.sensitivity === cell.sensitivity).length })) },
    publicStream: PUBLIC_CELLS.map(cell => ({ ...cell,
      cases: labels.filter((label, index) => label.sensitivity === cell.sensitivity && publicOutcome[index] === cell.outcome).length })),
    identityOnly, gateStatus, artifactCommitment: '',
  };
  projection.artifactCommitment = commitment(projection as unknown as Record<string, unknown>);
  return validatePiiIdentityOracleProjection(projection);
}

const count = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;
/** Public projection validator: fixed labels, integer counts, provenance commitments and typed reasons only. */
export function validatePiiIdentityOracleProjection(value: unknown) {
  if (!exact(value, ['schemaVersion', 'reportType', 'supportClaims', 'family', 'binding', 'authoredTruth', 'publicStream', 'identityOnly',
    'gateStatus', 'artifactCommitment'])) throw new Error('Invalid PII identity oracle projection');
  const row = value as PiiIdentityOracleProjection;
  const binding = row.binding, truth = row.authoredTruth, only = row.identityOnly as any;
  const total = Array.isArray(truth?.cells) ? truth.cells.reduce((sum, cell) => sum + (cell?.cases ?? 0), 0) : -1;
  const invalid = row.schemaVersion !== 1 || row.reportType !== 'pii-identity-oracle-projection' || row.supportClaims !== false ||
    typeof row.family !== 'string' || !/^pii:(?:global|[a-z]{2}):[a-z0-9-]+$/.test(row.family) ||
    !exact(binding, ['oracleCommitment', 'planCommitment', 'familyContractVersion', 'contextVocabulary', 'productSourceCommit',
      'candidateArtifactCommitment', 'productIdentityCommitment']) ||
    !digest(binding.oracleCommitment) || !digest(binding.planCommitment) || !digest(binding.candidateArtifactCommitment) ||
    !/^[a-f0-9]{40}$/.test(binding.productSourceCommit) || !Number.isInteger(binding.familyContractVersion) || binding.familyContractVersion < 1 ||
    !isPiiContextVocabulary(binding.contextVocabulary) || (binding.productIdentityCommitment !== null && !digest(binding.productIdentityCommitment)) ||
    !exact(truth, ['evidenceKind', 'cells']) || truth.evidenceKind !== 'authored-truth' ||
    JSON.stringify(truth.cells.map(cell => [cell.identity, cell.sensitivity])) !== JSON.stringify(CELLS.map(cell => [cell.identity, cell.sensitivity])) ||
    truth.cells.some(cell => !exact(cell, ['identity', 'sensitivity', 'cases']) || !count(cell.cases)) ||
    !Array.isArray(row.publicStream) ||
    JSON.stringify(row.publicStream.map(cell => [cell.sensitivity, cell.outcome])) !== JSON.stringify(PUBLIC_CELLS.map(cell => [cell.sensitivity, cell.outcome])) ||
    row.publicStream.some(cell => !exact(cell, ['sensitivity', 'outcome', 'cases']) || !count(cell.cases)) ||
    row.publicStream.reduce((sum, cell) => sum + cell.cases, 0) !== total ||
    !['met', 'not-met', 'unresolved'].includes(row.gateStatus) || !count(only?.eligibleCases) || only.eligibleCases > total ||
    (only?.status === 'not-measured' ? !exact(only, ['status', 'eligibleCases', 'reason']) || !exact(only.reason, ['code', 'issue']) ||
      only.reason.code !== PII_ORACLE_UNAVAILABLE_REASON.code || !/^redact-secret\/redact-secret#\d+$/.test(only.reason.issue) ||
      row.gateStatus !== 'unresolved' || binding.productIdentityCommitment !== null :
      only?.status === 'measured' ? !exact(only, ['status', 'eligibleCases', 'outcomes']) || !Array.isArray(only.outcomes) ||
        JSON.stringify(only.outcomes.map((entry: any) => entry?.outcome)) !== JSON.stringify(PII_ORACLE_IDENTITY_ONLY_OUTCOMES) ||
        only.outcomes.some((entry: any) => !exact(entry, ['outcome', 'cases']) || !count(entry.cases)) ||
        only.outcomes.reduce((sum: number, entry: any) => sum + entry.cases, 0) !== only.eligibleCases ||
        binding.productIdentityCommitment === null ||
        row.gateStatus !== (only.outcomes.every((entry: any) => entry.outcome === 'correct' || entry.cases === 0) ? 'met' : 'not-met') : true) ||
    row.artifactCommitment !== commitment(row as unknown as Record<string, unknown>);
  if (invalid) throw new Error('Invalid PII identity oracle projection');
  return row;
}
