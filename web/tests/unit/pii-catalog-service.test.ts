// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import * as coverage from '../../services/pii-coverage';
import { loadPiiCatalogSource } from '../../services/pii-catalog';

afterEach(() => vi.restoreAllMocks());

test('a missing source publication is absent, while malformed or mismatched commitments cannot be hidden', async () => {
  const load = vi.spyOn(coverage, 'loadPiiCoveragePage');
  load.mockRejectedValueOnce(Object.assign(new Error('missing synthetic source'), { code: 'ENOENT' }));
  expect(await loadPiiCatalogSource()).toBeNull();
  const mismatch = new Error('synthetic product binding mismatch');
  load.mockRejectedValueOnce(mismatch);
  await expect(loadPiiCatalogSource()).rejects.toBe(mismatch);
  const malformed = new SyntaxError('invalid synthetic source JSON');
  load.mockRejectedValueOnce(malformed);
  await expect(loadPiiCatalogSource()).rejects.toBe(malformed);
});
