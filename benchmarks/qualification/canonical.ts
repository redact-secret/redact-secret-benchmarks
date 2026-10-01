import { createHash } from 'node:crypto';

/**
 * Canonical JSON as credential-eval defines it (docs/contracts/identity.md): compact, object keys sorted by UTF-8
 * byte order at every depth. A run artifact's floats are written by serde_json (`0.0`, `1.96`), which JavaScript
 * cannot tell from integers after parsing, so a document read for a digest keeps each number's source text
 * (`parseKeepingNumbers`). Documents authored here have no such floats and use plain numbers.
 */
export class RawNumber { constructor(readonly source: string) {} }

const byteOrder = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));

export function canonical(value: unknown): string {
  if (value instanceof RawNumber) return value.source;
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort(byteOrder).map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export const sha256Hex = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const sha256Digest = (value: string | Buffer) => `sha256:${sha256Hex(value)}`;

/** Parse JSON, keeping every number as its source text so the canonical form matches the writer's. */
export function parseKeepingNumbers(text: string): unknown {
  // Source-text access (JSON.parse's third reviewer argument, Node 22) is not in the TypeScript lib yet.
  const reviver = ((_key: string, value: unknown, context?: { source?: string }) =>
    typeof value === 'number' && typeof context?.source === 'string' ? new RawNumber(context.source) : value) as unknown as (this: unknown, key: string, value: unknown) => unknown;
  return JSON.parse(text, reviver);
}
