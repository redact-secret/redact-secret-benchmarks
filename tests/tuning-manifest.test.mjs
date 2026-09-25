import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_GENERATED_SHARE_CAP, SCORING_CONTRACT_DECISION, evidenceStaleness, loadRepositoryState, loadTuningManifests,
  manifestSetProblems, scoringIdentity, tuningManifestHash, validateTuningManifest,
} from '../benchmarks/lib/tuning-manifest.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const repo = loadRepositoryState(root);
const holdout = JSON.parse(readFileSync(new URL('../holdout/manifest.json', import.meta.url), 'utf8'));
const hex = (c, n) => c.repeat(n);

function valid() {
  const scoring = {
    contractDecision: SCORING_CONTRACT_DECISION,
    featureSchemaVersion: '1',
    featureSetHash: hex('a', 64),
    aggregationContractVersion: '1',
    weightSetHash: hex('b', 64),
    thresholdSetHash: hex('c', 64),
  };
  return {
    schemaVersion: 1,
    id: 'generic-token-shadow-v1',
    status: 'active',
    createdAt: '2026-09-25',
    product: { sourceRevision: hex('1', 40), sourceHash: hex('2', 64), lockHash: hex('3', 64), candidateArtifactHash: hex('4', 64) },
    benchmark: { commit: hex('5', 40), dirty: false },
    featureDataset: { schemaVersion: 1, extractorVersion: '1', extractorSourceHash: hex('6', 64), datasetHash: hex('7', 64) },
    selection: { method: 'grouped-threshold-sweep', sourceHash: hex('8', 64), seed: 'none' },
    scoring: { ...scoring, identity: scoringIdentity(scoring) },
    corpora: {
      tuning: [
        {
          category: 'accuracy', corpusHash: repo.corpusHashes.accuracy,
          rows: { generated: 2, authored: 6 },
          families: { 'generic-token': { generated: 1, authored: 4 }, 'github-token': { generated: 1, authored: 2 } },
          contexts: { env: 5, json: 3 },
        },
        {
          category: 'common-formats', corpusHash: repo.corpusHashes['common-formats'],
          rows: { generated: 3, authored: 3 },
          families: { 'generic-token': { generated: 1, authored: 2 }, 'github-token': { generated: 2, authored: 1 } },
          contexts: { env: 6 },
        },
      ],
      evaluation: [
        { source: 'sendgrid-regressions', role: 'regression', corpusHash: repo.corpusHashes['sendgrid-regressions'] },
        { source: 'real-world-shapes', role: 'development-evaluation', corpusHash: repo.corpusHashes['real-world-shapes'] },
      ],
    },
    holdoutAccess: 'none',
    generatedShare: { cap: DEFAULT_GENERATED_SHARE_CAP },
    strata: { dimensions: ['family', 'context', 'kind', 'tier'] },
  };
}
const problems = m => validateTuningManifest(m, repo).join('\n');

test('the repository state names development, regression and holdout identities', () => {
  assert.ok(repo.developmentCategories.includes('accuracy'));
  assert.ok(repo.regressionCategories.includes('sendgrid-regressions'));
  assert.ok(repo.holdoutIdentifiers.includes(holdout.corpusHash));
});

test('a manifest that follows every rule is valid', () => {
  assert.deepEqual(validateTuningManifest(valid(), repo), []);
});

test('every checked-in tuning manifest is valid', () => {
  const manifests = loadTuningManifests(root);
  assert.deepEqual(manifestSetProblems(manifests), []);
  for (const { manifest } of manifests) assert.deepEqual(validateTuningManifest(manifest, repo), []);
});

test('a regression category is evaluation-only and cannot be tuned on', () => {
  const m = valid();
  m.corpora.tuning[0].category = 'sendgrid-regressions';
  m.corpora.evaluation = m.corpora.evaluation.filter(s => s.source !== 'sendgrid-regressions');
  assert.match(problems(m), /sendgrid-regressions is a regression category, which is evaluation-only/);
});

test('an unknown category cannot be tuned on', () => {
  const m = valid();
  m.corpora.tuning[0].category = 'not-a-category';
  assert.match(problems(m), /not-a-category is not a development-corpus category/);
});

test('one source is never both tuned on and evaluated against', () => {
  const m = valid();
  m.corpora.evaluation.push({ source: 'accuracy', role: 'development-evaluation', corpusHash: repo.corpusHashes.accuracy });
  assert.match(problems(m), /accuracy is also a tuning source/);
});

test('an adversarial source must be an accepted pack and carry the adversarial role', () => {
  const m = valid();
  m.corpora.evaluation.push({ source: 'adversarial:synthetic-sample', role: 'adversarial' });
  assert.match(problems(m), /adversarial:synthetic-sample is not an accepted adversarial pack/);
  const n = valid();
  n.corpora.evaluation.push({ source: 'adversarial:synthetic-sample', role: 'regression' });
  assert.match(problems(n), /must have role adversarial/);
});

test('no holdout corpus hash, seed hash or id may appear anywhere', () => {
  for (const value of [holdout.corpusHash, holdout.seedHash]) {
    const m = valid();
    m.corpora.evaluation.push({ source: 'reference-syntax', role: 'development-evaluation', corpusHash: value });
    assert.match(problems(m), /names a holdout manifest id, corpus hash or seed hash/);
  }
  const m = valid();
  m.featureDataset.extractorVersion = holdout.id;
  assert.match(problems(m), /names a holdout manifest id/);
});

test('no holdout path may appear anywhere', () => {
  const m = valid();
  m.featureDataset.extractorVersion = 'read holdout/generated/epoch/input.json';
  const text = problems(m);
  assert.match(text, /references a holdout path/);
  assert.doesNotMatch(text, /epoch/, 'the problem does not echo the private path');
});

