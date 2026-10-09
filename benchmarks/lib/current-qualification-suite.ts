import { createHash } from 'node:crypto';
import type { QualificationSuite } from '../evaluation/evidence.ts';

export function validateCurrentQualificationSuite(bytes: string): QualificationSuite {
  if (createHash('sha256').update(bytes).digest('hex') !== 'fa9d83ceb73efc942231348ceab7083c4d6ed76e0b3a78c3d8593a4e0ffb5188')
    throw new Error('Frozen engine qualification suite source digest mismatch');
  return JSON.parse(bytes) as QualificationSuite;
}
