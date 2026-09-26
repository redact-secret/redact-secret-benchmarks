import { validateAssessment } from '../benchmarks/lib/assessment.ts';
import { groupKey, scoreRow, encodeOutcome, KINDS, TIERS } from '../benchmarks/lib/lattice.ts';
import { ACCOUNTING_VERSION, accountGroups, accountingDelta, validateAccounting } from '../benchmarks/lib/accounting.ts';

/** Pure catalog and report projections shared by the UI and tests. */
export const fixtureSlug = (category, id) => `${category}--${id}`;

export function buildCatalog(categories, corpora, assignments, detectors) {
  const known = new Set(detectors.map(d => d.id));
  if (known.size !== detectors.length || categories.some(c => known.has(c.id))) throw new Error('Detector and case IDs must be unique');
  if ([...detectors, ...categories].some(item => !/^[a-z0-9-]+$/.test(item.id))) throw new Error('IDs must be URL-safe');
  const publishedCategories = categories.filter(category => !category.calibrationOnly);
  const fixtures = publishedCategories.flatMap(category => corpora[category.id].fixtures.map(f => {
    if (!/^[a-z0-9-]+$/.test(f.id)) throw new Error('Fixture IDs must be URL-safe');
    const slug = fixtureSlug(category.id, f.id);
    validateAssessment(f);
    if (!Object.hasOwn(assignments, slug)) throw new Error(`Missing detector classification: ${slug}`);
    if (assignments[slug].some(id => !known.has(id))) throw new Error(`Unknown detector: ${slug}`);
    return { ...f, slug, category: category.id, detectors: assignments[slug] };
  }));
  if (new Set(fixtures.map(f => f.slug)).size !== fixtures.length) throw new Error('Duplicate fixture slug');
  if (Object.keys(assignments).some(slug => !fixtures.some(f => f.slug === slug))) throw new Error('Orphan detector classification');
  return fixtures;
}

const ID = '[a-z0-9-]+';
const METHOD_IDS = ['twin', 'benign', 'metamorphic', 'mutation', 'differential', 'holdout'];
/** One shape for every route so callers never narrow: unused fields are ''. @returns {{ kind: string, id: string, view: string, to: string }} */
const at = (kind, id = '', view = '', to = '') => ({ kind, id, view, to });
const redirect = to => at('redirect', '', '', to);
const MISSING = () => at('missing');

/**
 * Pre-redesign paths. Every one lands on its replacement so no bookmark breaks.
 * `/benchmark/:id` served both detectors and suites; the suite list decides.
 */
function legacyRoute(path, suites) {
  if (path === '/benchmark') return redirect('/report');
  if (path === '/coverage-gaps') return redirect('/coverage');
  if (path === '/methodology') return redirect('/how-to-read');
  // T0 fixtures are one class of the review queue now.
  if (path === '/pending') return redirect('/workbench/review/t0-fixtures');
  if (path === '/evaluation' || path === '/evaluation/reviews' || path === '/evaluation/failures') return redirect('/workbench');
  // Operator evidence sits with the method that generates operator variants.
  if (path === '/evaluation/operators') return redirect('/workbench/method/mutation');
  let match = new RegExp(`^/evaluation/method/(${ID})$`).exec(path);
  if (match) return redirect(`/workbench/method/${match[1]}`);
  match = new RegExp(`^/evaluation/detector/(${ID})$`).exec(path);
  if (match) return redirect(`/coverage/${match[1]}`);
  match = new RegExp(`^/benchmark/(${ID})$`).exec(path);
  if (match) return redirect(suites.includes(match[1]) ? `/suites/${match[1]}` : `/coverage/${match[1]}`);
  return null;
}

/**
 * Route table of the redesign (plan section 03). `publicOnly` is the allowlist
 * flag for a future customer-only build: Workbench paths stop resolving.
 * @param {string} pathname
 * @param {{ suites?: string[], publicOnly?: boolean }} [options]
 */
export function parseRoute(pathname, { suites = [], publicOnly = false } = {}) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return redirect('/report');
  if (path === '/report') return at('report');
  if (path === '/coverage') return at('coverage');
  if (path === '/support') return at('support');
  if (path === '/performance') return at('performance');
  if (path === '/how-to-read') return at('how-to-read');
  const match = new RegExp(`^/(coverage|suites|fixture)/(${ID})$`).exec(path);
  if (match) return at(match[1] === 'suites' ? 'suite' : match[1], match[2]);
  const workbench = new RegExp(`^/workbench(?:/(changes|qualification)|/(review|method)/(${ID}))?$`).exec(path);
  if (workbench) {
    if (publicOnly) return MISSING();
    const view = workbench[1] ?? workbench[2] ?? 'overview', id = workbench[3] ?? '';
    if (view === 'method' && !METHOD_IDS.includes(id)) return MISSING();
    return at('workbench', id, view);
  }
  const legacy = legacyRoute(path, suites);
  if (legacy) return publicOnly && legacy.to.startsWith('/workbench') ? MISSING() : legacy;
  return MISSING();
}

