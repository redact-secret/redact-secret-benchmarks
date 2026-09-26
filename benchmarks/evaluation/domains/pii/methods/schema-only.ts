import type { PiiMethod } from '../types.ts';
import { interpretPiiOutcome, piiVariant, validatePiiCase } from '../contract-model.ts';

export const schemaOnly: PiiMethod = {
  id: 'schema-only', version: 1,
  validateCase(c) { validatePiiCase(c); if (c.method !== this.id) throw new Error('Schema-only method mismatch'); },
  generate(c) { return [piiVariant(c)]; },
  evaluate({ variants, observations }) {
    const outcomes = observations.flatMap(scanner => variants.map(variant => interpretPiiOutcome(variant, scanner)));
    return { outcomes, reviews: outcomes.filter(o => o.sensitivityContext.status === 'review-required')
      .map(o => ({ id: `${o.scanner}/${o.variant}/sensitivity`, variant: o.variant, reason: o.sensitivityContext.reason })) };
  },
};

