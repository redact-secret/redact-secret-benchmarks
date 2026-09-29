/** The beta.10 primary context languages and polarity strata; light enough for the browser, owned here so the corpus and the UI cannot drift. */
export const PII_CONTEXT_LANGUAGES = Object.freeze(['en', 'ko'] as const);
export const PII_CONTEXT_CLASSES = Object.freeze(['sensitive', 'neutral', 'non-sensitive'] as const);
