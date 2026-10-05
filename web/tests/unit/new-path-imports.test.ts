// @vitest-environment node
/**
 * The new credential path reads the view and the benchmark-owned modules, never the legacy Vite site's code (#658): the authority, the seam, the bridge
 * and the view reader import nothing from `src/`. The legacy-only services (run, catalog, evaluation, candidate, domains) still do, each with a role
 * the inventory in docs/specs/qualification-cutover.md records. Structure only: no value of the ledger is read.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const importsOf = (file: string) => [...readFileSync(path.join(process.cwd(), file), 'utf8').matchAll(/from '([^']+)'/g)].map(m => m[1]);

describe('the new credential path does not import the legacy site', () => {
  for (const file of ['services/authority.ts', 'services/credential-source.ts', 'services/credential-bridge.ts', 'services/qualification.ts']) {
    test(file, () => {
      expect(importsOf(file).filter(spec => /(^|\/)src\//.test(spec))).toEqual([]);
    });
  }
});
