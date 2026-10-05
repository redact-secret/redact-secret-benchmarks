/**
 * Contrast two official (or exploratory) replays of DIFFERENT evidence snapshots by semantic id (#680): every case, assertion and review
 * occurrence present in both is compared by its outcome; a difference is attributed to the evidence change that explains it, and anything
 * the evidence change does not explain is `unexplained` (and `--strict` exits 1). Cases only in the newer run are counted as added, only in
 * the older as removed. A regression is an unexplained difference that makes the newer outcome worse.
 *
 *   node --import tsx scripts/contrast-snapshots.ts --from <dir> --to <dir> --label <text> --explain <explain.json> [--out <json>] [--strict]
 *
 * <dir> holds <population>/artifact.json and public-evidence-snapshot/methods/artifact.json (the layout of an official-runs archive).
 * explain.json: { "<case id>": "<cause>" } for the cases whose evidence changed between the two snapshots (the change reports name them). A
 * methods variant `<case id>--<method>--<variant>` is attributed through its seed case id. Reads only the semantic part of the artifacts.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LARGE_ARTIFACT_BYTES, readRunArtifact } from '../benchmarks/qualification/run-artifact.ts';

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const need = (name: string) => option(name) ?? (() => { throw new Error(`--${name} is required`); })();
const from = path.resolve(need('from')), to = path.resolve(need('to'));
const explain: Record<string, string> = JSON.parse(readFileSync(need('explain'), 'utf8'));
type A = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const load = (file: string): A => readRunArtifact(readFileSync(file), { forceBytes: statSync(file).size > LARGE_ARTIFACT_BYTES }).artifact;
const j = (v: unknown) => JSON.stringify(v);
const seedOf = (id: string) => id.split('--').slice(0, 2).join('--');
const causeOf = (id: string) => explain[id] ?? explain[seedOf(id)];
const rank = (o: A) => {
  const m = o?.measurement;
  if (!m) return 0;
  if (m.type === 'positive') return (m.span_outcomes ?? []).every((x: string) => x === 'EXACT') && (m.collateral_bytes ?? 0) === 0 ? 3 : (m.span_outcomes ?? []).some((x: string) => x === 'EXACT') ? 2 : 1;
  if (m.type === 'control') return m.flagged ? 1 : 3;
  return 0;
};

interface Diff { population: string; scanner: string; kind: string; id: string; before: unknown; after: unknown; cause: string | null; regression: boolean }
const diffs: Diff[] = [];
const counts: Record<string, Record<string, number>> = {};
const bump = (population: string, what: string) => { counts[population] ??= {}; counts[population][what] = (counts[population][what] ?? 0) + 1; };
const assertionKey = (s: A) => [s.case_id, s.method, s.baseline ?? '', s.candidate ?? '', s.assertion, s.variant ?? ''].join('|');
const passed = (s: A) => s.status === 'pass';

function compare(population: string, a: A, b: A) {
  const scanners = new Set<string>([...a.scanners.map((s: A) => s.scanner), ...b.scanners.map((s: A) => s.scanner)]);
  for (const name of scanners) {
    const sa = a.scanners.find((s: A) => s.scanner === name), sb = b.scanners.find((s: A) => s.scanner === name);
    if (!sa || !sb) { diffs.push({ population, scanner: name, kind: 'scanner', id: name, before: !!sa, after: !!sb, cause: null, regression: false }); continue; }
    const ca = new Map<string, A>(sa.cases.map((c: A) => [c.case_id, c])), cb = new Map<string, A>(sb.cases.map((c: A) => [c.case_id, c]));
    for (const [id, y] of cb) {
      const x = ca.get(id);
      if (!x) { bump(population, `case-added:${name}`); continue; }
      bump(population, `case-common:${name}`);
      if (j(x.actual) === j(y.actual) && j(x.measurement) === j(y.measurement) && j(x.expected) === j(y.expected)) continue;
      const cause = causeOf(id);
      diffs.push({ population, scanner: name, kind: 'case', id, before: { expected: x.expected, actual: x.actual, measurement: x.measurement }, after: { expected: y.expected, actual: y.actual, measurement: y.measurement }, cause: cause ?? null, regression: !cause && rank(y) < rank(x) });
    }
    for (const id of ca.keys()) if (!cb.has(id)) bump(population, `case-removed:${name}`);
    const aa = new Map<string, A>(sa.assertions.map((s: A) => [assertionKey(s), s])), ab = new Map<string, A>(sb.assertions.map((s: A) => [assertionKey(s), s]));
    for (const [k, y] of ab) {
      const x = aa.get(k);
      if (!x) { bump(population, `assertion-added:${name}`); continue; }
      bump(population, `assertion-common:${name}`);
      if (j(x) === j(y)) continue;
      const cause = causeOf(k.split('|')[0]);
      diffs.push({ population, scanner: name, kind: 'assertion', id: k, before: x, after: y, cause: cause ?? null, regression: !cause && passed(x) && !passed(y) });
    }
    for (const k of aa.keys()) if (!ab.has(k)) bump(population, `assertion-removed:${name}`);
  }
  const rk = (q: A) => [q.case_id, q.peer, q.disagreement, q.variant, q.content_digest ?? q.contentDigest ?? '', q.method].join('|');
  const ra = new Map<string, A>((a.review_queue ?? []).map((q: A) => [rk(q), q])), rb = new Map<string, A>((b.review_queue ?? []).map((q: A) => [rk(q), q]));
  for (const [k, q] of rb) {
    if (ra.has(k)) { bump(population, 'review-common'); continue; }
    bump(population, 'review-added');
    if (!causeOf(q.case_id)) diffs.push({ population, scanner: String(q.peer ?? ''), kind: 'review-occurrence-added', id: k, before: null, after: { id: q.id }, cause: null, regression: true });
  }
  for (const [k, q] of ra) {
    if (rb.has(k)) continue;
    bump(population, 'review-removed');
    if (!causeOf(q.case_id)) diffs.push({ population, scanner: String(q.peer ?? ''), kind: 'review-occurrence-removed', id: k, before: { id: q.id }, after: null, cause: null, regression: false });
  }
}

const pops: Array<[string, string]> = [['regression-corpus', 'regression-corpus/artifact.json'], ['policy-corpus', 'policy-corpus/artifact.json'], ['public-evidence-snapshot', 'public-evidence-snapshot/artifact.json'], ['public-evidence-snapshot+methods', 'public-evidence-snapshot/methods/artifact.json']];
for (const [population, rel] of pops) {
  const fa = path.join(from, rel), fb = path.join(to, rel);
  if (!existsSync(fa) || !existsSync(fb)) { console.error(`skip ${population}: missing ${!existsSync(fa) ? fa : fb}`); continue; }
  compare(population, load(fa), load(fb));
}
const explained = diffs.filter(d => d.cause), unexplained = diffs.filter(d => !d.cause), regressions = diffs.filter(d => d.regression);
const byCause: Record<string, number> = {};
for (const d of explained) byCause[d.cause!] = (byCause[d.cause!] ?? 0) + 1;
const result = { schema: 'redact-secret/snapshot-contrast/v1', label: option('label') ?? '', counts, differences: diffs.length, explained: explained.length, unexplained: unexplained.length, regressions: regressions.length, byCause, explainedDifferences: explained, unexplainedDifferences: unexplained };
if (option('out')) writeFileSync(option('out')!, `${JSON.stringify(result, null, 1)}\n`);
console.log(JSON.stringify({ label: result.label, differences: result.differences, explained: result.explained, unexplained: result.unexplained, regressions: result.regressions, byCause, counts }, null, 1));
if (args.includes('--strict') && (unexplained.length || regressions.length)) process.exit(1);
