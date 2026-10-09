import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseEvidenceJson } from './pii-evidence-json.mjs';
import { createHash } from 'node:crypto';
import { createCoverageRow, validateCoverageMatrix } from './pii-coverage-model.mjs';
import { loadPiiCoverageInventories } from './pii-coverage-inventory.mjs';
const fail = reason => { throw new Error(`PII coverage join refusal: ${reason}`); };
const canonical = value => JSON.stringify(value && typeof value === 'object' ? Array.isArray(value) ? value.map(item => JSON.parse(canonical(item))) : Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])) : value);
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const same = (a, b) => canonical(a) === canonical(b);

/** Input comparison is the existing strict consumer's validated result, never raw run JSON. */
export function joinPiiCoverageInventory({ inventory, comparison = { state: 'absent' }, side, capabilityDeclarations = null }) {
  if (!['baseline', 'candidate'].includes(side)) fail('side-invalid');
  let usable = comparison.state === 'recorded', status = comparison.state === 'invalid' ? 'invalid' : 'absent';
  if (usable && (!same(comparison.evidence, inventory.source) || !same(comparison.population, inventory.consumer.importedPopulation) ||
      comparison.protocol?.id !== inventory.consumer.contract.protocol.id || comparison.protocol?.revision !== inventory.consumer.contract.protocol.revision ||
      !comparison.importer?.binarySha256 || !comparison.engine?.binarySha256 || !comparison.scanner?.configurationDigest ||
      !comparison.scanner?.activationDigest || !Array.isArray(comparison.scanner?.activation) ||
      !comparison[side]?.packageTreeSha256 ||
      !comparison.provenance || !Array.isArray(comparison.outcomes) || comparison.familyMetrics?.state !== 'unavailable')) {
    usable = false; status = 'identity-mismatch';
  }
  // A proposal may have engineering observations, but never borrows the active official run.
  if (inventory.role === 'proposed' && comparison.state === 'recorded' && !usable) status = 'identity-mismatch';
  const product = usable ? comparison[side] : null;
  const productCommitment = product ? digest({ sourceCommit: product.sourceCommit, packageTreeSha256: product.packageTreeSha256,
    addonTreeSha256: product.addonTreeSha256, wasmTreeSha256: product.wasmTreeSha256, tarballs: product.tarballs }) : null;
  const identity = { snapshotId: inventory.source.snapshot.id, snapshotCommitment: inventory.source.snapshot.contentDigest,
    productCommitment, mappingRevision: inventory.consumer.contract.mapping.revision,
    mappingCommitment: digest({ consumer: inventory.consumer.source, mapping: inventory.consumer.contract.mapping, population: inventory.consumer.importedPopulation }),
    protocol: `${inventory.consumer.contract.protocol.id}/${inventory.consumer.contract.protocol.revision}`,
    population: inventory.consumer.importedPopulation.digest, visibility: 'public', role: inventory.role === 'proposed' ? 'proposed' : side,
    bindingCommitment: usable ? digest({ snapshot: inventory.source.snapshot, population: comparison.population, product, engine: comparison.engine,
      importer: comparison.importer, scanner: comparison.scanner, protocol: comparison.protocol, run: comparison.provenance }) : null };
  const declarations = new Map();
  if (capabilityDeclarations !== null) {
    if (!capabilityDeclarations || capabilityDeclarations.productCommitment !== identity.productCommitment || !productCommitment ||
        !Array.isArray(capabilityDeclarations.rows) || typeof capabilityDeclarations.source !== 'string') fail('declaration-product-mismatch');
    for (const row of capabilityDeclarations.rows) {
      if (declarations.has(row.kindKey) || !inventory.rows.some(kind => kind.kindKey === row.kindKey) || !['declared', 'explicitly-absent', 'unknown'].includes(row.state)) fail('declaration-kind-ambiguous');
      declarations.set(row.kindKey, row);
    }
  }
  const rows = inventory.rows.map(kind => {
    const declaration = declarations.get(kind.kindKey);
    return createCoverageRow({ kindKey: kind.kindKey, label: kind.label, domains: kind.domains, jurisdictions: kind.jurisdictions, evidence: kind.evidence,
      capability: { state: declaration?.state ?? 'unknown', source: declaration ? capabilityDeclarations.source : null,
        productCommitment: declaration ? identity.productCommitment : null },
      mapping: { state: kind.mapping.state, losses: kind.mapping.losses, requiredAxes: kind.mapping.requiredAxes, representableAxes: kind.mapping.representableAxes },
      // Schema 1.4 carries case/assertion outcomes, not validated per-kind denominators.
      observation: { status: usable ? 'withheld' : status, identity: null, axes: [], source: usable ? `artifact:${product.artifactDigest}` : null },
      applicability: { state: 'unknown', source: null }, reasons: [] }, identity);
  });
  const matrix = validateCoverageMatrix({ schemaVersion: 1, identity, rows });
  const outcomes = usable ? inventory.rows.map(kind => ({ kindKey: kind.kindKey, families: kind.mapping.families,
    outcomes: comparison.outcomes.filter(row => kind.mapping.families.includes(row.family)).map(row => ({ caseId: row.caseId,
      variantId: row.variantId, family: row.family, outcome: row[side] })) })) : [];
  return { matrix, binding: usable ? { product, engine: comparison.engine, importer: comparison.importer, scanner: comparison.scanner,
    protocol: comparison.protocol, provenance: comparison.provenance } : null,
    outcomes, globalLosses: inventory.losses, perKindLossAccounting: 'unavailable', familyMetrics: { state: 'unavailable', reason: usable ? comparison.familyMetrics.reason : status },
    capabilityDeclarations: { state: capabilityDeclarations ? 'provided-exact-product' : 'unknown', reason: capabilityDeclarations ? null : 'no-reviewed-kind-to-product-declaration' } };
}

