/**
 * CI gate: `benchmarks/official-runs.json` (#604) pins the credential-eval engine, the scanners and each population's
 * evidence identity, and records the official runs made against them. This gate checks structure and consistency only:
 * it never reads a measurement, a count or a ledger value, and asserts nothing about the product.
 * With --bindings it also rebuilds the two product-owned corpus snapshots and refuses a pin that no longer matches
 * (run before an official run; the run driver refuses the same mismatch). The spec is docs/specs/official-runs.md.
 *
 * Run: npm run official-runs:check [-- --bindings]
 */
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const PLATFORMS = ['linux-x64', 'darwin-arm64'];
const POPULATIONS = ['public-evidence-snapshot', 'regression-corpus', 'policy-corpus'];
const PRODUCT = ['regression-corpus', 'policy-corpus'];
/** The scanners the roster lets an official run leave out when it says so (#763): benchmarks/support/scanner-roster.json, the same file the adapter reads. */
const rosterFile = JSON.parse(readFileSync(new URL('../benchmarks/support/scanner-roster.json', import.meta.url), 'utf8'));
const optionalOfficial = new Set(rosterFile.runClasses.official.optional);

/** Pure consistency check of a parsed registry. `schemaDigest` is the digest of the vendored RunArtifact schema; `inputs` is the parsed qualification-inputs manifest. */
export function officialRunProblems(registry, { schemaDigest, inputs, evaluationEvidenceDigest }) {
  const problems = [];
  const e = registry.engine ?? {};
  if (registry.schemaVersion !== 1) problems.push('schemaVersion must be 1');
  if (!/^v\d+\.\d+\.\d+/.test(e.tag ?? '') || !/^[0-9a-f]{40}$/.test(e.revision ?? '') || !e.version || !/^credential-eval-protocol\/\d+$/.test(e.protocol ?? '')) problems.push('engine needs a tag, a full 40-hex revision, a version and a protocol');
  if (!DIGEST.test(e.runArtifactSchema?.sha256 ?? '')) problems.push('engine.runArtifactSchema.sha256 must be sha256:<64 hex>');
  else if (e.runArtifactSchema.sha256 !== schemaDigest) problems.push(`the vendored RunArtifact schema digest ${schemaDigest} differs from the pinned ${e.runArtifactSchema.sha256}`);

  for (const platform of PLATFORMS) if (!registry.config?.platforms?.[platform]?.file) problems.push(`config.platforms.${platform}.file is required`);
  if (Object.values(registry.config?.platforms ?? {}).filter(p => p.canonical).length !== 1 || !registry.config?.platforms?.['linux-x64']?.canonical) problems.push('exactly one platform configuration is canonical, and it is linux-x64 (the CI platform)');

  const scanners = registry.scanners ?? [];
  if (new Set(scanners.map(s => s.id)).size !== scanners.length || scanners.length === 0) problems.push('scanners must be a non-empty list with unique ids');
  for (const s of scanners) {
    if (!s.version) problems.push(`scanner ${s.id}: version is required`);
    if (s.kind === 'executable') {
      for (const platform of PLATFORMS) {
        if (!DIGEST.test(s.executableSha256?.[platform] ?? '')) problems.push(`scanner ${s.id}: executableSha256.${platform} must be sha256:<64 hex>`);
        if (!DIGEST.test(s.archiveSha256?.[platform] ?? '')) problems.push(`scanner ${s.id}: archiveSha256.${platform} must be sha256:<64 hex>`);
      }
    } else if (s.kind === 'npm') {
      if (!/^sha512-[A-Za-z0-9+/=]+$/.test(s.integrity ?? '') || !s.package) problems.push(`scanner ${s.id}: an npm scanner needs a package and a sha512 integrity`);
    } else problems.push(`scanner ${s.id}: kind must be executable or npm`);
  }

  const populations = registry.populations ?? [];
  if (populations.map(p => p.id).join(',') !== POPULATIONS.join(',')) problems.push(`populations must be exactly, in order: ${POPULATIONS.join(', ')}`);
  for (const p of populations) {
    const at = `population ${p.id}`;
    const declared = inputs.populations.find(x => x.id === p.id);
    if (!declared) { problems.push(`${at}: not a population in benchmarks/qualification-inputs.json`); continue; }
    if (!['public', 'internal'].includes(p.runClass) || !declared.runClasses.includes(p.runClass)) problems.push(`${at}: runClass ${p.runClass} is not one of the run classes the population is allowed (${declared.runClasses.join(', ')})`);
    if (p.publishable !== declared.runClasses.includes('public')) problems.push(`${at}: publishable must equal whether the population may carry the public run class`);
    const ev = p.evidence ?? {};
    if (!ev.source || !ev.evidenceSchema || !ev.revision) problems.push(`${at}: evidence needs source, revision and evidenceSchema`);
    if (!DIGEST.test(ev.corpusDigest ?? '') || !DIGEST.test(ev.release?.manifestDigest ?? '') || !ev.release?.tag) problems.push(`${at}: evidence needs corpusDigest, release.tag and release.manifestDigest`);
    if (PRODUCT.includes(p.id)) {
      if (ev.revision !== `corpus-${ev.corpusDigest}`) problems.push(`${at}: a product population is content-addressed; revision must be corpus-<corpusDigest>`);
      if (!ev.release?.tag?.endsWith(ev.corpusDigest?.slice(7, 19) ?? '?')) problems.push(`${at}: release.tag must end with the first 12 hex digits of the corpus digest`);
    } else {
      const pin = declared.pin;
      if (ev.release?.tag !== pin.evidenceRelease || ev.release?.manifestDigest !== pin.manifestDigest || ev.corpusDigest !== pin.snapshotDigest)
        problems.push(`${at}: evidence differs from the pin in benchmarks/qualification-inputs.json (release tag, manifest digest, snapshot digest)`);
    }
  }

  // The methods run: a second official run of the floors population with the evaluation methods selected on the command line (a
  // configuration that names methods is refused by the engine) and the product evaluation evidence file pinned by digest.
  const methodsRun = registry.methodsRun;
  if (!methodsRun) problems.push('methodsRun is required: the pinned selection of the methods run');
  else {
    if (methodsRun.population !== 'public-evidence-snapshot') problems.push('methodsRun.population must be the floors population, public-evidence-snapshot');
    if (!Array.isArray(methodsRun.methods) || !methodsRun.methods.length || methodsRun.methods.join(',') !== [...new Set(methodsRun.methods)].sort().join(',')) problems.push('methodsRun.methods must be sorted, unique and non-empty');
    for (const method of ['metamorphic', 'mutation', 'differential']) if (!(methodsRun.methods ?? []).includes(method)) problems.push(`methodsRun.methods must include ${method}: the stable gates read it`);
    if (!methodsRun.reference || !['case-id', 'legacy-category'].includes(methodsRun.seed)) problems.push('methodsRun needs a reference scanner and a seed of case-id or legacy-category');
    if (!scanners.some(s => s.id === methodsRun.reference)) problems.push(`methodsRun.reference ${methodsRun.reference} is not a pinned scanner`);
    if (!methodsRun.evaluationEvidence?.file || !DIGEST.test(methodsRun.evaluationEvidence?.digest ?? '')) problems.push('methodsRun.evaluationEvidence needs a file and a sha256 digest');
    // `measuredWith`: digests of the earlier evidence files the recorded canonical methods runs actually read. A contract change re-derives the file; the recorded run keeps the digest it was measured with (its record is never rewritten) until a new methods run is made.
    for (const d of methodsRun.evaluationEvidence?.measuredWith ?? []) if (!DIGEST.test(d) || d === methodsRun.evaluationEvidence?.digest) problems.push('methodsRun.evaluationEvidence.measuredWith must list sha256 digests other than the pinned one');
    if (evaluationEvidenceDigest && evaluationEvidenceDigest !== methodsRun.evaluationEvidence?.digest) problems.push(`the evaluation evidence file has digest ${evaluationEvidenceDigest}, methodsRun pins ${methodsRun.evaluationEvidence?.digest}`);
  }

  const runIds = new Set();
  for (const run of registry.runs ?? []) {
    const at = `run ${run.id}`;
    if (runIds.has(run.id)) problems.push(`${at}: duplicate run id`);
    runIds.add(run.id);
    const population = populations.find(p => p.id === run.population);
    if (!population) { problems.push(`${at}: unknown population ${run.population}`); continue; }
    const isMethods = run.kind === 'methods';
    if (run.id !== `${run.population}${isMethods ? '+methods' : ''}@${run.platform}`) problems.push(`${at}: id must be <population>${isMethods ? '+methods' : ''}@<platform>`);
    if (isMethods) {
      if (!methodsRun || run.population !== methodsRun.population) problems.push(`${at}: a methods run is recorded for the pinned methodsRun population only`);
      else {
        if (JSON.stringify(run.methods) !== JSON.stringify(methodsRun.methods)) problems.push(`${at}: methods differ from the pinned methodsRun.methods`);
        if (![methodsRun.evaluationEvidence?.digest, ...(methodsRun.evaluationEvidence?.measuredWith ?? [])].includes(run.evaluation?.evidenceDigest) || run.evaluation?.reference !== methodsRun.reference || run.evaluation?.seed !== methodsRun.seed) problems.push(`${at}: evaluation (reference, seed, evidence digest) differs from the pinned methodsRun`);
      }
    } else if (run.kind !== undefined) problems.push(`${at}: unknown kind ${run.kind}`);
    if (!PLATFORMS.includes(run.platform)) problems.push(`${at}: unknown platform ${run.platform}`);
    if (run.canonical !== Boolean(registry.config?.platforms?.[run.platform]?.canonical)) problems.push(`${at}: canonical must be true exactly for the canonical platform`);
    if (run.engine?.version !== e.version || run.engine?.revision !== e.revision || run.engine?.protocol !== e.protocol) problems.push(`${at}: engine differs from the pinned engine`);
    if (run.engineRunClass !== 'official') problems.push(`${at}: only official runs are recorded`);
    if (!['public', 'internal'].includes(run.publication)) problems.push(`${at}: publication must be public or internal`);
    if (run.runClass === 'public' && (run.publication !== 'public' || !population.publishable)) problems.push(`${at}: a public run needs publication public and a publishable population`);
    const expected = population.evidence;
    const got = run.evidence ?? {};
    if (got.source !== expected.source || got.revision !== expected.revision || got.evidence_schema !== expected.evidenceSchema || got.corpus_digest !== expected.corpusDigest ||
        got.release?.tag !== expected.release.tag || got.release?.manifest_digest !== expected.release.manifestDigest) problems.push(`${at}: evidence differs from the population pin`);
    if (!DIGEST.test(run.artifact?.semanticDigest ?? '') || !DIGEST.test(run.artifact?.byteDigest ?? '') || run.artifact?.schemaDigest !== schemaDigest) problems.push(`${at}: artifact needs semanticDigest, byteDigest and the pinned schemaDigest`);
    if (!(run.determinism?.runs >= 2) || run.determinism?.semanticDigestsEqual !== true) problems.push(`${at}: an official artifact needs at least two runs with equal semantic digests`);
    if (!DIGEST.test(run.configHash ?? '')) problems.push(`${at}: configHash is required`);
    const pinnedConfig = isMethods ? undefined : registry.config?.platforms?.[run.platform]?.configHash;
    if (typeof pinnedConfig === 'string' && pinnedConfig !== run.configHash) problems.push(`${at}: configHash differs from the pinned ${pinnedConfig}`);
    const omittedOptional = new Set(run.omittedOptionalScanners ?? []);
    for (const id of omittedOptional) if (!optionalOfficial.has(id) || (run.scanners ?? []).some(x => x.id === id)) problems.push(`${at}: omittedOptionalScanners names ${id}, which is not an optional scanner left out of this run`);
    // The scanner selection a run was made under (#812) must agree with what the run measured: its scanners, its opted-in optional scanners and the configuration it names are the run's identity.
    if (run.scannerSelection) {
      const sel = run.scannerSelection;
      const ran = (run.scanners ?? []).map(x => x.id).sort().join(','), said = [...(sel.scanners ?? [])].sort().join(',');
      if (ran !== said) problems.push(`${at}: scannerSelection names the scanners ${said}, the run measured ${ran}`);
      for (const id of sel.includedOptionalScanners ?? []) if (!optionalOfficial.has(id) || !(run.scanners ?? []).some(x => x.id === id)) problems.push(`${at}: scannerSelection includes ${id}, which is not an optional scanner this run measured`);
      for (const id of sel.omittedOptionalScanners ?? []) if (!omittedOptional.has(id)) problems.push(`${at}: scannerSelection omits ${id} but omittedOptionalScanners does not say so`);
      if (typeof sel.configFile !== 'string' || !sel.configFile) problems.push(`${at}: scannerSelection names no configuration file`);
      else if (sel.configHash !== undefined && sel.configHash !== run.configHash) problems.push(`${at}: scannerSelection configHash differs from the run's configHash`);
    }
    for (const s of scanners) {
      const got = (run.scanners ?? []).find(x => x.id === s.id);
      // An OPTIONAL scanner of the roster may be left out of a run that says so (#763): never silently, and never a required one.
      if (!got && omittedOptional.has(s.id) && optionalOfficial.has(s.id)) continue;
      if (!got) { problems.push(`${at}: scanner ${s.id} is missing`); continue; }
      if (got.version !== s.version) problems.push(`${at}: scanner ${s.id} ran ${got.version}, pinned ${s.version}`);
      if (got.build !== 'released') problems.push(`${at}: scanner ${s.id} is a ${got.build} build; only released builds are recorded as public evidence`);
      if (s.kind === 'executable' && got.executableSha256 !== s.executableSha256[run.platform]) problems.push(`${at}: scanner ${s.id} executable digest differs from the ${run.platform} pin`);
      if (s.kind === 'npm' && got.packageIntegrity !== s.integrity && s.id === 'redact-secret') problems.push(`${at}: scanner ${s.id} package integrity differs from the pin`);
    }
  }
  problems.push(...historicalRunProblems(registry));
  problems.push(...retainedMeasurementProblems(registry, rosterFile));
  return problems;
}

