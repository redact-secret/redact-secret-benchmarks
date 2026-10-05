/**
 * Compare two sets of official RunArtifacts of the SAME evidence (#697): where every difference is either an identity field (engine, configuration or product
 * version, integrity and digests, the occurrence ids derived from them) or a per-case outcome, listed by semantic case id. Nothing else may differ: any other
 * path is reported as `unexplained` and `--strict` exits 1.
 *
 *   node --import tsx scripts/compare-replay-effects.ts --from <dir> --to <dir> --label "engine/config effect" [--out <json>] [--strict]
 *
 * <dir> holds <population>/artifact.json (regression-corpus, policy-corpus, public-evidence-snapshot) and public-evidence-snapshot/methods/artifact.json.
 * Reads only the semantic part (`non_semantic` is never read). Arrays are matched by their semantic key (case id, method, assertion; review occurrences by
 * case, peer, disagreement, variant and content digest), never by position or by occurrence id.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readRunArtifact } from '../benchmarks/qualification/run-artifact.ts';

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const from = path.resolve(option('from') ?? (() => { throw new Error('--from is required'); })()), to = path.resolve(option('to') ?? (() => { throw new Error('--to is required'); })());

type J = unknown;
const isObj = (v: J): v is Record<string, J> => !!v && typeof v === 'object' && !Array.isArray(v);
const key = (p: string, e: J, i: number): string => {
  if (!isObj(e)) return String(i);
  if (p === '/scanners') return String(e.scanner);
  if (/^\/scanners\/\*\/cases$/.test(p) || /unmeasured_cases$/.test(p)) return String(e.case_id);
  if (/^\/scanners\/\*\/assertions$/.test(p)) return `${e.case_id}|${e.method}|${e.assertion}|${e.variant ?? ''}`;
  if (p === '/review_queue') return [e.case_id, e.peer, e.disagreement, e.variant, e.content_digest ?? e.contentDigest ?? '', e.method].join('|');
  if (p === '/manifest/scanners' || p === '/manifest/methods') return String(e.id);
  if (/components$/.test(p)) return `${e.kind}:${e.name}`;
  if (p === '/variants') return String(e.id ?? e.case_id ?? i);
  return String(i);
};
// Identity paths: they say which engine, configuration or product build produced the artifact, not what it measured.
const IDENTITY = [
  /^\/manifest\/engine\/version$/, /^\/manifest\/config_hash$/, /^\/manifest\/scanners\/\*\/(version|configuration_hash)$/, /^\/manifest\/scanners\/\*\/provenance\/components\/\*\/(version|sha256|integrity)$/,
  /^\/manifest\/scanners\/\*\/mode$/,
  /^\/manifest\/(run_class|publication)$/, /^\/manifest\/scanners\/\*\/build$/, // an exploratory product candidate against an official control (#698)
  /^\/review_queue\/\*\/(id|reference\/version|reference\/configurationHash|reference\/configuration_hash)$/
];
const OUTCOME = [/^\/scanners\/\*\/aggregates\//, /^\/scanners\/\*\/cases\/\*\/(actual|measurement)(\/|$)/, /^\/scanners\/\*\/assertions\/\*\//, /^\/scanners\/\*\/(unmeasured_cases|findings)(\/|$)/, /^\/scanners\/\*\/status$/, /^\/review_queue\/\*(\(added\)|\(removed\)|\/)/, /^\/variants\//, /^\/comparisons\//];
const norm = (p: string) => p.replace(/\/\d+(?=\/|$)/g, '/*');

interface Diff { path: string; norm: string; case?: string }
function diff(a: J, b: J, p: string, np: string, ctx: { case?: string }, out: Diff[]) {
  if (a === b) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    const ka = new Map(a.map((e, i) => [key(np, e, i), e])), kb = new Map(b.map((e, i) => [key(np, e, i), e]));
    for (const [k, e] of ka) {
      const caseId = isObj(e) && typeof e.case_id === 'string' ? e.case_id : ctx.case;
      if (!kb.has(k)) out.push({ path: `${p}/${k}`, norm: `${np}/*(removed)`, case: caseId });
      else diff(e, kb.get(k), `${p}/${k}`, `${np}/*`, { case: caseId }, out);
    }
    for (const [k, e] of kb) if (!ka.has(k)) out.push({ path: `${p}/${k}`, norm: `${np}/*(added)`, case: isObj(e) && typeof e.case_id === 'string' ? e.case_id : ctx.case });
    return;
  }
  if (isObj(a) && isObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (k === 'non_semantic') continue;
      if (!(k in a) || !(k in b)) out.push({ path: `${p}/${k}`, norm: `${np}/${k}`, case: ctx.case });
      else diff(a[k], b[k], `${p}/${k}`, `${np}/${k}`, ctx, out);
    }
    return;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ path: p, norm: np, case: ctx.case });
}

const files = [['regression-corpus/artifact.json', false], ['policy-corpus/artifact.json', false], ['public-evidence-snapshot/artifact.json', false], ['public-evidence-snapshot/methods/artifact.json', true]] as const;
const result: Record<string, unknown> = {};
let unexplained = 0;
for (const [file, big] of files) {
  const fa = path.join(from, file), fb = path.join(to, file);
  if (!existsSync(fa) || !existsSync(fb)) { result[file] = { skipped: 'missing in one side' }; continue; }
  const A = readRunArtifact(readFileSync(fa), { forceBytes: big }), B = readRunArtifact(readFileSync(fb), { forceBytes: big });
  const out: Diff[] = [];
  diff(A.artifact, B.artifact, '', '', {}, out);
  const identity = new Map<string, number>(), outcome = new Map<string, number>(), other = new Map<string, number>();
  const cases = new Map<string, Set<string>>();
  for (const d of out) {
    const n = norm(d.norm);
    const bucket = IDENTITY.some(r => r.test(n)) ? identity : OUTCOME.some(r => r.test(n)) ? outcome : other;
    bucket.set(n, (bucket.get(n) ?? 0) + 1);
    if (bucket === outcome && d.case) { const s = cases.get(n) ?? new Set(); s.add(d.case); cases.set(n, s); }
  }
  const sorted = (m: Map<string, number>) => Object.fromEntries([...m].sort(([x], [y]) => (x < y ? -1 : 1)));
  unexplained += other.size;
  const outcomeCases = new Set([...cases.values()].flatMap(s => [...s]));
  result[file] = {
    semanticDigests: { from: A.semanticDigest, to: B.semanticDigest, equal: A.semanticDigest === B.semanticDigest },
    differingLeaves: out.length, identityPaths: sorted(identity), outcomePaths: sorted(outcome), unexplainedPaths: sorted(other),
    outcomeCases: outcomeCases.size, outcomeCaseIds: [...outcomeCases].sort().slice(0, 400),
  };
  console.error(`${file}: ${out.length} differing leaves; identity ${[...identity.values()].reduce((x, y) => x + y, 0)}; outcome ${[...outcome.values()].reduce((x, y) => x + y, 0)} (${outcomeCases.size} cases); unexplained paths ${other.size}`);
}
const report = { schema: 'redact-secret/replay-effect-comparison/v1', label: option('label') ?? '', from, to, unexplainedPathGroups: unexplained, populations: result };
if (option('out')) writeFileSync(option('out')!, `${JSON.stringify(report, null, 1)}\n`); else console.log(JSON.stringify(report, null, 1));
if (args.includes('--strict') && unexplained) process.exit(1);
