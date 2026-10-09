// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ evaluation: vi.fn(), scope: vi.fn(), dossiers: vi.fn(), qualification: vi.fn() }));
vi.mock('../../services/domains', () => ({ loadCredentialEvaluation: mocks.evaluation }));
vi.mock('../../services/product-scope', () => ({ loadProductScope: mocks.scope }));
vi.mock('../../services/dossiers', () => ({ loadDossiers: mocks.dossiers }));
vi.mock('../../services/qualification', () => ({ loadQualificationView: mocks.qualification }));
import { loadCredentialCoverage } from '../../services/credential-coverage';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.scope.mockResolvedValue({ boundTo: { release: 'synthetic' } });
  mocks.dossiers.mockResolvedValue(new Map());
  mocks.qualification.mockResolvedValue({ state: 'not-built', reason: 'synthetic unavailable' });
});

describe('credential coverage authority boundary', () => {
  test.each(['legacy', 'new-unavailable'])('does not borrow a view for %s', async state => {
    mocks.evaluation.mockResolvedValue({ pipeline: state === 'legacy' ? { authority: 'legacy' } : { authority: 'new', view: { state: 'stale' } } });
    const result = await loadCredentialCoverage();
    expect(result.qualification).toBeUndefined();
    expect(mocks.qualification).not.toHaveBeenCalled();
  });

  test('only an authority-approved ready source requests validated family qualification', async () => {
    mocks.evaluation.mockResolvedValue({ pipeline: { authority: 'new', view: { state: 'ready' } } });
    expect((await loadCredentialCoverage()).qualification).toEqual({ state: 'not-built', reason: 'synthetic unavailable' });
    expect(mocks.qualification).toHaveBeenCalledOnce();
  });
});
