import { createHash } from 'node:crypto';
import input from '../inputs/performance/current.json' with { type: 'json' };
const binding = 'ebd745b2b9cbf5496de71fcdc8cda2050c3211807ddce60d08e5369dcefca0dc';
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function validateCurrentPerformanceInputs(value) {
  if (sha(value) !== binding) throw new Error('Current performance input source or projection binding mismatch');
  return structuredClone(value);
}
export function currentPerformanceInputs() {
  const checked = validateCurrentPerformanceInputs(input);
  return { ...checked, baseline: checked.records.baseline.data, accepted: checked.records.accepted.data };
}
