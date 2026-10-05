/**
 * `/evaluation`, resolved to block props. Pure.
 *
 * The hub links four pages that other phases own (scanners, release candidate, personal data, credentials) and
 * the six method pages. A phase page is a link only once its entry is in the Evaluation section's navigation
 * (`builtHrefs`): until then the row names the page and says it is not in this build, so the export never links a
 * route it does not contain. The run all the pages read is stated here, once.
 */
import type { EvaluationHubProps } from '../components/evaluation/hub/EvaluationHub';
import type { HubMethod, HubPhase, HubRunData, HubScanner } from '../components/evaluation/hub/types';
import type { EvaluationReport, QualificationEvidence } from '../../benchmarks/shared/evaluation-types.ts';
import { METHOD_IDS, methodHref } from '../lib/methods';
import type { RouteEntry } from '../lib/routes';
import { toolName } from './comparison';
import { EVAL_COMMANDS, HUB_COPY, METHOD_COPY } from './evaluation-copy';
import { count, isoDate } from './format';

export interface HubInput {
  report?: EvaluationReport;
  reason?: string;
  qualification?: QualificationEvidence;
  phases: RouteEntry[];
  /** The hrefs of the pages in the Evaluation navigation: a phase in this set has a page. */
  builtHrefs: Set<string>;
}

export function resolvePhases(phases: RouteEntry[], builtHrefs: Set<string>): HubPhase[] {
  return phases.map(p => (builtHrefs.has(p.href)
    ? { href: p.href, label: p.label, title: p.title, description: p.summary, action: `${p.label} →` }
    : { label: p.label, title: p.title, description: p.summary, action: 'Not in this build yet' }));
}

function methodFact(id: (typeof METHOD_IDS)[number], report: EvaluationReport | undefined, qualification: QualificationEvidence | undefined): string | undefined {
  const unit = METHOD_COPY[id].unit;
  if (id === 'holdout') return qualification ? count(qualification.holdout.caseCount, unit.one, unit.other) : undefined;
  return report ? count(report.cases.filter(c => c.method === id).length, unit.one, unit.other) : undefined;
}

function runFor(report: EvaluationReport | undefined, reason: string | undefined): HubRunData {
  if (!report) {
    return {
      state: 'not-measured',
      title: 'The run behind these pages',
      description: 'Every method page except holdout reads one evaluation run.',
      reason: reason ?? 'No evaluation was published for this checkout.',
      command: EVAL_COMMANDS,
    };
  }
  const scanners: HubScanner[] = report.scanners.map(s => ({
    id: s.id,
    name: toolName(s.id),
    version: s.version ?? 'not recorded',
    mode: s.mode,
    observed: `${s.observation.source === 'fresh' ? 'Fresh' : 'Snapshot'}, ${isoDate(s.observation.observedAt)}`,
    status: s.status,
  }));
  return {
    state: 'recorded',
    title: 'The run behind these pages',
    description: `Run ${report.runId.slice(0, 8)}, finished ${isoDate(report.finishedAt)}, from revision ${report.provenance.revision.slice(0, 7)}. The method pages read this one run, so it is stated here and not on each page. Holdout reads a separate qualification run.`,
    scanners,
  };
}

export function resolveEvaluationHub(input: HubInput): EvaluationHubProps {
  const { report, qualification } = input;
  const methods: HubMethod[] = METHOD_IDS.map(id => ({
    id,
    href: methodHref(id),
    name: METHOD_COPY[id].name,
    question: METHOD_COPY[id].question,
    fact: methodFact(id, report, qualification),
  }));
  return {
    eyebrow: HUB_COPY.eyebrow,
    title: HUB_COPY.title,
    lede: HUB_COPY.lede,
    meta: report ? [{ label: 'Run', value: `${report.runId.slice(0, 8)} · ${isoDate(report.finishedAt)}` }, { label: 'Accounting', value: `v${report.accountingVersion}` }] : [{ value: 'Not measured' }],
    phasesLabel: HUB_COPY.phasesLabel,
    phases: resolvePhases(input.phases, input.builtHrefs),
    methodsTitle: HUB_COPY.methodsTitle,
    methodsIntro: HUB_COPY.methodsIntro,
    methods,
    run: runFor(report, input.reason),
    principlesTitle: HUB_COPY.principlesTitle,
    principles: HUB_COPY.principles,
  };
}
