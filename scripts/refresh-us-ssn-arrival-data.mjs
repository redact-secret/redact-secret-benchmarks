import { readFile, writeFile } from 'node:fs/promises';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';

const evidencePath = 'benchmarks/evaluation/domains/pii/benign-collision-evidence-v1.json';
const populationPath = 'benchmarks/evaluation/domains/pii/populations-v1.json';
const registryPath = 'benchmarks/evaluation/domains/pii/support-registry-v1.json';
const readJson = async location => JSON.parse(await readFile(location, 'utf8'));
const writeJson = async (location, value) => writeFile(location, `${JSON.stringify(value, null, 2)}\n`);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
const commitment = projection => hash(JSON.stringify(canonical(projection)));
const piiBenignCollisionCommitment = corpus => commitment({ accountingProfile: corpus.accountingProfile, reporting: corpus.reporting,
  classes: corpus.classes, families: corpus.families, entries: corpus.entries });
const piiPopulationCommitment = contract => { const { contentCommitment: _commitment, ...projection } = contract; return commitment(projection); };
const piiSupportRegistryCommitment = registry => commitment({ schemaVersion: registry.schemaVersion, id: registry.id, version: registry.version,
  source: registry.source, families: registry.families });

const authority = [
  { sourceKind: 'public-authority', sourceId: 'ssa-poms-rm-10201-030', locator: 'https://secure.ssa.gov/poms.nsf/lnx/0110201030',
    revision: 'TN-2-2011-06-23', supports: ['lexical', 'allocation'] },
  { sourceKind: 'public-authority', sourceId: 'ssa-ssn-randomization', locator: 'https://www.ssa.gov/employer/randomization.html',
    revision: 'implemented-2011-06-25-retrieved-2026-09-27', supports: ['allocation'] },
  { sourceKind: 'public-authority', sourceId: 'ssa-poms-rm-10201-035', locator: 'https://secure.ssa.gov/poms.nsf/lnx/0110201035',
    revision: 'TN-2-2011-06-23', supports: ['validation', 'allocation'] },
  { sourceKind: 'public-authority', sourceId: 'ssa-poms-rm-10201-020', locator: 'https://secure.ssa.gov/poms.nsf/lnx/0110201020',
    revision: 'Basic-2009-08-28', supports: ['reserved-control'] },
  { sourceKind: 'public-authority', sourceId: 'ssa-poms-gn-03325-002', locator: 'https://secure.ssa.gov/poms.nsf/lnx/0203325002',
    revision: 'TN-9-2024-04', supports: ['sensitivity'] },
];
const source = (sourceId, locator, revision) => ({ sourceKind: 'public-authority', sourceId, locator, revision });
const ssaAllocation = source('ssa-poms-rm-10201-035', 'https://secure.ssa.gov/poms.nsf/lnx/0110201035', 'TN-2-2011-06-23');
const ssaReserved = source('ssa-poms-rm-10201-020', 'https://secure.ssa.gov/poms.nsf/lnx/0110201020', 'Basic-2009-08-28');
const productContract = { sourceKind: 'product-decision', sourceId: 'redact-secret-us-ssn-v1',
  locator: 'https://github.com/redact-secret/redact-secret/blob/a0709d2a41b70217874da9afeffb40fb2a1a2596/docs/contracts/pii/us-ssn-v1.md',
  revision: 'a0709d2a41b70217874da9afeffb40fb2a1a2596' };
const validator = expected => ({ id: 'us-ssn-allocation', version: 1, expected });

function entry(id, population, evidenceClass, accountingClass, candidate, prefix, options = {}) {
  let seed = `redact-secret-benchmarks-392/${population}/${id}`;
  const authoritative = options.authoritative === true;
  const pattern = candidate;
  const materialize = (pattern, selectedSeed) => {
    let token = 0;
    return [...pattern].map(character => character === 'D' ?
      String(Number.parseInt(hash(`${selectedSeed}/${token++}`).slice(0, 8), 16) % 10) : character).join('');
  };
  if (!authoritative) {
    let attempt = 0;
    while (true) {
      seed = `redact-secret-benchmarks-392/${population}/${id}/${attempt++}`;
      const value = materialize(pattern, seed), area = Number(value.slice(0, 3));
      const structurallyValid = /^\d{9}$/.test(value) && area !== 0 && area !== 666 && area < 900 &&
        value.slice(3, 5) !== '00' && value.slice(5) !== '0000';
      if (structurallyValid === (options.valid !== false)) { candidate = value; break; }
    }
  }
  return {
    id: `${population}-${id}`, caseId: `${population}-${id}`, evidenceClass, accountingClass,
    family: 'pii:us:ssn', scope: 'jurisdiction:US', identityDomain: 'national-id', language: 'en',
    candidateCommitment: hash(candidate),
    fixture: { prefix, suffix: '', candidate: authoritative ? { kind: 'authoritative-reserved', value: candidate } :
      { kind: 'deterministic-pattern', generator: 'sha256-pattern', seed,
        pattern } },
    typeExpectation: options.valid === false ? 'invalid' : 'valid',
    sensitivityExpectation: options.valid === false && evidenceClass === 'near-miss' ? 'not-established' : 'non-sensitive',
    validator: validator(options.valid === false ? 'invalid' : 'valid'), contextGroup: null,
    context: { obligation: options.contextNegative ? 'required-for-sensitive-classification' : 'none',
      class: options.valid === false && evidenceClass === 'near-miss' ? 'neutral' : 'non-sensitive' },
    collision: null,
    provenance: authoritative ? { kind: 'authoritative', sources: [ssaReserved, ssaAllocation] } :
      { kind: 'deterministic-synthetic', sources: [ssaAllocation, productContract],
        generator: { id: 'sha256-pattern', version: 1, seedCommitment: hash(seed) } },
  };
}

