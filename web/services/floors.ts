/**
 * The accounting floors the run was configured with, read from the committed suite
 * (`qualification/suite-v1.json`): the same file the bench reads. The detector pages
 * mark each detector's fixture count against `minDenominator`, the sample size below
 * which the run withholds a bound.
 */
import { once, readJson } from './repo';

export interface AccountingFloors { minDenominator: number }

export function loadAccountingFloors(): Promise<AccountingFloors> {
  return once('accounting-floors', async () => {
    const suite = await readJson<{ accounting?: { minDenominator?: number } }>('qualification/suite-v1.json');
    const minDenominator = suite.accounting?.minDenominator;
    if (!Number.isInteger(minDenominator) || (minDenominator as number) < 1) throw new Error('qualification/suite-v1.json carries no accounting.minDenominator');
    return { minDenominator: minDenominator as number };
  });
}
