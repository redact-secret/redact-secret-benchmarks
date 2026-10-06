/**
 * Run credential-eval officially for one qualification population and record the run identity (#604).
 * The steps are credential-eval docs/consumers/benchmarks-quickstart.md; the pins are benchmarks/official-runs.json.
 *
 *   node --import tsx scripts/run-official-credential-eval.ts --population <id> --engine-dir <checkout at the pinned tag>
 *     --platform <linux-x64|darwin-arm64> --out <dir> [--runs 2] [--evidence-dir <dir with the public release assets>] [--methods] [--omit-optional <scanner>] [--attribution <id> | --candidate <id> [--evidence-tag <tag> --evidence-manifest-digest sha256:<hex>]]
 *
 * `--attribution <id>` (#697) makes an ATTRIBUTION run: the same engine, evidence and population, scanning the product build the registry's `attributionRuns[<id>]`
 * names (the previous published release, with the engine's own configuration file and Node shim directory for it, which are always used together). It exists to
 * separate a product effect from an engine or configuration effect; its artifacts are never the accepted runs and are never recorded in `runs[]`.
 *
 * `--candidate <id>` (#698) measures a REGISTERED UNPUBLISHED product build (benchmarks/product-candidates.json) on the adoption's engine candidate: the same engine,
 * evidence, populations, peers and configuration as the control run, the product packages replaced by the registered tarballs (verified by digest before anything
 * is measured). The engine refuses an unpinned build as official, so the run class is `exploratory` and the publication `internal`: the artifacts are never accepted
 * runs and never public evidence (docs/specs/product-candidate-replay.md).
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
 * `--reuse-observations <set> [--fresh <id>]... [--observations-out <file>]` (#706, docs/specs/accuracy-reuse.md) is for `--mode diagnostic` only: the engine keeps a peer's recorded accuracy
 * observation when its identity is unchanged (plan it first with scripts/plan-accuracy-reuse.ts) and scans the rest fresh. An official run measures every scanner fresh and refuses it
 * here; an engine without the reuse contract (the pinned tag's `run --help` does not list it) is refused rather than silently scanning everything. No performance measurement is started.
 *
 * It refuses, before reading any measurement, when the engine, a scanner, the evidence or a product corpus differs from
 * the registry. It runs the engine `--runs` times (default 2) and accepts the artifact only when every run exits 0, is
 * schema-valid, binds to the population and has the same semantic digest. It writes artifact.json and run-record.json.
 * Never publish an artifact from a non-zero exit, and never an `internal` one outside product qualification.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { canonical, sha256Digest } from '../benchmarks/qualification/canonical.ts';
import { buildEvaluationEvidence } from '../benchmarks/qualification/evaluation-evidence.ts';
import { exportPopulation, PRODUCT_POPULATIONS, type ProductPopulation } from '../benchmarks/qualification/population-snapshot.ts';
import { readScannerRoster, rosterFor } from '../benchmarks/qualification/scanner-roster.ts';
import { receiptProblems } from '../benchmarks/qualification/receipt-reuse.ts';
import { bindingProblems, readRunArtifact, type RunArtifact } from '../benchmarks/qualification/run-artifact.ts';
import { controlFor } from './candidate-control.mjs';
import { incompleteProblem, readJsonIfPresent, STAGE_INCOMPLETE_FILE, STAGE_INCOMPLETE_SCHEMA, stageReceiptProblems } from './stage-receipts.mjs';
import { createHash } from 'node:crypto';
import { releaseIdentityProblems } from './evidence-adoption.mjs';
import { candidateOf, install as installCandidate, readRegistry as readCandidateRegistry, verifyLoaded } from './install-product-candidate.mjs';
import { diagnosticBindingProblems, diagnosticSummary, outcomesOf, parseSelectedScanners, renderDiagnosticSummary, selectedScannerConfig, DIAGNOSTIC_PRODUCT_SCANNER, type PopulationOutcomes } from '../benchmarks/qualification/diagnostic-lane.ts';

const registry = JSON.parse(readFileSync(new URL('../benchmarks/official-runs.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const option = (name: string, fallback?: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : fallback; };
// A stage whose engine output is finished but not yet verified carries stage-incomplete.json (#762): a failure or a cancel in the checks that follow must not
// discard that output, and the run is explicitly INCOMPLETE, never a success. The marker is replaced by the run record when the stage verifies.
let incomplete: ((reason: string) => void) | undefined;
const fail = (message: string): never => { incomplete?.(message); console.error(`official run refused: ${message}`); process.exit(4); };

const mode = option('mode', 'full');
if (mode !== 'full' && mode !== 'diagnostic') fail(`--mode must be full or diagnostic, not ${mode}`);
const diagnostic = mode === 'diagnostic';
if (!diagnostic && args.includes('--scanners')) fail('--scanners is for --mode diagnostic; a full run uses every pinned scanner');
const registryScannerIds: string[] = registry.scanners.map((s: { id: string }) => s.id);
// An OPTIONAL scanner of the evaluation contract (#763, benchmarks/support/scanner-roster.json) is left out on request: the run is complete without it and its record names what was omitted.
const roster = readScannerRoster();
const omitOptional = option('omit-optional');
if (omitOptional !== undefined) {
  if (diagnostic) fail('--omit-optional is for an official run; the diagnostic lane selects its scanners with --scanners');
  if (!rosterFor(roster, 'official').optional.includes(omitOptional)) fail(`--omit-optional ${omitOptional}: not an optional scanner of the official run class (benchmarks/support/scanner-roster.json); a required scanner cannot be omitted`);
  if (!Object.keys(roster.optionalScanners[omitOptional].withoutConfigs).length) fail(`--omit-optional ${omitOptional}: it is in no official configuration, so there is nothing to leave out (#764: the credential profile is measured only by its own profile-only run, pending the owner's approval)`);
}
const selectedScanners: string[] = diagnostic ? (() => { try { return parseSelectedScanners(option('scanners'), registryScannerIds); } catch (e) { return fail((e as Error).message); } })() : registryScannerIds.filter(id => id !== omitOptional);
const reuseSet = option('reuse-observations');
const freshScanners = args.flatMap((a, i) => a === '--fresh' ? [args[i + 1]] : []);
const observationsOut = option('observations-out');
if (!diagnostic && (reuseSet !== undefined || freshScanners.length || observationsOut !== undefined)) fail('--reuse-observations, --fresh and --observations-out are for --mode diagnostic; an official run measures every scanner fresh');
if (reuseSet === undefined && freshScanners.length) fail('--fresh needs --reuse-observations');
// One or more directories (comma separated) that may hold this stage of an earlier run (#762); the first that is identical is reused.
const reuseReceipt = option('reuse-receipt');
if (diagnostic && reuseReceipt !== undefined) fail('--reuse-receipt is for an official retry (#707); a diagnostic run is always fresh');
const attributionId = option('attribution');
const candidateId = option('candidate');
const evidenceTag = option('evidence-tag'), evidenceManifestDigest = option('evidence-manifest-digest');
if (attributionId && candidateId) fail('--attribution and --candidate are exclusive');
if (diagnostic && candidateId) fail('--candidate (the full comparative candidate replay, #698) and --mode diagnostic (the product-only lane, #705) are different mechanisms; use one');
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

// Parallel scanner processes of the engine: a scheduling parameter the artifact records as non-semantic (it never changes a result). A candidate replay on the 7 GB runner uses fewer (#698).
const engineJobs = option('jobs', '4')!;
if (!/^[1-4]$/.test(engineJobs)) fail('--jobs must be 1 to 4');

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
// A candidate run replays on the adoption's engine candidate (benchmarks/evidence-adoption.json), which is not the registry's accepted engine.
const adoption = candidateId ? JSON.parse(readFileSync(new URL('../benchmarks/evidence-adoption.json', import.meta.url), 'utf8')) : undefined;
let engineCandidate: { engine: { tag: string; revision: string }; product: { version: string; integrity: string }; evidenceRelease: string; manifestDigest: string } | undefined;
try { engineCandidate = candidateId ? controlFor(adoption, { evidenceTag, manifestDigest: evidenceManifestDigest, requireArchive: false }) as typeof engineCandidate : undefined; } catch (error) { fail((error as Error).message); }
if (candidateId && !engineCandidate) fail('benchmarks/evidence-adoption.json records no engineCandidate to replay a product candidate on');
if (candidateId && !evidenceTag && (engineCandidate!.evidenceRelease !== registry.populations.find((p: { id: string }) => p.id === 'public-evidence-snapshot')?.evidence.release.tag)) fail('the engineCandidate evidence is not the registry pin: a product candidate is measured on the accepted evidence');
// A candidate is measured on the accepted evidence, or, with --evidence-tag and --evidence-manifest-digest (a new snapshot, #698 phase 2), on that release of credential-evidence
// instead: the same registered product bytes, the engine candidate's engine, verified against the manifest digest the caller names (never against the registry pin).
if (!!evidenceTag !== !!evidenceManifestDigest) fail('--evidence-tag and --evidence-manifest-digest go together');
if (evidenceTag && !candidateId) fail('--evidence-tag is for a product candidate run: an official run measures the registry pin');
if (evidenceTag && !/^snapshot-\d{4}\.\d{2}\.\d{2}(\.\d+)?$/.test(evidenceTag)) fail(`--evidence-tag ${evidenceTag} is not a snapshot tag`);
if (evidenceManifestDigest && !/^sha256:[0-9a-f]{64}$/.test(evidenceManifestDigest)) fail('--evidence-manifest-digest must be sha256:<64 hex>');
const expectedEngine = engineCandidate ? { revision: engineCandidate.engine.revision, version: engineCandidate.engine.tag.replace(/^v/, '') } : { revision: registry.engine.revision, version: registry.engine.version };
const candidate = candidateId ? candidateOf(readCandidateRegistry(), candidateId) : undefined;
// A candidate replay may leave the same optional scanner out as its control did: the comparison needs one scanner roster on both sides (candidate-diff refuses a different roster).
if (omitOptional !== undefined && attributionId) fail('--omit-optional is for the accepted official run and a candidate replay, not an attribution run');
const withoutConfig = omitOptional === undefined ? undefined : (roster.optionalScanners[omitOptional].withoutConfigs[platform] ?? fail(`the scanner roster names no run configuration without ${omitOptional} for platform ${platform}`));
const configFile = (withoutConfig ?? (attribution ? attribution.configs[platform] : registry.config.platforms[platform]?.file)) ?? fail(`no run configuration pinned for platform ${platform}`);
const nodeDir = path.join(engineDir, attribution?.nodeDir ?? 'adapters/node');
// The scanners this run is pinned to: the registry's, with the attributed product build in place of the product pin.
const runScanners: typeof registry.scanners = registry.scanners.filter((s: { id: string }) => selectedScanners.includes(s.id)).map((s: { id: string }) => (attribution?.scanners[s.id] ? { ...s, ...attribution.scanners[s.id] } : s));
const pinnedConfigPath = path.join(engineDir, 'configs/official', configFile);
const binary = path.join(engineDir, 'target/release/credential-eval');
// The without-optional configuration ships with an engine release; a pinned engine that predates it is refused plainly, never measured with the optional scanner by accident.
if (withoutConfig !== undefined && !existsSync(pinnedConfigPath)) fail(`the pinned engine ${registry.engine.tag} has no configuration ${withoutConfig} (engine release pending, #763): an official run without ${omitOptional} needs an engine release that ships it, and the pin moves only by the owner's repin`);
mkdirSync(out, { recursive: true });

// 1. Engine identity: the tag's commit, the version string and the protocol. A different engine is a different measurement.
const revision = execFileSync('/usr/bin/git', ['-C', engineDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (revision !== expectedEngine.revision) fail(`engine checkout is at ${revision}, expected ${expectedEngine.revision}`);
const engineVersion = execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim();
const expectedVersion = `credential-eval ${expectedEngine.version} (protocol ${registry.engine.protocol})`;
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
  // The control build of a candidate run is the engine candidate's product pin (the registry still holds the accepted run's).
  const control = candidate && scanner.id === 'redact-secret' ? { ...scanner, ...engineCandidate!.product } : scanner;
  if (!entry?.pin || entry.pin.version !== control.version) fail(`configuration pins ${scanner.id} at ${entry?.pin?.version ?? 'nothing'}, the registry pins ${control.version}`);
  if (scanner.kind === 'npm' && control.integrity && entry.pin.integrity !== control.integrity) fail(`configuration pins ${scanner.id} with integrity ${entry.pin.integrity ?? 'none'}, the registry pins ${control.integrity}`);
  if (scanner.kind === 'executable' && entry.pin.sha256 !== scanner.executableSha256[platform]) fail(`configuration pin for ${scanner.id} differs from the registry on ${platform}`);
}
if (reuseSet !== undefined && !(spawnSync(binary, ['run', '--help'], { encoding: 'utf8' }).stdout ?? '').includes('--reuse-observations'))
  fail(`engine ${registry.engine.version} has no observation reuse contract (credential-eval ADR 0008); pin an engine that has it, or run fresh without --reuse-observations`);
if (reuseSet !== undefined) {
  const unknown = freshScanners.filter(id => !selectedScanners.includes(id));
  if (unknown.length) fail(`--fresh names ${unknown.join(', ')}, not selected scanners`);
}
// 2b. A product candidate: the registered tarballs over the shim's published install, byte-verified, loaded by the shim, receipt kept with the run.
let candidateReceipt: unknown;
if (candidate) {
  const receiptFile = path.join(out, 'product-candidate-receipt.json');
  try {
    candidateReceipt = installCandidate({ registry: readCandidateRegistry(), id: candidateId!, nodeDir, platform, receipt: receiptFile });
    verifyLoaded({ nodeDir, shim: path.join(nodeDir, 'shim.mjs'), expectedVersion: candidate.product.version });
  } catch (error) { fail(`product candidate ${candidateId}: ${(error as Error).message}`); }
}
const probe = (command: string, argv: string[]) => (spawnSync(command, argv, { encoding: 'utf8' }).stdout ?? '').trim();
if (selectedScanners.includes('trufflehog') && probe('trufflehog', ['--version']) !== `trufflehog ${registry.scanners.find((s: { id: string }) => s.id === 'trufflehog').version}`) fail(`trufflehog on PATH is "${probe('trufflehog', ['--version'])}", not the pinned version; put a pinned binary first on PATH`);
if (selectedScanners.includes('gitleaks') && probe('gitleaks', ['version']) !== registry.scanners.find((s: { id: string }) => s.id === 'gitleaks').version) fail('gitleaks on PATH is not the pinned version');

// 3. Population inputs.
const pin = population.evidence;
let bindPin = pin; // the pin the artifact must bind to: the registry's, or the named release's own identity (a new snapshot, candidate runs only)
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
    execFileSync('gh', ['release', 'download', evidenceTag ?? pin.release.tag, '-R', pin.source === 'credential-evidence' ? 'redact-secret/credential-evidence' : pin.source, '-D', dir,
      '-p', 'release-manifest.json', '-p', 'release-manifest.json.sha256', '-p', 'credential-eval-corpus-snapshot.json'], { stdio: 'inherit' });
  inputs.corpus = path.join(dir, 'credential-eval-corpus-snapshot.json');
  inputs.manifest = path.join(dir, 'release-manifest.json');
  if (evidenceTag) {
    // A new snapshot: the identity of the release as the adoption preflight checks it (manifest digest, asset bytes, records tree, schema, case count).
    const manifestBytes = readFileSync(inputs.manifest), snapshotBytes = readFileSync(inputs.corpus);
    const problems = releaseIdentityProblems({ tag: evidenceTag, expectedManifestDigest: evidenceManifestDigest, manifestBytes, manifest: JSON.parse(manifestBytes.toString('utf8')), snapshotBytes, snapshot: JSON.parse(snapshotBytes.toString('utf8')) });
    if (problems.length) fail(`${evidenceTag} is not the release ${evidenceManifestDigest}: ${problems.join('; ')}`);
    inputs.tag = evidenceTag; inputs.manifestDigest = evidenceManifestDigest!;
    const identity = JSON.parse(snapshotBytes.toString('utf8')).identity as { source: string; revision: string; evidence_schema: string; corpus_digest: string };
    bindPin = { ...pin, source: pin.source, revision: identity.revision, evidenceSchema: identity.evidence_schema, corpusDigest: identity.corpus_digest, release: { tag: evidenceTag, manifestDigest: evidenceManifestDigest! } };
  } else if (sha256Digest(readFileSync(inputs.manifest)) !== pin.release.manifestDigest) fail(`release manifest digest differs from the pinned ${pin.release.manifestDigest}`);
}

// 4. Run the engine; any exit but 0 is a failed job. A retry (#707) first tries the receipt of the same stage of an earlier run: an artifact that passed this
// same determinism check and is the identity this run would produce. It is bound to the current pins in step 5 like a fresh artifact; any doubt measures fresh.
const artifacts: string[] = [];
let receiptReuse: { reused: boolean; source?: string; artifactDigest?: string; reasons?: string[] } | undefined;
if (reuseReceipt !== undefined) {
  const stage = methodsMode ? 'methods' : 'plain';
  const sources = reuseReceipt.split(',').filter(Boolean);
  const rejected: string[] = [];
  for (const source of sources) {
    const dir = path.resolve(source);
    const problems: string[] = [];
    try {
      const marker = readJsonIfPresent(path.join(dir, STAGE_INCOMPLETE_FILE));
      const blocked = incompleteProblem(marker);
      if (blocked) problems.push(blocked);
      else {
        const bytes = readFileSync(path.join(dir, 'artifact.json'));
        const recordBytes = readFileSync(path.join(dir, 'run-record.json'));
        const found = JSON.parse(recordBytes.toString('utf8'));
        const digest = readRunArtifact(bytes).artifactDigest;
        problems.push(...receiptProblems(found, digest, {
          population: populationId, platform, methods: methodsMode, engineRevision: revision, runs,
          candidateId: candidateId ?? null, attributionId: attributionId ?? null, evidenceTag: evidenceTag ?? null, scannerIds: selectedScanners,
          ...(methodsMode ? { methodsRun: { methods: methodsRun!.methods, reference: methodsRun!.reference, seed: methodsRun!.seed, evidenceDigest: methodsRun!.evaluationEvidence.digest } } : {}),
        }));
        // The stage receipt (#762) is optional: an artifact of an earlier workflow (official-run-*, early-plain-*) has the run record only. When there is one, it must hold.
        const receipt = readJsonIfPresent(path.join(dir, 'stage-receipt.json'));
        if (receipt) problems.push(...stageReceiptProblems(receipt, { stage, population: populationId, artifactSha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`, recordSha256: `sha256:${createHash('sha256').update(recordBytes).digest('hex')}`, engineRevision: revision }));
        if (!problems.length) {
          const kept = path.join(out, 'artifact-1.json');
          writeFileSync(kept, bytes);
          artifacts.push(kept);
          receiptReuse = { reused: true, source: source.replace(/^.*receipts-in\//, ''), artifactDigest: digest };
          console.log(`receipt reused (${stage} stage of ${populationId}, source ${receiptReuse.source}${receipt ? `, stage receipt measured in run ${receipt.measuredInRun}` : ', run record only'}): engine ${revision}, artifact ${digest}; the engine is not run for this stage`);
          break;
        }
      }
    } catch (error) { problems.push(`the receipt is unreadable: ${(error as Error).message}`); }
    rejected.push(`${source}: ${problems.join('; ')}`);
    console.log(`receipt source ${source} not usable for the ${stage} stage: ${problems.join('; ')}`);
  }
  if (!receiptReuse) {
    receiptReuse = { reused: false, reasons: rejected.length ? rejected : ['no source was offered'] };
    console.log(`receipt not reused (${receiptReuse.reasons!.join(' | ')}): measuring fresh`);
  }
}
for (let n = 1; n <= runs && !receiptReuse?.reused; n++) {
  const artifact = path.join(out, `artifact-${n}.json`);
  // A methods run is not given --require-complete: the engine then also exits 3 for a recorded operator generation attempt that errored, which
  // is a fact about the generated variants, not a scanner that did not measure. Scanner completeness is checked on the artifact below.
  const methodArgs = methodsMode ? ['--methods', methodsRun!.methods.join(','), '--reference', methodsRun!.reference, '--seed', methodsRun!.seed, '--evidence', evaluationEvidenceFile] : ['--require-complete'];
  const result = spawnSync(binary, ['run', '--run-class', diagnostic || candidate ? 'exploratory' : 'official', '--corpus', inputs.corpus, '--evidence-release', inputs.tag, '--evidence-manifest', inputs.manifest,
    '--evidence-manifest-digest', inputs.manifestDigest, '--config', configPath, '--node-dir', nodeDir, '--jobs', engineJobs, ...methodArgs,
    ...(reuseSet !== undefined ? ['--reuse-observations', path.resolve(reuseSet), ...freshScanners.flatMap(id => ['--fresh', id])] : []),
    ...(observationsOut !== undefined && n === 1 ? ['--observations-out', path.resolve(observationsOut)] : []), '--out', artifact],
  { stdio: ['ignore', 'inherit', 'inherit'] });
  if (result.status !== 0) fail(`credential-eval run ${n} exited ${result.status}; no artifact is accepted`);
  artifacts.push(artifact);
}

// The engine output is finished (or a verified receipt stands in for it). From here until the run record is written, a failure or a cancel leaves the output in
// place and the stage explicitly INCOMPLETE (#762); the CI uploads the directory with its marker.
const markerFile = path.join(out, STAGE_INCOMPLETE_FILE);
const writeMarker = (reason: string) => {
  try {
    writeFileSync(markerFile, `${JSON.stringify({
      schema: STAGE_INCOMPLETE_SCHEMA, status: 'incomplete', stage: methodsMode ? 'methods' : 'plain', population: populationId, platform,
      reason, engineOutputKept: artifacts.map(file => ({ file: path.basename(file), bytes: statSync(file).size })),
      note: 'the engine run finished; the checks after it did not. The output is kept as evidence and is never reused or counted as a success.',
    }, null, 2)}\n`);
  } catch { /* the marker is best effort: the exit status already says the run failed */ }
};
if (!diagnostic) { writeMarker('engine output finished; verification not completed'); incomplete = writeMarker; }

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
    : bindingProblems(a.artifact, bindPin, { engineVersion: expectedEngine.version, protocol: registry.engine.protocol })
    // A candidate is exploratory by construction: the class is checked for what it must be instead of being refused.
      .filter(problem => !(candidate && problem.startsWith('run_class is')));
  if (candidate && (a.artifact.manifest.run_class !== 'exploratory' || a.artifact.manifest.publication !== 'internal')) problems.push(`a product candidate run is exploratory and internal, this artifact is ${a.artifact.manifest.run_class}/${a.artifact.manifest.publication}`);
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
  ...(reuseSet !== undefined ? { accuracyReuse: { observations: path.basename(reuseSet), observationsDigest: sha256Digest(readFileSync(reuseSet)), fresh: [...freshScanners].sort(), performanceMeasurements: 0 } } : {}),
  population: populationId, platform,
  benchmarkRevision: execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  engine: { ...kept.manifest.engine, revision, protocol: kept.manifest.protocol_version },
  runClass: kept.manifest.run_class, publication: kept.manifest.publication,
  evidence: kept.manifest.evidence, configHash: kept.manifest.config_hash,
  artifact: { digest: kept.artifactDigest, semanticDigest: kept.semanticDigest, schemaDigest: sha256Digest(readFileSync(new URL('../schemas/credential-eval-run-artifact-v1.json', import.meta.url))) },
  determinism: { runs, semanticDigestsEqual: true },
  ...(omitOptional !== undefined ? { omittedOptionalScanners: [omitOptional] } : {}),
  ...(receiptReuse ? { receiptReuse } : {}),
  ...(evidenceTag && !(PRODUCT_POPULATIONS as readonly string[]).includes(populationId) ? { evidenceOverride: { tag: evidenceTag, manifestDigest: evidenceManifestDigest } } : {}),
  ...(candidate ? { productCandidate: { id: candidateId, commit: candidate.product.commit, version: candidate.product.version, published: false, packages: candidate.packages.map(x => ({ name: x.name, sha256: x.sha256 })), control: engineCandidate!.product, receipt: 'product-candidate-receipt.json' } } : {}),
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
incomplete = undefined; rmSync(markerFile, { force: true });
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
