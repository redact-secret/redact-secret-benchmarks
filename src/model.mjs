import { containment } from "../benchmarks/lib/containment.mjs";
import { cohorts, validateAssessment } from '../benchmarks/lib/cohorts.mjs';

/** Pure catalog and report projections shared by the UI and tests. */
export const fixtureSlug = (category, id) => `${category}--${id}`;

export function buildCatalog(categories, corpora, assignments, detectors) {
  const known = new Set(detectors.map(d => d.id));
  if (known.size !== detectors.length || categories.some(c => known.has(c.id))) throw new Error('Detector and case IDs must be unique');
  if ([...detectors, ...categories].some(item => !/^[a-z0-9-]+$/.test(item.id))) throw new Error('IDs must be URL-safe');
  const fixtures = categories.flatMap(category => corpora[category.id].fixtures.map(f => {
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

export function parseRoute(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/benchmark') return { kind: 'overview', id: '' };
  if (path === '/coverage-gaps') return { kind: 'coverage-gaps', id: '' };
  if (path === '/methodology') return { kind: 'methodology', id: '' };
  const match = /^\/(benchmark|fixture)\/([a-z0-9-]+)$/.exec(path);
  return match ? { kind: match[1], id: match[2] } : { kind: 'missing', id: '' };
}

// Never join a report's ranges to different fixture bytes.
export function reportProblem(report, category, hash, fixtures) {
  if (report?.schemaVersion < 3) return 'Legacy mixed-score report: rerun npm run bench';
  if (!report || report.schemaVersion !== 3 || report.category !== category || !Array.isArray(report.scanners)) return 'Missing or invalid report';
  if (report.corpusHash !== hash) return 'Stale report: fixture corpus changed';
  const source = fixtures.filter(f => f.category === category);
  for (const scanner of report.scanners) {
    if (scanner.status !== 'complete') continue;
    if (!Array.isArray(scanner.rows) || scanner.rows.length !== source.length || new Set(scanner.rows.map(r => r.id)).size !== source.length) return 'Invalid report rows';
    const totals = Object.fromEntries(Object.keys(cohorts).map(id => [id, { fixtureCount: 0, expectedCount: 0, tp: 0, fp: 0, fn: 0, tn: 0, contained: 0, broader: 0 }]));
    for (const f of source) {
      const row = scanner.rows.find(r => r.id === f.id);
      if (!row || row.path !== f.path || JSON.stringify(row.expected) !== JSON.stringify(f.expected.map(({start,end}) => ({start,end})))) return 'Report ground truth does not match fixture';
      if (JSON.stringify(row.assessment) !== JSON.stringify(f.assessment)) return 'Report assessment does not match fixture';
      if (!Array.isArray(row.actual)) return 'Invalid report ranges';
      const boundaries = new Set([0]); let offset = 0;
      for (const char of f.content) { offset += new TextEncoder().encode(char).length; boundaries.add(offset); }
      if (row.actual.some(a => !a || !Number.isInteger(a.start) || !Number.isInteger(a.end) || a.start >= a.end || !boundaries.has(a.start) || !boundaries.has(a.end))) return 'Invalid report ranges';
      if (new Set(row.actual.map(a => `${a.start}:${a.end}`)).size !== row.actual.length) return 'Duplicate report ranges';
      const t = totals[f.assessment.cohort];
      t.fixtureCount++; t.expectedCount += row.expected.length;
      if (f.assessment.cohort === 'unreviewed') {
        if (['tp', 'fp', 'fn', 'tn', 'contained', 'broader'].some(k => row[k] != null)) return 'Unreviewed fixture must not be scored';
        continue;
      }
      const counts = containment(row.expected, row.actual);
      const tp = row.expected.filter(e => row.actual.some(a => e.start === a.start && e.end === a.end)).length;
      Object.assign(counts, { tp, fp: row.actual.length - tp, fn: row.expected.length - tp, tn: !row.expected.length && !row.actual.length ? 1 : 0 });
      if (row.contained !== counts.contained || row.broader !== counts.broader) return 'Invalid containment counts';
      for (const k of Object.keys(counts)) { if (row[k] !== counts[k]) return 'Invalid exact counts'; t[k] += counts[k]; }
    }
    if (['tp', 'fp', 'fn', 'tn', 'contained', 'broader', 'precision', 'recall', 'f1'].some(k => scanner[k] != null)) return 'Mixed overall scores are not allowed';
    for (const [id, t] of Object.entries(totals)) {
      const actual = scanner.cohorts?.[id];
      if (!actual || actual.fixtureCount !== t.fixtureCount || actual.expectedCount !== t.expectedCount) return 'Invalid cohort totals';
      if (id === 'unreviewed') {
        if (actual.scored !== false || ['tp','fp','fn','tn','contained','broader','precision','recall','f1'].some(k => actual[k] != null)) return 'Unreviewed cohort must not be scored';
      } else {
        if (actual.scored !== true || Object.keys(t).some(k => actual[k] !== t[k])) return 'Invalid cohort totals';
        const precision = t.tp + t.fp ? t.tp / (t.tp + t.fp) : null;
        const recall = t.tp + t.fn ? t.tp / (t.tp + t.fn) : null;
        const f1 = 2*t.tp + t.fp + t.fn ? 2*t.tp / (2*t.tp + t.fp + t.fn) : null;
        if (actual.precision !== precision || actual.recall !== recall || actual.f1 !== f1) return 'Invalid cohort rates';
      }
    }
  }
  return null;
}

export function summarize(fixtures, reports) {
  const selected = new Map(fixtures.map(f => [f.slug, f]));
  const groups = new Map();
  for (const report of reports) for (const scanner of report.scanners) for (const cohort of Object.keys(cohorts)) {
    const relevant = fixtures.filter(f => f.category === report.category && f.assessment.cohort === cohort);
    if (!relevant.length) continue;
    // Different versions, modes, dependencies or matching protocols are separate observations.
    const key = JSON.stringify([cohort, scanner.id, scanner.version, scanner.mode, report.lockHash, report.matching]);
    if (!groups.has(key)) groups.set(key, { ...scanner, cohort, selectedCount: 0, lockHash: report.lockHash, matching: report.matching, rows: [], tp: 0, fp: 0, fn: 0, tn: 0, contained: 0, broader: 0, sources: [], statuses: [], reviews: [] });
    const group = groups.get(key);
    group.selectedCount += relevant.length;
    group.statuses.push(scanner.status);
    group.reviews.push(report.reviewStatus);
    group.sources.push(report.category);
    if (scanner.status !== 'complete') continue;
    for (const row of scanner.rows ?? []) {
      const slug = fixtureSlug(report.category, row.id);
      if (selected.get(slug)?.assessment.cohort !== cohort) continue;
      group.rows.push({ ...row, slug });
      if (cohort === 'unreviewed') continue;
      for (const count of ['tp', 'fp', 'fn', 'tn', 'contained', 'broader']) group[count] += row[count];
    }
  }
  return [...groups.values()].map(g => g.cohort === 'unreviewed' ? { ...g, tp: null, fp: null, fn: null, tn: null, contained: null, broader: null, precision: null, recall: null, f1: null } : ({ ...g,
    precision: g.tp + g.fp ? g.tp / (g.tp + g.fp) : null,
    recall: g.tp + g.fn ? g.tp / (g.tp + g.fn) : null,
    f1: 2*g.tp + g.fp + g.fn ? 2*g.tp / (2*g.tp + g.fp + g.fn) : null,
  }));
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
