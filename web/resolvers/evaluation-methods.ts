/**
 * The six evaluation method pages, resolved to block props. Pure.
 *
 * Boundary rule: every number shown is one the evaluation run recorded. Nothing is ranked, summed across
 * scanners or called better; a scanner that did not complete is "Not measured", never a zero, and a missing
 * run resolves to a stated "Not measured" with the command that produces it.
 *
 * One schema serves all six methods (decision: docs/decisions/2026-10-01-show-each-evaluation-method-in-one-fixed-order.md):
 * what it is, how it runs, what was recorded now (scanners across, checks down), how to read it, the exact inputs.
 * Each method differs only in which checks are the rows. A count is derived from the assertions once, here, and a
 * block shows it once.
 */
import type { MetaItem } from '../components/page/MetaList';
import type {
  EvidenceCell, EvidenceColumn, EvidenceGroup, MethodInputsData, MethodPageProps, MethodRecordedData, NotMeasuredData, TextTable,
} from '../components/evaluation/methods/types';
import type { EvaluationAssertion, EvaluationCase, EvaluationReport, EvaluationVariant, QualificationEvidence } from '../../benchmarks/shared/evaluation-types.ts';
import { METHOD_IDS, methodHref, type MethodId } from '../lib/methods';
import { toolName } from './comparison';
import { methodChecksHref, REVIEW_LEDGER, type CheckStatus } from './evaluation-checks-view';
import { EVAL_COMMANDS, METHOD_COPY, OPERATOR_COPY } from './evaluation-copy';
import { count, int, isoDate } from './format';

const PRODUCT = 'redact-secret';

/**
 * The evaluation without its two large arrays (#789): the page reads the summary, the cases of its own method (`casesOf`, called
 * for that method only) and the one count it takes from the reviews. The accounting below is the same for every source; only the
 * way the cases reach it changed.
 */
export type EvaluationSummary = Omit<EvaluationReport, 'cases' | 'reviews'>;

/** What the page reads. `report` is absent when no usable evaluation was published; `reason` then says why. */
export interface MethodInput {
  report?: EvaluationSummary;
  /** The cases of one method. Called with the page's own method; never for the whole report. */
  casesOf?: (method: string) => EvaluationCase[];
  /** Reviews that name a peer (differential comparisons queued for review). */
  peerReviews?: number;
  reason?: string;
  /** The qualification aggregate, for the holdout page. */
  qualification: { state: 'recorded'; source: 'run' | 'frozen'; report: QualificationEvidence } | { state: 'not-recorded'; reason: string };
  /** The published suites by id, with their titles: the ones a suite link can point at. */
  suites: Map<string, string>;
}

/**
 * The holdout aggregate is the protected-holdout lifecycle's output (`eval:qualify`), which the owner kept (2026-10-05). Under the `new` authority the publication
 * runs no qualification and the evaluation bundle embeds none (#657): the page reads the frozen report committed at `docs/specs/qualification/engine-v1.json`. Only
 * the `legacy` rollback's publication embeds a fresh one (`eval:publish --qualification`), so that command is named as the rollback's, not as how the page is fed.
 */
const QUALIFY_COMMANDS = 'npm run eval:qualify   # writes results-output/qualification/engine-v1.json (the protected-holdout lifecycle)\n# the rollback publication embeds it: npm run eval:publish -- --qualification=results-output/qualification/engine-v1.json';

const notMeasured = (title: string, body: string, command = EVAL_COMMANDS): NotMeasuredData => ({ state: 'not-measured', title, body, command });

// ---- Tallies --------------------------------------------------------------------------------------

export interface Tally { pass: number; fail: number; review: number }
const emptyTally = (): Tally => ({ pass: 0, fail: 0, review: 0 });

export interface Spec { group: string; groupOrder: number; key: string; order: number; label: string; note?: string }
type Classify = (c: EvaluationCase, a: EvaluationAssertion, variant: EvaluationVariant, baseline: EvaluationVariant | undefined) => Spec | null;

/** One recorded check behind a count (#623): the assertion, the case it belongs to and the variant it reads. */
export interface CheckRef { case: EvaluationCase; assertion: EvaluationAssertion; variant: EvaluationVariant }
/** One scanner's tally in one row, and the checks behind its two listable figures: the ones that did not hold and the ones that wait for review. */
export interface ScannerChecks { tally: Tally; fail: CheckRef[]; review: CheckRef[] }
export interface TalliedRow { spec: Spec; byScanner: Map<string, ScannerChecks> }

