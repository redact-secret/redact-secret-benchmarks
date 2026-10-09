import { createHash } from 'node:crypto';
import index from '../inputs/runtime/index.json' with { type: 'json' };

const binding = 'c1d77f52ff3340635e239277138f0606b8d8710457ca26f012216288c9774fb0';
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
if (sha(index) !== binding) throw new Error('Current runtime input registry binding mismatch');
export const runtimeInputPaths = Object.freeze(Object.fromEntries(Object.entries(index.records).map(([id, record]) => [id, record.path])));
export function validateCurrentRuntimeInput(id, value) {
  const record = index.records[id];
  if (!record || sha(value) !== record.dataSha256) throw new Error(`Current runtime snapshot source binding mismatch: ${id}`);
  return value;
}
