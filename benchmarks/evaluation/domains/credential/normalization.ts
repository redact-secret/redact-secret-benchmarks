import type { Finding } from '../../../types.ts';
import type { Scanner } from '../../model/types.ts';
import { contracts } from './assessment.ts';

export const normalizeFinding = ({ path, start, end, family, action }: Finding, scanner: Pick<Scanner, 'capabilities'>): Finding => ({
  path, start, end,
  ...(scanner.capabilities?.classification !== false && family && Object.hasOwn(contracts, family) ? { family } : {}),
  ...(action !== undefined ? { action } : {}),
});
