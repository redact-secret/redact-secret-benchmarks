import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, existsSync, readdirSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sha256, expectedPreflightReport } from '../scripts/lib/pii-evidence-contract.mjs';
import { preparePiiEvidenceAdoption, validateMaintainerAcceptance, adoptionDigest, validateAdoptionScanner, validateActiveEvidenceAdoption } from '../scripts/lib/pii-evidence-adoption.mjs';
import { applyEvidenceAdoption, adoptionUpdateFiles, checkActiveEvidenceFiles, prepareEvidenceAdoptionReview } from '../scripts/lib/pii-evidence-adoption-apply.mjs';
import { collectEvidenceComparison } from '../scripts/record-pii-evidence-comparison.mjs';
import { loadPiiEvidenceComparison } from '../benchmarks/evaluation/domains/pii/evidence-comparison.mjs';
import { syntheticEvidenceOfficialUpload, syntheticFutureEvidenceOfficialUpload } from './helpers/pii-evidence-comparison-fixture.mjs';
import { main, parseProposalJson } from '../scripts/prepare-pii-evidence-adoption.mjs';

const policy = JSON.parse(readFileSync(new URL('../benchmarks/pii-population-policy.json', import.meta.url), 'utf8'));
const preflight = () => expectedPreflightReport(policy);
const scanner = () => ({ schema: 'pii-evidence-scanner-identity/1', sourceCommit: 'a'.repeat(40), version: '0.1.0-beta.14', kind: 'published-npm',
  coreTarballSha256: 'b'.repeat(64), nativeTarballSha256: 'c'.repeat(64), wasmTarballSha256: 'd'.repeat(64),
  packageTreeSha256: 'e'.repeat(64), adapterDigest: 'f'.repeat(64), configurationDigest: '1'.repeat(64), activationDigest: '2'.repeat(64) });
const input = () => ({ policy, preflight: preflight() });

test('preparing the same public input is deterministic and does not invent execution or acceptance', () => {
  const first = preparePiiEvidenceAdoption(input()), second = preparePiiEvidenceAdoption(input());
  assert.deepEqual(first, second);
  assert.equal(first.ownerAcceptance, null);
  assert.equal(first.adoption.canApply, false);
  assert.equal(first.measurement.scannerExecutions, 0);
  assert.equal(first.measurement.targetSelected, false);
  assert.equal(first.measurement.reused, false);
  assert.equal(first.activePinsChanged, false);
  assert.ok(Object.values(first.changes.losses).every(row => row.previous === null && row.delta === null));
});

test('identical identities require receipt validation before reuse and a changed scanner loses eligibility', () => {
  const identical = preparePiiEvidenceAdoption({ ...input(), scanner: scanner(), previousPreflight: preflight(), previousScanner: scanner() });
  assert.equal(identical.measurement.identityCompatible, true);
  assert.equal(identical.measurement.reused, false);
  assert.equal(identical.measurement.state, 'fresh-execution-required');
  assert.ok(identical.historical);
  for (const key of ['sourceCommit', 'coreTarballSha256', 'configurationDigest', 'activationDigest']) {
    const changed = scanner(); changed[key] = '3'.repeat(key === 'sourceCommit' ? 40 : 64);
    const result = preparePiiEvidenceAdoption({ ...input(), scanner: changed, previousPreflight: preflight(), previousScanner: scanner() });
    assert.equal(result.measurement.identityCompatible, false);
    assert.equal(result.measurement.reused, false);
  }
});

test('invalid preflight, owner claims, raw extra fields and unbound scanner identities refuse', () => {
  for (const mutate of [
    value => { value.preflight.supportClaims = true; },
    value => { value.preflight.activePinsChanged = true; },
    value => { value.preflight.verification.canonical = true; },
    value => { value.preflight.counts.occurrences += 1; },
    value => { value.preflight.losses['phi-domain-not-carried'] = 0; },
    value => { value.preflight.raw = 'CANARY-DO-NOT-PRINT'; },
    value => { value.scanner = { ...scanner(), sourceCommit: 'latest-main' }; },
    value => { value.previousScanner = scanner(); },
  ]) {
    const value = input(); mutate(value);
    assert.throws(() => preparePiiEvidenceAdoption(value));
  }
  assert.throws(() => validateAdoptionScanner({ ...scanner(), binary: 'unbound' }));
});

