// @vitest-environment node
/**
 * The maintainer-reviewed disclosure: the count is read from the adoption record's change report and the words are fixed. Every record
 * here is synthetic; no committed count is asserted.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { overlay } from './overlay';
import { resolveReviewDisclosure } from '../../resolvers/run';

beforeEach(() => { vi.unstubAllEnvs(); });
afterEach(() => { vi.unstubAllEnvs(); });

const record = (state: string, release = 'snapshot-0000.00.00') => JSON.stringify({ state, candidate: { evidenceRelease: release, changeReport: 'docs/generated/x.json' } });
const report = (maintainerOnly: number, total: number, present = true) => JSON.stringify({ reviewState: { candidate: { present, fixtures: { total, maintainerOnly } } } });

async function load(files: Record<string, string | null>, tag: string | undefined) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', overlay(files));
  return (await import('../../services/review-state')).loadReviewDisclosure(tag);
}

describe('loadReviewDisclosure', () => {
  test('reads the count from the data of the accepted release the view was built from', async () => {
    const data = await load({ 'benchmarks/evidence-adoption.json': record('accepted'), 'docs/generated/x.json': report(7, 100) }, 'snapshot-0000.00.00');
    expect(data).toEqual({ maintainerOnly: 7, total: 100, evidenceRelease: 'snapshot-0000.00.00' });
  });

  test.each([
    ['a candidate that is not accepted', { 'benchmarks/evidence-adoption.json': record('candidate'), 'docs/generated/x.json': report(7, 100) }, 'snapshot-0000.00.00'],
    ['a view built from another release', { 'benchmarks/evidence-adoption.json': record('accepted'), 'docs/generated/x.json': report(7, 100) }, 'snapshot-9999.99.99'],
    ['a report with no review-state facts', { 'benchmarks/evidence-adoption.json': record('accepted'), 'docs/generated/x.json': report(7, 100, false) }, 'snapshot-0000.00.00'],
    ['no adoption record', { 'benchmarks/evidence-adoption.json': null }, 'snapshot-0000.00.00'],
  ])('shows nothing for %s, never a zero', async (_name, files, tag) => {
    expect(await load(files, tag)).toBeUndefined();
  });
});

describe('resolveReviewDisclosure', () => {
  test('uses the decided words and the count it is given', () => {
    const d = resolveReviewDisclosure({ maintainerOnly: 3, total: 40, evidenceRelease: 'snapshot-x' });
    expect(d?.labels).toEqual({ ko: '메인테이너 검토 (독립 검토 대기)', en: 'Maintainer-reviewed (independent review pending)' });
    expect(d?.note).toBe('Passed the project’s own verification (source evidence, automated checks, recorded counter-arguments); not yet independently reviewed.');
    expect(d?.count).toContain('3 fixtures');
    expect(d?.count).toContain('40');
    expect(JSON.stringify(d)).not.toMatch(/independent(ly)? (validat|verif)/i);
  });
  test('is absent without data', () => { expect(resolveReviewDisclosure(undefined)).toBeUndefined(); });
});
