import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

/** Validates a qualification view against schemas/qualification-view-v1.json (the contract #606 reads). */
export const VIEW_SCHEMA_PATH = new URL('../../schemas/qualification-view-v1.json', import.meta.url);
let compiled: ReturnType<Ajv2020['compile']> | undefined;

export function validateQualificationView(view: unknown): string[] {
  compiled ??= new Ajv2020({ strict: true, allErrors: true }).compile(JSON.parse(readFileSync(VIEW_SCHEMA_PATH, 'utf8')));
  return compiled(view) ? [] : (compiled.errors ?? []).slice(0, 5).map(e => `${e.instancePath || '/'} ${e.message}`);
}
