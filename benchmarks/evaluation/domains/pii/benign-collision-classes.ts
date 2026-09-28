export const PII_BENIGN_ACCOUNTING_CLASSES = Object.freeze([
  'reserved', 'documentation', 'test-value', 'public-operational', 'placeholder', 'context-negative',
] as const);
export type PiiBenignAccountingClass = typeof PII_BENIGN_ACCOUNTING_CLASSES[number];

export const PII_BENIGN_COLLISION_EVIDENCE_CLASSES = Object.freeze([
  'reserved-documentation', 'official-test', 'public-identifier', 'ordinary-reference-account', 'near-miss', 'placeholder',
  'context-negative', 'cross-family-collision',
] as const);
export type PiiBenignCollisionEvidenceClass = typeof PII_BENIGN_COLLISION_EVIDENCE_CLASSES[number];

/** Deliberately lossy mapping into the frozen pii-v1 accounting vocabulary. */
export const PII_EVIDENCE_ACCOUNTING_CLASSES = Object.freeze({
  'reserved-documentation': ['reserved', 'documentation'],
  'official-test': ['test-value'],
  'public-identifier': ['public-operational'],
  'ordinary-reference-account': ['public-operational'],
  'near-miss': [],
  'placeholder': ['placeholder'],
  'context-negative': ['context-negative'],
  'cross-family-collision': [],
} as const satisfies Readonly<Record<PiiBenignCollisionEvidenceClass, readonly PiiBenignAccountingClass[]>>);

/** What each authored class can qualify, and which method counts it. A class with no accounting class is not benign evidence. */
export const PII_EVIDENCE_CLASS_ROLES = Object.freeze(Object.fromEntries(PII_BENIGN_COLLISION_EVIDENCE_CLASSES.map(id => [id, Object.freeze({
  kind: id === 'near-miss' ? 'mechanical-control' : id === 'cross-family-collision' ? 'collision' : 'benign',
  qualifies: Object.freeze(id === 'near-miss' ? ['type-identity', 'validator'] : id === 'cross-family-collision'
    ? ['family-discrimination', 'jurisdiction-discrimination', 'sensitivity'] : ['sensitivity']),
  method: id === 'near-miss' ? 'type-validation' : id === 'cross-family-collision' ? 'jurisdiction-collision' : 'pii-benign',
} as const)])) as Readonly<Record<PiiBenignCollisionEvidenceClass, {
  kind: 'mechanical-control' | 'collision' | 'benign'; qualifies: readonly ('type-identity' | 'validator' | 'family-discrimination' | 'jurisdiction-discrimination' | 'sensitivity')[];
  method: 'type-validation' | 'jurisdiction-collision' | 'pii-benign' }>>);