export const columnsOf = (report: EvaluationSummary, only?: (id: string) => boolean): EvidenceColumn[] =>
  report.scanners.filter(s => !only || only(s.id)).map(s => ({ id: s.id, name: toolName(s.id), ...(s.version ? { version: s.version } : {}) }));

// ---- The address of the checks behind a count (#623) ----------------------------------------------

/** A data-path segment (`lib/data-paths.ts`): a row key, an operator or a scanner id. A row or scanner whose id is not one has no list. */
export const SEGMENT = /^[a-z0-9][a-z0-9._-]*$/i;

/** Row keys that can be an address: segment-safe and used by one row only (two groups could share a key; then neither is linked). */
export function addressableKeys(keys: string[]): Set<string> {
  const seen = new Map<string, number>();
  for (const k of keys) seen.set(k, (seen.get(k) ?? 0) + 1);
  return new Set(keys.filter(k => SEGMENT.test(k) && seen.get(k) === 1));
}

/** The cell for one scanner and one row: "n of N" over scored checks, or the state that stops a count. A count opens the checks behind it. */
function cellOf(checks: ScannerChecks | undefined, complete: boolean, href: ((status: CheckStatus) => string) | undefined): EvidenceCell {
  if (!complete) return { kind: 'not-measured' };
  if (!checks) return { kind: 'none' };
  const { tally } = checks;
  const scored = tally.pass + tally.fail;
  if (scored > 0) return { kind: 'count', value: int(tally.fail), of: int(scored), ...(href && tally.fail > 0 ? { href: href('fail') } : {}) };
  if (tally.review > 0) return { kind: 'unscored', of: int(tally.review), ...(href ? { href: href('review-required') } : {}) };
  return { kind: 'none' };
}

/** Count the assertions of one method into rows chosen by `classify`, keeping the checks behind each count: one pass, read by the table and the lists alike. */
export function collectRows(cases: EvaluationCase[], classify: Classify): TalliedRow[] {
  const rows = new Map<string, TalliedRow>();
  for (const c of cases) {
    const variants = new Map(c.variants.map(v => [v.id, v]));
    for (const a of c.assertions) {
      const variant = variants.get(a.variant || a.candidate);
      if (!variant) continue;
      const spec = classify(c, a, variant, a.baseline ? variants.get(a.baseline) : undefined);
      if (!spec) continue;
      const id = `${spec.group}\u0000${spec.key}`;
      const row = rows.get(id) ?? { spec, byScanner: new Map<string, ScannerChecks>() };
      rows.set(id, row);
      const checks = row.byScanner.get(a.scanner) ?? { tally: emptyTally(), fail: [], review: [] };
      row.byScanner.set(a.scanner, checks);
      if (a.status === 'pass') checks.tally.pass++;
      else if (a.status === 'fail') { checks.tally.fail++; checks.fail.push({ case: c, assertion: a, variant }); }
      else if (a.status === 'review-required') { checks.tally.review++; checks.review.push({ case: c, assertion: a, variant }); }
    }
  }
  return [...rows.values()];
}

const NO_ADDRESS = 'Not listed: this row has no address of its own, so its counts open no list.';

/** The rows as the table shows them, grouped and ordered by the spec; a count links to its checks when the row and scanner have an address. */
function tallyRows(report: EvaluationSummary, cases: EvaluationCase[], columns: EvidenceColumn[], classify: Classify, method: MethodId): EvidenceGroup[] {
  const rows = collectRows(cases, classify);
  const complete = new Map(report.scanners.map(s => [s.id, s.status === 'complete']));
  const linkable = addressableKeys(rows.map(r => r.spec.key));
  const groups = new Map<string, { order: number; rows: TalliedRow[] }>();
  for (const row of rows) {
    const group = groups.get(row.spec.group) ?? { order: row.spec.groupOrder, rows: [] };
    groups.set(row.spec.group, group);
    group.rows.push(row);
  }
  return [...groups.entries()]
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([label, group]) => ({
      label,
      rows: group.rows
        .sort((a, b) => a.spec.order - b.spec.order || a.spec.label.localeCompare(b.spec.label))
        .map(({ spec, byScanner }) => {
          const linked = linkable.has(spec.key);
          return {
            key: spec.key,
            label: spec.label,
            ...(spec.note ? { note: spec.note } : {}),
            cells: columns.map(col => cellOf(byScanner.get(col.id), complete.get(col.id) === true,
              linked && SEGMENT.test(col.id) ? status => methodChecksHref(method, spec.key, col.id, status) : undefined)),
            ...(linked ? {} : { unlisted: NO_ADDRESS }),
          };
        }),
    }));
}

