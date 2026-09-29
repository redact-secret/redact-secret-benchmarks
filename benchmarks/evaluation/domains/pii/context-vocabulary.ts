/**
 * The product's `pii-context` vocabulary identities, as they appear in the `vocabulary=` field of a PII activation
 * identity. `pii-context/v1` shipped with beta.10 and every frozen beta.10 record reads it; `pii-context/v2` is the
 * repaired vocabulary merged in redact-secret#930 (#924–#927). Authored plans keep the vocabulary they were
 * frozen against; product evidence must name the vocabulary its own activation identity reports.
 */
export const PII_CONTEXT_VOCABULARIES = ['pii-context/v1', 'pii-context/v2'] as const;
export type PiiContextVocabulary = typeof PII_CONTEXT_VOCABULARIES[number];
export const isPiiContextVocabulary = (value: unknown): value is PiiContextVocabulary =>
  (PII_CONTEXT_VOCABULARIES as readonly unknown[]).includes(value);
