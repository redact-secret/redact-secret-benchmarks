import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import {
  DEFAULT_OUTPUT, FEATURE_EXTRACTION_VERSION, alphabetOf, assertNoCandidateBytes, assertNoHoldout, buildDataset, contextClassOf,
  datasetHashOf, extractFeatures, extractorSourceHash, holdoutIdentifiers, loadCategoryInputs, longestToken, minEntropy,
  negativeClassOf, resolveNonPublicOutput, shannonEntropy, smallestPeriod,
} from '../benchmarks/lib/candidate-features.ts';
import { exclusionProblems } from '../scripts/check-feature-dataset-exclusion.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const schema = JSON.parse(readFileSync(new URL('../schemas/candidate-features-v1.json', import.meta.url), 'utf8'));
const holdout = holdoutIdentifiers(root, readdirSync(path.join(root, 'holdout')));
const build = () => buildDataset(loadCategoryInputs(root), { sourceHash: extractorSourceHash(root), commit: 'test', dirty: true, holdoutIdentifiers: holdout });
const dataset = build();
const micro = value => Math.round(value * 1_000_000);

// Synthetic values only. None of these is, or resembles, an issued credential.
const RANDOMISH = 'q7Vd2LmZ9xKp4TsW8nRb3YhJ6cFg1AeU';

test('Shannon entropy mirrors redact-secret: bits per Unicode scalar value, log base 2', () => {
  // The same cases as crates/secret-scan-core/src/entropy.rs.
  assert.equal(shannonEntropy(''), 0);
  assert.equal(shannonEntropy('aaaa'), 0);
  assert.equal(shannonEntropy('ab'), 1);
  assert.equal(shannonEntropy('abcd'), 2);
  assert.equal(shannonEntropy('abcdefghijklmnop'), 4);
  assert.equal(shannonEntropy('😀😃'), 1);
  assert.equal(shannonEntropy('😀😀'), 0);
  assert.equal(shannonEntropy('😀😃😀😃'), shannonEntropy('abab'));
  assert.equal(shannonEntropy('aabbcc'), shannonEntropy('ccbbaa'));
  assert.equal(shannonEntropy('aabc'), 1.5);
});

test('min-entropy and information bits', () => {
  assert.equal(minEntropy(''), 0);
  assert.equal(minEntropy('aaaa'), 0);
  assert.equal(minEntropy('aabc'), 1);
  assert.equal(minEntropy('abcd'), 2);
  const f = extractFeatures('aabc');
  assert.equal(f.shannonEntropyBitsMicro, 1_500_000);
  assert.equal(f.minEntropyBitsMicro, 1_000_000);
  assert.equal(f.informationBitsMicro, 6_000_000);
  assert.equal(extractFeatures('😀😃').lengthBytes, 8);
  assert.equal(extractFeatures('😀😃').lengthCodePoints, 2);
});

test('lexical features: alphabet, class ratios, classes present', () => {
  assert.equal(alphabetOf(''), 'empty');
  assert.equal(alphabetOf('0123'), 'decimal');
  assert.equal(alphabetOf('deadbeef01'), 'hex-lower');
  assert.equal(alphabetOf('DEADBEEF01'), 'hex-upper');
  assert.equal(alphabetOf('MZXW6YTBOI======'), 'base32');
  assert.equal(alphabetOf(RANDOMISH), 'alphanumeric');
  assert.equal(alphabetOf('ab_cd-ef'), 'base64url');
  assert.equal(alphabetOf('ab+cd/ef=='), 'base64');
  assert.equal(alphabetOf('a b!c'), 'printable-ascii');
  assert.equal(alphabetOf('añb'), 'other');
  const f = extractFeatures('Ab1!');
  assert.deepEqual([f.upperRatioMicro, f.lowerRatioMicro, f.digitRatioMicro, f.symbolRatioMicro, f.whitespaceRatioMicro, f.otherRatioMicro],
    [250_000, 250_000, 250_000, 250_000, 0, 0]);
  assert.equal(f.classesPresent, 4);
  assert.equal(extractFeatures('a é').otherRatioMicro, micro(1 / 3));
});