// ---- Shapes of the inputs -------------------------------------------------------------------------

const suiteOf = (c: EvaluationCase) => c.sourceSlug.split('--')[0];
const isIdentity = (v: EvaluationVariant) => v.operator === 'identity';
const OPERATOR_ORDER = (report: EvaluationSummary) => new Map(report.provenance.operators.map((o, i) => [o.id, i]));
const titleCase = (id: string) => { const words = id.replace(/-/g, ' '); return words.charAt(0).toUpperCase() + words.slice(1); };

function suitesTable(report: EvaluationSummary, cases: EvaluationCase[], suites: Map<string, string>, noun: { one: string; other: string }): TextTable {
  const counts = new Map<string, number>();
  for (const c of cases) counts.set(suiteOf(c), (counts.get(suiteOf(c)) ?? 0) + 1);
  const order = Object.keys(report.corpusHashes);
  const ids = [...counts.keys()].sort((a, b) => (order.indexOf(a) + 1 || order.length + 1) - (order.indexOf(b) + 1 || order.length + 1) || a.localeCompare(b));
  return {
    caption: 'Suites the cases come from',
    columns: [{ key: 'suite', header: 'Suite' }, { key: 'cases', header: noun.other.charAt(0).toUpperCase() + noun.other.slice(1), numeric: true }],
    rows: ids.map(id => ({
      key: id,
      cells: [
        suites.has(id) ? { text: suites.get(id)!, href: `/report/corpus/${id}/`, note: id } : { text: id },
        { text: int(counts.get(id)!) },
      ],
    })),
  };
}

/** The operators a method generated, with what each did to its sources. Generation counts come from the cases of this method only. */
function operatorsTable(report: EvaluationSummary, cases: EvaluationCase[], exclude: (id: string) => boolean, scored: boolean): TextTable {
  const order = OPERATOR_ORDER(report);
  const per = new Map<string, { generated: number; valid: number; deferred: number; unsupported: number; error: number }>();
  const row = (id: string) => { const r = per.get(id) ?? { generated: 0, valid: 0, deferred: 0, unsupported: 0, error: 0 }; per.set(id, r); return r; };
  for (const c of cases) {
    for (const v of c.variants) if (!isIdentity(v) && !exclude(v.operator)) { const r = row(v.operator); r.generated++; if (v.expectationEffect === 'defer') r.deferred++; else r.valid++; }
    for (const g of c.generation) if (!exclude(g.operator) && g.status !== 'generated') row(g.operator)[g.status]++;
  }
  const ids = [...per.keys()].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99) || a.localeCompare(b));
  const errors = ids.some(id => per.get(id)!.error > 0);
  const columns: TextTable['columns'] = [
    { key: 'operator', header: 'Operator' },
    { key: 'what', header: 'What it changes' },
    { key: 'generated', header: 'Generated', numeric: true },
    ...(scored ? [{ key: 'scored', header: 'Scored', numeric: true }, { key: 'deferred', header: 'Deferred to review', numeric: true }] : []),
    { key: 'unsupported', header: 'Not applicable', numeric: true },
    ...(errors ? [{ key: 'error', header: 'Errors', numeric: true }] : []),
  ];
  return {
    caption: 'Operators and what they generated',
    columns,
    rows: ids.map(id => {
      const r = per.get(id)!;
      return {
        key: id,
        cells: [
          { text: id },
          { text: OPERATOR_COPY[id] ?? 'No description recorded' },
          { text: int(r.generated) },
          ...(scored ? [{ text: int(r.valid) }, { text: int(r.deferred) }] : []),
          { text: int(r.unsupported) },
          ...(errors ? [{ text: int(r.error) }] : []),
        ],
      };
    }),
  };
}

// ---- The checks of each method --------------------------------------------------------------------

const SAME_DETECTION = 'same-detection';

