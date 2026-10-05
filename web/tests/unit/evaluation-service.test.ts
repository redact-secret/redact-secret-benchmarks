// @vitest-environment node
/**
 * `services/evaluation.ts` decides what the evaluation pages may say: measured, not published, unusable. The
 * file under test is written by the test into a temporary results directory, so the committed tree and the run
 * are never read for a figure. The contract check itself (`evaluationProblem`) is covered by its own tests at the
 * root; here it is stubbed where a synthetic report would not satisfy the real schema.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { REAL_ROOT, overlay } from './overlay';
import { syntheticQualification, syntheticReport } from './evaluation-data';

const dirs: string[] = [];
function results(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'web-results-'));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) { mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); writeFileSync(path.join(dir, name), text); }
  return dir;
}

async function service(options: { dir: string; root?: string; contract?: string | null }) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', options.root ?? REAL_ROOT);
  vi.stubEnv('WEB_RESULTS_DIR', options.dir);
  if (options.contract !== undefined) vi.doMock('../../../benchmarks/shared/evaluation-model.ts', () => ({ evaluationProblem: () => options.contract }));
  return import('../../services/evaluation');
}

beforeEach(() => { vi.unstubAllEnvs(); });
afterEach(() => { vi.doUnmock('../../../benchmarks/shared/evaluation-model.ts'); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('loadEvaluation', () => {
  test('a results directory with no evaluation is not published, with the file named', async () => {
    const s = await service({ dir: results({}) });
    await expect(s.loadEvaluation()).resolves.toMatchObject({ state: 'not-published', reason: expect.stringContaining('evaluation-v1.json is absent') });
  });

  test('a file that is not JSON is unusable', async () => {
    const s = await service({ dir: results({ 'evaluation-v1.json': '{nope' }) });
    await expect(s.loadEvaluation()).resolves.toMatchObject({ state: 'unusable', reason: expect.stringContaining('not valid JSON') });
  });

  test('a file that breaks the contract is unusable, with the contract failure named', async () => {
    const s = await service({ dir: results({ 'evaluation-v1.json': '{}' }) });
    await expect(s.loadEvaluation()).resolves.toMatchObject({ state: 'unusable', reason: expect.stringContaining('Unsupported evaluation report version') });
  });

  test('a report the contract accepts is measured, and is read once', async () => {
    const report = syntheticReport();
    const s = await service({ dir: results({ 'evaluation-v1.json': JSON.stringify(report) }), contract: null });
    const first = await s.loadEvaluation();
    expect(first).toMatchObject({ state: 'measured', report: { runId: report.runId } });
    expect(await s.loadEvaluation()).toBe(first);
  });

  test('a directory where the file should be is an error, not "absent"', async () => {
    const s = await service({ dir: results({ 'evaluation-v1.json/inside': 'x' }) });
    await expect(s.loadEvaluation()).rejects.toThrow(/unreadable/);
  });
});

describe('loadQualification', () => {
  test('the aggregate published with the evaluation wins', async () => {
    const q = syntheticQualification();
    const s = await service({ dir: results({ 'evaluation-v1.json': JSON.stringify(syntheticReport({ qualification: q })) }), contract: null });
    await expect(s.loadQualification()).resolves.toMatchObject({ state: 'recorded', source: 'run', report: { runId: q.runId } });
  });

  test('without one, the frozen report in the repository is used and labelled frozen', async () => {
    const q = syntheticQualification();
    const root = overlay({ [`${'docs/specs/qualification/engine-v1.json'}`]: JSON.stringify(q) });
    const s = await service({ dir: results({}), root });
    await expect(s.loadQualification()).resolves.toMatchObject({ state: 'recorded', source: 'frozen', report: { runId: q.runId } });
  });

  test('a frozen report this site cannot read, or none at all, is not recorded', async () => {
    const unreadable = await service({ dir: results({}), root: overlay({ 'docs/specs/qualification/engine-v1.json': '{"reportType":"other"}' }) });
    await expect(unreadable.loadQualification()).resolves.toMatchObject({ state: 'not-recorded', reason: expect.stringContaining('not a qualification report') });
    const absent = await service({ dir: results({}), root: overlay({ 'docs/specs/qualification/engine-v1.json': null }) });
    await expect(absent.loadQualification()).resolves.toMatchObject({ state: 'not-recorded', reason: expect.stringContaining('is absent') });
  });
});