test('external acceptance binds the proposal but cannot waive missing measurement or write an active pin', () => {
  const candidate = preparePiiEvidenceAdoption(input());
  const acceptance = { schema: 'pii-evidence-maintainer-acceptance/1', scope: 'public-evidence-snapshot-adoption',
    candidateDigest: candidate.candidateDigest, acceptedBy: 'Example Maintainer', acceptedAt: '2026-10-08T12:00:00Z',
    source: 'https://github.com/redact-secret/redact-secret-benchmarks/issues/841#issuecomment-123' };
  const reviewed = preparePiiEvidenceAdoption({ ...input(), acceptance });
  assert.equal(reviewed.candidateDigest, candidate.candidateDigest);
  assert.equal(reviewed.ownerAcceptance, null);
  assert.equal(reviewed.acceptanceReview.activeUpdateApplied, false);
  assert.equal(reviewed.acceptanceReview.measurementValidated, false);
  assert.equal(reviewed.adoption.canApply, false);
  for (const change of [{ scope: 'product-support' }, { candidateDigest: '0'.repeat(64) }, { source: 'https://example.com/approval' },
    { acceptedBy: 'CANARY\nDO-NOT-PRINT' }, { acceptedAt: '2026-02-30T12:00:00Z' }, { ownerCriterion: true }]) {
    assert.throws(() => validateMaintainerAcceptance({ ...acceptance, ...change }, candidate.candidateDigest));
  }
  assert.notEqual(adoptionDigest({ scanner: scanner() }), candidate.candidateDigest);
});