function classifyTwin(): Classify {
  const rows: Record<string, Spec> = {
    'must-flip': { group: '', groupOrder: 0, key: 'pair', order: 0, label: 'Pair told apart', note: 'The positive is detected and its twin is left alone' },
    'present-within-envelope': { group: '', groupOrder: 0, key: 'positive', order: 1, label: 'Positive side', note: 'Detected within its expected envelope' },
    absent: { group: '', groupOrder: 0, key: 'negative', order: 2, label: 'Negative twin', note: 'Left alone' },
  };
  return (_c, a) => rows[a.type] ?? null;
}

function classifyBenign(): Classify {
  return (c, a) => {
    if (a.type !== 'absent' || !c.taxonomy) return null;
    const untargeted = c.taxonomy.startsWith('realworld-');
    return {
      group: untargeted ? 'Real-world shapes, untargeted' : 'Controls by family axis',
      groupOrder: untargeted ? 1 : 0,
      key: c.taxonomy,
      order: 0,
      label: titleCase(untargeted ? c.taxonomy.slice('realworld-'.length) : c.taxonomy),
    };
  };
}

function classifyTransform(report: EvaluationSummary, groups: { relation: string; alone: string }, skip: (v: EvaluationVariant) => boolean): Classify {
  const order = OPERATOR_ORDER(report);
  return (_c, a, variant) => {
    if (isIdentity(variant) || skip(variant)) return null;
    if (a.type === SAME_DETECTION || a.type === 'absolute') return { group: groups.relation, groupOrder: 0, key: variant.operator, order: order.get(variant.operator) ?? 99, label: variant.operator, note: OPERATOR_COPY[variant.operator] };
    if (a.type === 'present-within-envelope') return { group: groups.alone, groupOrder: 1, key: 'detected', order: 0, label: 'Value detected', note: 'A value that should be detected is, within its expected envelope' };
    if (a.type === 'absent') return { group: groups.alone, groupOrder: 1, key: 'left-alone', order: 1, label: 'Look-alike left alone', note: 'A text that should not be flagged is not' };
    return null;
  };
}

export type TallyMethod = Exclude<MethodId, 'holdout' | 'differential'>;

/** Which row a check of each tallied method falls in. The table and the lists behind its counts both read this one choice. */
export function classifierFor(id: TallyMethod, report: EvaluationSummary): Classify {
  switch (id) {
    case 'twin': return classifyTwin();
    case 'benign': return classifyBenign();
    case 'metamorphic': return classifyTransform(report, { relation: 'Same detection after the transform', alone: 'The transformed text on its own' }, () => false);
    default: return classifyTransform(report, { relation: 'Same detection, format still valid', alone: 'The altered value on its own' }, v => v.operator === 'authored.twin');
  }
}

// ---- Unscored -------------------------------------------------------------------------------------

/** Cases with at least one check waiting for a person, for the methods whose assertions can be review-required. */
function unscoredCases(cases: EvaluationCase[]): number {
  return cases.filter(c => c.assertions.some(a => a.status === 'review-required')).length;
}

// ---- Differential and holdout have their own shapes -----------------------------------------------

export const DIFFERENCES: { key: string; label: string; note: string; disagreement: string }[] = [
  { key: 'same', label: 'No difference found', note: 'The same ranges, or none from either, and no family difference where families could be compared', disagreement: 'none' },
  { key: 'range', label: 'Ranges differ', note: 'Both reported something, and not the same ranges', disagreement: 'range-disagreement' },
  { key: 'product-only', label: `Only ${PRODUCT} reported`, note: `${PRODUCT} reported a range the peer did not`, disagreement: 'redact-secret-only' },
  { key: 'peer-only', label: 'Only the peer reported', note: `The peer reported a range ${PRODUCT} did not`, disagreement: 'peer-only' },
  { key: 'classification', label: 'Same ranges, different family', note: 'The ranges match and the families they map to differ', disagreement: 'classification-disagreement' },
];

/** One recorded comparison behind a differential count (#623). */
export interface ComparisonRef { case: EvaluationCase; comparison: EvaluationCase['comparisons'][number] }
export interface PeerComparisons { complete: number; kinds: Map<string, ComparisonRef[]>; compared: number; notCompared: number }

/** The comparisons of each peer, by what each tool reported: one pass, read by the table and the lists alike. */
export function comparisonsByPeer(peers: string[], cases: EvaluationCase[]): Map<string, PeerComparisons> {
  const per = new Map<string, PeerComparisons>(peers.map(p => [p, { complete: 0, kinds: new Map(), compared: 0, notCompared: 0 }]));
  for (const c of cases) {
    for (const x of c.comparisons) {
      const p = per.get(x.peer);
      if (!p) continue;
      if (x.status !== 'complete') { p.notCompared++; continue; }
      p.complete++;
      const kind = p.kinds.get(x.disagreement) ?? [];
      p.kinds.set(x.disagreement, kind);
      kind.push({ case: c, comparison: x });
      if (x.classification === 'compared') p.compared++;
    }
  }
  return per;
}

