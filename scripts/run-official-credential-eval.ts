/**
 * Run credential-eval officially for one qualification population and record the run identity (#604).
 * The steps are credential-eval docs/consumers/benchmarks-quickstart.md; the pins are benchmarks/official-runs.json.
 *
 *   node --import tsx scripts/run-official-credential-eval.ts --population <id> --engine-dir <checkout at the pinned tag>
 *     --platform <linux-x64|darwin-arm64> --out <dir> [--runs 2] [--evidence-dir <dir with the public release assets>]
 *
 * It refuses, before reading any measurement, when the engine, a scanner, the evidence or a product corpus differs from
 * the registry. It runs the engine `--runs` times (default 2) and accepts the artifact only when every run exits 0, is
 * schema-valid, binds to the population and has the same semantic digest. It writes artifact.json and run-record.json.
 * Never publish an artifact from a non-zero exit, and never an `internal` one outside product qualification.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { sha256Digest } from '../benchmarks/qualification/canonical.ts';
import { exportPopulation, PRODUCT_POPULATIONS, type ProductPopulation } from '../benchmarks/qualification/population-snapshot.ts';
import { bindingProblems, readRunArtifact, type RunArtifact } from '../benchmarks/qualification/run-artifact.ts';

const registry = JSON.parse(readFileSync(new URL('../benchmarks/official-runs.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const option = (name: string, fallback?: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : fallback; };
const fail = (message: string): never => { console.error(`official run refused: ${message}`); process.exit(4); };

const populationId = option('population') ?? fail('--population is required');
const engineDir = path.resolve(option('engine-dir') ?? fail('--engine-dir is required'));
const platform = option('platform') ?? fail('--platform is required');
const out = path.resolve(option('out') ?? fail('--out is required'));
const runs = Number(option('runs', '2'));
if (!Number.isInteger(runs) || runs < 2) fail('--runs must be at least 2: an official artifact needs a determinism check');

const population = registry.populations.find((p: { id: string }) => p.id === populationId) ?? fail(`unknown population ${populationId}`);
const configFile = registry.config.platforms[platform]?.file ?? fail(`no run configuration pinned for platform ${platform}`);
const configPath = path.join(engineDir, 'configs/official', configFile);
const binary = path.join(engineDir, 'target/release/credential-eval');
mkdirSync(out, { recursive: true });

// 1. Engine identity: the tag's commit, the version string and the protocol. A different engine is a different measurement.
const revision = execFileSync('/usr/bin/git', ['-C', engineDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (revision !== registry.engine.revision) fail(`engine checkout is at ${revision}, expected ${registry.engine.revision} (${registry.engine.tag})`);
const engineVersion = execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim();
const expectedVersion = `credential-eval ${registry.engine.version} (protocol ${registry.engine.protocol})`;
if (engineVersion !== expectedVersion) fail(`engine prints "${engineVersion}", expected "${expectedVersion}"`);

// 2. Scanner pins: read from the pinned configuration, and checked against the registry and the binaries on PATH.
const config = JSON.parse(readFileSync(configPath, 'utf8'));
for (const scanner of registry.scanners) {
  const entry = config.scanners.find((s: { id: string }) => s.id === scanner.id);
  if (!entry?.pin || entry.pin.version !== scanner.version) fail(`configuration pins ${scanner.id} at ${entry?.pin?.version ?? 'nothing'}, the registry pins ${scanner.version}`);
  if (scanner.kind === 'executable' && entry.pin.sha256 !== scanner.executableSha256[platform]) fail(`configuration pin for ${scanner.id} differs from the registry on ${platform}`);
}
const probe = (command: string, argv: string[]) => (spawnSync(command, argv, { encoding: 'utf8' }).stdout ?? '').trim();
if (probe('trufflehog', ['--version']) !== `trufflehog ${registry.scanners.find((s: { id: string }) => s.id === 'trufflehog').version}`) fail(`trufflehog on PATH is "${probe('trufflehog', ['--version'])}", not the pinned version; put a pinned binary first on PATH`);
if (probe('gitleaks', ['version']) !== registry.scanners.find((s: { id: string }) => s.id === 'gitleaks').version) fail('gitleaks on PATH is not the pinned version');

// 3. Population inputs.
const pin = population.evidence;
const inputs: { corpus: string; manifest: string; tag: string; manifestDigest: string } = { corpus: '', manifest: '', tag: pin.release.tag, manifestDigest: pin.release.manifestDigest };
if ((PRODUCT_POPULATIONS as readonly string[]).includes(populationId)) {
  const exported = await exportPopulation(populationId as ProductPopulation);
  const identity = exported.snapshot.identity as { source: string; revision: string; corpus_digest: string };
  if (identity.source !== pin.source || identity.revision !== pin.revision || identity.corpus_digest !== pin.corpusDigest || exported.tag !== pin.release.tag || exported.manifestDigest !== pin.release.manifestDigest)
    fail(`${populationId} corpus differs from its pin in benchmarks/official-runs.json (corpus ${identity.corpus_digest}, manifest ${exported.manifestDigest}); re-pin with the new run`);
  const dir = path.join(out, 'inputs');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'credential-eval-corpus-snapshot.json'), exported.snapshotBytes);
  writeFileSync(path.join(dir, 'release-manifest.json'), exported.manifestBytes);
  writeFileSync(path.join(dir, 'case-metadata.json'), `${JSON.stringify(exported.metadata)}\n`);
  inputs.corpus = path.join(dir, 'credential-eval-corpus-snapshot.json');
  inputs.manifest = path.join(dir, 'release-manifest.json');
} else {
  const dir = path.resolve(option('evidence-dir', path.join(out, 'evidence'))!);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(path.join(dir, 'release-manifest.json')))
    execFileSync('gh', ['release', 'download', pin.release.tag, '-R', pin.source === 'credential-evidence' ? 'redact-secret/credential-evidence' : pin.source, '-D', dir,
      '-p', 'release-manifest.json', '-p', 'release-manifest.json.sha256', '-p', 'credential-eval-corpus-snapshot.json'], { stdio: 'inherit' });
  inputs.corpus = path.join(dir, 'credential-eval-corpus-snapshot.json');
  inputs.manifest = path.join(dir, 'release-manifest.json');
  if (sha256Digest(readFileSync(inputs.manifest)) !== pin.release.manifestDigest) fail(`release manifest digest differs from the pinned ${pin.release.manifestDigest}`);
}

// 4. Run the engine; any exit but 0 is a failed job.
const artifacts: string[] = [];
for (let n = 1; n <= runs; n++) {
  const artifact = path.join(out, `artifact-${n}.json`);
  const result = spawnSync(binary, ['run', '--run-class', 'official', '--corpus', inputs.corpus, '--evidence-release', inputs.tag, '--evidence-manifest', inputs.manifest,
    '--evidence-manifest-digest', inputs.manifestDigest, '--config', configPath, '--node-dir', path.join(engineDir, 'adapters/node'), '--jobs', '4', '--require-complete', '--out', artifact],
  { stdio: ['ignore', 'inherit', 'inherit'] });
  if (result.status !== 0) fail(`credential-eval run ${n} exited ${result.status}; no artifact is accepted`);
  artifacts.push(artifact);
}

// 5. Accept only schema-valid artifacts that bind to the population and agree semantically.
const accepted = artifacts.map(file => readRunArtifact(readFileSync(file)));
const first = accepted[0];
for (const [i, a] of accepted.entries()) {
  const problems = bindingProblems(a.artifact, pin, { engineVersion: registry.engine.version, protocol: registry.engine.protocol });
  if (problems.length) fail(`artifact ${i + 1} is not accepted for ${populationId}: ${problems.join('; ')}`);
  if (a.semanticDigest !== first.semanticDigest) fail(`run ${i + 1} has semantic digest ${a.semanticDigest}, run 1 has ${first.semanticDigest}: the measurement is not reproducible`);
}
copyFileSync(artifacts[0], path.join(out, 'artifact.json'));
const artifact: RunArtifact = first.artifact;
const record = {
  schema: 'redact-secret-benchmarks/official-run-record/v1',
  population: populationId, platform,
  benchmarkRevision: execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  engine: { ...artifact.manifest.engine, revision, protocol: artifact.manifest.protocol_version },
  runClass: artifact.manifest.run_class, publication: artifact.manifest.publication,
  evidence: artifact.manifest.evidence, configHash: artifact.manifest.config_hash,
  artifact: { digest: first.artifactDigest, semanticDigest: first.semanticDigest, schemaDigest: sha256Digest(readFileSync(new URL('../schemas/credential-eval-run-artifact-v1.json', import.meta.url))) },
  determinism: { runs, semanticDigestsEqual: true },
  scanners: artifact.manifest.scanners.map(s => ({
    id: s.id, version: s.version, build: s.build ?? null, mode: s.mode, adapter: s.adapter, configurationHash: s.configuration_hash,
    executableSha256: s.provenance?.components?.find(c => c.kind === 'executable')?.sha256 ?? null,
    packageIntegrity: s.provenance?.components?.find(c => c.kind === 'npm-package')?.integrity ?? null,
  })),
  caseCounts: Object.fromEntries(artifact.scanners.map(s => [s.scanner, s.cases.length])),
};
writeFileSync(path.join(out, 'run-record.json'), `${JSON.stringify(record, null, 2)}\n`);
console.log(`${populationId} (${platform}): official/${artifact.manifest.publication}, ${runs} runs, semantic digest ${first.semanticDigest}, artifact ${first.artifactDigest}`);
