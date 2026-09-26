import { createHash } from 'node:crypto';

/** Internal deterministic identity primitive. This is not a public extension API. */
export const hash = (value: unknown) => createHash('sha256')
  .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
  .digest('hex');

/** Retain only replay-safe scalar parameters; arbitrary text remains represented by its hash. */
export const safeParameters = (parameters: Record<string, unknown>) => Object.fromEntries(
  Object.entries(parameters).filter(([key, value]) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(key) &&
    (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))),
) as Record<string, number | boolean>;