const CLASSIFICATION_UNLISTED = 'Not listed: the same comparisons as the rows above, split by family. Open a count above.';

function differentialRecorded(report: EvaluationSummary, cases: EvaluationCase[], peerReviews: number): MethodRecordedData | NotMeasuredData {
  const copy = METHOD_COPY.differential;
  const peers = report.scanners.filter(s => s.id !== PRODUCT);
  if (peers.length === 0) return notMeasured('No peer scanner ran', `The evaluation was published with ${PRODUCT} alone, so there is nothing to compare it with. Run the evaluation with its peers.`);
  const columns = columnsOf(report, id => id !== PRODUCT);
  const per = comparisonsByPeer(peers.map(p => p.id), cases);
  const status = new Map(peers.map(p => [p.id, p.status === 'complete']));
  const cell = (peer: string, value: (p: PeerComparisons) => number, href?: string): EvidenceCell => {
    const p = per.get(peer)!;
    if (!status.get(peer)) return { kind: 'not-measured' };
    if (p.complete === 0) return { kind: 'none' };
    const n = value(p);
    return { kind: 'count', value: int(n), of: int(p.complete), ...(href && n > 0 && SEGMENT.test(peer) ? { href } : {}) };
  };
  const groups: EvidenceGroup[] = [
    {
      label: 'What each tool reported',
      rows: DIFFERENCES.map(d => ({
        key: d.key, label: d.label, note: d.note,
        cells: columns.map(col => cell(col.id, p => p.kinds.get(d.disagreement)?.length ?? 0, methodChecksHref('differential', d.key, col.id, 'complete'))),
      })),
    },
    {
      label: 'Family classification',
      rows: [
        { key: 'compared', label: 'Comparable', note: 'Ranges match and every range maps to a family', cells: columns.map(col => cell(col.id, p => p.compared)), unlisted: CLASSIFICATION_UNLISTED },
        { key: 'not-comparable', label: 'Not comparable', note: 'Nothing to compare, an unmapped range, or ranges that differ', cells: columns.map(col => cell(col.id, p => p.complete - p.compared)), unlisted: CLASSIFICATION_UNLISTED },
      ],
    },
  ];
  const queued = peerReviews;
  const notCompared = [...per.values()].reduce((n, p) => Math.max(n, p.notCompared), 0);
  return {
    state: 'recorded',
    title: 'Where the ranges differ',
    description: `${PRODUCT} against each peer, input by input. Peers are columns here, and ${PRODUCT} is the reference every row is read from.`,
    rowHeader: 'What was compared',
    cellMeaning: copy.cellMeaning,
    columns,
    groups,
    unscored: {
      title: 'Differences are review evidence',
      text: `${int(queued)} comparisons recorded a difference and are queued for review.${notCompared ? ` Up to ${int(notCompared)} inputs were not compared for a peer that did not complete them.` : ''} Which tool is right is not decided here.`,
    },
    caption: 'Differences between redact-secret and each peer',
    detail: `A count opens the comparisons behind it, from this run only. A zero has none to open. Which tool is right is decided in the review ledger (${REVIEW_LEDGER}), never on these pages.`,
  };
}