/**
 * Retained measurements of the scanner roster (#763): the roster keeps a pointer to the last official measurement of an optional scanner whose runs the registry no
 * longer lists. A retained run must not also be in the registry (one source per run, so the pointer never disagrees with the registry), must be older than every
 * active run, and must name an optional scanner of the official run class.
 */
export function retainedMeasurementProblems(registry, roster) {
  const problems = [];
  const listed = new Set([...(registry.runs ?? []), ...(registry.historicalRuns ?? [])].map(r => `${r.id}|${r.artifact?.semanticDigest}`));
  const newest = (registry.runs ?? []).map(r => r.recordedOn).filter(Boolean).sort().at(-1);
  for (const [id, spec] of Object.entries(roster.optionalScanners ?? {})) {
    if (!(spec.retainedMeasurements ?? []).length) continue;
    if (!(roster.runClasses?.official?.optional ?? []).includes(id)) problems.push(`scanner-roster retainedMeasurements: ${id} is not an optional scanner of the official run class`);
    for (const m of spec.retainedMeasurements) {
      if (newest && m.recordedOn >= newest) problems.push(`scanner-roster retainedMeasurements: ${id} ${m.recordedOn} is not older than the active runs (${newest}); a measurement the registry still holds is read from the registry`);
      for (const r of m.runs ?? []) if (listed.has(`${r.id}|${r.semanticDigest}`)) problems.push(`scanner-roster retainedMeasurements: ${id} run ${r.id} is also listed by the registry; keep it in one place`);
    }
  }
  return problems;
}

