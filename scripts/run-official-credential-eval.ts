/**
 * Run credential-eval officially for one qualification population and record the run identity (#604).
 * The steps are credential-eval docs/consumers/benchmarks-quickstart.md; the pins are benchmarks/official-runs.json.
 *
 *   node --import tsx scripts/run-official-credential-eval.ts --population <id> --engine-dir <checkout at the pinned tag>
 *     --platform <linux-x64|darwin-arm64> --out <dir> [--runs 2] [--evidence-dir <dir with the public release assets>] [--methods] [--attribution <id>]
 *
 * `--attribution <id>` (#697) makes an ATTRIBUTION run: the same engine, evidence and population, scanning the product build the registry's `attributionRuns[<id>]`
 * names (the previous published release, with the engine's own configuration file and Node shim directory for it, which are always used together). It exists to
 * separate a product effect from an engine or configuration effect; its artifacts are never the accepted runs and are never recorded in `runs[]`.
 *
 * `--methods` makes the methods run of the floors population (docs/specs/official-runs.md, "The methods run"): the same
 * evidence and configuration as the plain run plus `--methods`, `--reference`, `--seed` and the product evaluation evidence
 * file pinned in the registry `methodsRun`. It writes <out>/methods/artifact.json and <out>/methods/run-record.json.
 *
 * `--mode diagnostic` (#705) is the fast product-candidate lane (docs/specs/official-runs.md, "The diagnostic lane"): an EXPLORATORY run, so `internal`,
 * over a configuration restricted to `--scanners` (default the product only), one engine run by default, no methods. The engine still verifies the evidence and
 * every selected scanner's pin; this driver still checks the engine, the evidence binding and the product build against the registry. It writes
 * diagnostic-record.json and diagnostic-summary.{json,md} (never run-record.json), which no official-run tool accepts. `--mode full` (the default) is unchanged.
 *
 * It refuses, before reading any measurement, when the engine, a scanner, the evidence or a product corpus differs from
 * the registry. It runs the engine `--runs` times (default 2) and accepts the artifact only when every run exits 0, is
 * schema-valid, binds to the population and has the same semantic digest. It writes artifact.json and run-record.json.
 * Never publish an artifact from a non-zero exit, and never an `internal` one outside product qualification.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { canonical, sha256Digest } from '../benchmarks/qualification/canonical.ts';
import { buildEvaluationEvidence } from '../benchmarks/qualification/evaluation-evidence.ts';
import { exportPopulation, PRODUCT_POPULATIONS, type ProductPopulation } from '../benchmarks/qualification/population-snapshot.ts';
import { bindingProblems, readRunArtifact, type RunArtifact } from '../benchmarks/qualification/run-artifact.ts';
import { diagnosticBindingProblems, diagnosticSummary, outcomesOf, parseSelectedScanners, renderDiagnosticSummary, selectedScannerConfig, DIAGNOSTIC_PRODUCT_SCANNER, type PopulationOutcomes } from '../benchmarks/qualification/diagnostic-lane.ts';

const registry = JSON.parse(readFileSync(new URL('../benchmarks/official-runs.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const option = (name: string, fallback?: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : fallback; };
const fail = (message: string): never => { console.error(`official run refused: ${message}`); process.exit(4); };

const mode = option('mode', 'full');
if (mode !== 'full' && mode !== 'diagnostic') fail(`--mode must be full or diagnostic, not ${mode}`);
const diagnostic = mode === 'diagnostic';
if (!diagnostic && args.includes('--scanners')) fail('--scanners is for --mode diagnostic; a full run uses every pinned scanner');
const registryScannerIds: string[] = registry.scanners.map((s: { id: string }) => s.id);
const selectedScanners: string[] = diagnostic ? (() => { try { return parseSelectedScanners(option('scanners'), registryScannerIds); } catch (e) { return fail((e as Error).message); } })() : registryScannerIds;
const attributionId = option('attribution');
if (diagnostic && (attributionId !== undefined || args.includes('--methods'))) fail('a diagnostic run makes no attribution run and no methods run; the methods need the peers and are reported as unavailable');
type Attribution = { configs: Record<string, string>; nodeDir: string; scanners: Record<string, { version: string; integrity: string }> };
const attribution: Attribution | undefined = attributionId === undefined ? undefined : (registry.attributionRuns?.[attributionId] ?? fail(`the registry pins no attribution run ${attributionId}`));
const populationId = option('population') ?? fail('--population is required');
const engineDir = path.resolve(option('engine-dir') ?? fail('--engine-dir is required'));
const platform = option('platform') ?? fail('--platform is required');
const methodsMode = args.includes('--methods');
const baseOut = path.resolve(option('out') ?? fail('--out is required'));
const out = methodsMode ? path.join(baseOut, 'methods') : baseOut;
const minRuns = diagnostic ? 1 : 2;
const runs = Number(option('runs', String(minRuns)));
if (!Number.isInteger(runs) || runs < minRuns) fail(diagnostic ? '--runs must be at least 1' : '--runs must be at least 2: an official artifact needs a determinism check');

const population = registry.populations.find((p: { id: string }) => p.id === populationId) ?? fail(`unknown population ${populationId}`);

// The methods run: its selection and the evaluation evidence are pinned in the registry, and the evidence file must be what the product contracts derive.
const methodsRun = registry.methodsRun as { population: string; methods: string[]; reference: string; seed: string; evaluationEvidence: { file: string; digest: string } } | undefined;
let evaluationEvidenceFile = '';
if (methodsMode) {
  if (!methodsRun) fail('the registry pins no methods run (methodsRun)');
  else if (methodsRun.population !== populationId) fail(`the methods run is pinned for ${methodsRun.population}, not ${populationId}`);
  evaluationEvidenceFile = path.resolve(new URL('..', import.meta.url).pathname, methodsRun!.evaluationEvidence.file);
  const onDisk = sha256Digest(canonical(JSON.parse(readFileSync(evaluationEvidenceFile, 'utf8'))));
  if (onDisk !== methodsRun!.evaluationEvidence.digest) fail(`${methodsRun!.evaluationEvidence.file} has digest ${onDisk}, the registry pins ${methodsRun!.evaluationEvidence.digest}`);
  if (sha256Digest(canonical(buildEvaluationEvidence())) !== onDisk) fail(`${methodsRun!.evaluationEvidence.file} is stale against the product contracts; run npm run qualification:evidence`);
}
const configFile = (attribution ? attribution.configs[platform] : registry.config.platforms[platform]?.file) ?? fail(`no run configuration pinned for platform ${platform}`);
const nodeDir = path.join(engineDir, attribution?.nodeDir ?? 'adapters/node');
// The scanners this run is pinned to: the registry's, with the attributed product build in place of the product pin.
const runScanners: typeof registry.scanners = registry.scanners.filter((s: { id: string }) => selectedScanners.includes(s.id)).map((s: { id: string }) => (attribution?.scanners[s.id] ? { ...s, ...attribution.scanners[s.id] } : s));
const pinnedConfigPath = path.join(engineDir, 'configs/official', configFile);
const binary = path.join(engineDir, 'target/release/credential-eval');
mkdirSync(out, { recursive: true });

// 1. Engine identity: the tag's commit, the version string and the protocol. A different engine is a different measurement.
const revision = execFileSync('/usr/bin/git', ['-C', engineDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (revision !== registry.engine.revision) fail(`engine checkout is at ${revision}, expected ${registry.engine.revision} (${registry.engine.tag})`);
const engineVersion = execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim();
const expectedVersion = `credential-eval ${registry.engine.version} (protocol ${registry.engine.protocol})`;
if (engineVersion !== expectedVersion) fail(`engine prints "${engineVersion}", expected "${expectedVersion}"`);

// 2. Scanner pins: read from the pinned configuration, and checked against the registry and the binaries on PATH.
const config = JSON.parse(readFileSync(pinnedConfigPath, 'utf8'));
// A diagnostic run hands the engine the pinned configuration restricted to the selected scanners; each keeps the engine's own pin.
let configPath = pinnedConfigPath;
if (diagnostic) {
  configPath = path.join(out, 'diagnostic-config.json');
  writeFileSync(configPath, `${JSON.stringify(selectedScannerConfig(config, selectedScanners), null, 2)}\n`);
}
for (const scanner of runScanners) {
  const entry = config.scanners.find((s: { id: string }) => s.id === scanner.id);
  if (!entry?.pin || entry.pin.version !== scanner.version) fail(`configuration pins ${scanner.id} at ${entry?.pin?.version ?? 'nothing'}, the registry pins ${scanner.version}`);
  if (scanner.kind === 'npm' && scanner.integrity && entry.pin.integrity !== scanner.integrity) fail(`configuration pins ${scanner.id} with integrity ${entry.pin.integrity ?? 'none'}, the registry pins ${scanner.integrity}`);
  if (scanner.kind === 'executable' && entry.pin.sha256 !== scanner.executableSha256[platform]) fail(`configuration pin for ${scanner.id} differs from the registry on ${platform}`);
}
const probe = (command: string, argv: string[]) => (spawnSync(command, argv, { encoding: 'utf8' }).stdout ?? '').trim();
if (selectedScanners.includes('trufflehog') && probe('trufflehog', ['--version']) !== `trufflehog ${registry.scanners.find((s: { id: string }) => s.id === 'trufflehog').version}`) fail(`trufflehog on PATH is "${probe('trufflehog', ['--version'])}", not the pinned version; put a pinned binary first on PATH`);
if (selectedScanners.includes('gitleaks') && probe('gitleaks', ['version']) !== registry.scanners.find((s: { id: string }) => s.id === 'gitleaks').version) fail('gitleaks on PATH is not the pinned version');

// 3. Population inputs.
const pin = population.evidence;
const inputs: { corpus: string; manifest: string; tag: string; manifestDigest: string } = { corpus: '', manifest: '', tag: pin.release.tag, manifestDigest: pin.release.manifestDigest };
if (methodsMode && (PRODUCT_POPULATIONS as readonly string[]).includes(populationId)) fail('a methods run is made for the floors population only');
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
  const dir = path.resolve(option('evidence-dir', path.join(baseOut, 'evidence'))!);
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
  // A methods run is not given --require-complete: the engine then also exits 3 for a recorded operator generation attempt that errored, which
  // is a fact about the generated variants, not a scanner that did not measure. Scanner completeness is checked on the artifact below.
  const methodArgs = methodsMode ? ['--methods', methodsRun!.methods.join(','), '--reference', methodsRun!.reference, '--seed', methodsRun!.seed, '--evidence', evaluationEvidenceFile] : ['--require-complete'];
  const result = spawnSync(binary, ['run', '--run-class', diagnostic ? 'exploratory' : 'official', '--corpus', inputs.corpus, '--evidence-release', inputs.tag, '--evidence-manifest', inputs.manifest,
    '--evidence-manifest-digest', inputs.manifestDigest, '--config', configPath, '--node-dir', nodeDir, '--jobs', '4', ...methodArgs, '--out', artifact],
  { stdio: ['ignore', 'inherit', 'inherit'] });
  if (result.status !== 0) fail(`credential-eval run ${n} exited ${result.status}; no artifact is accepted`);
  artifacts.push(artifact);
}

// 5. Accept only schema-valid artifacts that bind to the population and agree semantically. They are read one at a time: a methods
// artifact is a few hundred MB, and only the first one's identity is kept.
interface Kept { manifest: RunArtifact['manifest']; caseCounts: Record<string, number>; artifactDigest: string; semanticDigest: string }
let first: Kept | undefined;
let diagnosticOutcomes: PopulationOutcomes | undefined;
for (const [i, file] of artifacts.entries()) {
  const a = readRunArtifact(readFileSync(file));
  const product = runScanners.find((s: { id: string }) => s.id === DIAGNOSTIC_PRODUCT_SCANNER);
  const problems = diagnostic
    ? diagnosticBindingProblems(a.artifact, pin, { engineVersion: registry.engine.version, protocol: registry.engine.protocol, selected: selectedScanners, product: { id: DIAGNOSTIC_PRODUCT_SCANNER, version: product.version, integrity: product.integrity } })
    : bindingProblems(a.artifact, pin, { engineVersion: registry.engine.version, protocol: registry.engine.protocol });
  if (problems.length) fail(`artifact ${i + 1} is not accepted for ${populationId}: ${problems.join('; ')}`);
  if (methodsMode) {
    const ran = [...a.artifact.manifest.methods.map(m => m.id)].sort().join(',');
    if (ran !== [...methodsRun!.methods].sort().join(',')) fail(`artifact ${i + 1} ran methods ${ran}, the registry pins ${methodsRun!.methods.join(',')}`);
  } else if (a.artifact.manifest.methods.length) fail(`artifact ${i + 1} ran methods; the plain run measures none`);
  if (first && a.semanticDigest !== first.semanticDigest) fail(`run ${i + 1} has semantic digest ${a.semanticDigest}, run 1 has ${first.semanticDigest}: the measurement is not reproducible`);
  if (diagnostic && !first) diagnosticOutcomes = outcomesOf(a.artifact, populationId);
  first ??= { manifest: a.artifact.manifest, caseCounts: Object.fromEntries(a.artifact.scanners.map(x => [x.scanner, x.cases.length])), artifactDigest: a.artifactDigest, semanticDigest: a.semanticDigest };
}
if (!first) fail('no artifact was produced');
copyFileSync(artifacts[0], path.join(out, 'artifact.json'));
const kept = first!;
const record = {
  schema: diagnostic ? 'redact-secret-benchmarks/diagnostic-record/v1' : 'redact-secret-benchmarks/official-run-record/v1',
  ...(diagnostic ? { mode: 'diagnostic', promotion: 'disallowed', selectedScanners } : {}),
  population: populationId, platform,
  benchmarkRevision: execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  engine: { ...kept.manifest.engine, revision, protocol: kept.manifest.protocol_version },
  runClass: kept.manifest.run_class, publication: kept.manifest.publication,
  evidence: kept.manifest.evidence, configHash: kept.manifest.config_hash,
  artifact: { digest: kept.artifactDigest, semanticDigest: kept.semanticDigest, schemaDigest: sha256Digest(readFileSync(new URL('../schemas/credential-eval-run-artifact-v1.json', import.meta.url))) },
  determinism: { runs, semanticDigestsEqual: true },
  ...(attributionId ? { attribution: { id: attributionId, configFile, nodeDir: attribution!.nodeDir } } : {}),
  ...(methodsMode ? { kind: 'methods', methods: [...methodsRun!.methods].sort(), evaluation: { reference: methodsRun!.reference, seed: methodsRun!.seed, evidenceDigest: methodsRun!.evaluationEvidence.digest } } : {}),
  scanners: kept.manifest.scanners.map(s => ({
    id: s.id, version: s.version, build: s.build ?? null, mode: s.mode, adapter: s.adapter, configurationHash: s.configuration_hash,
    executableSha256: s.provenance?.components?.find(c => c.kind === 'executable')?.sha256 ?? null,
    packageIntegrity: s.provenance?.components?.find(c => c.kind === 'npm-package')?.integrity ?? null,
  })),
  caseCounts: kept.caseCounts,
};
writeFileSync(path.join(out, diagnostic ? 'diagnostic-record.json' : 'run-record.json'), `${JSON.stringify(record, null, 2)}\n`);
if (diagnostic) {
  const summary = diagnosticSummary({
    populations: [populationId], selected: selectedScanners, registryScanners: registryScannerIds,
    engine: `${kept.manifest.engine.name} ${kept.manifest.engine.version} (${kept.manifest.protocol_version})`,
    evidence: { source: kept.manifest.evidence.source, revision: kept.manifest.evidence.revision, corpusDigest: kept.manifest.evidence.corpus_digest, release: kept.manifest.evidence.release?.tag ?? '' },
  }, [diagnosticOutcomes!], registry.methodsRun?.methods ?? []);
  writeFileSync(path.join(out, 'diagnostic-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(path.join(out, 'diagnostic-summary.md'), renderDiagnosticSummary(summary));
}
console.log(diagnostic ? `${populationId} DIAGNOSTIC (${platform}): exploratory/${kept.manifest.publication}, scanners ${selectedScanners.join(',')}, ${runs} run(s), artifact ${kept.artifactDigest}. Not an official run; never record, archive or promote it.` : `${populationId}${methodsMode ? ' methods run' : ''} (${platform}): official/${kept.manifest.publication}, ${runs} runs, semantic digest ${kept.semanticDigest}, artifact ${kept.artifactDigest}`);