test('repetition and periodicity indicators', () => {
  assert.equal(smallestPeriod([...'abcabcabc']), 3);
  assert.equal(smallestPeriod([...'abcabcab']), 3);
  assert.equal(smallestPeriod([...'abcd']), 0);
  assert.equal(smallestPeriod([...'aaaa']), 1);
  const periodic = extractFeatures('abcabcabc');
  assert.equal(periodic.maxAutocorrelationMicro, 1_000_000);
  assert.equal(periodic.repeatedBigramRatioMicro, micro(5 / 8));
  assert.equal(extractFeatures('xaaaay').maxRunLength, 4);
  assert.equal(extractFeatures('zabcdefz').maxMonotonicStepRun, 6);
  assert.equal(extractFeatures('987654').maxMonotonicStepRun, 6);
  assert.equal(extractFeatures('abab').maxMonotonicStepRun, 2);
  const random = extractFeatures(RANDOMISH);
  assert.equal(random.smallestPeriod, 0);
  assert.equal(random.maxRunLength, 1);
  assert.equal(extractFeatures('').maxRunLength, 0);
});

const at = (content, value) => {
  const start = content.indexOf(value);
  return [content, start, start + value.length, value];
};

test('contextual evidence class reads the candidate line only', () => {
  const ctx = (content, value) => contextClassOf(...at(content, value).slice(0, 3));
  assert.equal(ctx(`API_KEY=${RANDOMISH}\n`, RANDOMISH), 'credential-name');
  assert.equal(ctx(`  "dbPassword": "${RANDOMISH}"`, RANDOMISH), 'credential-name');
  assert.equal(ctx(`--auth-token ${RANDOMISH}`, RANDOMISH), 'credential-name');
  assert.equal(ctx(`build_id: ${RANDOMISH}`, RANDOMISH), 'other-name');
  assert.equal(ctx(`Authorization: Bearer ${RANDOMISH}`, RANDOMISH), 'authorization-header');
  assert.equal(ctx(`postgres://fixture:${RANDOMISH}@db.example.invalid/app`, RANDOMISH), 'url-userinfo');
  assert.equal(ctx(`see ${RANDOMISH} here`, RANDOMISH), 'bare');
  assert.equal(ctx(`API_KEY=\n${RANDOMISH}`, RANDOMISH), 'bare', 'a name on the previous line is not context');
});

test('negative evidence needs a whole-value grammar; lookalikes are not negative', () => {
  const neg = (content, value) => negativeClassOf(...at(content, value));
  assert.equal(neg('API_KEY={{ secrets.API_KEY }}', 'secrets.API_KEY'), 'template-reference');
  assert.equal(neg('API_KEY={{ secrets.API_KEY }}', '{{ secrets.API_KEY }}'), 'template-reference');
  assert.equal(neg('TOKEN=${GITHUB_TOKEN}', 'GITHUB_TOKEN'), 'environment-reference');
  assert.equal(neg('TOKEN=$GITHUB_TOKEN', 'GITHUB_TOKEN'), 'environment-reference');
  assert.equal(neg('TOKEN=$(vault read token)', 'vault read token'), 'command-substitution');
  assert.equal(neg('TOKEN=<your-token>', 'your-token'), 'angle-placeholder');
  assert.equal(neg('TOKEN=xxxxxxxx', 'xxxxxxxx'), 'mask');
  assert.equal(neg('TOKEN=your_api_key_here', 'your_api_key_here'), 'placeholder-vocabulary');
  assert.equal(neg('key = process.env.API_KEY', 'process.env.API_KEY'), 'dotted-reference');
  // The frozen contract's lookalike: placeholder-looking text around real-looking material is never negative.
  assert.equal(neg(`API_KEY=EXAMPLE${RANDOMISH}`, `EXAMPLE${RANDOMISH}`), 'none');
  assert.equal(neg(`API_KEY={{ ${RANDOMISH}`, RANDOMISH), 'none', 'an unclosed template is not a reference');
  assert.equal(neg('TOKEN=api_key', 'api_key'), 'none', 'vocabulary without a placeholder marker');
  assert.equal(neg(`API_KEY=${RANDOMISH}`, RANDOMISH), 'none');
});

test('a control contributes its longest token as a UTF-8 byte range', () => {
  assert.deepEqual(longestToken('GITHUB_TOKEN=${GITHUB_TOKEN}'), { start: 0, end: 12 });
  assert.deepEqual(longestToken('é abcd'), { start: 3, end: 7 });
  assert.equal(longestToken(' \t\r\n'), null);
  assert.equal(longestToken(''), null);
});