/** Paths the app owns, for intercepting link clicks. */
export const isAppPath = pathname => parseRoute(pathname).kind !== 'missing';

/** Every copy of the site, staging included, names production as canonical; CloudFront's X-Robots-Tag keeps staging out of the index. */
export const CANONICAL_ORIGIN = 'https://benchmarks.redactsecret.dev';
/** Routes are paths alone; a query string only selects a view of the same page, so it stays out of the canonical URL. */
export const canonicalUrl = pathname => CANONICAL_ORIGIN + (pathname.replace(/\/+$/, '') || '/');

const project = expected => expected.map(({ start, end, role, envelope }) => ({ start, end, role, ...(envelope ? { envelope: { start: envelope.start, end: envelope.end } } : {}) }));
const FORBIDDEN = ['precision', 'recall', 'f1', 'tp', 'fp', 'fn', 'tn', 'contained', 'broader'];
const SCORE_FIELDS = ['spanOutcomes', 'leakedBytes', 'collateralBytes', 'flagged', 'findings', 'coDetected'];

// Never join a report's ranges to different fixture bytes; re-verify every
// row and every group total client-side (docs/specs/measurement-v4.md §3).
export function reportProblem(report, category, hash, fixtures) {
  if (report?.schemaVersion < 5) return 'Legacy report: rerun npm run bench';
  // Reports are only comparable under one accounting version; the block is re-validated, never trusted.
  if (report?.accountingVersion !== ACCOUNTING_VERSION) return 'Report accounting version is not comparable';
  try { validateAccounting(report.accounting); } catch { return 'Invalid accounting configuration'; }
  if (!report || report.schemaVersion !== 5 || report.category !== category || !Array.isArray(report.scanners)) return 'Missing or invalid report';
  if (typeof report.runId !== 'string' || !report.runId) return 'Report has no run id';
  if (report.corpusHash !== hash) return 'Stale report: fixture corpus changed';
  const source = fixtures.filter(f => f.category === category);
  for (const scanner of report.scanners) {
    if (scanner.status !== 'complete') continue;
    if (FORBIDDEN.some(k => scanner[k] != null)) return 'Scanner-wide totals are not allowed';
    if (!Array.isArray(scanner.rows) || scanner.rows.length !== source.length || new Set(scanner.rows.map(r => r.id)).size !== source.length) return 'Invalid report rows';
    for (const f of source) {
      const row = scanner.rows.find(r => r.id === f.id);
      if (!row || row.path !== f.path || JSON.stringify(row.expected) !== JSON.stringify(project(f.expected))) return 'Report ground truth does not match fixture';
      if (row.kind !== f.assessment.kind || row.tier !== f.assessment.tier || (row.contract ?? null) !== (f.assessment.contract ?? null) || (row.twinOf ?? null) !== (f.twinOf ?? null)) return 'Report assessment does not match fixture';
      if (!Array.isArray(row.actual)) return 'Invalid report ranges';
      const boundaries = new Set([0]); let offset = 0;
      for (const char of f.content) { offset += new TextEncoder().encode(char).length; boundaries.add(offset); }
      if (row.actual.some(a => !a || !Number.isInteger(a.start) || !Number.isInteger(a.end) || a.start >= a.end || !boundaries.has(a.start) || !boundaries.has(a.end))) return 'Invalid report ranges';
      if (new Set(row.actual.map(a => `${a.start}:${a.end}`)).size !== row.actual.length) return 'Duplicate report ranges';
      if (FORBIDDEN.some(k => row[k] != null)) return 'Exact-range scores on rows are not allowed';
      if (f.assessment.tier === 'T0') {
        if (SCORE_FIELDS.some(k => row[k] != null)) return 'Pending fixture must not be scored';
        continue;
      }
      const expected = scoreRow(row.expected, row.actual, row.twinOf ? row.contract : undefined);
      for (const k of SCORE_FIELDS) if (JSON.stringify(row[k] ?? null) !== JSON.stringify(expected[k] ?? null)) return 'Row outcome does not recompute';
    }
    const groups = accountGroups(scanner.rows, report.accounting);
    if (JSON.stringify(scanner.groups) !== JSON.stringify(groups)) return 'Group totals do not recompute from rows';
    if (JSON.stringify(scanner.accountingDelta) !== JSON.stringify(accountingDelta(scanner.rows, report.accounting))) return 'Accounting delta does not recompute from rows';
    if (JSON.stringify(groups).includes('"precision"')) return 'Rates other than v4 headline metrics are not allowed';
  }
  return null;
}