const diagnostic = [
  entry('reserved-display', 'diagnostic', 'reserved-documentation', 'reserved', '000000000', 'ssn=', { valid: false, authoritative: true }),
  entry('official-control', 'diagnostic', 'official-test', 'test-value', '000626879', 'ssn=', { valid: false, authoritative: true }),
  entry('ordinary-reference', 'diagnostic', 'ordinary-reference-account', 'public-operational', 'DDDDDDDDD', 'order_reference='),
  entry('allocation-near-miss', 'diagnostic', 'near-miss', null, 'DDDDDDDDD', 'ssn=', { valid: false }),
  entry('context-negative', 'diagnostic', 'context-negative', 'context-negative', 'DDDDDDDDD', 'ssn documentation=', { contextNegative: true }),
];
const stress = [
  entry('reserved-display', 'stress', 'reserved-documentation', 'reserved', '000000000', 'ssn=', { valid: false, authoritative: true }),
  entry('documentation', 'stress', 'reserved-documentation', 'documentation', 'DDDDDDDDD', 'ssn documentation=', { contextNegative: true }),
  entry('official-area-zero', 'stress', 'official-test', 'test-value', '000626879', 'ssn=', { valid: false, authoritative: true }),
  entry('official-area-666', 'stress', 'official-test', 'test-value', '666626879', 'ssn=', { valid: false, authoritative: true }),
  entry('public-identifier-a', 'stress', 'public-identifier', 'public-operational', 'DDDDDDDDD', 'public_record_id='),
  entry('public-identifier-b', 'stress', 'public-identifier', 'public-operational', 'DDDDDDDDD', 'employee_registry_id='),
  entry('order-reference', 'stress', 'ordinary-reference-account', 'public-operational', 'DDDDDDDDD', 'order_reference='),
  entry('invoice-reference', 'stress', 'ordinary-reference-account', 'public-operational', 'DDDDDDDDD', 'invoice_number='),
  entry('placeholder', 'stress', 'placeholder', 'placeholder', 'DDDDDDDDD', 'placeholder_ssn='),
  entry('context-negative', 'stress', 'context-negative', 'context-negative', 'DDDDDDDDD', 'not_ssn=', { contextNegative: true }),
];

const evidence = await readJson(evidencePath);
evidence.families = [{ family: 'pii:us:ssn', displayName: 'US Social Security Number', identityDomain: 'national-id',
  scope: 'jurisdiction:US', validator: { id: 'us-ssn-allocation', version: 1 }, authority }];
evidence.entries = [...diagnostic, ...stress];
evidence.contentCommitment = piiBenignCollisionCommitment(evidence);
await writeJson(evidencePath, evidence);

const population = await readJson(populationPath);
population.source.corpus.contentCommitment = evidence.contentCommitment;
const dimension = row => ({ family: row.family, scope: row.scope, contextClass: row.context.class, evidenceClass: row.evidenceClass,
  accountingAxis: row.accountingClass, sensitivity: row.sensitivityExpectation, validatorBacked: row.validator !== null,
  contextDependent: row.context.obligation === 'required-for-sensitive-classification' });
const key = row => JSON.stringify(dimension(row));
function populate(target, rows, masses) {
  target.denominator.evidenceIds = rows.map(row => row.id);
  target.denominator.caseIds = rows.map(row => row.caseId);
  const groups = [...new Map(rows.map(row => [key(row), row])).values()];
  target.baseRate.sensitiveMass = masses.sensitive;
  target.baseRate.nonSensitiveMass = masses.nonSensitive;
  target.baseRate.notEstablishedMass = masses.notEstablished;
  target.baseRate.strata = groups.map(row => {
    const count = rows.filter(candidate => key(candidate) === key(row)).length;
    const totalMass = target.id === 'diagnostic-balanced' ? 2000 : 1000 * count;
    return { ...dimension(row), totalMass,
      sensitiveMass: row.sensitivityExpectation === 'sensitive' ? totalMass : 0,
      nonSensitiveMass: row.sensitivityExpectation === 'non-sensitive' ? totalMass : 0,
      notEstablishedMass: row.sensitivityExpectation === 'not-established' ? totalMass : 0 };
  });
}
populate(population.populations.find(row => row.id === 'diagnostic-balanced'), diagnostic,
  { sensitive: 0, nonSensitive: 8000, notEstablished: 2000 });
populate(population.populations.find(row => row.id === 'benign-heavy-stress'), stress,
  { sensitive: 0, nonSensitive: 10000, notEstablished: 0 });
population.contentCommitment = piiPopulationCommitment(population);
await writeJson(populationPath, population);

const registry = await readJson(registryPath);
registry.contentCommitment = piiSupportRegistryCommitment(registry);
await writeJson(registryPath, registry);
console.log(JSON.stringify({ evidence: evidence.contentCommitment, populations: population.contentCommitment, registry: registry.contentCommitment }));
