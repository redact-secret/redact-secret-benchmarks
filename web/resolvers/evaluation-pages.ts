/**
 * The resolvers the Evaluation pages call. Like `pages.ts`, this module awaits the services and hands their
 * raw output to the pure resolvers (`evaluation-hub.ts`, `evaluation-methods.ts`), so a page depends on
 * resolvers alone. Server-only.
 */
import type { EvaluationHubProps } from '../components/evaluation/hub/EvaluationHub';
import { EVALUATION_PHASES, SECTIONS } from '../lib/routes';
import { loadSuites } from '../services/catalog';
import { loadEvaluation, loadQualification } from '../services/evaluation';
import { resolveEvaluationHub } from './evaluation-hub';

const builtHrefs = (): Set<string> => new Set(SECTIONS.find(s => s.href === '/evaluation/')?.entries.map(e => e.href) ?? []);

async function sources() {
  const [evaluation, qualification, suites] = await Promise.all([loadEvaluation(), loadQualification(), loadSuites()]);
  const report = evaluation.state === 'measured' ? evaluation.report : undefined;
  const reason = evaluation.state === 'measured' ? undefined : evaluation.reason;
  return { report, reason, qualification, suites: new Map(suites.map(s => [s.id, s.title])) };
}

export async function resolveEvaluationHubPage(): Promise<EvaluationHubProps> {
  const { report, reason, qualification } = await sources();
  return resolveEvaluationHub({
    report,
    reason,
    qualification: qualification.state === 'recorded' ? qualification.report : undefined,
    phases: EVALUATION_PHASES,
    builtHrefs: builtHrefs(),
  });
}
