import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseEvidenceJson } from './pii-evidence-json.mjs';
import { sha256, mappingKindsOf, validateEvidencePins, validateProposedConsumerPin, validatePreflightReport } from './pii-evidence-contract.mjs';

const fail = reason => { throw new Error(`PII coverage inventory refusal: ${reason}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const integer = value => Number.isSafeInteger(value) && value >= 0;
export const PROPOSED_EVIDENCE_DIRECTORY = 'benchmarks/inputs/pii-evidence-snapshot-v2-post37-candidate';
const set = (values, reason) => {
  if (!Array.isArray(values) || values.some(value => typeof value !== 'string' || !value) || new Set(values).size !== values.length) fail(reason);
  return [...values].sort();
};

// The pinned manifest authenticates the taxonomy bytes, including zero-case entries.
export function consumePiiCoverageInventory({ manifestBytes, taxonomyBytes, snapshotPin, consumerPin, preflight, policy, role, repoRoot }) {
  if (!['active', 'proposed'].includes(role)) fail('role-invalid');
  if (role === 'active') validateEvidencePins(snapshotPin, consumerPin);
  else validateProposedConsumerPin(consumerPin, snapshotPin, { repoRoot });
  validatePreflightReport(preflight, policy, { snapshotPin, consumerPin, repoRoot });
  if (sha256(manifestBytes) !== snapshotPin.snapshot.manifestSha256) fail('manifest-bytes-mismatch');
  const manifest = parseEvidenceJson(manifestBytes.toString()), taxonomy = parseEvidenceJson(taxonomyBytes.toString());
  if (manifest.id !== snapshotPin.snapshot.id || manifest.contentDigest !== snapshotPin.snapshot.contentDigest ||
      manifest.sourceManifestDigest !== snapshotPin.snapshot.sourceManifestDigest || manifest.population !== 'public') fail('snapshot-identity-mismatch');
  const files = manifest.files.filter(row => row.path === 'taxonomy/privacy-kinds.json');
  if (files.length !== 1 || files[0].bytes !== taxonomyBytes.length || files[0].sha256 !== sha256(taxonomyBytes)) fail('taxonomy-bytes-mismatch');
  if (taxonomy.kind !== 'privacy-kinds' || !Array.isArray(taxonomy.kinds)) fail('taxonomy-unavailable');
  const ids = set(taxonomy.kinds.map(row => row.id), 'kind-identity-ambiguous');
  const accepted = set(manifest.coverage?.kinds, 'accepted-kind-metadata-missing');
  const empty = set(manifest.coverage?.kindsWithoutCases, 'empty-kind-metadata-missing');
  if (accepted.some(id => empty.includes(id)) || !same(ids, [...accepted, ...empty].sort())) fail('exposed-kind-set-mismatch');
  if (!same(Object.keys(manifest.coverage.perKind).sort(), accepted)) fail('per-kind-set-mismatch');
  const mapping = mappingKindsOf(consumerPin, { repoRoot }), usedFamilies = new Set();
  const metadataPreserved = consumerPin.contract.mapping.revision === 3;
  const rows = taxonomy.kinds.map(kind => {
    if (typeof kind.label !== 'string' || !kind.label || !kind.classification || !['resolved', 'unresolved'].includes(kind.classification.state) ||
        typeof kind.classification.evidenceClass !== 'string' || !Array.isArray(kind.openQuestions)) fail('kind-metadata-missing');
    const domains = set(kind.domains, 'domain-metadata-missing').map(domain => {
      if (!['pii', 'phi'].includes(domain)) fail('domain-unknown'); return domain.toUpperCase();
    });
    const jurisdictions = set(kind.jurisdictions, 'jurisdiction-metadata-missing');
    const sourceCounts = accepted.includes(kind.id) ? manifest.coverage.perKind[kind.id] : { cases: 0, fixtures: 0 };
    if (!integer(sourceCounts.cases) || !integer(sourceCounts.fixtures) || (accepted.includes(kind.id) && sourceCounts.cases === 0)) fail('kind-count-invalid');
    const families = mapping[kind.id] === undefined ? [] : Array.isArray(mapping[kind.id]) ? mapping[kind.id] : [mapping[kind.id]];
    const counts = families.filter(family => preflight.mappedFamilies[family]).map(family => {
      if (usedFamilies.has(family)) fail('family-join-ambiguous'); usedFamilies.add(family); return preflight.mappedFamilies[family];
    });
    const importedCases = families.length ? counts.reduce((sum, row) => sum + row.cases, 0) : null;
    const variants = families.length ? counts.reduce((sum, row) => sum + row.variants, 0) : null;
    if (variants !== null && variants !== sourceCounts.fixtures) fail('fixture-variant-total-mismatch');
    return { kindKey: kind.id, label: kind.label, domains, jurisdictions,
      research: { ...kind.classification, openQuestions: kind.openQuestions, contextClaims: kind.contextClaims ?? [] },
      evidence: { availability: sourceCounts.cases ? 'accepted' : 'none', authoredCases: sourceCounts.cases, acceptedCases: sourceCounts.cases,
        fixtures: sourceCounts.fixtures, importedCases, variants, occurrences: null },
      mapping: { families, revision: consumerPin.contract.mapping.revision, state: families.length ? 'partial' : 'not-representable',
        losses: ['per-kind-fidelity-unavailable', ...(!metadataPreserved && domains.includes('PHI') ? ['phi-domain-not-represented'] : []), ...(!metadataPreserved && (kind.contextClaims ?? []).length ? ['source-context-fidelity-unavailable'] : [])], requiredAxes: ['identity', 'sensitivity', ...(domains.includes('PHI') ? ['phi-domain'] : []), ...((kind.contextClaims ?? []).length ? ['context'] : [])], representableAxes: families.length ? ['identity', 'sensitivity', ...(metadataPreserved && domains.includes('PHI') ? ['phi-domain'] : []), ...(metadataPreserved && (kind.contextClaims ?? []).length ? ['context'] : [])] : [], reason: families.length ? 'per-kind-semantic-loss-accounting-unavailable' : 'source-kind-unmapped' },
      emptyReasons: sourceCounts.cases ? [] : [kind.classification.state === 'unresolved' ? 'source-classification-unresolved' : 'no-publicly-accepted-source-cases'],
      source: { repository: snapshotPin.release.repository, commit: snapshotPin.release.commit, snapshotId: snapshotPin.snapshot.id,
        manifestSha256: snapshotPin.snapshot.manifestSha256, taxonomySha256: files[0].sha256 } };
  }).sort((a, b) => a.kindKey.localeCompare(b.kindKey));
  const sum = key => rows.reduce((total, row) => total + (row.evidence[key] ?? 0), 0);
  if (sum('authoredCases') !== manifest.counts.cases || sum('fixtures') !== manifest.counts.fixtures ||
      sum('importedCases') !== preflight.counts.corpusCases || sum('variants') !== preflight.counts.corpusVariants ||
      usedFamilies.size !== Object.keys(preflight.mappedFamilies).length) fail('inventory-total-mismatch');
  return { schema: 'pii-coverage-inventory/1', role, source: structuredClone(snapshotPin), consumer: structuredClone(consumerPin),
    totals: { kinds: rows.length, authoredCases: sum('authoredCases'), fixtures: sum('fixtures'), importedCases: sum('importedCases'),
      variants: sum('variants'), occurrences: preflight.counts.occurrences },
    losses: structuredClone(preflight.losses), limitations: ['source-membership-is-not-product-support', 'source-classification-is-not-a-deferred-acceptance-decision',
      'per-kind-semantic-loss-accounting-unavailable', 'per-kind-occurrence-accounting-unavailable', 'source-deferred-counts-unavailable'], rows };
}

export async function loadPiiCoverageInventories(root) {
  const read = async file => parseEvidenceJson(await readFile(path.join(root, file), 'utf8'));
  const policy = await read('benchmarks/pii-population-policy.json');
  const entries = await Promise.all(['active', 'proposed'].map(async role => {
    const pinDirectory = role === 'active' ? 'benchmarks/pii-evidence' : PROPOSED_EVIDENCE_DIRECTORY;
    const directory = `benchmarks/inputs/pii-coverage/${role}`;
    const [snapshotPin, consumerPin, preflight, manifestBytes, taxonomyBytes] = await Promise.all([
      read(`${pinDirectory}/snapshot-pin.json`), read(`${pinDirectory}/consumer-pin.json`), read(`${pinDirectory}/preflight.json`),
      readFile(path.join(root, directory, 'manifest.json')), readFile(path.join(root, directory, 'privacy-kinds.json'))]);
    return [role, consumePiiCoverageInventory({ snapshotPin, consumerPin, preflight, manifestBytes, taxonomyBytes, policy, role, repoRoot: root })];
  }));
  return Object.fromEntries(entries);
}
