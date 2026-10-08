/**
 * The checks behind each count of a method table (#623), resolved on the server. Pure.
 *
 * Decision: docs/decisions/2026-10-07-link-method-cells-to-the-checks-behind-each-count.md. A count on
 * `/evaluation/method/<method>/` is one scanner's figure for one row of the discovery run's evaluation bundle. Its checks are the same
 * assertions the table counted (the one pass `collectRows` / `comparisonsByPeer` makes for both), kept as one bounded file per list
 * (`data/evaluation/<method>/<row>/<scanner>/<status>/checks.json`) and shown on `/evaluation/method/<method>/checks/` with every filter in
 * the address (`evaluation-checks-view.ts`). A list is never summed with another, never ranked and never re-scored. Qualification case
 * pages are another report (the official credential-eval runs, per population): a case's families link there as that report's own
 * pages and the page says its rows are not these checks. Review decisions stay in the review ledger; nothing here decides one.
 */
import type { CheckTable, MethodCasesProps } from '../components/evaluation/methods/types';
import type { EvaluationCase } from '../../benchmarks/shared/evaluation-types.ts';
import { methodChecksDataPath } from '../lib/data-paths';
import { methodHref, type MethodId } from '../lib/methods';
import { toolName } from './comparison';
import { EVAL_COMMANDS, METHOD_COPY } from './evaluation-copy';
import {
  CHECKS_SCHEMA, listKey, methodChecksHref, REVIEW_LEDGER, type CheckStatus, type ChecksContext, type ChecksEntry, type ChecksFile, type PackedCheck,
} from './evaluation-checks-view';
import {
  addressableKeys, classifierFor, collectRows, comparisonsByPeer, DIFFERENCES, SEGMENT,
  type CheckRef, type ComparisonRef, type EvaluationSummary, type TallyMethod,
} from './evaluation-methods';
import { int, isoDate } from './format';

const PRODUCT = 'redact-secret';

/**
 * One list as the build keeps it: the row and scanner it belongs to, the denominator the method page shows for it, and the checks behind
 * its figure, already packed as the file carries them. The build keeps these, never the cases, so what it holds is the lists, not the report.
 */
export interface CheckList {
  kind: 'assertions' | 'comparisons';
  row: string; rowLabel: string; group: string; scanner: string; status: CheckStatus;
  /** The `of` of the method page's cell: scored checks, or complete comparisons. */
  scored: number;
  checks: PackedCheck[];
}

/** The source fixture's page id is filled in when the file is written (`checksFile`), from the catalog the suite pages are built from. */
const fromAssertion = (r: CheckRef): PackedCheck =>
  [r.case.id, r.case.sourceSlug, r.case.targets, r.variant.id, `${r.variant.operator} · ${r.variant.tier}`, r.assertion.type, r.assertion.baseline ? `against ${r.assertion.baseline}` : '', ''];
const fromComparison = (r: ComparisonRef): PackedCheck =>
  [r.case.id, r.case.sourceSlug, r.case.targets, r.comparison.variant, '', r.comparison.classification, '', ''];

/**
 * Every list a method page links to, keyed by `<row>/<scanner>/<status>`. The conditions are the method table's own: a count over zero
 * opens its failed checks, an "unscored" cell opens the checks that wait for review, a differential count over zero opens its comparisons.
 * A scanner that did not complete has no list. Holdout has none (a holdout case cannot be opened).
 */
