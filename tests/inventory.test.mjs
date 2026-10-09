import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

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
  assert.deepEqual(knownGaps.issues.map(i => i.number), [292,293,294,404,405,406,407,408,551,552,553,428,428,671,672,670,707,708,714,738,739,740,749,741,742,743,743,744,745,746,747,754,756,727,264,730,702,815,816,817,818,819,820,821,822,823,824,825,911,931,932,933,934,935,936,949,1015,1016,1017,1038,1018,1041,1042,1236]);
  const assignments = await read('benchmarks/fixture-detectors.json');
  const slugs = knownGaps.issues.flatMap(i => i.fixtures);
  // #949: three Inngest/Resend placeholder controls (Beta.11 #434/#436 graduation).
  // #932 is split in two: the fixed forms (product-932) and the masked_ LiteLLM row
  // (product-932-masked-key-policy, policy-decision); the fixture count is unchanged.
  // #1015-#1017: Beta.12 provisional triage (five beta8-384a/384e fixtures); #1018 is
  // linked from product-932-masked-key-policy, which already owns the LiteLLM fixture.
  // #1038: redact-secret#1013 Mistral os.environ subscript assignment (beta8-384e).
  // Beta.12 graduation at 4fb7882: product #1018 changed the masked_ policy, so the LiteLLM fixture moved from
  // product-932-masked-key-policy (removed) to product-1018; #1041 adds the Rust secrecy placeholder control and #1042
  // the seven placeholder controls of the #464/#528/#1012 corpora.
  // #1236: three Square placeholder controls (beta8-583a, #583) promoted to the product, observed on beta.13.
  // product-1016 also carries the Mistral name:/value: fixture (confirmed on redact-secret#1016).
  assert.equal(slugs.length, 197);
  assert.equal(new Set(slugs).size, 197);
  // A slug is either a corpus fixture or `<adversarial pack id>--<fixture id>`
  // for a fixture in that pack's intake record (#140). An adversarial record's
  // corpus hash is the pack's expectations digest.
  const packs = new Map();
  const pack = async id => {
    if (!packs.has(id)) packs.set(id, await read(`adversarial/packs/${id}/intake.json`).catch(() => null));
    return packs.get(id);
  };
  for (const issue of knownGaps.issues) {
    assert.equal(issue.url, `https://github.com/redact-secret/redact-secret/issues/${issue.number}`);
    for (const [index, slug] of issue.fixtures.entries()) {
      if (Object.hasOwn(assignments, slug)) continue;
      const [packId, fixtureId] = slug.split('--');
      const intake = await pack(packId);
      assert.ok(intake?.fixtures.some(f => f.id === fixtureId), slug);
      assert.equal(issue.evidence[index].corpusHash, intake.expectations.digest, slug);
    }
    assert.deepEqual(issue.evidence.map(e => e.fixture),issue.fixtures);
  }
});
