/**
 * The resolvers the Evaluation pages call. Like `pages.ts`, this module awaits the services and hands their
 * raw output to the pure resolvers (`evaluation-hub.ts`, `evaluation-methods.ts`), so a page depends on
 * resolvers alone. Server-only.
 */
import type { EvaluationHubProps } from '../components/evaluation/hub/EvaluationHub';
import type { MethodPageProps } from '../components/evaluation/methods/types';
import { EVALUATION_PHASES, SECTIONS } from '../lib/routes';
import type { MethodId } from '../lib/methods';
import { loadSuites } from '../services/catalog';
import { loadEvaluation, loadQualification } from '../services/evaluation';
import { resolveEvaluationHub } from './evaluation-hub';
import { resolveMethodPage } from './evaluation-methods';

const builtHrefs = (): Set<string> => new Set(SECTIONS.find(s => s.href === '/evaluation/')?.entries.map(e => e.href) ?? []);

async function sources() {
  const [evaluation, qualification, suites] = await Promise.all([loadEvaluation(), loadQualification(), loadSuites()]);
  const measured = evaluation.state === 'measured' ? evaluation : undefined;
  const reason = evaluation.state === 'measured' ? undefined : evaluation.reason;
  return { evaluation: measured, reason, qualification, suites: new Map(suites.map(s => [s.id, s.title])) };
}

export async function resolveEvaluationHubPage(): Promise<EvaluationHubProps> {
  const { evaluation, reason, qualification } = await sources();
  return resolveEvaluationHub({
    report: evaluation?.report,
    caseCounts: evaluation?.caseCounts,
    reason,
    qualification: qualification.state === 'recorded' ? qualification.report : undefined,
    phases: EVALUATION_PHASES,
    builtHrefs: builtHrefs(),
  });
}

export async function resolveMethodPageFor(id: MethodId): Promise<MethodPageProps> {
  const { evaluation, reason, qualification, suites } = await sources();
  // Only this method's cases are read (holdout reads none); the pure resolver is handed them already in memory.
  const cases = evaluation && id !== 'holdout' ? await evaluation.casesOf(id) : [];
  return resolveMethodPage(id, {
    report: evaluation?.report,
    casesOf: evaluation ? method => { if (method !== id) throw new Error(`The ${id} page asked for the ${method} cases.`); return cases; } : undefined,
    peerReviews: evaluation?.peerReviews,
    reason, qualification, suites,
  });
}
