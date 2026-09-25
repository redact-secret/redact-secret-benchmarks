import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import {
  DEFAULT_OUTPUT, FEATURE_EXTRACTION_VERSION, assertNoCandidateBytes, assertNoHoldout, buildDataset, contextClassOf,
  datasetHashOf, extractorSourceHash, holdoutIdentifiers, loadCategoryInputs, longestToken, negativeClassOf, resolveNonPublicOutput,
} from '../benchmarks/lib/candidate-features.ts';
import { CORE_FEATURE_SCHEMA, FEATURE_NAMES, extractEvidenceFeatures, log2Q16, permille } from '../benchmarks/lib/evidence-features.ts';
import { exclusionProblems } from '../scripts/check-feature-dataset-exclusion.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const schema = JSON.parse(readFileSync(new URL('../schemas/candidate-features-v1.json', import.meta.url), 'utf8'));
const holdout = holdoutIdentifiers(root, readdirSync(path.join(root, 'holdout')));
const build = () => buildDataset(loadCategoryInputs(root), { sourceHash: extractorSourceHash(root), commit: 'test', dirty: true, holdoutIdentifiers: holdout });
const dataset = build();

// Synthetic values only. None of these is, or resembles, an issued credential.
const RANDOMISH = 'q7Vd2LmZ9xKp4TsW8nRb3YhJ6cFg1AeU';

test('log2_q16 and permille match the core reference values', () => {
  assert.deepEqual([3, 5, 10, 62, 255].map(log2Q16), [103872, 152169, 217705, 390214, 523917]);
  assert.equal(log2Q16(0), 0);
  assert.equal(log2Q16(1), 0);
  assert.equal(log2Q16(1 << 20), 20 << 16);
  for (let x = 1; x <= 4096; x++) {
    const exact = Math.log2(x) * 65536;
    assert.ok(log2Q16(x) <= exact + 1e-6 && log2Q16(x) > exact - 2, `log2Q16(${x}) is within its documented bound`);
  }
  assert.equal(permille(2, 3), 666);
  assert.equal(permille(5, 0), 0);
});

// The eight golden vectors of redact-secret docs/specs/engine.md "Shadow evidence feature schema" (evidence-features/v1).
const GOLDEN = [
  ['', Array(27).fill(0).join(',')],
  ['aaaaaaaaaaaaaaaa', '16,16,0,1,16,0,0,0,16,0,0,0,0,0,1,0,26,0,0,62,62,16,1000,933,1,1000,2'],
  ['abcabcabcabcabcabc', '18,18,0,3,6,103872,103872,1869696,18,0,0,0,0,0,1,0,26,1000,337,166,70,1,0,823,3,1000,3'],
  ['XXXX-XXXX-XXXX-XXXX', '19,19,0,2,16,41239,16248,783541,0,16,0,3,0,0,2,6,58,629,107,105,74,4,666,833,5,1000,5'],
  ['Q7vK2mZp9LxR4tWb8NcY3hJd6FsG1eUa', '32,32,0,32,1,327680,327680,10485760,12,12,8,0,0,0,3,31,62,1000,839,1000,125,1,0,0,0,0,0'],
  ['\u{1F600}a\u{1F603}b\u{1F600}a\u{1F603}b', '20,8,0,4,2,131072,131072,1048576,4,0,0,0,0,4,2,7,28,1000,416,500,31,1,0,428,4,1000,4'],
  ['ab', '2,2,0,2,1,65536,65536,131072,2,0,0,0,0,0,1,0,26,1000,212,1000,7,1,0,0,0,0,0'],
  ['aabc', '4,4,0,3,2,98304,65536,393216,4,0,0,0,0,0,1,0,26,946,319,750,15,2,333,0,0,0,0'],
];

test('the evidence-features/v1 vector reproduces the core golden vectors', () => {
  assert.equal(CORE_FEATURE_SCHEMA.id, 'evidence-features/v1');
  assert.equal(FEATURE_NAMES.length, 27);
  for (const [input, expected] of GOLDEN) assert.equal(extractEvidenceFeatures(input).join(','), expected, JSON.stringify(input));
});

test('only the first 256 symbols are analysed; byte_len covers the whole value', () => {
  const long = `${'ab'.repeat(128)}${RANDOMISH}`;
  const v = extractEvidenceFeatures(long);
  const named = Object.fromEntries(FEATURE_NAMES.map((name, i) => [name, v[i]]));
  assert.equal(named.byte_len, long.length);
  assert.equal(named.analysed_chars, 256);
  assert.equal(named.truncated, 1);
  assert.equal(named.length_permille, 1000);
  assert.equal(named.distinct_symbols, 2, 'the tail past 256 symbols is invisible');
  assert.equal(named.smallest_period, 2);
  assert.deepEqual(extractEvidenceFeatures('ab'.repeat(128)).slice(1), v.slice(1).map((x, i) => (i === 1 ? 0 : x)));
  const emoji = extractEvidenceFeatures('\u{1F600}'.repeat(300));
  assert.equal(emoji[0], 1200);
  assert.equal(emoji[1], 256);
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
  assert.equal(dataset.featureSchema.id, 'evidence-features/v1');
  assert.deepEqual(dataset.featureSchema.names, [...FEATURE_NAMES]);
  assert.equal(dataset.featureSchema.sourceRevision, CORE_FEATURE_SCHEMA.sourceRevision);
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
    assert.equal(r.features.length, 27);
    for (const value of r.features) assert.ok(Number.isInteger(value) && value >= 0);
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
