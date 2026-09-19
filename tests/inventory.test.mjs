import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { filterInventory } from '../src/inventory.mjs';
import { parseRoute } from '../src/model.mjs';

const read = async path => JSON.parse(await readFile(new URL('../'+path, import.meta.url), 'utf8'));
const inventory = await read('benchmarks/detector-inventory.json');
const knownGaps = await read('benchmarks/known-gaps.json');
const registry = await read('benchmarks/detectors.json');

test('source inventory has unique, traceable entries and valid conservative mappings', () => {
  const rows = inventory.entries;
  assert.equal(new Set(rows.map(r => `${r.tool}:${r.id}`)).size, rows.length);
  assert.equal(rows.filter(r => r.tool === 'gitleaks').length, 222);
  assert.equal(rows.filter(r => r.tool === 'trufflehog').length, 892);
  assert.equal(rows.filter(r => r.tool === 'flare-redact').length, 81);
  assert.equal(inventory.redactSecretRevision, registry.sourceRevision);
  for (const r of rows) {
    const source = inventory.sources[r.tool];
    assert.match(source.revision, /^[a-f0-9]{40}$/);
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(r.sourceUrl.startsWith(source.url+'#L'));
    assert.equal(r.status, r.relatedDetector ? 'related-family' : 'no-dedicated-detector');
    if (r.relatedDetector) assert.ok(registry.detectors.some(d => d.id === r.relatedDetector));
    if (r.activation === 'feature-gated') assert.ok(r.featureFlag);
  }
  assert.equal(rows.find(r => r.tool === 'trufflehog' && r.id === 'azure_storage').relatedDetector, 'connection-string');
  assert.ok(!rows.some(r => r.tool === 'trufflehog' && r.id === 'abstract'));
});

test('search and filters keep unverified related families separate from missing dedicated coverage', () => {
  assert.ok(filterInventory(inventory.entries).every(r => !r.relatedDetector));
  assert.equal(filterInventory(inventory.entries, {query:'github', tool:'gitleaks'}).length, 0);
  const related = filterInventory(inventory.entries, {query:'GITHUB', tool:'gitleaks',status:'related-family'});
  assert.ok(related.length > 0 && related.every(r => r.relatedDetector === 'github-token'));
  assert.ok(filterInventory(inventory.entries, {query:'datadog',tool:'gitleaks'}).length > 0);
  assert.equal(filterInventory(inventory.entries, {query:'does-not-exist-12345'}).length, 0);
});

test('TruffleHog parser excludes comments, recognizes factories, and preserves feature gates', () => {
  const code = `
import importlib.util
spec=importlib.util.spec_from_file_location('inventory','scripts/refresh-detector-inventory.py')
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
source='''import (
 "github.com/trufflesecurity/trufflehog/v3/pkg/detectors/aws"
 "github.com/trufflesecurity/trufflehog/v3/pkg/detectors/pinecone"
)
dets := []detectors.Detector{
 // &removed.Scanner{},
 aws.New(),
 &pinecone.Scanner{}, // trailing comment
}
dets = slices.DeleteFunc(dets, func(d detectors.Detector) bool {
 case *pinecone.Scanner:
 return !feature.PineconeDetectorEnabled.Load()
})'''
empty_spec='{"detectors":[]}'
sources={'gitleaks':{'url':'https://example.invalid/g'},'trufflehog':{'url':'https://example.invalid/t'},'flare-redact':{'url':'https://example.invalid/f'}}
rows=m.inventory('[[rules]]\\nid = "gcp-api-key"\\n',source,empty_spec,sources)
assert len(rows)==3
assert next(r for r in rows if r['id']=='pinecone')['activation']=='feature-gated'
assert next(r for r in rows if r['id']=='aws')['relatedDetector']=='aws-access-key'
try:
 m.inventory('[[rules]]\\nid = "gcp-api-key"\\n',source.replace('aws.New(),','unknown(),'),empty_spec,sources)
except ValueError: pass
else: raise AssertionError('unknown constructor silently skipped')
`;
  execFileSync('python3', ['-B', '-c', code], {cwd: new URL('..',import.meta.url),stdio:'pipe'});
});

test('flare-redact parser reads the FRS-1 spec JSON and maps default vs opt-in activation', () => {
  const code = `
import importlib.util
spec=importlib.util.spec_from_file_location('inventory','scripts/refresh-detector-inventory.py')
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
flare_spec='''{
  "id": "flare-redact/core",
  "detectors": [
    {"id": "github_token", "default": true},
    {"id": "phone", "tags": ["pii"], "default": false}
  ]
}'''
sources={'gitleaks':{'url':'https://example.invalid/g'},'trufflehog':{'url':'https://example.invalid/t'},'flare-redact':{'url':'https://example.invalid/f'}}
empty_trufflehog='''dets := []detectors.Detector{
}
dets = slices.DeleteFunc(dets, func(d detectors.Detector) bool {
})'''
rows=m.inventory('[[rules]]\\nid = "gcp-api-key"\\n',empty_trufflehog,flare_spec,sources)
flare_rows={r['id']: r for r in rows if r['tool']=='flare-redact'}
assert flare_rows['github_token']['activation']=='default-detector'
assert flare_rows['github_token']['relatedDetector']=='github-token'
assert flare_rows['phone']['activation']=='opt-in-detector'
assert flare_rows['phone']['relatedDetector'] is None
assert flare_rows['github_token']['sourceUrl'].startswith('https://example.invalid/f#L')
`;
  execFileSync('python3', ['-B', '-c', code], {cwd: new URL('..',import.meta.url),stdio:'pipe'});
});

test('known gap issues cover all recorded failures and link to authored fixtures', async () => {
  assert.deepEqual(knownGaps.issues.map(i => i.number), [292,293,294,404,405,406,407,408]);
  const assignments = await read('benchmarks/fixture-detectors.json');
  const slugs = knownGaps.issues.flatMap(i => i.fixtures);
  assert.equal(slugs.length, 25);
  assert.equal(new Set(slugs).size, 25);
  for (const issue of knownGaps.issues) {
    assert.equal(issue.url, `https://github.com/redact-secret/redact-secret/issues/${issue.number}`);
    for (const slug of issue.fixtures) assert.ok(Object.hasOwn(assignments,slug));
    assert.deepEqual(issue.evidence.map(e => e.fixture),issue.fixtures);
  }
});

test('coverage route renders inventory, source provenance, milestone, and fixture follow-ups', async () => {
  assert.equal(parseRoute('/coverage-gaps/').kind, 'coverage-gaps');
  const server = await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
  try {
    const {coverageGaps} = await server.ssrLoadModule('/src/pages/gaps.ts');
    const html = coverageGaps();
    assert.ok(html.includes('No dedicated detector'));
    assert.ok(html.includes('parity is unverified'));
    assert.ok(html.includes('inventory-query') && html.includes('inventory-next'));
    for (const source of Object.values(inventory.sources)) assert.ok(html.includes(source.url));
    for (const issue of knownGaps.issues) assert.ok(html.includes(issue.url));
    const {fixturePage} = await server.ssrLoadModule('/src/pages/browse.ts');
    const {fixtures} = await server.ssrLoadModule('/src/catalog.ts');
    assert.ok(fixturePage(fixtures.find(f => f.slug === 'reference-syntax--windows-env'),[]).includes('Beta.4 #292'));
  } finally { await server.close(); }
});