function sandbox(body) {
  const root = mkdtempSync(join(tmpdir(), 'pii-adoption-'));
  try {
    mkdirSync(join(root, 'benchmarks'));
    writeFileSync(join(root, 'benchmarks/pii-population-policy.json'), JSON.stringify(policy));
    writeFileSync(join(root, 'preflight.json'), JSON.stringify(preflight()));
    body(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const args = ['--preflight', 'preflight.json', '--out-dir', 'results-output/pii-evidence-adoption/example'];
const run = (root, argv = args) => {
  const messages = [];
  const code = main(argv, { root, out: message => messages.push(message), err: message => messages.push(message) });
  return { code, messages };
};

test('CLI writes a new scratch proposal only and refuses overwrite without changing inputs', () => sandbox(root => {
  const before = readFileSync(join(root, 'benchmarks/pii-population-policy.json'), 'utf8');
  assert.equal(run(root).code, 0);
  const output = join(root, args[3]);
  assert.deepEqual(readdirSync(output).sort(), ['acceptance-plan.json', 'candidate.json', 'summary.md']);
  const candidate = readFileSync(join(output, 'candidate.json'), 'utf8');
  assert.equal(run(root).code, 1);
  assert.equal(readFileSync(join(output, 'candidate.json'), 'utf8'), candidate);
  assert.equal(readFileSync(join(root, 'benchmarks/pii-population-policy.json'), 'utf8'), before);
}));

test('CLI invalid and duplicate-key inputs refuse before writes with bounded diagnostics', () => sandbox(root => {
  writeFileSync(join(root, 'preflight.json'), '{"state":"CANARY-DO-NOT-PRINT","state":"duplicate"}');
  const result = run(root);
  assert.equal(result.code, 1);
  assert.equal(result.messages.join().includes('CANARY'), false);
  assert.equal(existsSync(join(root, 'results-output')), false);
}));

test('CLI unsafe output, symlink input/parent and unknown flags refuse', () => {
  for (const output of ['benchmarks/active', '../escape', '/tmp/escape', 'results-output/pii-evidence-adoption/a/b']) sandbox(root => {
    assert.equal(run(root, ['--preflight', 'preflight.json', '--out-dir', output]).code, 1);
    assert.equal(existsSync(join(root, 'results-output')), false);
  });
  sandbox(root => {
    mkdirSync(join(root, 'outside'));
    symlinkSync(join(root, 'outside'), join(root, 'results-output'));
    assert.equal(run(root).code, 1);
    assert.deepEqual(readdirSync(join(root, 'outside')), []);
  });
  sandbox(root => {
    symlinkSync(join(root, 'preflight.json'), join(root, 'linked.json'));
    assert.equal(run(root, ['--preflight', 'linked.json', '--out-dir', args[3]]).code, 1);
    assert.equal(run(root, [...args, '--dispatch', 'yes']).code, 1);
  });
});


test('a future verified release prepares without hand-editing the initial immutable anchor', () => {
  const previous = preflight(), snapshotPin = structuredClone(previous.evidence), consumerPin = structuredClone(previous.consumer);
  snapshotPin.snapshot.id = 'public-pii-phi/2026-10-09/aaaaaaaaaaaa';
  snapshotPin.snapshot.contentDigest = 'a'.repeat(64);
  snapshotPin.release.tag = 'snapshot-public-pii-phi-2026-10-09-aaaaaaaaaaaa';
  snapshotPin.release.archive.name = 'pii-evidence-public-pii-phi-2026-10-09-aaaaaaaaaaaa.tar.gz';
  snapshotPin.release.commit = 'b'.repeat(40);
  consumerPin.importedPopulation.id = 'pii-evidence-public-pii-phi-2026-10-09-aaaaaaaaaaaa';
  consumerPin.importedPopulation.digest = 'c'.repeat(64);
  consumerPin.importedPopulation.bindingDigest = 'd'.repeat(64);
  const next = expectedPreflightReport(policy, { snapshotPin, consumerPin });
  const candidate = preparePiiEvidenceAdoption({ policy, preflight: next, previousPreflight: previous, scanner: scanner(), previousScanner: scanner() });
  assert.equal(candidate.identity.evidence.snapshot.id, snapshotPin.snapshot.id);
  assert.deepEqual(candidate.historical.identity.evidence, previous.evidence);
  assert.equal(candidate.measurement.identityCompatible, false);
  assert.equal(candidate.measurement.reused, false);
  assert.deepEqual(candidate.changes.mappedKinds, { added: [], removed: [] });
  assert.deepEqual(previous, preflight());
});

test('nullable policy parsing rejects duplicate, malformed, nonfinite and excessively nested JSON', () => {
  assert.equal(parseProposalJson('{"pending":null}').pending, null);
  for (const text of ['{"a":1,"a":2}', '{"nested":{"a":1,"a":2}}', '[1,]', '{"a":null,}', '1e999', 'true false', '\ufeff{}', '['.repeat(66) + '0' + ']'.repeat(66)]) {
    assert.throws(() => parseProposalJson(text));
  }
});


function activeInput(e = syntheticEvidenceOfficialUpload(), previous = null) {
  const receiptText = e.files['receipt.json'];
  const record = collectEvidenceComparison(e).record;
  const row = e.receipt.candidate;
  const target = { schema: 'pii-evidence-scanner-identity/1', sourceCommit: row.sourceCommit, version: row.version, kind: 'qualified-candidate',
    coreTarballSha256: row.tarballs.core, nativeTarballSha256: row.tarballs.node, wasmTarballSha256: row.tarballs.wasm,
    packageTreeSha256: row.packageTreeSha256, adapterDigest: adoptionDigest(e.plan.scanner.adapter),
    configurationDigest: e.plan.scanner.configurationDigest, activationDigest: e.plan.scanner.activationDigest };
  const prepared = e.plan.preflight, candidate = preparePiiEvidenceAdoption({ policy, preflight: prepared, scanner: target,
    previousPreflight: previous?.preflight ?? null, previousScanner: previous?.candidate.identity.scanner ?? null });
  return { policy, snapshotPin: prepared.evidence, consumerPin: prepared.consumer, preflight: prepared, candidate,
    acceptance: { schema: 'pii-evidence-maintainer-acceptance/1', scope: 'public-evidence-snapshot-adoption', candidateDigest: candidate.candidateDigest,
      acceptedBy: 'Synthetic Maintainer', acceptedAt: '2026-10-08T12:00:00Z', source: 'https://github.com/redact-secret/redact-secret-benchmarks/issues/841#issuecomment-123' },
    history: [], retainedFiles: e.files, comparison: { plan: e.plan, receipt: e.receipt, receiptText, record, artifacts: e.artifacts, populationIndex: e.populationIndex } };
}

test('active adoption requires strict canonical record and externally supplied exact acceptance without writes', () => {
  const input = activeInput(), before = adoptionDigest(input);
  const loaded = loadPiiEvidenceComparison(input.comparison); assert.equal(loaded.state, 'recorded', loaded.reason);
  const result = validateActiveEvidenceAdoption(input);
  assert.equal(result.state, 'externally-accepted-and-measured');
  assert.equal(result.activeWritesApplied, false); assert.equal(result.authorityChanged, false); assert.equal(result.qualified, false);
  assert.equal(adoptionDigest(input), before);
  for (const mutate of [value => { value.acceptance = null; }, value => { value.comparison.record = null; },
    value => { value.comparison.receiptText += ' '; }, value => { value.candidate.identity.scanner.configurationDigest = 'a'.repeat(64); },
    value => { value.snapshotPin.release.commit = 'a'.repeat(40); }, value => { value.comparison.allowUnrecordedOfficial = true; },
    value => { value.authorityChanged = true; }, value => { value.history = [{ unknown: true }]; }]) {
    const value = activeInput(); mutate(value); assert.throws(() => validateActiveEvidenceAdoption(value));
  }
});


test('future acceptance keeps the complete canonical initial history and refuses missing or altered entries', () => {
  const initial = activeInput(), next = activeInput(syntheticFutureEvidenceOfficialUpload(), initial);
  const entry = { preflight: initial.preflight, candidate: initial.candidate, acceptance: initial.acceptance, comparison: initial.comparison, retainedFiles: initial.retainedFiles };
  next.history = [entry];
  const checked = validateActiveEvidenceAdoption(next);
  assert.equal(checked.historical.length, 1);
  assert.deepEqual(checked.historical[0].identity, initial.candidate.identity);
  assert.equal(checked.snapshotPin.snapshot.id, next.snapshotPin.snapshot.id);
  for (const mutate of [value => { value.history = []; }, value => { value.history[0].acceptance.candidateDigest = 'a'.repeat(64); },
    value => { value.history[0].comparison.artifacts[0].text += ' '; }, value => { value.history.push(value.history[0]); },
    value => { value.history[0].candidate.historical = { invented: true }; },
    value => { delete value.history[0].retainedFiles['build-receipt.json']; },
    value => { value.retainedFiles['replay-inputs/candidate/observation.json'] += ' '; }]) {
    const value = structuredClone(next); mutate(value); assert.throws(() => validateActiveEvidenceAdoption(value));
  }
});

test('acceptance CLI prepares reversible reviewed changes and preserves raw historical evidence without active writes', () => sandbox(root => {
  const initial = activeInput(), next = activeInput(syntheticFutureEvidenceOfficialUpload(), initial);
  next.history = [{ preflight: initial.preflight, candidate: initial.candidate, acceptance: initial.acceptance, comparison: initial.comparison, retainedFiles: initial.retainedFiles }];
  writeFileSync(join(root, 'bundle.json'), JSON.stringify(next));
  const before = readFileSync(join(root, 'bundle.json'), 'utf8');
  const argv = ['--validate-adoption', 'bundle.json', '--out-dir', 'results-output/pii-evidence-adoption/accepted'];
  assert.equal(run(root, argv).code, 0);
  const output = join(root, argv[3]), read = name => JSON.parse(readFileSync(join(output, name), 'utf8'));
  assert.equal(read('proposed-active.json').snapshotPin.snapshot.id, next.snapshotPin.snapshot.id);
  assert.deepEqual(read('rollback.json').snapshotPin, initial.snapshotPin);
  assert.equal(read('proposed-history.json').entries[0].comparison.receiptText, initial.comparison.receiptText);
  assert.equal(read('proposed-history.json').entries.length, 2);
  assert.deepEqual(read('proposed-history.json').entries[0].retainedFiles, initial.retainedFiles);
  assert.equal(Object.keys(read('proposed-history.json').entries[1].retainedFiles).length, 11);
  assert.deepEqual(read('apply-plan.json').repositoryWritesApplied, []);
  assert.equal(read('apply-plan.json').ownerAcceptanceGenerated, false);
  assert.equal(existsSync(join(root, 'benchmarks/pii-evidence')), false);
  assert.equal(readFileSync(join(root, 'bundle.json'), 'utf8'), before);
  assert.equal(run(root, argv).code, 1);
  assert.equal(run(root, [...argv, '--acceptance', 'bundle.json']).code, 1);
  const bad = structuredClone(next); bad.acceptance = null; writeFileSync(join(root, 'bad.json'), JSON.stringify(bad));
  assert.equal(run(root, ['--validate-adoption', 'bad.json', '--out-dir', 'results-output/pii-evidence-adoption/rejected']).code, 1);
  assert.equal(existsSync(join(root, 'results-output/pii-evidence-adoption/rejected')), false);
}));


function appliedSandbox(body) {
  sandbox(root => {
    const initial = activeInput(); mkdirSync(join(root, 'benchmarks/pii-evidence'));
    for (const [name, value] of [['snapshot-pin', initial.snapshotPin], ['consumer-pin', initial.consumerPin], ['preflight', initial.preflight]])
      writeFileSync(join(root, `benchmarks/pii-evidence/${name}.json`), JSON.stringify(value));
    writeFileSync(join(root, 'benchmarks/pii-eval-population-pins.json'), readFileSync(new URL('../benchmarks/pii-eval-population-pins.json', import.meta.url)));
    const e = syntheticFutureEvidenceOfficialUpload(), next = activeInput(e, initial);
    next.history = [{ preflight: initial.preflight, candidate: initial.candidate, acceptance: initial.acceptance,
      comparison: initial.comparison, retainedFiles: initial.retainedFiles }];
    const files = adoptionUpdateFiles(next, e.costDecision).files;
    const expectedPriorSha256 = Object.fromEntries(Object.keys(files).map(name => [name,
      existsSync(join(root, name)) ? sha256(readFileSync(join(root, name))) : null]));
    body({ root, next, reviewPackage: { schema: 'pii-evidence-adoption-review-package/1', bundle: next, costDecision: e.costDecision, expectedPriorSha256 }, files });
  });
}

test('guarded apply updates every fixed file, retains complete history, and enables the future-active check', () => appliedSandbox(({ root, next, reviewPackage, files }) => {
  const beforeFour = readFileSync(join(root, 'benchmarks/pii-eval-population-pins.json'), 'utf8');
  writeFileSync(join(root, 'accepted-bundle.json'), JSON.stringify(reviewPackage.bundle));
  writeFileSync(join(root, 'cost.json'), JSON.stringify(reviewPackage.costDecision));
  assert.equal(run(root, ['--validate-adoption', 'accepted-bundle.json', '--cost-decision', 'cost.json', '--out-dir', 'results-output/pii-evidence-adoption/reviewed']).code, 0);
  const preparedFile = 'results-output/pii-evidence-adoption/reviewed/review-package.json';
  assert.equal(adoptionDigest(JSON.parse(readFileSync(join(root, preparedFile), 'utf8'))), adoptionDigest(reviewPackage));
  assert.equal(run(root, ['--apply-adoption', preparedFile]).code, 0);
  for (const [name, text] of Object.entries(files)) assert.equal(readFileSync(join(root, name), 'utf8'), text);
  assert.equal(checkActiveEvidenceFiles(root).snapshotPin.snapshot.id, next.snapshotPin.snapshot.id);
  assert.equal(readFileSync(join(root, 'benchmarks/pii-eval-population-pins.json'), 'utf8'), beforeFour);
  assert.equal(existsSync(join(root, 'benchmarks/pii-authority.json')), false);
  assert.equal(run(root, ['--apply-adoption', preparedFile]).code, 1);
  writeFileSync(join(root, 'benchmarks/pii-evidence-comparison/replay-inputs/candidate/observation.json'), 'tampered');
  assert.throws(() => checkActiveEvidenceFiles(root));
}));

test('apply refuses missing acceptance, stale preimages, mismatched cost and symlink targets before writes', () => {
  for (const mutate of [value => { value.bundle.acceptance = null; }, value => { value.costDecision.scope.runs = 4; },
    value => { delete value.expectedPriorSha256['benchmarks/pii-evidence/history.json']; },
    value => { value.expectedPriorSha256['benchmarks/pii-evidence/snapshot-pin.json'] = 'a'.repeat(64); }])
    appliedSandbox(({ root, reviewPackage }) => {
      const before = readFileSync(join(root, 'benchmarks/pii-evidence/snapshot-pin.json'), 'utf8');
      mutate(reviewPackage); assert.throws(() => applyEvidenceAdoption({ root, reviewPackage }));
      assert.equal(readFileSync(join(root, 'benchmarks/pii-evidence/snapshot-pin.json'), 'utf8'), before);
      assert.equal(existsSync(join(root, 'benchmarks/pii-evidence/adoption.json')), false);
    });
  appliedSandbox(({ root, reviewPackage }) => {
    mkdirSync(join(root, 'outside')); symlinkSync(join(root, 'outside'), join(root, 'benchmarks/pii-evidence-comparison'));
    assert.throws(() => applyEvidenceAdoption({ root, reviewPackage }));
    assert.deepEqual(readdirSync(join(root, 'outside')), []);
  });
});

test('dangling destination and parent symlinks refuse rather than satisfying a missing preimage', () => {
  for (const target of ['benchmarks/pii-evidence/history.json', 'benchmarks/pii-evidence-comparison']) appliedSandbox(({ root, reviewPackage }) => {
    symlinkSync(join(root, 'does-not-exist'), join(root, target));
    assert.throws(() => applyEvidenceAdoption({ root, reviewPackage }), /unsafe-(target|parent)/);
    assert.equal(existsSync(join(root, 'benchmarks/pii-evidence/adoption.json')), false);
    assert.equal(existsSync(join(root, 'does-not-exist')), false);
  });
});

test('an injected mid-transaction failure restores every prior byte and removes newly created files', () => appliedSandbox(({ root, reviewPackage, files }) => {
  const before = Object.fromEntries(Object.keys(files).map(name => [name, existsSync(join(root, name)) ? readFileSync(join(root, name), 'utf8') : null]));
  assert.throws(() => applyEvidenceAdoption({ root, reviewPackage, beforeReplace: (_name, index) => { if (index === 4) throw new Error('synthetic-write-failure'); } }));
  for (const [name, text] of Object.entries(before)) {
    if (text === null) assert.equal(existsSync(join(root, name)), false);
    else assert.equal(readFileSync(join(root, name), 'utf8'), text);
  }
  assert.deepEqual(readdirSync(join(root, 'benchmarks/pii-evidence')).sort(), ['consumer-pin.json', 'preflight.json', 'snapshot-pin.json']);
  checkActiveEvidenceFiles(root);
}));