/**
 * Historical receipts (#690): runs that were accepted evidence for an earlier pin, kept after a repin. They are receipts, not
 * evidence of the current pin, so they live apart from runs[] (which must match the pins) and are never read as canonical by the
 * authority check. Each must say what superseded it and must not be a run of the current pin.
 */
export function historicalRunProblems(registry) {
  const problems = [];
  const populations = registry.populations ?? [];
  const seen = new Set();
  for (const run of registry.historicalRuns ?? []) {
    const at = `historical run ${run.id}`;
    const key = `${run.id}|${run.evidence?.release?.manifest_digest}`;
    if (seen.has(key)) problems.push(`${at}: duplicate historical receipt for the same evidence release`);
    seen.add(key);
    const population = populations.find(p => p.id === run.population);
    if (!population) { problems.push(`${at}: unknown population ${run.population}`); continue; }
    if (run.status !== 'historical') problems.push(`${at}: status must be "historical"`);
    if (!DIGEST.test(run.supersededBy?.manifestDigest ?? '') || !run.supersededBy?.evidenceRelease || !run.supersededOn) problems.push(`${at}: supersededBy (evidenceRelease, manifestDigest) and supersededOn are required`);
    if (!run.evidence?.release?.tag || !DIGEST.test(run.evidence?.release?.manifest_digest ?? '') || !DIGEST.test(run.evidence?.corpus_digest ?? '')) problems.push(`${at}: evidence needs release.tag, release.manifest_digest and corpus_digest`);
    if (!DIGEST.test(run.artifact?.semanticDigest ?? '') || !DIGEST.test(run.artifact?.byteDigest ?? '')) problems.push(`${at}: artifact needs semanticDigest and byteDigest`);
    if (run.evidence?.release?.manifest_digest === population.evidence?.release?.manifestDigest) problems.push(`${at}: its evidence is the population's current pin, so it belongs in runs[], not in the receipts`);
    if (run.supersededBy?.manifestDigest === run.evidence?.release?.manifest_digest) problems.push(`${at}: a run cannot be superseded by its own evidence release`);
  }
  return problems;
}