export function methodCheckLists(id: MethodId, report: EvaluationSummary, cases: EvaluationCase[]): Map<string, CheckList> {
  const lists = new Map<string, CheckList>();
  if (id === 'holdout') return lists;
  const complete = new Set(report.scanners.filter(s => s.status === 'complete' && SEGMENT.test(s.id)).map(s => s.id));
  if (id === 'differential') {
    const peers = report.scanners.filter(s => s.id !== PRODUCT).map(s => s.id);
    const per = comparisonsByPeer(peers, cases);
    for (const d of DIFFERENCES) {
      for (const peer of peers) {
        const p = per.get(peer)!;
        const checks = p.kinds.get(d.disagreement) ?? [];
        if (!complete.has(peer) || p.complete === 0 || checks.length === 0) continue;
        lists.set(listKey(d.key, peer, 'complete'), { kind: 'comparisons', row: d.key, rowLabel: d.label, group: 'What each tool reported', scanner: peer, status: 'complete', scored: p.complete, checks: checks.map(fromComparison) });
      }
    }
    return lists;
  }
  const rows = collectRows(cases, classifierFor(id as TallyMethod, report));
  const linkable = addressableKeys(rows.map(r => r.spec.key));
  for (const { spec, byScanner } of rows) {
    if (!linkable.has(spec.key)) continue;
    for (const [scanner, checks] of byScanner) {
      if (!complete.has(scanner)) continue;
      const scored = checks.tally.pass + checks.tally.fail;
      const base = { kind: 'assertions' as const, row: spec.key, rowLabel: spec.label, group: spec.group, scanner, scored };
      if (checks.fail.length > 0) lists.set(listKey(spec.key, scanner, 'fail'), { ...base, status: 'fail', checks: checks.fail.map(fromAssertion) });
      else if (scored === 0 && checks.review.length > 0) lists.set(listKey(spec.key, scanner, 'review-required'), { ...base, status: 'review-required', checks: checks.review.map(fromAssertion) });
    }
  }
  return lists;
}

/**
 * The file the build writes for one list. `fixturePage` names the id of a source slug's fixture page in its suite when this build has one
 * (the credential source's catalog, the same the suite pages are built from); a slug it does not know stays unlinked.
 */
export const checksFile = (method: MethodId, list: CheckList, runId: string, fixturePage: (slug: string) => string | undefined = () => undefined): ChecksFile =>
  ({ schema: CHECKS_SCHEMA, method, row: list.row, scanner: list.scanner, status: list.status, runId, checks: list.checks.map(c => { const page = fixturePage(c[1]); return page ? [...c.slice(0, 7), page] as PackedCheck : c; }) });

/** Every file the export writes for one method: one per list. */
export const methodChecksFileParams = (id: MethodId, lists: Map<string, CheckList>): { method: string; row: string; scanner: string; status: string }[] =>
  [...lists.values()].map(l => ({ method: id, row: l.row, scanner: l.scanner, status: l.status }));

const STATUS_WORD: Record<CheckStatus, string> = { fail: 'Did not hold', 'review-required': 'Needs review', complete: 'Compared' };

function countSentence(list: CheckList): string {
  const n = list.checks.length;
  switch (list.status) {
    case 'fail': return `${int(n)} of ${int(list.scored)} ${list.scored === 1 ? 'check' : 'checks'} did not hold. These are the ${int(n)}, as the run recorded them.`;
    case 'review-required': return `${int(n)} ${n === 1 ? 'check waits' : 'checks wait'} for a person and none was scored. These are the ${int(n)}, as the run recorded them.`;
    default: return `${int(n)} of ${int(list.scored)} ${list.scored === 1 ? 'comparison' : 'comparisons'} recorded this. These are the ${int(n)}, as the run recorded them.`;
  }
}

export interface MethodChecksInput {
  method: MethodId;
  report?: EvaluationSummary;
  /** This method's lists, from `methodCheckLists`. Absent when no evaluation is usable. */
  lists?: Map<string, CheckList>;
  reason?: string;
  /** Published suites by id, with their titles. */
  suites: Map<string, string>;
  /** The families the qualification view has case pages for, or why there is none to link to. */
  qualification: { state: 'ready'; families: Set<string> } | { state: 'unavailable'; reason: string };
}

/** What the page and its client island receive: the index the page shows without an address, the lists it can open and what they share. */
export interface MethodChecksPageProps {
  index: MethodCasesProps;
  entries: ChecksEntry[];
  context: ChecksContext | null;
}

function entryOf(method: MethodId, list: CheckList, input: MethodChecksInput & { report: EvaluationSummary }): ChecksEntry {
  const copy = METHOD_COPY[method];
  const name = toolName(list.scanner);
  const version = input.report.scanners.find(s => s.id === list.scanner)?.version;
  const comparisons = list.kind === 'comparisons';
  return {
    row: list.row, scanner: list.scanner, scannerName: name, status: list.status, total: list.checks.length,
    src: methodChecksDataPath(method, list.row, list.scanner, list.status),
    head: {
      crumbs: [{ label: 'Evaluation', href: '/evaluation/' }, { label: copy.name, href: methodHref(method) }, { label: `${list.rowLabel} · ${name}` }],
      eyebrow: `${copy.name.toUpperCase()} · CHECKS`,
      title: `${list.rowLabel}: ${name}`,
      lede: countSentence(list),
      filters: [
        { term: 'Method', description: copy.name },
        { term: 'Check', description: list.group ? `${list.rowLabel} (${list.group})` : list.rowLabel },
        { term: comparisons ? 'Peer' : 'Scanner', description: `${name}${version ? ` ${version}` : ''}` },
        { term: 'Status', description: STATUS_WORD[list.status] },
      ],
    },
  };
}

