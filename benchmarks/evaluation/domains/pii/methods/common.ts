import { interpretPiiOutcome } from '../contract-model.ts';
import type { PiiMethodContext, PiiMethodResult } from '../types.ts';

export const evaluatePiiVariants = ({ variants, observations }: PiiMethodContext): PiiMethodResult => {
  const outcomes = observations.flatMap(scanner => variants.map(variant => interpretPiiOutcome(variant, scanner)));
  return { outcomes, reviews: outcomes.flatMap(outcome => [outcome.typeIdentity, outcome.sensitivityContext]
    .filter(axis => axis.status === 'review-required' || axis.status === 'not-measured')
    .map(axis => ({ id: `${outcome.scanner}/${outcome.variant}/${axis.axis}`, variant: outcome.variant, reason: axis.reason }))) };
};

export function candidateValue(content: string, candidate: { start: number; end: number }) {
  return Buffer.from(content).subarray(candidate.start, candidate.end).toString();
}
