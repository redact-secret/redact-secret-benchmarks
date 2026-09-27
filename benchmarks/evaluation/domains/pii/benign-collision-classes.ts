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