function holdoutRecorded(q: QualificationEvidence): MethodRecordedData {
  const copy = METHOD_COPY.holdout;
  const h = q.holdout;
  const columns: EvidenceColumn[] = h.scanners.map(s => ({ id: s.id, name: toolName(s.id), ...(s.version ? { version: s.version } : {}) }));
  const cellFor = (s: QualificationEvidence['holdout']['scanners'][number], counts: { pass: number; fail: number; 'review-required': number } | undefined): EvidenceCell => {
    if (s.status !== 'complete') return { kind: 'not-measured' };
    if (!counts) return { kind: 'none' };
    const scored = counts.pass + counts.fail;
    return scored > 0 ? { kind: 'count', value: int(counts.fail), of: int(scored) } : counts['review-required'] > 0 ? { kind: 'unscored', of: int(counts['review-required']) } : { kind: 'none' };
  };
  const strata = [...new Set(h.scanners.flatMap(s => Object.keys(s.byStratum)))].sort();
  const groups: EvidenceGroup[] = [
    {
      label: '',
      rows: strata.map(key => {
        const [kind, tier] = key.split(':');
        return { key, label: `${titleCase(kind)}, tier ${tier}`, cells: h.scanners.map(s => cellFor(s, s.byStratum[key])) };
      }),
    },
  ];
  const needsReview = h.scanners.some(s => s.assertions['review-required'] > 0);
  return {
    state: 'recorded',
    title: 'What the holdout run recorded',
    description: `${titleCase(q.status)} (${q.scope}), run ${q.runId.slice(0, 8)} on ${isoDate(q.finishedAt)}. It records that the infrastructure executed its contract. It makes no detection-quality or support claim.`,
    rowHeader: 'Stratum',
    cellMeaning: copy.cellMeaning,
    columns,
    groups,
    ...(needsReview ? { unscored: { title: 'Needs review', text: 'Some checks wait for a person and are counted in no row above.' } } : {}),
    caption: 'Holdout checks per scanner and stratum',
  };
}

function holdoutInputs(q: QualificationEvidence): MethodInputsData {
  const h = q.holdout;
  const short = (v: string) => v.slice(0, 12);
  return {
    state: 'recorded',
    title: 'The corpus and the candidate',
    description: 'A holdout case cannot be opened. These are the aggregate facts the report publishes.',
    tables: [],
    facts: [
      { term: 'Corpus', description: `${h.corpus.id}, revision ${h.corpus.revision}` },
      { term: 'Purpose', description: h.corpus.purpose },
      { term: 'Lifecycle', description: h.corpus.lifecycle },
      { term: 'Independence', description: h.independence },
      { term: 'Methodology', description: h.methodology },
      { term: 'Cases', description: `${count(h.caseCount, 'case')}, ${count(h.variantCount, 'variant')}, ${count(h.generationErrors, 'generation error')}` },
      { term: 'Plan', description: short(h.planHash) },
    ],
    provenance: {
      summary: 'Full hashes of the corpus, the plan and the candidate',
      text: JSON.stringify({ corpusHash: h.corpus.corpusHash, seedHash: h.corpus.seedHash, planHash: h.planHash, candidate: h.candidate }, null, 2),
    },
  };
}

// ---- The page -------------------------------------------------------------------------------------

function metaFor(report: EvaluationSummary): MetaItem[] {
  const product = report.scanners.find(s => s.id === PRODUCT);
  return [
    { label: 'Run', value: `${report.runId.slice(0, 8)} · ${isoDate(report.finishedAt)}` },
    ...(product ? [{ label: PRODUCT, value: `${product.version ?? 'version not recorded'} · ${product.mode}` }] : []),
    { label: 'Accounting', value: `v${report.accountingVersion}` },
  ];
}

function holdoutFigures(q: QualificationEvidence): { term: string; description: string }[] {
  return [{ term: 'Cases', description: int(q.holdout.caseCount) }, { term: 'Variants', description: int(q.holdout.variantCount) }, { term: 'Scanners', description: int(q.holdout.scanners.length) }];
}

function figuresFor(id: Exclude<MethodId, 'holdout'>, report: EvaluationSummary, cases: EvaluationCase[]): { term: string; description: string }[] {
  const suites = new Set(cases.map(suiteOf)).size;
  const transformed = cases.reduce((n, c) => n + c.variants.filter(v => !isIdentity(v) && v.operator !== 'authored.twin').length, 0);
  const operators = new Set(cases.flatMap(c => c.variants.filter(v => !isIdentity(v) && v.operator !== 'authored.twin').map(v => v.operator))).size;
  const unit = METHOD_COPY[id].unit;
  const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  switch (id) {
    case 'twin': return [{ term: title(unit.other), description: int(cases.length) }, { term: 'Texts', description: int(cases.reduce((n, c) => n + c.variants.length, 0)) }, { term: 'Suites', description: int(suites) }];
    case 'benign': return [{ term: title(unit.other), description: int(cases.length) }, { term: 'Taxonomies', description: int(new Set(cases.map(c => c.taxonomy)).size) }, { term: 'Suites', description: int(suites) }];
    case 'differential': return [{ term: title(unit.other), description: int(cases.length) }, { term: 'Peers', description: int(report.scanners.filter(s => s.id !== PRODUCT).length) }, { term: 'Suites', description: int(suites) }];
    default: return [{ term: title(unit.other), description: int(cases.length) }, { term: id === 'mutation' ? 'Altered values' : 'Transformed texts', description: int(transformed) }, { term: 'Operators', description: int(operators) }];
  }
}