/** The index of a method's lists, the one view a reader without script, or without an address, sees. */
function indexTable(method: MethodId, lists: CheckList[]): CheckTable {
  return {
    caption: `${METHOD_COPY[method].name}: the lists behind the counts`,
    columns: [{ key: 'check', header: 'Check' }, { key: 'scanner', header: method === 'differential' ? 'Peer' : 'Scanner' }, { key: 'status', header: 'Status' }, { key: 'checks', header: 'Checks' }],
    rows: lists.map(l => ({
      key: listKey(l.row, l.scanner, l.status),
      cells: [
        [{ text: l.rowLabel, ...(l.group ? { note: l.group } : {}) }],
        [{ text: toolName(l.scanner) }],
        [{ text: STATUS_WORD[l.status] }],
        [{ text: l.status === 'review-required' ? `${int(l.checks.length)} unscored` : `${int(l.checks.length)} of ${int(l.scored)}`, href: methodChecksHref(method, l.row, l.scanner, l.status) }],
      ],
    })),
  };
}

/** `/evaluation/method/<method>/checks/`: the index of the method's lists, every list's head, and what the island needs to open one. */
export function resolveMethodChecksPage(input: MethodChecksInput): MethodChecksPageProps {
  const { method } = input;
  const copy = METHOD_COPY[method];
  const back = { label: `Back to the ${copy.name.toLowerCase()} method`, href: methodHref(method) };
  const crumbs = [{ label: 'Evaluation', href: '/evaluation/' }, { label: copy.name, href: methodHref(method) }, { label: 'Checks' }];
  const head = { crumbs, eyebrow: `${copy.name.toUpperCase()} · CHECKS`, title: `${copy.name}: the checks behind each count` };

  if (!input.report || !input.lists) {
    return {
      index: {
        ...head, lede: 'No evaluation is usable in this build, so there are no checks to list.', meta: [{ value: 'Not measured' }], filters: [{ term: 'Method', description: copy.name }], notes: [],
        body: { state: 'not-measured', title: 'Not measured: no evaluation published', body: `${input.reason ?? 'No evaluation was published for this checkout.'} The lists behind the method counts read the evaluation bundle (public/results/evaluation-bundle-v1.json).`, command: EVAL_COMMANDS },
        back,
      },
      entries: [],
      context: null,
    };
  }
  const report = input.report;
  const lists = [...input.lists.values()];
  const meta = [
    { label: 'Run', value: `${report.runId.slice(0, 8)} · ${isoDate(report.finishedAt)}` },
    { label: 'Cases hash', value: report.provenance.casesHash.slice(0, 12) },
    { label: 'Accounting', value: `v${report.accountingVersion}` },
  ];
  return {
    index: {
      ...head,
      lede: lists.length > 0
        ? `Every count of the ${copy.name.toLowerCase()} page that has checks behind it opens one of these lists. Open one to read its checks.`
        : `No count of the ${copy.name.toLowerCase()} page has checks behind it in this run: every figure is a zero or a scanner that did not run.`,
      meta,
      filters: [{ term: 'Method', description: copy.name }, { term: 'Lists', description: int(lists.length) }],
      notes: [{ title: 'From one run', text: `Every list is one row and one scanner of discovery run ${report.runId.slice(0, 8)}. Nothing is counted across lists, scanners or runs, and a review decision is the review ledger’s (${REVIEW_LEDGER}).` }],
      body: { state: 'index', table: indexTable(method, lists) },
      back,
    },
    entries: lists.map(l => entryOf(method, l, { ...input, report })),
    context: {
      method, runId: report.runId, meta, back,
      suites: [...input.suites.entries()],
      families: input.qualification.state === 'ready' ? [...input.qualification.families].sort() : null,
      comparisons: method === 'differential',
      methodName: copy.name,
      ...(input.qualification.state === 'ready' ? {} : { qualificationReason: input.qualification.reason }),
    },
  };
}
