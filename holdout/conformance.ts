import type { HoldoutCorpus } from './types.ts';
import { hash } from '../benchmarks/engine/model.ts';
import { evidence } from '../benchmarks/lib/assessment.ts';

/** Public lifecycle controls, never represented as independent holdout data. */
export function publicConformanceCorpus(seed: string): HoldoutCorpus {
  return { schemaVersion: 2, seed, fixtures: Array.from({ length: 12 }, (_, index) => {
    const positive = index % 2 === 0;
    const prefix = index % 3 ? 'GITHUB_TOKEN=' : '# 🔑 control\r\nGITHUB_TOKEN=';
    const value = 'ghp_' + hash(`${seed}:${index}`).slice(0, 36);
    const content = positive ? prefix + value + '\n' : `Public engine control ${index}. No credential is present.\n`;
    return { id: `control-${index}`, path: `controls/${index}.txt`, content, group: 'public-conformance',
      expected: positive ? [{ start: Buffer.byteLength(prefix), end: Buffer.byteLength(prefix + value), role: 'secret' as const }] : [],
      detectors: ['github-token'], assessment: positive
        ? { kind: 'must-redact' as const, tier: 'T1' as const, contract: 'github-token', reason: 'Public synthetic engine control; never provider issued.', sources: evidence('github-token') }
        : { kind: 'must-not-flag' as const, tier: 'T3' as const, reason: 'Public prose control.', sources: [] },
    };
  }) };
}