function recordedFor(id: Exclude<MethodId, 'holdout' | 'differential'>, report: EvaluationSummary, cases: EvaluationCase[]): MethodRecordedData {
  const copy = METHOD_COPY[id];
  const columns = columnsOf(report);
  let groups: EvidenceGroup[];
  let title: string;
  let description: string;
  let rowHeader = 'Check';
  let unscored: MethodRecordedData['unscored'];
  groups = tallyRows(report, cases, columns, classifierFor(id, report), id);
  switch (id) {
    case 'twin':
      title = 'Do the pairs come apart?';
      description = 'One row for the pair and one for each side, per scanner.';
      break;
    case 'benign': {
      groups.push(...untargetedActions(report, cases, columns));
      title = 'Which controls were flagged?';
      description = 'Controls by taxonomy, per scanner. Findings are not counted, only whether a control was flagged.';
      rowHeader = 'Taxonomy';
      break;
    }
    case 'metamorphic':
      title = 'Does detection survive a change of context?';
      description = 'One row per transform, then the transformed text read on its own.';
      rowHeader = 'Transform';
      break;
    default:
      title = 'Does detection survive an altered value?';
      description = 'Only values that still match the format contract are scored. One row per operator.';
      rowHeader = 'Operator';
      break;
  }
  if (id === 'twin' || id === 'metamorphic') {
    const n = unscoredCases(cases);
    if (n > 0) unscored = { title: 'Needs review', text: `${count(n, METHOD_COPY[id].unit.one)} ${n === 1 ? 'has' : 'have'} a side whose expected outcome is unresolved (tier T0). ${n === 1 ? 'It is' : 'They are'} counted in no row above.` };
  }
  if (id === 'mutation') {
    const deferred = cases.reduce((n, c) => n + c.variants.filter(v => v.expectationEffect === 'defer').length, 0);
    if (deferred > 0) unscored = { title: 'Needs review', text: `${count(deferred, 'altered value')} no longer match the format contract. Their expectation is deferred, so they are counted in no row above.` };
  }
  return { state: 'recorded', title, description, rowHeader, cellMeaning: copy.cellMeaning, columns, groups, ...(unscored ? { unscored } : {}), caption: `${copy.name}: checks that did not hold, per scanner`, detail: CHECKS_DETAIL };
}

/** What a count opens, said once under every tallied table (#623). */
const CHECKS_DETAIL = 'A count opens the checks behind it: the ones that did not hold, from this run only. "Needs review" opens the checks that wait for a person. A zero has none to open, and a scanner that did not run has none to list.';

const UNTARGETED_UNLISTED = 'Not listed: these controls are the untargeted taxonomy rows above, split by the action a finding carried. Open a count there.';

/** Untargeted real-world-shaped controls, split by the policy action a finding carried (#95): only a scanner that reports an action has numbers here. */
function untargetedActions(report: EvaluationSummary, benign: EvaluationCase[], columns: EvidenceColumn[]): EvidenceGroup[] {
  const cases = benign.filter(c => c.taxonomy.startsWith('realworld-'));
  if (cases.length === 0) return [];
  const complete = new Map(report.scanners.map(s => [s.id, s.status === 'complete']));
  const per = new Map<string, { controls: number; flagged: number; gating: number; actions: boolean }>();
  for (const c of cases) {
    for (const f of c.findings) {
      const p = per.get(f.scanner) ?? { controls: 0, flagged: 0, gating: 0, actions: false };
      per.set(f.scanner, p);
      p.controls++;
      const names = Object.keys(f.actionCounts ?? {});
      if (names.length) p.actions = true;
      if (f.flagged) { p.flagged++; if (names.some(n => n === 'redact' || n === 'block')) p.gating++; }
    }
  }
  const cell = (id: string, value: (p: { controls: number; flagged: number; gating: number }) => number): EvidenceCell => {
    const p = per.get(id);
    if (!complete.get(id)) return { kind: 'not-measured' };
    return p && p.actions ? { kind: 'count', value: int(value(p)), of: int(p.controls) } : { kind: 'none' };
  };
  return [{
    label: 'Untargeted, by policy action',
    rows: [
      { key: 'gating', label: 'Flagged with redact or block', note: 'Only a scanner that reports a policy action has a count here', cells: columns.map(c => cell(c.id, p => p.gating)), unlisted: UNTARGETED_UNLISTED },
      { key: 'warn', label: 'Flagged with warn only', note: 'Accepted by the product policy on ordinary prose', cells: columns.map(c => cell(c.id, p => p.flagged - p.gating)), unlisted: UNTARGETED_UNLISTED },
    ],
  }];
}