test('the dataset matches its versioned schema and is deterministic', () => {
  const validate = new Ajv({ strict: true, allErrors: true }).compile(schema);
  assert.ok(validate(dataset), JSON.stringify(validate.errors?.slice(0, 3)));
  const again = build();
  assert.deepEqual(again, dataset);
  assert.equal(dataset.extractor.version, FEATURE_EXTRACTION_VERSION);
  assert.equal(dataset.datasetHash, datasetHashOf(dataset));
  assert.deepEqual(dataset.manifestBinding, {
    schemaVersion: 1, extractorVersion: FEATURE_EXTRACTION_VERSION, extractorSourceHash: dataset.extractor.sourceHash, datasetHash: dataset.datasetHash,
  });
  const other = buildDataset(loadCategoryInputs(root), { sourceHash: dataset.extractor.sourceHash, commit: 'elsewhere', dirty: false, holdoutIdentifiers: holdout });
  assert.equal(other.datasetHash, dataset.datasetHash, 'the benchmark commit is provenance, not dataset content');
  assert.ok(dataset.rows.length > 1000);
});

test('holdout is never read and development rows are the only tuning-eligible ones', () => {
  const development = JSON.parse(readFileSync(path.join(root, 'corpora/development/manifest.json'), 'utf8')).categories;
  const regression = JSON.parse(readFileSync(path.join(root, 'corpora/regression/manifest.json'), 'utf8')).categories;
  assert.deepEqual(dataset.corpora.map(c => c.category).sort(), [...development, ...regression].sort());
  for (const c of dataset.corpora) assert.equal(c.partition, development.includes(c.category) ? 'development' : 'regression');
  for (const r of dataset.rows) assert.equal(r.tuningEligible, r.partition === 'development');
  assert.ok(dataset.rows.some(r => r.partition === 'regression'));
  assert.equal(dataset.holdoutAccess, 'none');
  assert.ok(holdout.length > 0);
  assert.doesNotThrow(() => assertNoHoldout(dataset, holdout));
  const serialized = JSON.stringify(dataset);
  for (const id of holdout) assert.ok(!serialized.includes(id));
  assert.ok(!/(^|["\s/])holdout\//.test(serialized));
  assert.throws(() => assertNoHoldout({ ...dataset, note: holdout[0] }, holdout), /holdout/);
});

test('ground truth is copied from the authored fixture, never derived from features', () => {
  const inputs = loadCategoryInputs(root);
  const fixtures = new Map(inputs.flatMap(i => i.fixtures.map(f => [`${i.id}--${f.id}`, f])));
  for (const r of dataset.rows) {
    const f = fixtures.get(`${r.category}--${r.fixtureId}`);
    assert.equal(r.kind, f.assessment.kind);
    assert.equal(r.tier, f.assessment.tier);
    assert.notEqual(r.tier, 'T0');
    assert.equal(r.contract, f.assessment.contract ?? null);
    if (r.candidateSource === 'expected-span') {
      const span = f.expected[r.candidateIndex];
      assert.deepEqual(r.range, { start: span.start, end: span.end });
      assert.equal(r.role, span.role);
    } else {
      assert.equal(f.expected.length, 0);
      assert.equal(r.role, 'none');
    }
  }
  for (const c of dataset.corpora) {
    const rows = c.rows.generated + c.rows.authored;
    assert.equal(Object.values(c.families).reduce((a, f) => a + f.generated + f.authored, 0), rows);
    assert.equal(Object.values(c.contexts).reduce((a, n) => a + n, 0), rows);
    assert.equal(dataset.rows.filter(r => r.category === c.category).length, rows);
  }
});

test('no row carries candidate bytes', () => {
  const inputs = loadCategoryInputs(root);
  const serialized = JSON.stringify(dataset);
  let checked = 0;
  for (const input of inputs) {
    for (const f of input.fixtures) {
      for (const span of f.expected) {
        const value = Buffer.from(f.content).subarray(span.start, span.end).toString();
        if ([...value].length < 8) continue;
        checked++;
        assert.ok(!serialized.includes(value), `${input.id}/${f.id} leaked a span value`);
      }
    }
  }
  assert.ok(checked > 500);
  // Every string a row carries is fixture metadata or a closed vocabulary, never content.
  const metadata = ['id', 'category', 'fixtureId', 'family', 'contract', 'contextAxis', 'twinOf', 'mutationKind'];
  for (const r of dataset.rows) {
    assert.ok(r.id.startsWith(`${r.category}--${r.fixtureId}#`));
    for (const [key, value] of Object.entries(r)) {
      if (typeof value === 'string' && !metadata.includes(key)) {
        assert.ok(schema.definitions[key]?.enum?.includes(value) ?? schema.properties.rows.items.properties[key]?.enum?.includes(value), `${key} is not a closed vocabulary`);
      }
    }
    for (const value of Object.values(r.features)) assert.ok(typeof value === 'number' || schema.definitions.features.properties.alphabet.enum.includes(value));
  }
  assert.throws(() => assertNoCandidateBytes({ rows: [{ note: `x${RANDOMISH}` }] }, [RANDOMISH]), /refusing/);
  assert.throws(() => assertNoCandidateBytes({ [RANDOMISH]: 1 }, [RANDOMISH]), /refusing/);
});

test('the dataset may only be written under results-output/', () => {
  assert.equal(resolveNonPublicOutput(root), path.join(root, DEFAULT_OUTPUT));
  assert.equal(resolveNonPublicOutput(root, 'results-output/x/y.json'), path.join(root, 'results-output/x/y.json'));
  for (const bad of ['public/results/candidate-features-v1.json', 'dist/features.json', 'results-output', 'results-output/../public/a.json', '/tmp/features.json', 'docs/features.json']) {
    assert.throws(() => resolveNonPublicOutput(root, bad), /maintainer-local/, bad);
  }
});

test('the public-surface check finds a dataset in public/ or dist/ and passes on the real tree', () => {
  assert.deepEqual(exclusionProblems(root), []);
  const temp = mkdtempSync(path.join(tmpdir(), 'features-exclusion-'));
  try {
    mkdirSync(path.join(temp, 'public/results'), { recursive: true });
    mkdirSync(path.join(temp, 'dist/assets'), { recursive: true });
    writeFileSync(path.join(temp, 'public/results/summary.json'), '{"ok":true}');
    assert.deepEqual(exclusionProblems(temp, { checkIgnore: false }), []);
    writeFileSync(path.join(temp, 'public/results/candidate-features-v1.json'), '{}');
    writeFileSync(path.join(temp, 'dist/assets/index-abc.js'), 'const d={datasetType:"candidate-features",rows:[]};');
    writeFileSync(path.join(temp, 'public/results/renamed.json'), JSON.stringify({ datasetType: 'candidate-features' }));
    const problems = exclusionProblems(temp, { checkIgnore: false });
    assert.equal(problems.length, 3, problems.join('\n'));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('a corpus that resolves outside development storage (e.g. into holdout/) is refused', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'features-storage-'));
  try {
    const write = (file, value) => { mkdirSync(path.dirname(path.join(temp, file)), { recursive: true }); writeFileSync(path.join(temp, file), JSON.stringify(value)); };
    const corpus = { fixtures: [] };
    write('benchmarks/fixture-detectors.json', {});
    write('corpora/regression/manifest.json', { schemaVersion: 1, visibility: 'regression', categories: [] });
    write('corpora/development/manifest.json', { schemaVersion: 1, visibility: 'development', categories: ['sneaky'] });
    write('holdout/generated/protected.json', corpus);
    write('benchmarks/categories.json', [{ id: 'sneaky', corpus: 'holdout/generated/protected.json' }]);
    assert.throws(() => loadCategoryInputs(temp), /outside development storage/);
    write('fixtures/ok/corpus.json', corpus);
    symlinkSync(path.join(temp, 'holdout/generated/protected.json'), path.join(temp, 'fixtures/link.json'));
    write('benchmarks/categories.json', [{ id: 'sneaky', corpus: 'fixtures/link.json' }]);
    assert.throws(() => loadCategoryInputs(temp), /outside development storage/);
    write('benchmarks/categories.json', [{ id: 'sneaky', corpus: 'fixtures/ok/corpus.json' }]);
    assert.equal(loadCategoryInputs(temp).length, 1);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
