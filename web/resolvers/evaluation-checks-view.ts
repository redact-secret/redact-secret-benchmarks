/**
 * The checks behind one count of a method table (#623), as the browser builds them: pure, no `node:` and no service, so the
 * client island of `/evaluation/method/<method>/checks/` may import it (tests/unit/report-rows.test.mjs lists the modules that may).
 *
 * The build writes one bounded file per list (`lib/data-paths.ts` `methodChecksDataPath`): the checks of one method, row, scanner and
 * status, in run order, packed as arrays. The page carries the index of its method's lists (each list's figure, filters and notes,
 * resolved on the server) and the island picks one by `?row=&scanner=&status=&page=`, fetches its file and windows it here,
 * CHECK_PAGE_ROWS a page. Nothing is counted or re-scored in the browser: the rows are the file's, the figure is the index's, and a
 * file whose run or length is not the page's is refused. Decision:
 * docs/decisions/2026-10-07-link-method-cells-to-the-checks-behind-each-count.md.
 */
import type { CheckItem, CheckTable, MethodCasesProps } from '../components/evaluation/methods/types';
import { methodHref, type MethodId } from '../lib/methods';
import { int } from './format';
import { qualificationCasesHref } from './qualification';
import { fixtureHref } from './rows';

/** Checks on one page of a list: one line each. The file holds the whole list; a page is a window over it. */
export const CHECK_PAGE_ROWS = 100;
/** The status a list is filtered to: an assertion's own status word, or `complete` for a differential comparison. */
export type CheckStatus = 'fail' | 'review-required' | 'complete';
export const CHECK_STATUSES: readonly CheckStatus[] = ['fail', 'review-required', 'complete'];
export const CHECKS_SCHEMA = 'redact-secret/evaluation-checks/v1';

/** The page that shows the lists of one method. */
export const methodChecksPath = (method: MethodId): string => `${methodHref(method)}checks/`;

/** One list, as an address: every filter that chose it stays in the URL. Page 1 is the address without `page`. */
export const methodChecksHref = (method: MethodId, row: string, scanner: string, status: CheckStatus, page = 1): string =>
  `${methodChecksPath(method)}?row=${encodeURIComponent(row)}&scanner=${encodeURIComponent(scanner)}&status=${status}${page > 1 ? `&page=${page}` : ''}`;

export interface ChecksQuery { row: string; scanner: string; status: string; page: number }

/** The list an address names, or null when it names none (the page then shows its index). A page that is not a positive integer is page 0, which no list has. */
export function checksQueryOf(params: URLSearchParams): ChecksQuery | null {
  const row = params.get('row');
  const scanner = params.get('scanner');
  const status = params.get('status');
  if (!row || !scanner || !status) return null;
  const raw = params.get('page');
  const page = raw === null ? 1 : /^[1-9][0-9]{0,6}$/.test(raw) ? Number(raw) : 0;
  return { row, scanner, status, page };
}

export const listKey = (row: string, scanner: string, status: string): string => `${row}/${scanner}/${status}`;

/**
 * One check in a file: case id, source slug, the families it targets, variant id, variant note, check, check note, and the id of the
 * source fixture's page in its suite, or '' when this build has no page for it (the build knows; the browser does not guess).
 */
export type PackedCheck = [caseId: string, sourceSlug: string, targets: string[], variant: string, variantNote: string, check: string, checkNote: string, fixturePage: string];

export interface ChecksFile {
  schema: typeof CHECKS_SCHEMA;
  method: string; row: string; scanner: string; status: string;
  /** The discovery run the checks were recorded by: a file from another run is refused. */
  runId: string;
  checks: PackedCheck[];
}

/**
 * The one file a build writes when it has no list (no usable evaluation, or no count with checks behind it): `output: export` refuses a
 * route with no params. No page links it, and `isChecksFile` refuses it, so it can never be shown as a list.
 */
export const UNAVAILABLE_CHECKS = { method: 'twin', row: 'not-published', scanner: 'none', status: 'fail' } as const;
export interface ChecksUnavailable { schema: typeof CHECKS_SCHEMA; unavailable: string }

const isString = (v: unknown): v is string => typeof v === 'string';
const isPacked = (v: unknown): v is PackedCheck =>
  Array.isArray(v) && v.length === 8 && isString(v[0]) && isString(v[1]) && Array.isArray(v[2]) && (v[2] as unknown[]).every(isString) && isString(v[3]) && isString(v[4]) && isString(v[5]) && isString(v[6]) && isString(v[7]);

export function isChecksFile(value: unknown): value is ChecksFile {
  const f = value as ChecksFile | null;
  return Boolean(f && typeof f === 'object' && f.schema === CHECKS_SCHEMA && isString(f.method) && isString(f.row) && isString(f.scanner) && isString(f.status) && isString(f.runId)
    && Array.isArray(f.checks) && f.checks.every(isPacked));
}

/** What the page knows of one list before its file is in: its figure, its file and the words of its head, all resolved on the server. */
export interface ChecksEntry {
  row: string; scanner: string; status: CheckStatus;
  /** The figure of the method page's cell: the file must hold exactly this many checks. */
  total: number;
  src: string;
  head: Pick<MethodCasesProps, 'crumbs' | 'eyebrow' | 'title' | 'lede' | 'filters'>;
  /** The scanner's or peer's name, as the notes say it. */
  scannerName: string;
}