function inputsFor(id: Exclude<MethodId, 'holdout'>, report: EvaluationSummary, cases: EvaluationCase[], suites: Map<string, string>): MethodInputsData {
  const copy = METHOD_COPY[id];
  const suiteTable = suitesTable(report, cases, suites, copy.unit);
  const tables: MethodInputsData['tables'] = [{ title: 'Suites', description: 'Every case comes from a published suite. Open a suite to read its fixtures.', summary: `Show the ${count(suiteTable.rows.length, 'suite')}`, table: suiteTable }];
  if (id === 'mutation' || id === 'metamorphic') {
    tables.push({
      title: 'Operators',
      description: id === 'mutation'
        ? 'Generated counts exclude the unaltered source. Deferred values no longer match the format contract. Not applicable means the operator could not be applied to that source.'
        : 'Generated counts exclude the unaltered source. Not applicable means the operator could not be applied to that source.',
      table: operatorsTable(report, cases, op => op === 'authored.twin', id === 'mutation'),
    });
  }
  return { state: 'recorded', title: 'Where the cases come from', description: `${count(cases.length, copy.unit.one, copy.unit.other)} read by this method. Synthetic content only.`, tables };
}

const crumbs = (name: string) => [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Methods', href: methodHref('twin') }, { label: name }];

/** One method page: the same sections in the same order for every method. */
export function resolveMethodPage(id: MethodId, input: MethodInput): MethodPageProps {
  const copy = METHOD_COPY[id];
  const common = {
    switchLabel: 'Evaluation methods',
    switcher: METHOD_IDS.map(m => ({ label: METHOD_COPY[m].name, href: methodHref(m) })),
    currentHref: methodHref(id),
    crumbs: crumbs(copy.name),
    eyebrow: 'EVALUATION METHOD',
    title: copy.name,
    lede: copy.lede,
    read: { title: `Reading ${copy.name.toLowerCase()}`, rules: copy.read },
  };
  const steps = [{ label: 'Input', text: copy.input }, { label: 'Change', text: copy.change }, { label: 'Check', text: copy.check }];
  const how = (figures: { term: string; description: string }[]) => ({ title: copy.question, steps, figures });

  if (id === 'holdout') {
    const q = input.qualification;
    if (q.state !== 'recorded') {
      const missing = notMeasured('Not measured: no holdout aggregate', `${q.reason} Holdout is not part of ordinary discovery. Under the new authority the publication measures no qualification: this page reads the frozen report committed at docs/specs/qualification/engine-v1.json.`, QUALIFY_COMMANDS);
      return { ...common, meta: [{ value: 'Not measured' }], how: how([]), recorded: missing, inputs: missing };
    }
    const meta: MetaItem[] = [
      { label: 'Qualification run', value: `${q.report.runId.slice(0, 8)} · ${isoDate(q.report.finishedAt)}` },
      { label: 'Source', value: q.source === 'run' ? 'Published with the evaluation' : 'Frozen report in the repository' },
    ];
    return { ...common, meta, how: how(holdoutFigures(q.report)), recorded: holdoutRecorded(q.report), inputs: holdoutInputs(q.report) };
  }

  const report = input.report;
  if (!report || !input.casesOf) {
    const missing = notMeasured('Not measured: no evaluation published', `${input.reason ?? 'No evaluation was published for this checkout.'} Method pages read the evaluation bundle (public/results/evaluation-bundle-v1.json).`);
    return { ...common, meta: [{ value: 'Not measured' }], how: how([]), recorded: missing, inputs: missing };
  }
  const cases = input.casesOf(id);
  return {
    ...common,
    meta: metaFor(report),
    how: how(figuresFor(id, report, cases)),
    recorded: id === 'differential' ? differentialRecorded(report, cases, input.peerReviews ?? 0) : recordedFor(id, report, cases),
    inputs: inputsFor(id, report, cases, input.suites),
  };
}
