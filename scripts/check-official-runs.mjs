/**
 * CI gate: `benchmarks/official-runs.json` (#604) pins the credential-eval engine, the scanners and each population's
 * evidence identity, and records the official runs made against them. This gate checks structure and consistency only:
 * it never reads a measurement, a count or a ledger value, and asserts nothing about the product.
 * With --bindings it also rebuilds the two product-owned corpus snapshots and refuses a pin that no longer matches
 * (run before an official run; the run driver refuses the same mismatch). The spec is docs/specs/official-runs.md.
 *
 * Run: npm run official-runs:check [-- --bindings]
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const PLATFORMS = ['linux-x64', 'darwin-arm64'];
const POPULATIONS = ['public-evidence-snapshot', 'regression-corpus', 'policy-corpus'];
const PRODUCT = ['regression-corpus', 'policy-corpus'];

/** Pure consistency check of a parsed registry. `schemaDigest` is the digest of the vendored RunArtifact schema; `inputs` is the parsed qualification-inputs manifest. */
export function officialRunProblems(registry, { schemaDigest, inputs }) {
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

  for (const run of registry.runs ?? []) {
    const at = `run ${run.id}`;
    const population = populations.find(p => p.id === run.population);
    if (!population) { problems.push(`${at}: unknown population ${run.population}`); continue; }
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
    const pinnedConfig = registry.config?.platforms?.[run.platform]?.configHash;
    if (typeof pinnedConfig === 'string' && pinnedConfig !== run.configHash) problems.push(`${at}: configHash differs from the pinned ${pinnedConfig}`);
    for (const s of scanners) {
      const got = (run.scanners ?? []).find(x => x.id === s.id);
      if (!got) { problems.push(`${at}: scanner ${s.id} is missing`); continue; }
      if (got.version !== s.version) problems.push(`${at}: scanner ${s.id} ran ${got.version}, pinned ${s.version}`);
      if (got.build !== 'released') problems.push(`${at}: scanner ${s.id} is a ${got.build} build; only released builds are recorded as public evidence`);
      if (s.kind === 'executable' && got.executableSha256 !== s.executableSha256[run.platform]) problems.push(`${at}: scanner ${s.id} executable digest differs from the ${run.platform} pin`);
      if (s.kind === 'npm' && got.packageIntegrity !== s.integrity && s.id === 'redact-secret') problems.push(`${at}: scanner ${s.id} package integrity differs from the pin`);
    }
  }
  return problems;
}

const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

export async function checkOfficialRuns({ bindings = false } = {}) {
  const [registry, inputs, schemaBytes] = await Promise.all([readJson('benchmarks/official-runs.json'), readJson('benchmarks/qualification-inputs.json'), readFile(new URL('schemas/credential-eval-run-artifact-v1.json', root))]);
  const problems = officialRunProblems(registry, { schemaDigest: `sha256:${createHash('sha256').update(schemaBytes).digest('hex')}`, inputs });
  if (bindings) {
    const { exportPopulation } = await import('../benchmarks/qualification/population-snapshot.ts');
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
