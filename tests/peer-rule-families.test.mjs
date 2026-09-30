// The peer rule-to-family map and the peer registry (#558): the committed files validate, and the
// validator refuses each way a map can go wrong. Synthetic rule ids only for the negative cases.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { peerRegistryProblems, peerRuleFamilyProblems, looksLikeProvider, providerTokens, targetedFamilies } from '../benchmarks/lib/peer-rule-families.ts';
import { problems, peerInventories } from '../scripts/check-peer-rule-families.mjs';

const read = file => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));

test('the committed rule map and registry validate against the pinned rule files and the taxonomy', async () => {
  assert.deepEqual(await problems(), []);
});

const taxonomy = {
  providers: [{ id: 'acme', name: 'Acme Cloud' }, { id: 'hashicorp-vault', name: 'HashiCorp Vault' }],
  families: [{ id: 'acme:api-key', provider: 'acme', name: 'API key', description: '', detectors: [] }, { id: 'generic:jwt', provider: null, name: 'JWT', description: '', detectors: [] }],
};
const entry = (rules, extra = {}) => ({ source: { version: '1' }, ruleCount: 3, rules, reviewedNoFamily: {}, ...extra });
const map = scanners => ({
  schemaVersion: 1, reviewedAt: '2026-09-30', method: 'Authored and reviewed by hand from each pinned peer rule file, never from findings.',
  scanners: { gitleaks: entry({}), trufflehog: entry({}), 'flare-redact': entry({}), openredaction: entry({}), ...scanners },
});
const inventories = { gitleaks: ['acme-key', 'jwt', 'other'], trufflehog: ['a', 'b', 'c'], 'flare-redact': ['a', 'b', 'c'], openredaction: ['A', 'B', 'C'] };

test('the validator refuses an unknown family, a rule not in the pinned file and a missing basis', () => {
  const bad = map({ gitleaks: entry({ 'acme-key': { families: ['acme:nope'], basis: 'acme_ + 32' }, ghost: { families: ['generic:jwt'], basis: 'x' }, jwt: { families: ['generic:jwt'], basis: ' ' } }) });
  const found = peerRuleFamilyProblems(bad, taxonomy, inventories).join('\n');
  assert.match(found, /unknown family acme:nope/);
  assert.match(found, /rule ghost is not in the pinned rule file/);
  assert.match(found, /rule jwt has no pattern evidence/);
});

test('a rule that looks like a provider must be mapped or reviewed, and the count must match the pinned file', () => {
  const unreviewed = map({ gitleaks: entry({ jwt: { families: ['generic:jwt'], basis: 'eyJ header' } }) });
  assert.match(peerRuleFamilyProblems(unreviewed, taxonomy, inventories).join('\n'), /acme-key looks like a taxonomy provider but is neither mapped nor reviewed/);
  const reviewed = map({ gitleaks: entry({ jwt: { families: ['generic:jwt'], basis: 'eyJ header' } }, { reviewedNoFamily: { 'acme-key': 'a legacy key, another token class' } }) });
  assert.deepEqual(peerRuleFamilyProblems(reviewed, taxonomy, inventories), []);
  const wrongCount = map({ gitleaks: entry({}, { ruleCount: 9, reviewedNoFamily: { 'acme-key': 'reason' } }) });
  assert.match(peerRuleFamilyProblems(wrongCount, taxonomy, inventories).join('\n'), /ruleCount 9 is not the 3 rules/);
  const both = map({ gitleaks: entry({ 'acme-key': { families: ['acme:api-key'], basis: 'acme_ + 32' } }, { reviewedNoFamily: { 'acme-key': 'reason' } }) });
  assert.match(peerRuleFamilyProblems(both, taxonomy, inventories).join('\n'), /both mapped and reviewed/);
});

test('rules and reviews stay sorted, so a diff shows only what changed', () => {
  const unsorted = map({ gitleaks: entry({ jwt: { families: ['generic:jwt'], basis: 'x' }, 'acme-key': { families: ['acme:api-key'], basis: 'x' } }) });
  assert.match(peerRuleFamilyProblems(unsorted, taxonomy, inventories).join('\n'), /rules must be sorted/);
});

test('provider names are matched by prefix of the id or a segment, not anywhere in it', () => {
  const tokens = providerTokens(taxonomy);
  assert.ok(looksLikeProvider('acme-api-token', tokens));
  assert.ok(looksLikeProvider('hashicorpvault/hashicorpvaulttoken', tokens));
  assert.ok(!looksLikeProvider('vault-thing', ['hashicorp']));
  assert.ok(!looksLikeProvider('geoacme', tokens));
});

test('the registry copy states what a scanner is built for and never ranks it', () => {
  const registry = { schemaVersion: 1, scanners: { gitleaks: { kind: 'repository-scanner', description: 'Built to find secrets.' }, trufflehog: { kind: 'repository-scanner', description: 'A better scanner.' }, extra: { kind: 'runtime-library', description: 'x' } } };
  const found = peerRegistryProblems(registry, ['redact-secret', 'gitleaks', 'trufflehog', 'flare-redact']).join('\n');
  assert.match(found, /trufflehog description words a judgement/);
  assert.match(found, /no entry for peer flare-redact/);
  assert.match(found, /extra is not a registered peer/);
});

test('every peer family the map targets is a taxonomy family, and the targeted set is the union of its rules', async () => {
  const committed = read('scanners/peer-rule-families.json');
  const families = new Set(read('benchmarks/support/taxonomy.json').families.map(f => f.id));
  for (const [id, set] of Object.entries(committed.scanners)) {
    const { families: targeted, mappedRules } = targetedFamilies(set);
    assert.ok(mappedRules > 0 && targeted.size > 0, id);
    for (const family of targeted) assert.ok(families.has(family), `${id}: ${family}`);
  }
  assert.equal((await peerInventories()).gitleaks.length, committed.scanners.gitleaks.ruleCount);
});
