/**
 * Pure resolvers for the qualification case pages (#606): the raw view's per-case rows (`services/qualification.ts`) in, block props
 * out. A scope is one detector family or the cases no family claims. Rows stay per population (the same id in two populations is two
 * rows), nothing is counted across populations or scanners, and the scanners' words are the artifact's own: a pending case and a case
 * that was not measured are their own words, never a miss and never a pass. The evidence class is the artifact's label, never a status.
 */
import type { CaseCell, CaseRowProps, CaseSection, QualificationCasesProps } from '../components/qualification/types';
import type { CaseRow, CaseScannerResult, PopulationView, QualificationView } from '../services/qualification';
import { int } from './format';
import { QUALIFICATION_HREF, qualificationCasesHref, qualificationUnattributedHref } from './qualification';

/** Case rows on one page, across the populations of the scope: every page stays small enough to be one request. */
export const QUALIFICATION_CASE_PAGE_ROWS = 50;

export type CaseScope = { kind: 'family'; family: string } | { kind: 'unattributed' };

const scopeHref = (scope: CaseScope, page: number): string => (scope.kind === 'family' ? qualificationCasesHref(scope.family, page) : qualificationUnattributedHref(page));

const inScope = (c: CaseRow, scope: CaseScope): boolean => (scope.kind === 'family' ? c.detectors.includes(scope.family) : c.detectors.length === 0);

interface Slice { population: PopulationView; rows: CaseRow[] }
const sliceOf = (view: QualificationView, scope: CaseScope): Slice[] => view.populations.map(population => ({ population, rows: population.cases.filter(c => inScope(c, scope)) })).filter(s => s.rows.length > 0);

/** How many pages the scope's rows take; one page even when the scope holds no case. */
export function qualificationCasePageCount(view: QualificationView, scope: CaseScope): number {
  const rows = sliceOf(view, scope).reduce((n, s) => n + s.rows.length, 0);
  return Math.max(1, Math.ceil(rows / QUALIFICATION_CASE_PAGE_ROWS));
}

/** Every address the export pre-renders for the families a view scores. */
export const qualificationCaseParams = (view: QualificationView): { family: string; page: string }[] =>
  view.families.flatMap(f => Array.from({ length: qualificationCasePageCount(view, { kind: 'family', family: f.family }) }, (_, i) => ({ family: f.family, page: String(i + 1) })));

export const qualificationUnattributedParams = (view: QualificationView): { page: string }[] =>
  Array.from({ length: qualificationCasePageCount(view, { kind: 'unattributed' }) }, (_, i) => ({ page: String(i + 1) }));

const OUTCOME_ORDER = ['EXACT', 'COVERED', 'OVERBROAD', 'PARTIAL', 'MISS'];
const outcomeWord = (outcomes: string[]): string => {
  if (outcomes.length === 0) return 'No span';
  if (outcomes.length === 1) return outcomes[0];
  return OUTCOME_ORDER.filter(o => outcomes.includes(o)).map(o => `${o} ${int(outcomes.filter(x => x === o).length)}`).join(' · ');
};

const findings = (n: number): string => `${int(n)} ${n === 1 ? 'finding' : 'findings'} reported`;
const bytes = (n: number): string => `${int(n)} ${n === 1 ? 'byte' : 'bytes'}`;

/** What one scanner recorded for the case, as the table cell says it. */
export function caseCell(result: CaseScannerResult): CaseCell {
  switch (result.measurement) {
    case 'positive': return { scanner: result.scanner, word: outcomeWord(result.outcomes ?? []), state: 'measured' };
    case 'control': return { scanner: result.scanner, word: `${result.flagged ? 'Flagged' : 'Not flagged'}${result.coDetected ? ' · co-detected' : ''}`, state: 'measured' };
    case 'pending': return { scanner: result.scanner, word: 'Pending', state: 'pending' };
    default: return { scanner: result.scanner, word: 'Not measured', state: 'not-measured' };
  }
}

/** The same record at length, for the opened row. */
function resultDetail(result: CaseScannerResult): string {
  switch (result.measurement) {
    case 'positive': {
      const spans = result.outcomes ?? [];
      return `${int(spans.length)} ${spans.length === 1 ? 'span' : 'spans'}: ${spans.join(', ') || 'none'} · leaked ${bytes(result.leakedBytes ?? 0)} · collateral ${bytes(result.collateralBytes ?? 0)} · ${findings(result.observed)}`;
    }
    case 'control': return `${result.flagged ? 'Flagged' : 'Not flagged'} · ${findings(result.findings ?? result.observed)}${result.coDetected ? ' · another detector also reported it' : ''}`;
    case 'pending': return 'Pending: the case has no scored outcome yet. It is not a miss and not a pass.';
    default: return `Not measured${result.status ? `: the scanner’s status was ${result.status}` : ''}. It is not a miss and not a pass.`;
  }
}

const ATTRIBUTION: Record<CaseRow['attribution'], string> = {
  snapshot: 'Named by the evidence itself (its targets, family or taxonomy family)',
  'overlay-detectors': 'Attributed by the product overlay’s legacy targets',
  'twin-parent': 'Attributed through its twin’s parent',
  none: 'Not attributed to a detector family',
};

const span = (s: CaseRow['expected'][number]): string => `${s.role} ${int(s.start)} to ${int(s.end)}${s.envelope ? ` (envelope ${int(s.envelope.start)} to ${int(s.envelope.end)})` : ''}`;

