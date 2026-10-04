/**
 * Export the triage queue of the adopted evidence snapshot (#698): the core non-exact positives and flagged controls of the added cases, the unsettled
 * gate-peer differential occurrences and the reference scanner's failed metamorphic and mutation assertions on added cases, keyed by case semantic id,
 * method and operator, occurrence id and scanner, configuration and product identity, deduplicated by root cause with every occurrence kept.
 *
 *   node scripts/official-run-archive.mjs fetch --out <dir>                     the archived official artifacts, verified against the registry
 *   node scripts/fetch-pinned-public-snapshot.mjs --out <snapshot dir>          the pinned snapshot, verified
 *   node --import tsx scripts/export-triage-queue.ts --artifacts <dir> --snapshot <snapshot dir>/credential-eval-corpus-snapshot.json \
 *     [--report docs/generated/evidence-adoption/<tag>.json] [--comparison docs/generated/evidence-adoption/<tag>.comparison.json] \
 *     [--out-json docs/generated/evidence-adoption/<tag>.triage-queue.json] [--out-md ...]
 *
 * This is an export, not a decision: it classifies nothing, settles no review-ledger entry and restores no status (benchmarks/qualification/triage-queue.ts).
 * Deterministic: the same artifacts and snapshot write the same bytes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildTriageQueue } from '../benchmarks/qualification/triage-queue.ts';
import { readRunArtifact } from '../benchmarks/qualification/run-artifact.ts';
import { sha256Digest } from '../benchmarks/qualification/canonical.ts';

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const need = (name: string) => option(name) ?? (() => { throw new Error(`--${name} is required`); })();
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const record = readJson(option('record') ?? 'benchmarks/evidence-adoption.json').candidate;
const registry = readJson('benchmarks/official-runs.json');
const report = readJson(option('report') ?? record.changeReport);
const comparison = readJson(option('comparison') ?? record.changeReport.replace(/\.json$/, '.comparison.json'));
const dir = path.resolve(need('artifacts'));
const snapshot = readJson(need('snapshot'));

const plain = readRunArtifact(readFileSync(path.join(dir, 'public-evidence-snapshot/artifact.json')));
const methods = readRunArtifact(readFileSync(path.join(dir, 'public-evidence-snapshot/methods/artifact.json')), { forceBytes: true });
// Fail closed: the artifacts are the registry's canonical runs of the pinned snapshot, and the snapshot is the one they ran on.
const recorded = (kind: string) => registry.runs.find((r: { population: string; kind?: string; canonical?: boolean }) => r.population === 'public-evidence-snapshot' && (r.kind ?? 'plain') === kind && r.canonical);
for (const [label, read, kind] of [['plain', plain, 'plain'], ['methods', methods, 'methods']] as const) {
  const run = recorded(kind);
  if (!run || run.artifact.semanticDigest !== read.semanticDigest) throw new Error(`The ${label} artifact has semantic digest ${read.semanticDigest}; the registry records ${run?.artifact.semanticDigest ?? 'no canonical run'}`);
  if (read.artifact.manifest.evidence.corpus_digest !== snapshot.identity.corpus_digest) throw new Error(`The ${label} artifact ran corpus ${read.artifact.manifest.evidence.corpus_digest}, the snapshot is ${snapshot.identity.corpus_digest}`);
}
if (snapshot.identity.corpus_digest !== record.snapshotDigest) throw new Error(`The snapshot is corpus ${snapshot.identity.corpus_digest}, the adoption record names ${record.snapshotDigest}`);

const policy = readJson('benchmarks/support/population-policy.json');
const moved = comparison.reviewStateEffect?.movedOutOfNotAssertable?.byKindAndTier ?? {};
const movedControls = Object.entries(moved).filter(([k]) => k.startsWith('must-not-flag')).reduce((n, [, c]) => n + (c as number), 0);
const queue = buildTriageQueue({
  source: { evidenceRelease: record.evidenceRelease, corpusDigest: record.snapshotDigest, manifestDigest: record.manifestDigest, ciRun: record.replay?.ciRun, archiveRelease: record.replay?.archive?.release, archiveSha256: record.replay?.archive?.sha256 },
  plain, methods, snapshotCases: snapshot.cases, addedIds: report.diff.added, maintainerOnlyIds: report.reviewState?.candidate?.maintainerOnlyFixtureIds ?? [],
  unsettledGate: comparison.methods.unsettledGateOccurrences.items, reference: registry.methodsRun.reference, gatePeers: policy.methods.differential.peers,
  disclosure: {
    maintainerOnlyFixtures: report.reviewState?.candidate?.fixtures?.maintainerOnly ?? 0, independentlyReviewed: report.reviewState?.candidate?.fixtures?.reviewed ?? 0,
    newlyScoredPositives: Object.values(moved as Record<string, number>).reduce((n, c) => n + c, 0) - movedControls, newlyScoredControls: movedControls,
  },
});
// One root cause per line: a review diff reads a root cause, not a nested occurrence.
const { rootCauses, ...head } = queue;
const text = `${JSON.stringify(head, null, 1).replace(/\n}$/, `,\n "rootCauses": [\n${rootCauses.map(r => `  ${JSON.stringify(r)}`).join(',\n')}\n ]\n}`)}\n`;
const out = option('out-json');
if (out) writeFileSync(out, text); else process.stdout.write(text);
if (option('out-md')) writeFileSync(option('out-md')!, renderMarkdown(queue, out ? sha256Digest(text) : null));
console.error(`${queue.summary.rootCauses} root causes, ${queue.summary.occurrences} occurrences: ${JSON.stringify(queue.summary.occurrencesByKind)}`);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderMarkdown(q: any, digest: string | null): string {
  const t = (head: string[], rows: unknown[][]) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');
  const s = q.summary, d = q.disclosure;
  return [
    `# Triage queue: ${q.source.evidenceRelease} (#698)`, '',
    `Generated by \`scripts/export-triage-queue.ts\` from the archived official run ${q.source.ciRun ?? ''} (release \`${q.source.archiveRelease}\`), credential-eval ${q.identity.engine.version}, scanned product \`@redact-secret/core@${q.identity.product.version}\`.${digest ? ` Data: \`${path.basename(out!)}\` (${digest}).` : ''} ${q.note}`, '',
    `**Disclosure: Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기).** ${d.maintainerOnlyFixtures} maintainer-only fixtures, ${d.independentlyReviewed} independently reviewed; ${d.newlyScoredPositives + d.newlyScoredControls} cases newly entered scoring (${d.newlyScoredPositives} positives, ${d.newlyScoredControls} controls), all within the maintainer-only set. ${s.restingOnMaintainerOnly.rootCauses} of ${s.rootCauses} root causes (${s.restingOnMaintainerOnly.occurrences} of ${s.occurrences} occurrences) rest on a seed case the release attributes to a maintainer-only record; ${JSON.stringify(s.restingOnMaintainerOnly.byKind)} by kind. A seed case not attributed is not claimed reviewed.`, '',
    '## Size', '',
    t(['Kind', 'Root causes', 'Occurrences'], Object.keys(s.occurrencesByKind).map(k => [k, s.rootCausesByKind[k], s.occurrencesByKind[k]])), '',
    `Occurrences are not unique defects: one root cause lists every affected variant, peer and operator. ${s.occurrencesOfCommonCases} occurrences are of common cases (unsettled in the accepted baseline too).`, '',
    '## Gate-peer occurrences by product family', '',
    t(['Product family', 'Occurrences'], Object.entries(s.gateOccurrencesByProductFamily).map(([k, c]) => [k, c])), '',
    '## What this is not', '',
    `Nothing is classified (${q.classifications.join(', ')} are the buckets #698 asks for), no ledger entry is settled and no status is restored here. The final attribution to the published beta.13 needs its pinned replay of the same snapshot (#697): these occurrences were measured on beta.12.`, '',
  ].join('\n');
}
