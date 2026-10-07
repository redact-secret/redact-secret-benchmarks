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
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'benchmarks/pii-eval-official-execution-plan.json';
const read = file => readFileSync(path.join(ROOT, file));
const readJson = file => JSON.parse(read(file).toString('utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

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
    candidate: migration.benchmarkPopulations.candidate,
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
    openItems: [
      { id: 'scorer-basis', text: 'The scorer-basis decision (#795) is proposed and the owner decision is pending; "complete populations validate under the accepted scorer semantics" cannot be asserted before it.' },
      { id: 'candidate-package-identity', text: 'An official run requires the scanner package tree digest (`package.treeSha256`, the candidate digest) and pinned extra artifacts (native addon). The recorded candidate identity is the artifact-set commitment of the frozen observation; whether it equals the tree digest the engine derives from the beta.13 package is not established, and the package for a fresh run has to be obtained from the product repository build.' },
      { id: 'dispatch-workflow', text: 'No workflow executes `pii-eval run --config` against a scanner package in CI; it must be added and reviewed (dispatch only, read-only pii-eval App token for the pinned engine artifact, no token in the scanner step).' },
      { id: 'cost', text: 'A fresh Linux execution of four populations (1,188 memberships) plus the candidate package build is a long run; the owner decides whether to dispatch it (CI cost).' },
    ],
    dispatch: {
      workflow: null, dispatched: false,
      intendedCommand: 'gh workflow run pii-official-run.yml -R redact-secret/redact-secret-benchmarks --ref develop -f plan=benchmarks/pii-eval-official-execution-plan.json',
      note: 'The workflow named in the intended command does not exist yet (open item dispatch-workflow). Nothing was dispatched.',
    },
    execution: { localDarwin: 'verification only, never compared with a linux run', canonicalPlatform: 'linux-x64' },
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
  } else console.log(text(plan));
}
