/**
 * The resolvers the Evaluation pages call. Like `pages.ts`, this module awaits the services and hands their
 * raw output to the pure resolvers (`evaluation-hub.ts`, `evaluation-methods.ts`), so a page depends on
 * resolvers alone. Server-only.
 */
import type { EvaluationHubProps } from '../components/evaluation/hub/EvaluationHub';
import type { MethodPageProps } from '../components/evaluation/methods/types';
import { EVALUATION_PHASES, SECTIONS } from '../lib/routes';
import { isMethodId, METHOD_IDS, type MethodId } from '../lib/methods';
import { loadSuites } from '../services/catalog';
import { loadEvaluation, loadQualification, type MeasuredEvaluation } from '../services/evaluation';
import { loadCredentialSource } from '../services/credential-source';
import { loadQualificationView } from '../services/qualification';
import { checksFile, methodCheckLists, methodChecksFileParams, resolveMethodChecksPage, type CheckList, type MethodChecksPageProps } from './evaluation-checks';
import { CHECKS_SCHEMA, listKey, UNAVAILABLE_CHECKS, type ChecksFile, type ChecksUnavailable } from './evaluation-checks-view';
import { resolveEvaluationHub } from './evaluation-hub';
import { resolveMethodPage } from './evaluation-methods';

const builtHrefs = (): Set<string> => new Set(SECTIONS.flatMap(s => s.entries.map(e => e.href)));

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

/**
 * One method's lists (#623), built once per build process from that method's cases and kept: the method's checks page and every file of
 * its lists read the same index, so a method's parts are read once, not once per file. Only the packed lists are kept, never the cases.
 */
const listsByMethod = new Map<MethodId, Promise<Map<string, CheckList>>>();
function listsOf(evaluation: MeasuredEvaluation, id: MethodId): Promise<Map<string, CheckList>> {
  let lists = listsByMethod.get(id);
  if (!lists) {
    lists = id === 'holdout' ? Promise.resolve(new Map()) : evaluation.casesOf(id).then(cases => methodCheckLists(id, evaluation.report, cases));
    listsByMethod.set(id, lists);
  }
  return lists;
}

/** `/evaluation/method/<method>/checks/`: the index of the method's lists and what its island needs to open one. */
export async function resolveMethodChecksPageFor(id: MethodId): Promise<MethodChecksPageProps> {
  const [{ evaluation, reason }, view, { catalog }] = await Promise.all([sources(), loadQualificationView(), loadCredentialSource()]);
  return resolveMethodChecksPage({
    method: id,
    report: evaluation?.report,
    lists: evaluation ? await listsOf(evaluation, id) : undefined,
    reason,
    // The suites this build has pages for (the credential source's catalog, as the suite pages), never the corpus registry: a link is to a page that exists.
    suites: new Map(catalog.suites.map(s => [s.id, s.title])),
    qualification: view.state === 'ready'
      ? { state: 'ready', families: new Set(view.view.families.map(f => f.family)) }
      : { state: 'unavailable', reason: `The qualification view is ${view.state} in this build.` },
  });
}

/**
 * Every list file the export writes, across the methods that have lists. With no usable evaluation (or no list at all) it is the one stated
 * file `output: export` needs for a route (`UNAVAILABLE_CHECKS`), which no page links and no guard accepts as a list.
 */
export async function resolveMethodChecksFileParams(): Promise<{ method: string; row: string; scanner: string; status: string }[]> {
  const { evaluation } = await sources();
  const params = [];
  if (evaluation) for (const id of METHOD_IDS) params.push(...methodChecksFileParams(id, await listsOf(evaluation, id)));
  return params.length > 0 ? params : [{ ...UNAVAILABLE_CHECKS }];
}

/** The file of one list; the stated file when no list exists; undefined for an address the run does not record. */
export async function resolveMethodChecksFile(params: { method: string; row: string; scanner: string; status: string }): Promise<ChecksFile | ChecksUnavailable | undefined> {
  if (!isMethodId(params.method)) return undefined;
  const { evaluation, reason } = await sources();
  if (listKey(params.row, params.scanner, params.status) === listKey(UNAVAILABLE_CHECKS.row, UNAVAILABLE_CHECKS.scanner, UNAVAILABLE_CHECKS.status)) {
    return { schema: CHECKS_SCHEMA, unavailable: evaluation ? 'No count of any method has checks behind it in this run.' : reason ?? 'No evaluation was published for this checkout.' };
  }
  if (!evaluation) return undefined;
  const list = (await listsOf(evaluation, params.method)).get(listKey(params.row, params.scanner, params.status));
  if (!list) return undefined;
  const { catalog } = await loadCredentialSource();
  return checksFile(params.method, list, evaluation.report.runId, slug => { const f = catalog.bySlug.get(slug); return f && slug === `${f.category}--${f.id}` ? f.id : undefined; });
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
