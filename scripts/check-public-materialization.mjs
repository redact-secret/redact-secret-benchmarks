/**
 * Compare the public evidence population's legacy generator output with the pinned credential-evidence snapshot (#659).
 *
 *   npm run evidence:materialize          download and verify the pinned snapshot into results-output/evidence-snapshot (gh, read-only)
 *   npm run evidence:public-check         this script, over that directory
 *
 * The generator rules of the public population (`public-evidence-snapshot` in benchmarks/generated-populations.json) are the legacy oracle's input; the
 * canonical source of the same public knowledge is the snapshot. A generated fixture is **kept** when a snapshot case has the same bytes. It is
 * **loss** when no case does: loss fails, because deleting the rule for that fixture would lose it without an explanation. Where the bytes are kept but
 * the span expectation differs the canonical snapshot wins and the difference is reported, never failed (the evidence owners re-review expectations,
 * and the case-by-case attribution is docs/generated/qualification-parity.json). Product populations are not compared: they are not public evidence.
 *
 * This repository measures and records: nothing here asserts a product result, and no count is written to a file.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { categoriesOf, loadPopulations } from '../fixtures/generated/populations.mjs';
import { SNAPSHOT_ASSET } from './evidence-adoption.mjs';
import { pinnedSnapshotProblems } from './fetch-pinned-public-snapshot.mjs';

const sha256 = text => createHash('sha256').update(text).digest('hex');
const spanKey = spans => JSON.stringify(spans.map(s => [s.start, s.end, s.role ?? 'secret']).sort((a, b) => a[0] - b[0] || a[1] - b[1] || String(a[2]).localeCompare(String(b[2]))));

/**
 * Pure. `fixtures`: `{ category, id, content, expected }` of the public population; `cases`: the snapshot's `{ id, content, expected }`.
 * Returns `{ kept, loss, differing }`: counts and the loss and differing entries.
 */
export function materializationReport({ fixtures, cases }) {
  const byContent = new Map();
  for (const c of cases) {
    const key = sha256(c.content);
    if (!byContent.has(key)) byContent.set(key, []);
    byContent.get(key).push(c);
  }
  const loss = [], differing = [];
  let kept = 0;
  for (const f of fixtures) {
    const same = byContent.get(sha256(f.content));
    if (!same) { loss.push({ category: f.category, id: f.id }); continue; }
    kept++;
    const spans = spanKey(f.expected);
    if (!same.some(c => spanKey(c.expected) === spans)) differing.push({ category: f.category, id: f.id, snapshotCases: same.map(c => c.id) });
  }
  return { kept, loss, differing };
}

/** The public population's generated fixtures, from the same build the generator command writes. */
export function publicFixtures(generated, populations = loadPopulations()) {
  const ids = categoriesOf(populations, 'public-evidence-snapshot', Object.keys(generated));
  return ids.flatMap(category => generated[category].fixtures.map(f => ({ category, id: f.id, content: f.content, expected: f.expected })));
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const at = process.argv.indexOf('--snapshot');
  if (at < 0 || !process.argv[at + 1]) throw new Error('Usage: check-public-materialization.mjs --snapshot <dir from evidence:materialize>');
  const dir = path.resolve(process.argv[at + 1]);
  const registry = JSON.parse(readFileSync(new URL('../benchmarks/official-runs.json', import.meta.url), 'utf8'));
  const pin = registry.populations.find(p => p.id === 'public-evidence-snapshot').evidence;
  const manifestBytes = readFileSync(path.join(dir, 'release-manifest.json')), snapshotBytes = readFileSync(path.join(dir, SNAPSHOT_ASSET));
  const pinProblems = pinnedSnapshotProblems({ pin, manifestBytes, snapshotBytes });
  if (pinProblems.length) { console.error(`${dir} is not the pinned snapshot:\n${pinProblems.map(p => `  - ${p}`).join('\n')}`); process.exit(3); }
  const report = materializationReport({ fixtures: publicFixtures(buildCorpora()), cases: JSON.parse(snapshotBytes).cases });
  console.log(`Public population vs ${pin.release.tag}: ${report.kept} generated fixtures have their bytes in the snapshot, ${report.differing.length} with a different span expectation (the snapshot is canonical), ${report.loss.length} with no case.`);
  for (const d of report.differing) console.log(`  differs: ${d.category}/${d.id} (snapshot ${d.snapshotCases.join(', ')})`);
  if (report.loss.length) {
    console.error(`Unexplained fixture loss: the snapshot holds no case with these bytes, so the generator rule cannot be retired for them:\n${report.loss.map(l => `  - ${l.category}/${l.id}`).join('\n')}`);
    process.exit(1);
  }
}
