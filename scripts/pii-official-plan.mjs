#!/usr/bin/env node
// The frozen execution plan of the first official public/synthetic PII measurement (#796), derived from the committed pins and never typed:
//
//   node scripts/pii-official-plan.mjs [--write | --check]
//
// It names the exact engine, protocol, candidate, scanner configuration and activation, complete populations (snapshot, manifest, roster), benchmark
// policy and scorer-basis state that a fresh execution must use, records what exists today (replays of a frozen observation, exploratory) apart from
// what does not exist (a fresh official execution), and lists the open items that stop the dispatch. It dispatches nothing, launches no scanner and
// writes no authority, owner acceptance or threshold. `--check` fails when the plan no longer equals the pins.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'benchmarks/pii-eval-official-execution-plan.json';
const read = file => readFileSync(path.join(ROOT, file));
const readJson = file => JSON.parse(read(file).toString('utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const WORKFLOW = '.github/workflows/pii-official-run.yml';
// The product build a fresh execution launches: the packages of the product commit's own `artifact-qualification` run on `main` (the workflow resolves the run
// for the commit and refuses any other id). Only the run id is typed here; the commit comes from the pins and every tarball is verified against the run's inventory.
export const CANDIDATE_BUILD = { repository: 'redact-secret/redact-secret', workflow: 'artifact-qualification.yml', ref: 'main', qualificationRunId: 37093118224 };

/**
 * What a fresh execution launches, and why its identity is not the recorded artifact-set commitment (resolved with evidence, #796):
 *  - `a26968fe…` is `sha256(canonical JSON {core, node, wasm})` of the three npm tarball digests of the frozen observation (`piiArrivalCommitment`), built locally on darwin-arm64;
 *  - the engine pins a candidate by the tree digest of the installed `@redact-secret/core` directory (`package.treeSha256`), a different construct over different bytes, and the manifest binds
 *    that digest as the scanner identity, so a run's manifest, and therefore every artifact digest, differs from the replays by construction;
 *  - only the `core` tarball is the same everywhere (CI linux, CI and local darwin); the platform package is not (the addon), so even the commitment of the linux build differs.
 */
function candidatePackage(migration) {
  const observation = readJson(migration.benchmarkPopulations.observation.path).candidate;
  return {
    name: '@redact-secret/core', entry: 'dist/index.js', coreTarballSha256: observation.components.core,
    treeSha256: 'computed-at-execution', addon: { name: '@redact-secret/node-linux-x64-gnu', pinned: 'extraArtifacts tree, digest computed at execution from the qualified tarball' },
    identity: { runIdentity: 'package.treeSha256 of the installed core directory (the engine recomputes it before launching a scanner)', recordedIdentity: 'artifact-set commitment of the frozen observation', equal: false },
  };
}

export function buildPlan() {
  const migration = readJson('benchmarks/pii-eval-migration.json');
  const pins = readJson('benchmarks/pii-eval-population-pins.json');
  const source = readJson('benchmarks/pii-eval-public-synthetic-source.json');
  const dual = migration.benchmarkPopulationDualRun;
  const decision = 'docs/decisions/2026-10-07-propose-the-pii-scorer-basis-and-metric-semantics.md';
  const decisionStatus = /^status:\s*(\S+)/m.exec(read(decision).toString('utf8'))?.[1];
  return {
    schemaVersion: 1, reportType: 'pii-official-execution-plan', issue: 'redact-secret/redact-secret-benchmarks#796', supportClaims: false, authorityChanged: false,
    state: 'pending-not-dispatched',
    note: 'Public synthetic only: no EC2, custodian, private ledger, protected corpus or production key. Derived by scripts/pii-official-plan.mjs from the committed pins; not a run and not an acceptance.',
    mode: 'official', runClass: 'public-synthetic', product: 'candidate',
    engine: {
      repository: pins.build.repository, commit: pins.build.commit, cargoLockSha256: pins.build.cargoLockSha256, binarySha256: pins.build.binarySha256, sourceArchiveSha256: pins.build.sourceArchiveSha256,
      build: 'cargo build --release --locked -p pii-eval-cli', ci: { runId: source.workflow.runId, engineArtifactId: source.artifacts.engine.id, engineArtifactName: source.artifacts.engine.name, archiveSha256: source.artifacts.engine.archiveSha256, expiresAt: source.artifacts.engine.expiresAt },
    },
    protocol: { id: 'pii-v1', revision: migration.engine.protocol.revision, artifactSchema: migration.engine.artifactSchema.version },
    candidate: { ...migration.benchmarkPopulations.candidate, build: CANDIDATE_BUILD, package: candidatePackage(migration) },
    scanner: { adapter: migration.scanner.adapter, configurationDigest: migration.scanner.configurationDigest, activationDigest: migration.scanner.activationDigest, activation: migration.scanner.activation },
    populations: pins.populations.map(p => {
      const item = dual.artifacts.find(a => a.view === p.label);
      return { view: p.label, populationId: p.population.populationId, snapshotDigest: p.population.populationDigest, manifestDigest: p.manifestDigest, rosterDigest: p.projection.rosterDigest,
        memberships: item.cases, located: item.locatedCases, unresolvedRange: item.unresolvedRangeCases, expectedMode: 'official', currentMode: p.projection.mode };
    }),
    benchmarkPolicy: {
      qualificationProfile: { path: 'qualification/pii-v1.json', sha256: sha256(read('qualification/pii-v1.json')) },
      scorerBasis: { decision, status: decisionStatus, spec: 'docs/specs/pii-scorer-basis.md' },
    },
    provenance: {
      today: 'replay-of-frozen-observation',
      detail: 'The four committed artifacts are replays of the frozen Beta.13 observation (no scanner launched), exploratory; the canonical linux replay equals them byte for byte. A replay proves deterministic reproduction, not a fresh execution.',
      replay: { receipt: dual.linuxReplay.path, runId: dual.linuxReplay.runId, scannersLaunched: 0 },
      freshOfficialExecution: null,
    },
    openItems: openItems(decisionStatus),
    resolvedItems: [
      { id: 'candidate-package-identity', text: 'Resolved with evidence: the candidate digest of a run is the tree digest of the launched package, and it is not the recorded artifact-set commitment (different construct, different bytes; the addon tarball is platform specific). The manifest is therefore rebuilt for the run, the snapshot and roster stay identical, and the receipt records both numbers (docs/specs/pii-official-execution-plan.md).' },
    ],
    dispatch: dispatchBlock(),
    execution: { localDarwin: 'verification only, never compared with a linux run', canonicalPlatform: 'linux-x64' },
  };
}

function openItems(decisionStatus) {
  const items = [];
  if (decisionStatus !== 'accepted') items.push({ id: 'scorer-basis', text: 'The scorer-basis decision (#795) is not accepted; "complete populations validate under the accepted scorer semantics" cannot be asserted before it.' });
  if (!existsSync(path.join(ROOT, WORKFLOW))) items.push({ id: 'dispatch-workflow', text: 'No workflow executes `pii-eval run --config` against a scanner package in CI; it must be added and reviewed (dispatch only, read-only pii-eval App token for the pinned engine artifact, no token in the scanner step).' });
  items.push({ id: 'cost', text: 'A fresh Linux execution of four populations (1,188 memberships) plus the candidate package fetch is a long run; the owner waived the cost gate for exactly one dispatch (2026-10-06, #796), so there is no default re-dispatch.' });
  return items;
}

function dispatchBlock() {
  const exists = existsSync(path.join(ROOT, WORKFLOW));
  return {
    workflow: exists ? WORKFLOW : null, dispatched: false,
    intendedCommand: 'gh workflow run pii-official-run.yml -R redact-secret/redact-secret-benchmarks --ref <branch-holding-the-workflow>',
    note: exists ? 'Dispatch only, no inputs (the plan is this file at the dispatched commit). One dispatch is approved; a failed run caused by an infrastructure or workflow defect may be fixed and dispatched once more, said so in the record.' : 'The workflow named in the intended command does not exist yet (open item dispatch-workflow). Nothing was dispatched.',
  };
}

const text = value => `${JSON.stringify(value, null, 2)}\n`;
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const plan = buildPlan();
  if (process.argv.includes('--write')) { writeFileSync(path.join(ROOT, OUT), text(plan)); console.log(`wrote ${OUT}`); }
  else if (process.argv.includes('--check')) {
    if (text(plan) !== read(OUT).toString('utf8')) throw new Error(`${OUT} differs from the pins: run node scripts/pii-official-plan.mjs --write`);
    if (plan.populations.some(p => p.memberships !== p.located + p.unresolvedRange)) throw new Error('a population does not add up');
    if (plan.provenance.freshOfficialExecution !== null || plan.dispatch.dispatched !== false) throw new Error('the plan claims an execution that was not recorded');
    console.log(`${OUT} equals the pins (pending, not dispatched)`);
  } else if (process.argv.includes('--github-output')) {
    // What the dispatch-only workflow reads (key=value lines for $GITHUB_OUTPUT), after refusing a plan that is not an exact official public-synthetic candidate plan.
    const hex = (value, size) => typeof value === 'string' && new RegExp(`^[0-9a-f]{${size}}$`).test(value);
    if (plan.mode !== 'official' || plan.runClass !== 'public-synthetic' || plan.product !== 'candidate' || plan.authorityChanged !== false || plan.supportClaims !== false) throw new Error('the plan is not an official public-synthetic candidate plan');
    if (!hex(plan.candidate.sourceCommit, 40) || !hex(plan.engine.commit, 40) || !hex(plan.candidate.package.coreTarballSha256, 64) || !Number.isSafeInteger(plan.candidate.build.qualificationRunId) || plan.candidate.build.ref !== 'main') throw new Error('the plan does not name an exact candidate and engine');
    console.log([`product_sha=${plan.candidate.sourceCommit}`, `product_ref=${plan.candidate.build.ref}`, `qualification_run_id=${plan.candidate.build.qualificationRunId}`,
      `core_tarball_sha256=${plan.candidate.package.coreTarballSha256}`, `engine_commit=${plan.engine.commit}`].join('\n'));
  } else console.log(text(plan));
}
