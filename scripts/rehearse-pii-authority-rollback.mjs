#!/usr/bin/env node
// Rehearsal of the PII authority rollback (#666), in the manner of web/scripts/with-authority.mjs. It changes the one committed value
// (benchmarks/pii-authority.json) in the working tree, builds the PII support publication and runs the authority gate under each value,
// and puts the file's own bytes back (also when interrupted). Nothing is committed by it and no owner authorisation is written: `new`
// is rehearsed exactly as it can be selected today, with no authorisation, and must be refused.
//
//   node --import tsx scripts/rehearse-pii-authority-rollback.mjs            run, print the record
//   node --import tsx scripts/rehearse-pii-authority-rollback.mjs --write    also write docs/generated/pii-authority-rehearsal.json
//
// The publication that is rebuilt is the one staging publishes without a product: the reviewed protected route plus the five bound
// pii-eval artifacts. The authority value is not an input of that publication, so the claim under test is that flipping and restoring
// the value changes no byte of it. It is a rehearsal against the pinned target (engine commit and the four population digests), so a
// repin makes the record stale and criterion rollback-rehearsed-for-target unmet until it is rehearsed again. Never run by a workflow
// that publishes, and never run concurrently with other tests (it edits a tracked file for its duration).
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'benchmarks/pii-authority.json');
const out = path.join(root, 'docs/generated/pii-authority-rehearsal.json');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const self = fileURLToPath(import.meta.url);

/** The child: build the publication and run the gate under whatever value the file holds now. Prints one JSON line. */
async function probe() {
  const { buildPiiSupportMatrixV2, validatePiiSupportMatrixV2 } = await import('../benchmarks/evaluation/domains/pii/support-v2.ts');
  const { bindPiiProtectedSupport } = await import('../benchmarks/evaluation/domains/pii/protected-support-binding.ts');
  const { piiEvalMeasurementFrom } = await import('./pii-publication-inputs.ts');
  const { checkPiiAuthority } = await import('./check-pii-authority.mjs');
  const dual = existsSync(path.join(root, 'benchmarks/pii-eval-official-run/record.json')) ? 'benchmarks/pii-eval-official-run' : 'benchmarks/pii-eval-population-dual-run'; // the artifacts the pins name
  const bindings = {
    piiEvalMeasurement: await piiEvalMeasurementFrom(
      ['benchmarks/pii-eval-public-synthetic-pins.json', 'benchmarks/pii-eval-population-pins.json'].map(f => path.join(root, f)),
      [JSON.parse(readFileSync(path.join(root, 'benchmarks/pii-eval-public-synthetic-source.json'), 'utf8')).durableCopy.path, ...['oracle-plan', 'qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress'].map(v => `${dual}/${v}.public-synthetic-artifact.json`)].map(f => path.join(root, f))),
  };
  const route = await bindPiiProtectedSupport(root);
  if (route) bindings.protectedRoute = route;
  const matrix = validatePiiSupportMatrixV2(buildPiiSupportMatrixV2(bindings), bindings);
  const problems = await checkPiiAuthority();
  console.log(JSON.stringify({ matrixSha256: sha256(`${JSON.stringify(matrix)}\n`), matrixBytes: Buffer.byteLength(`${JSON.stringify(matrix)}\n`), gate: { accepted: problems.length === 0, problems: problems.map(p => p.replace(/\s+/g, ' ').slice(0, 200)) } }));
}

function child() {
  const result = spawnSync(process.execPath, ['--import', 'tsx', self, '--probe'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (result.status !== 0) throw new Error(`probe failed: ${result.stderr.slice(0, 600)}`);
  return JSON.parse(result.stdout.trim().split('\n').pop());
}

async function rehearse() {
  const original = readFileSync(file, 'utf8');
  const pattern = /("authority":\s*")(legacy|new)(")/;
  if (!pattern.test(original)) throw new Error('benchmarks/pii-authority.json has no authority value to set');
  const committedValue = original.match(pattern)[2];
  const restore = () => writeFileSync(file, original);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { restore(); process.exit(130); });
  const states = [];
  try {
    for (const [label, value] of [['committed', committedValue], ['flipped', committedValue === 'legacy' ? 'new' : 'legacy'], ['rolled-back', committedValue]]) {
      writeFileSync(file, original.replace(pattern, `$1${value}$3`));
      states.push({ label, authority: value, fileSha256: sha256(readFileSync(file)), ...child() });
    }
  } finally { restore(); }
  const restoredIdentical = sha256(readFileSync(file)) === sha256(original) && states[2].fileSha256 === states[0].fileSha256;
  const migration = JSON.parse(readFileSync(path.join(root, 'benchmarks/pii-eval-migration.json'), 'utf8'));
  const flipped = states[1];
  const result = {
    matrixIdenticalAcrossValues: new Set(states.map(s => s.matrixSha256)).size === 1,
    restoredIdentical,
    legacyAccepted: [states[0], states[2]].every(s => s.authority !== 'legacy' || s.gate.accepted),
    newWithoutAuthorisationRefused: flipped.authority !== 'new' || (!flipped.gate.accepted && flipped.gate.problems.some(p => /no owner authorisation/.test(p))),
  };
  return {
    schemaVersion: 1, reportType: 'pii-authority-rollback-rehearsal', supportClaims: false, authorityChanged: false, writesAcceptance: false,
    rehearsedOn: new Date().toISOString().slice(0, 10), committedAuthority: committedValue,
    target: { engineCommit: migration.pins.piiEvalProjection, populationDigests: Object.fromEntries(JSON.parse(readFileSync(path.join(root, 'benchmarks/pii-eval-population-pins.json'), 'utf8')).populations.map(p => [p.label, p.artifactDigest])) },
    method: 'the one value flipped in the working tree and restored; the PII support publication (protected route plus the five bound pii-eval artifacts) rebuilt and the gate run under each value',
    states: states.map(({ label, authority, fileSha256, matrixSha256, matrixBytes, gate }) => ({ label, authority, fileSha256, matrixSha256, matrixBytes, gateAccepted: gate.accepted, gateProblems: gate.problems })),
    result,
  };
}

if (process.argv.includes('--probe')) await probe();
else {
  const record = await rehearse();
  const text = `${JSON.stringify(record, null, 1)}\n`;
  if (process.argv.includes('--write')) writeFileSync(out, text);
  process.stdout.write(text);
  if (!Object.values(record.result).every(Boolean)) { console.error('the rollback rehearsal did not hold'); process.exitCode = 1; }
}