const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

export async function checkOfficialRuns({ bindings = false } = {}) {
  const [registry, inputs, schemaBytes] = await Promise.all([readJson('benchmarks/official-runs.json'), readJson('benchmarks/qualification-inputs.json'), readFile(new URL('schemas/credential-eval-run-artifact-v1.json', root))]);
  const { canonical, sha256Digest } = await import('../benchmarks/qualification/canonical.ts');
  const evaluationEvidenceDigest = sha256Digest(canonical(await readJson(registry.methodsRun?.evaluationEvidence?.file ?? 'benchmarks/qualification/evaluation-evidence.json')));
  const problems = officialRunProblems(registry, { schemaDigest: `sha256:${createHash('sha256').update(schemaBytes).digest('hex')}`, inputs, evaluationEvidenceDigest });
  if (bindings) {
    const { exportPopulation } = await import('../benchmarks/qualification/population-snapshot.ts');
    const { evaluationEvidenceDigest: derived } = await import('../benchmarks/qualification/evaluation-evidence.ts');
    if (derived() !== evaluationEvidenceDigest) problems.push(`the evaluation evidence file is stale against the product contracts (derived ${derived()}, committed ${evaluationEvidenceDigest}); run npm run qualification:evidence`);
    for (const id of PRODUCT) {
      const pin = registry.populations.find(p => p.id === id)?.evidence;
      const built = await exportPopulation(id);
      if (built.corpusDigest !== pin?.corpusDigest || built.tag !== pin?.release?.tag || built.manifestDigest !== pin?.release?.manifestDigest)
        problems.push(`population ${id}: the corpus now has digest ${built.corpusDigest} (manifest ${built.manifestDigest}); re-run it officially and re-pin benchmarks/official-runs.json`);
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = await checkOfficialRuns({ bindings: process.argv.includes('--bindings') });
  if (problems.length > 0) {
    console.error(`${problems.length} official-run problem(s):\n${problems.map(problem => `  - ${problem}`).join('\n')}`);
    process.exit(1);
  }
  console.log('Official runs: engine, scanners and population evidence are pinned, and every recorded run matches its pins.');
}
