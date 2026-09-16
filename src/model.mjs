/** Pure catalog and report projections shared by the UI and tests. */
export const fixtureSlug = (category, id) => `${category}--${id}`;

export function buildCatalog(categories, corpora, assignments, detectors) {
  const known = new Set(detectors.map(d => d.id));
  if (known.size !== detectors.length || categories.some(c => known.has(c.id))) throw new Error('Detector and case IDs must be unique');
  if ([...detectors, ...categories].some(item => !/^[a-z0-9-]+$/.test(item.id))) throw new Error('IDs must be URL-safe');
  const fixtures = categories.flatMap(category => corpora[category.id].fixtures.map(f => {
    if (!/^[a-z0-9-]+$/.test(f.id)) throw new Error('Fixture IDs must be URL-safe');
    const slug = fixtureSlug(category.id, f.id);
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
  if (path === '/methodology') return { kind: 'methodology', id: '' };
  const match = /^\/(benchmark|fixture)\/([a-z0-9-]+)$/.exec(path);
  return match ? { kind: match[1], id: match[2] } : { kind: 'missing', id: '' };
}

// Never join a report's ranges to different fixture bytes.
export function reportProblem(report, category, hash, fixtures) {
  if (!report || report.schemaVersion !== 1 || report.category !== category || !Array.isArray(report.scanners)) return 'Missing or invalid report';
  if (report.corpusHash !== hash) return 'Stale report: fixture corpus changed';
  const source = fixtures.filter(f => f.category === category);
  for (const scanner of report.scanners) {
    if (scanner.status !== 'complete') continue;
    if (!Array.isArray(scanner.rows) || scanner.rows.length !== source.length || new Set(scanner.rows.map(r => r.id)).size !== source.length) return 'Invalid report rows';
    for (const f of source) {
      const row = scanner.rows.find(r => r.id === f.id);
      if (!row || row.path !== f.path || JSON.stringify(row.expected) !== JSON.stringify(f.expected.map(({start,end}) => ({start,end})))) return 'Report ground truth does not match fixture';
    }
  }
  return null;
}

export function summarize(fixtures, reports) {
  const selected = new Set(fixtures.map(f => f.slug));
  const groups = new Map();
  for (const report of reports) for (const scanner of report.scanners) {
    // Different versions, modes, dependencies or matching protocols are separate observations.
    const key = JSON.stringify([scanner.id, scanner.version, scanner.mode, report.lockHash, report.matching]);
    if (!groups.has(key)) groups.set(key, { ...scanner, lockHash: report.lockHash, matching: report.matching, rows: [], tp: 0, fp: 0, fn: 0, tn: 0, sources: [], statuses: [] });
    const group = groups.get(key);
    group.statuses.push(scanner.status);
    group.sources.push(report.category);
    if (scanner.status !== 'complete') continue;
    for (const row of scanner.rows ?? []) {
      const slug = fixtureSlug(report.category, row.id);
      if (!selected.has(slug)) continue;
      group.rows.push({ ...row, slug });
      for (const count of ['tp', 'fp', 'fn', 'tn']) group[count] += row[count];
    }
  }
  return [...groups.values()].map(g => ({ ...g,
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