test('holdout access other than none is rejected', () => {
  const m = valid();
  m.holdoutAccess = 'aggregate-only';
  assert.match(problems(m), /holdoutAccess/);
});

test('a changed weight, threshold or feature set without a new identity is rejected', () => {
  for (const field of ['featureSetHash', 'weightSetHash', 'thresholdSetHash', 'featureSchemaVersion', 'aggregationContractVersion']) {
    const m = valid();
    m.scoring[field] = field.endsWith('Hash') ? hex('d', 64) : '2';
    assert.match(problems(m), /scoring.identity: does not match/, field);
  }
});

test('evidence from an earlier scoring identity, manifest or candidate is stale', () => {
  const m = valid();
  const evidence = { tuningManifestHash: tuningManifestHash(m), scoringIdentity: m.scoring.identity, candidateArtifactHash: m.product.candidateArtifactHash };
  assert.deepEqual(evidenceStaleness(evidence, m), []);
  const retuned = valid();
  retuned.scoring.thresholdSetHash = hex('e', 64);
  retuned.scoring.identity = scoringIdentity(retuned.scoring);
  assert.deepEqual(validateTuningManifest(retuned, repo), []);
  assert.deepEqual(evidenceStaleness(evidence, retuned), ['tuning manifest changed', 'scoring identity changed']);
  const rebuilt = valid();
  rebuilt.product.candidateArtifactHash = hex('f', 64);
  assert.ok(evidenceStaleness(evidence, rebuilt).includes('candidate artifact changed'));
  const superseded = { ...valid(), status: 'superseded', supersededBy: 'next' };
  assert.ok(evidenceStaleness(evidence, superseded).includes('tuning manifest superseded'));
});

test('benchmark-generated rows cannot dominate overall', () => {
  const m = valid();
  m.corpora.tuning[0].rows = { generated: 7, authored: 1 };
  m.corpora.tuning[0].families = { 'generic-token': { generated: 4, authored: 1 }, 'github-token': { generated: 3, authored: 0 } };
  assert.match(problems(m), /generatedShare: 10\/14 tuning rows are benchmark-generated, above the cap 0.5/);
});

test('benchmark-generated rows cannot dominate one family even when the total is balanced', () => {
  const m = valid();
  m.corpora.tuning[1].families = { 'generic-token': { generated: 0, authored: 3 }, 'github-token': { generated: 3, authored: 0 } };
  const text = problems(m);
  assert.doesNotMatch(text, /tuning rows are benchmark-generated/);
  assert.match(text, /family github-token has 4\/6 benchmark-generated tuning rows/);
});

test('only a reviewed override raises the generated-share cap', () => {
  const m = valid();
  m.corpora.tuning[1].families = { 'generic-token': { generated: 0, authored: 3 }, 'github-token': { generated: 3, authored: 0 } };
  m.generatedShare.cap = 0.8;
  assert.match(problems(m), /generatedShare\/cap/);
  m.generatedShare = { cap: 0.5, override: { cap: 0.7, reason: 'Provider documentation publishes no authored example for this family.', reviewedBy: 'maintainer' } };
  assert.deepEqual(validateTuningManifest(m, repo), []);
  m.generatedShare.override.reason = 'short';
  assert.match(problems(m), /override\/reason/);
});

test('strata must include family and context and must add up', () => {
  const m = valid();
  m.strata.dimensions = ['kind'];
  const text = problems(m);
  assert.match(text, /must include family/);
  assert.match(text, /must include context/);
  const n = valid();
  n.corpora.tuning[0].contexts = { env: 1 };
  assert.match(problems(n), /accuracy context counts do not sum to its rows/);
  const o = valid();
  o.corpora.tuning[0].families['generic-token'].generated = 0;
  assert.match(problems(o), /accuracy family counts do not sum to its rows/);
});

test('an active manifest must match the current corpus; a superseded one is kept for audit', () => {
  const m = valid();
  m.corpora.tuning[0].corpusHash = hex('9', 64);
  assert.match(problems(m), /accuracy corpus changed since this active manifest was recorded/);
  m.status = 'superseded';
  m.supersededBy = 'generic-token-shadow-v2';
  assert.deepEqual(validateTuningManifest(m, repo), []);
  delete m.supersededBy;
  assert.match(problems(m), /names its successor/);
});

test('a dirty benchmark tree and a foreign scoring contract are rejected by the schema', () => {
  const m = valid();
  m.benchmark.dirty = true;
  assert.match(problems(m), /benchmark\/dirty/);
  const n = valid();
  n.scoring.contractDecision = 'decision-something-else';
  assert.match(problems(n), /scoring\/contractDecision/);
});

test('a manifest without its selection procedure cannot be reproduced and is rejected', () => {
  const m = valid();
  delete m.selection;
  assert.match(problems(m), /selection/);
});

test('the schema has no field for scores, weights or thresholds as values', () => {
  const m = valid();
  m.scoring.thresholds = [0.3, 0.6, 0.9];
  assert.match(problems(m), /must NOT have additional properties/);
});

test('a manifest set rejects duplicate ids, mismatched file names and a missing successor', () => {
  const a = valid();
  const b = { ...valid(), status: 'superseded', supersededBy: 'missing-manifest' };
  const text = manifestSetProblems([{ file: 'generic-token-shadow-v1.json', manifest: a }, { file: 'other.json', manifest: b }]).join('\n');
  assert.match(text, /other.json: file name must be generic-token-shadow-v1.json/);
  assert.match(text, /duplicate manifest id/);
  assert.match(text, /supersededBy missing-manifest is not a checked-in manifest/);
});