export function caseRowProps(population: string, c: CaseRow): CaseRowProps {
  return {
    key: `${population}/${c.id}`,
    id: c.id,
    kind: c.kind,
    tier: c.tier,
    group: c.group,
    evidenceClass: c.evidenceClass ?? 'Not recorded',
    cells: c.results.map(caseCell),
    detail: [
      { term: 'Path', value: c.path, code: true },
      { term: 'Corpus family', value: c.family ?? 'Not named' },
      { term: 'Taxonomy', value: c.taxonomy ?? 'Not recorded' },
      { term: 'Targets', value: c.targets.length ? c.targets.join(', ') : 'None named' },
      { term: 'Twin of', value: c.twinOf ?? 'Not a twin', ...(c.twinOf ? { code: true } : {}) },
      ...(c.twinOf ? [{ term: 'Twin mutation', value: c.twinMutationKind ?? 'Not recorded' }] : []),
      { term: 'Attribution', value: ATTRIBUTION[c.attribution] },
      { term: 'Product detector families', value: c.detectors.length ? c.detectors.join(', ') : 'None' },
      { term: 'Expected spans', value: c.expected.length ? c.expected.map(span).join('; ') : 'None: a control expects no finding' },
      ...c.results.map(r => ({ term: r.scanner, value: resultDetail(r) })),
    ],
  };
}

const shortDigest = (digest: string): string => {
  const [algorithm, hex] = digest.split(':');
  return hex ? `${algorithm}:${hex.slice(0, 12)}` : digest.slice(0, 19);
};
const ROLE: Record<string, string> = { 'floors-and-gates': 'floors and gates', gates: 'gates', 'policy-route': 'policy route' };

function sectionOf(slice: Slice, from: number, to: number): CaseSection {
  const p = slice.population;
  const e = p.artifact.evidence;
  return {
    id: p.population,
    role: ROLE[p.role] ?? p.role,
    range: `cases ${int(from + 1)} to ${int(to)} of this population’s ${int(slice.rows.length)} in this scope`,
    identity: [
      { term: 'Evidence', value: `${e.source}${e.release ? ` · ${e.release.tag}` : ''}` },
      { term: 'Corpus digest', value: shortDigest(e.corpus_digest), code: true },
      { term: 'Semantic digest', value: shortDigest(p.artifact.semanticDigest), code: true },
      { term: 'Run class', value: p.runClass },
    ],
    rows: slice.rows.slice(from, to).map(c => caseRowProps(p.population, c)),
  };
}

/** One page of a scope's cases, or `null` when the family is not scored or the page is out of range. */
export function resolveQualificationCases(view: QualificationView, scope: CaseScope, page: number): QualificationCasesProps | null {
  if (scope.kind === 'family' && !view.families.some(f => f.family === scope.family)) return null;
  const pageCount = qualificationCasePageCount(view, scope);
  if (!Number.isInteger(page) || page < 1 || page > pageCount) return null;
  const slices = sliceOf(view, scope);
  // The page is a window over the scope's rows in population order; a population that straddles a page boundary continues on the next one.
  const start = (page - 1) * QUALIFICATION_CASE_PAGE_ROWS, end = start + QUALIFICATION_CASE_PAGE_ROWS;
  const sections: CaseSection[] = [];
  let offset = 0;
  for (const slice of slices) {
    const from = Math.max(start - offset, 0), to = Math.min(end - offset, slice.rows.length);
    if (to > from) sections.push(sectionOf(slice, from, to));
    offset += slice.rows.length;
  }
  const family = scope.kind === 'family' ? scope.family : null;
  const back = family ? { href: `${QUALIFICATION_HREF}families/${family}/`, label: `Back to ${family}` } : { href: QUALIFICATION_HREF, label: 'Back to the qualification overview' };
  return {
    breadcrumb: [
      { label: 'Evaluation', href: '/evaluation/' }, { label: 'Qualification', href: QUALIFICATION_HREF },
      ...(family ? [{ label: family, href: back.href }] : []),
      { label: family ? 'Cases' : 'Unattributed cases' },
    ],
    eyebrow: 'redact-secret · Evaluation · Qualification',
    title: family ? `Cases of ${family}` : 'Cases no detector family claims',
    lede: family
      ? 'Every case the populations hold for this detector family, with what each scanner recorded.'
      : 'Cases the adapter could not attribute to a product detector family. They stay in their population’s unattributed counts and are listed here, never dropped.',
    meta: [{ label: 'View', value: view.publication }, { label: 'Scanners', value: view.scanners.join(', ') || 'None' }],
    note: {
      title: 'What these rows are',
      text: 'A row is one case of one population; the same id in two populations is two rows, and no figure is a sum across populations or scanners. A scanner’s word is what its run artifact recorded. The evidence class is the artifact’s own label for the case and is not a support status. Pending and not measured are not misses.',
    },
    scanners: view.scanners,
    sections,
    empty: family ? 'No population holds a case for this detector family.' : 'Every case is attributed to a detector family.',
    pager: {
      page, pageCount,
      ...(page > 1 ? { previousHref: scopeHref(scope, page - 1) } : {}),
      ...(page < pageCount ? { nextHref: scopeHref(scope, page + 1) } : {}),
    },
    back,
  };
}
