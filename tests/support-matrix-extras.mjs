import { fileURLToPath } from 'node:url';
import { findingTypeSource, findingTypesFor } from '../benchmarks/support/finding-types.ts';
import { buildPiiMatrixSection } from '../benchmarks/support/pii-families.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
/** The PII section the generator writes, read once from the committed aggregate records. */
export const piiSection = await buildPiiMatrixSection(root);

/** Adds what `generate-support-matrix.ts` adds to a built matrix (#647): the finding-type key, its source and the PII section. */
export const withMatrixExtras = matrix => ({
  ...matrix,
  families: matrix.families.map(family => ({ ...family, findingTypes: findingTypesFor(family.detectors) })),
  findingTypeSource,
  ...structuredClone(piiSection),
});