/** The run every cross-suite aggregation is restricted to. */
export function newestRunId(reports, run) {
  if (run?.runId) return run.runId;
  return reports.map(r => r.runId).filter(Boolean).sort().at(-1) ?? null;
}

/**
 * Aggregate the selected fixtures' rows per group and scanner identity.
 * Reports from a different run id are listed as stale, never summed.
 */
export function summarize(fixtures, reports, runId = newestRunId(reports)) {
  const selected = new Map(fixtures.map(f => [f.slug, f]));
  const groups = new Map();
  const stale = [];
  for (const report of reports) {
    if (runId && report.runId !== runId) { stale.push(report.category); continue; }
    for (const scanner of report.scanners) {
      const rows = (scanner.status === 'complete' ? scanner.rows ?? [] : []).flatMap(row => {
        const slug = fixtureSlug(report.category, row.id);
        const f = selected.get(slug);
        if (!f || f.category !== report.category) return [];
        return [{ ...row, id: slug, slug, category: report.category, twinOf: row.twinOf ? fixtureSlug(report.category, row.twinOf) : undefined }];
      });
      const relevant = fixtures.filter(f => f.category === report.category);
      for (const key of new Set(relevant.map(f => groupKey(f.assessment.kind, f.assessment.tier)))) {
        // Different versions, modes, dependencies or matching protocols are separate observations.
        const id = JSON.stringify([key, scanner.id, scanner.version, scanner.mode, report.lockHash, report.matching]);
        if (!groups.has(id)) groups.set(id, { accounting: report.accounting, key, kind: key.split('/')[0], tier: key.split('/')[1], scanner: scanner.id, name: scanner.name, version: scanner.version, mode: scanner.mode, lockHash: report.lockHash, matching: report.matching, runId, selectedCount: 0, rows: [], sources: [], statuses: [], reviews: [] });
        const g = groups.get(id);
        g.selectedCount += relevant.filter(f => groupKey(f.assessment.kind, f.assessment.tier) === key).length;
        g.statuses.push(scanner.status);
        g.reviews.push(report.reviewStatus);
        g.sources.push(report.category);
        g.rows.push(...rows.filter(r => groupKey(r.kind, r.tier) === key));
      }
    }
  }
  const summaries = [...groups.values()].map(g => {
    // Twins live in the same suite as their positive; aggregate over every selected row of that suite.
    const allRows = reports.filter(r => r.runId === g.runId && g.sources.includes(r.category)).flatMap(r => (r.scanners.find(s => s.id === g.scanner && s.version === g.version && s.status === 'complete')?.rows ?? []).map(row => ({ ...row, id: fixtureSlug(r.category, row.id), twinOf: row.twinOf ? fixtureSlug(r.category, row.twinOf) : undefined })));
    const own = new Set(g.rows.map(r => r.id));
    // Selected T0 rows stay beside the group they are absent from, so measurableShare survives a filtered view.
    const pending = new Set([...groups.values()].filter(p => p.key === 'pending/T0' && p.scanner === g.scanner && p.version === g.version && p.mode === g.mode).flatMap(p => p.rows.map(r => r.id)));
    const metrics = accountGroups(allRows.filter(r => own.has(r.id) || pending.has(r.id) || (r.twinOf && own.has(r.twinOf))), g.accounting)[g.key] ?? null;
    return { ...g, metrics };
  });
  return { summaries, stale: [...new Set(stale)], runId };
}

export const outcomeCode = row => encodeOutcome(row);

/** Rows that carry signal: changed since the baseline, or not clean. */
export function rowSignal(row, baselineOutcome) {
  if (!row) return { changed: false, clean: null };
  const current = encodeOutcome(row);
  const changed = baselineOutcome !== undefined && baselineOutcome !== current;
  const clean = row.spanOutcomes ? row.spanOutcomes.every(o => o === 'EXACT' || o === 'COVERED') : row.flagged != null ? !row.flagged : null;
  return { changed, clean };
}

export function contentSegments(content, ranges) {
  const bytes = new TextEncoder().encode(content);
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const segments = [];
  let cursor = 0;
  for (const range of ranges) {
    segments.push({ text: decoder.decode(bytes.slice(cursor, range.start)), highlighted: false });
    segments.push({ text: decoder.decode(bytes.slice(range.start, range.end)), highlighted: true });
    cursor = range.end;
  }
  segments.push({ text: decoder.decode(bytes.slice(cursor)), highlighted: false });
  return segments;
}

export { KINDS, TIERS, groupKey };
