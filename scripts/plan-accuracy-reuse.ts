/**
 * Plan accuracy-observation reuse for one population before any scan runs (#706, docs/specs/accuracy-reuse.md).
 *
 *   node --import tsx scripts/plan-accuracy-reuse.ts --population <id> --snapshot <credential-eval-corpus-snapshot.json> --platform <linux-x64|darwin-arm64>
 *     [--archive <observations.json> --archive-digest sha256:<bytes> [--source-release <tag>]] [--product-version <v> --product-integrity <sri>]
 *     [--force-fresh <id,id|all>] [--out <dir>]
 *
 * The archive is an engine `--observations-out` file kept immutably; its byte digest must equal `--archive-digest` (a mismatch is a refusal, exit 4). The target is
 * the registry's recorded run for the population and platform, with the product replaced by the candidate when it is given. Writes reuse-plan.{json,md} and prints the
 * engine arguments the plan selects. It reads no score and starts no scan, and never a performance measurement. A plan that reuses anything is for an exploratory
 * (diagnostic) run: the engine refuses `--reuse-observations` for an official one.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sha256Digest } from '../benchmarks/qualification/canonical.ts';
import { inputDigest, planAccuracyReuse, renderReusePlan, PRODUCT_SCANNER, type Archive, type ScannerIdentity, type Target } from '../benchmarks/qualification/accuracy-reuse.ts';

const registry = JSON.parse(readFileSync(new URL('../benchmarks/official-runs.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const fail = (message: string): never => { console.error(`accuracy reuse plan refused: ${message}`); process.exit(4); };

const populationId = option('population') ?? fail('--population is required');
const platform = option('platform') ?? fail('--platform is required');
const snapshotFile = option('snapshot') ?? fail('--snapshot is required');
const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8')) as { identity: { corpus_digest: string }; cases: { path: string; content: string }[] };
const recorded = registry.runs.find((r: { population: string; platform: string; kind?: string }) => r.population === populationId && r.platform === platform && r.kind !== 'methods')
  ?? fail(`the registry records no plain run of ${populationId} on ${platform}`);

const scanners: Record<string, ScannerIdentity | null> = {};
for (const s of recorded.scanners as (ScannerIdentity & { id: string })[]) {
  const { id, ...identity } = s;
  scanners[id] = id === PRODUCT_SCANNER
    ? { ...identity, ...(option('product-version') ? { version: option('product-version')! } : {}), ...(option('product-integrity') ? { packageIntegrity: option('product-integrity')! } : {}) }
    : identity;
}
const target: Target = { population: populationId, inputDigest: inputDigest(snapshot.cases), corpusDigest: snapshot.identity.corpus_digest, protocol: registry.engine.protocol, restriction: null, scanners };

const archiveFile = option('archive');
let archive: Archive | undefined;
let pin: { path: string; byteDigest: string; sourceRelease?: string } | undefined;
if (archiveFile) {
  const bytes = readFileSync(archiveFile);
  const expected = option('archive-digest') ?? fail('--archive needs --archive-digest, the immutable record of its bytes');
  archive = { set: JSON.parse(bytes.toString('utf8')), byteDigest: sha256Digest(bytes), sourceRelease: option('source-release') };
  // The pin is the expected digest; the planner refuses on a mismatch.
  pin = { path: archiveFile, byteDigest: expected, ...(option('source-release') ? { sourceRelease: option('source-release') } : {}) };
}
const force = option('force-fresh');
const plan = planAccuracyReuse({ archive, pin, target, archivePath: archiveFile, forceFresh: force === 'all' ? 'all' : force ? force.split(',').map(s => s.trim()).filter(Boolean) : [] });

const out = option('out');
if (out) {
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'reuse-plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  writeFileSync(path.join(out, 'reuse-plan.md'), renderReusePlan(plan));
}
console.log(renderReusePlan(plan));
if (plan.verdict === 'refused') fail(plan.refusals.join('; '));
console.log(`engine arguments: ${plan.engineArguments.join(' ') || '(none: a fresh run)'}`);