/** What every list of the page shares: the run, the published suites and the families the qualification view has case pages for. */
export interface ChecksContext {
  method: MethodId;
  runId: string;
  meta: MethodCasesProps['meta'];
  /** The suites this build has pages for, by id, with their titles: a source fixture links to its page only in one of them. */
  suites: [id: string, title: string][];
  /** The families with a case page in the qualification view; null when the view is not usable in this build. */
  families: string[] | null;
  back: MethodCasesProps['back'];
  /** Column words of this method's lists: an assertion's check type, or a comparison's family classification. */
  comparisons: boolean;
  /** The method's name, as the notes say it. */
  methodName: string;
  /** Why no family is linked, when the qualification view is not usable. */
  qualificationReason?: string;
}

/** Where review decisions live. The pages show what a run recorded; a decision is the ledger's, never a page's. */
export const REVIEW_LEDGER = 'benchmarks/review-ledger.json';

/** What a list is and is not: one count of one run, families that lead to another report, and review decisions that stay in the ledger. */
export function checksNotes(entry: ChecksEntry, context: ChecksContext): MethodCasesProps['notes'] {
  const noun = context.comparisons ? 'comparison' : 'check';
  const notes: MethodCasesProps['notes'] = [
    {
      title: 'The checks behind one count',
      text: `Every row is one ${noun} discovery run ${context.runId.slice(0, 8)} recorded for ${entry.scannerName}, in run order: the ${int(entry.total)} behind the ${context.methodName.toLowerCase()} page's figure for this row. Nothing is counted across scanners, rows or runs.`,
    },
    context.families
      ? { title: 'Families lead to another report', text: 'A family opens its cases in the qualification view, which is built from the official credential-eval runs with one section per population. Those are another run and other case identities: its rows are not these checks, and nothing here is counted there.' }
      : { title: 'No qualification view to link to', text: `${context.qualificationReason ?? 'The qualification view is not usable in this build.'} The families are named, not linked.` },
  ];
  if (entry.status !== 'fail') notes.push({ title: 'Review decisions are the ledger’s', text: `This list shows what the run recorded. Whether a ${context.comparisons ? 'difference' : 'check'} is right is decided in the review ledger (${REVIEW_LEDGER}), never on this page.` });
  return notes;
}

/** The file that fits this entry and this page's run, and no other. */
export const checksFileFits = (entry: ChecksEntry, runId: string) => (value: unknown): value is ChecksFile =>
  isChecksFile(value) && value.runId === runId && value.row === entry.row && value.scanner === entry.scanner && value.status === entry.status && value.checks.length === entry.total;

export const checksPageCount = (total: number): number => Math.max(1, Math.ceil(total / CHECK_PAGE_ROWS));

const SEGMENT = /^[a-z0-9][a-z0-9._-]*$/i;

/** The source fixture, linked to its page only when the build wrote one for it (`fixturePage`) in a suite this build publishes. */
function sourceItem(slug: string, fixturePage: string, suites: Map<string, string>): CheckItem {
  const cut = slug.indexOf('--');
  const suite = cut > 0 ? slug.slice(0, cut) : slug;
  return fixturePage && suites.has(suite)
    ? { text: fixturePage, href: fixtureHref({ category: suite, id: fixturePage }), note: suites.get(suite)! }
    : { text: slug, note: 'No fixture page in this build' };
}

function familyItems(targets: string[], families: Set<string> | null): CheckItem[] {
  if (targets.length === 0) return [{ text: 'None named' }];
  return targets.map(t => (families?.has(t) && SEGMENT.test(t)
    ? { text: t, href: qualificationCasesHref(t, 1) }
    : { text: t, ...(families ? { note: 'No case page in the qualification view' } : {}) }));
}

/** One window of a list as a table: one row per recorded check, in the file's order. */
export function checksTable(entry: ChecksEntry, checks: PackedCheck[], context: ChecksContext, caption: string): CheckTable {
  const suites = new Map(context.suites);
  const families = context.families ? new Set(context.families) : null;
  return {
    caption,
    columns: [
      { key: 'case', header: context.comparisons ? 'Input' : 'Case' }, { key: 'source', header: 'Source fixture' }, { key: 'variant', header: 'Variant' },
      { key: 'check', header: context.comparisons ? 'Family classification' : 'Check' }, { key: 'families', header: 'Families (qualification view)' },
    ],
    rows: checks.map(([caseId, slug, targets, variant, variantNote, check, checkNote, fixturePage], i) => ({
      key: `${i}:${caseId}:${variant}`,
      cells: [
        [{ text: caseId, code: true }],
        [sourceItem(slug, fixturePage, suites)],
        [{ text: variant, code: true, ...(variantNote ? { note: variantNote } : {}) }],
        [{ text: check, ...(checkNote ? { note: checkNote } : {}) }],
        familyItems(targets, families),
      ],
    })),
  };
}

/** The recorded body of one page of a list, or null for a page past the last. */
export function checksBody(entry: ChecksEntry, file: ChecksFile, page: number, context: ChecksContext): Extract<MethodCasesProps['body'], { state: 'recorded' }> | null {
  const pages = checksPageCount(file.checks.length);
  if (page < 1 || page > pages) return null;
  const start = (page - 1) * CHECK_PAGE_ROWS;
  const href = (p: number) => methodChecksHref(context.method, entry.row, entry.scanner, entry.status, p);
  return {
    state: 'recorded',
    table: checksTable(entry, file.checks.slice(start, start + CHECK_PAGE_ROWS), context, `${entry.head.title}: page ${int(page)}`),
    pager: {
      page, pageCount: pages, total: file.checks.length, pageSize: CHECK_PAGE_ROWS,
      ...(page > 1 ? { previousHref: href(page - 1) } : {}),
      ...(page < pages ? { nextHref: href(page + 1) } : {}),
    },
  };
}