export async function loadPiiCoverage(root, { comparison = { state: 'absent' }, proposedComparison = { state: 'absent' }, capabilityDeclarations = {} } = {}) {
  const inventories = await loadPiiCoverageInventories(root), matrices = {};
  const catalogs = {};
  for (const side of ['baseline', 'candidate']) {
    const bytes = await readFile(path.join(root, `benchmarks/inputs/pii-coverage/${side}-product-catalog.json`));
    const expected = side === 'baseline' ? '96aed93ada7a65c1990d101a9eca621dccf15dc24ffefc671af375682acd7de8' : 'a0c3829593add99ddd0ebd5677c6b2868b7e7e756c2004ad4a6445ba0e3d0396';
    if (createHash('sha256').update(bytes).digest('hex') !== expected) fail('product-catalog-projection-mismatch');
    const catalog = parseEvidenceJson(bytes.toString());
    const families = [...catalog.declaration.matchAll(/"(pii:[a-z0-9:-]+)"/g)].map(match => match[1]);
    if (catalog.schema !== 'pii-coverage-product-catalog/1' || catalog.symbol !== 'AVAILABLE_FAMILIES' ||
        !same(families, catalog.families) || new Set(families).size !== families.length) fail('product-catalog-declaration-invalid');
    catalogs[side] = catalog;
  }
  for (const role of ['active', 'proposed']) {
    matrices[role] = {};
    for (const side of ['baseline', 'candidate']) {
      const initial = joinPiiCoverageInventory({ inventory: inventories[role], side, comparison: role === 'active' ? comparison : proposedComparison });
      const catalog = catalogs[side];
      const declarations = initial.binding && catalog.sourceCommit === initial.binding.product.sourceCommit ? {
        productCommitment: initial.matrix.identity.productCommitment,
        source: `https://github.com/${catalog.repository}/blob/${catalog.sourceCommit}/${catalog.path}#L${catalog.lines.start}`,
        rows: inventories[role].rows.map(row => ({ kindKey: row.kindKey, state: row.mapping.families.length ?
          row.mapping.families.every(family => catalog.families.includes(family)) ? 'declared' : 'explicitly-absent' : 'unknown' })) } : null;
      matrices[role][side] = joinPiiCoverageInventory({ inventory: inventories[role], side,
      comparison: role === 'active' ? comparison : proposedComparison,
      capabilityDeclarations: capabilityDeclarations[role]?.[side] ?? declarations });
    }
  }
  return { schema: 'pii-coverage-view/1', inventories, matrices, supportClaims: false, qualified: false };
}
