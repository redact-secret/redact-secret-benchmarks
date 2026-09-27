import { validateEvidence } from '../credential/evidence.ts';
import { hash } from '../../substrate/hash.ts';
import trustedBindings from './trusted-product-bindings-v1.json';

type GateStatus = 'met' | 'not-met' | 'unresolved' | 'not-applicable';
export interface PiiActivationEvidence {
  schemaVersion: 1; reportType: 'pii-activation-evidence'; supportClaims: false;
  product: { repository: 'redact-secret/redact-secret'; sourceCommit: string; artifactCommitment: string; candidateEvidenceCommitment: string };
  profile: { id: 'pii-v1'; version: 1 }; requestedSelectors: string[]; activationIdentity: string; availableFamilies: string[];
  selectorChecks: PiiActivationCheck[];
  surfaces: Array<{ id: string; status: 'pass'; activationChecks: PiiActivationCheck[] }>;
  offSurfaces: Array<{ id: string; status: 'pass' }>;
  artifactCommitment: string;
}
interface PiiActivationCheck { selectors: string[]; activationIdentity: string; availableFamilies: string[] }
export interface PiiFamilyQualificationEvidence {
  schemaVersion: 1; reportType: 'pii-family-qualification'; supportClaims: false; family: string;
  product: PiiActivationEvidence['product']; activationArtifactCommitment: string; planCommitment: string;
  profile: { id: 'pii-v1'; version: 1 }; gates: Array<{ id: string; status: GateStatus }>;
  classAccounting: Array<{ id: string; status: 'measured' | 'unresolved'; observations: number }>;
  installedArtifactConformance?: PiiInstalledArtifactConformance;
  sourceConformance?: PiiSourceConformance;
  status: 'qualified' | 'not-qualified'; reasonCodes: string[]; artifactCommitment: string;
}
interface PiiInstalledObservation { id: string; publicFinding: boolean; type: string | null; action: string | null;
  nativeOffsetUnit: 'utf16-code-unit'; nativeRange: { start: number; end: number } | null;
  canonicalRange: { start: number; end: number } | null }
interface PiiInstalledArtifactConformance { canonicalOffsetUnit: 'utf8-byte';
  lanes: Array<{ id: 'node-addon' | 'node-wasm'; status: 'pass'; nativeOffsetUnit: 'utf16-code-unit'; observations: PiiInstalledObservation[] }>;
  artifactCommitment: string }
interface PiiSourceConformance { sourceCommit: string; sourceState: 'clean'; lanes: Array<{ id: string; status: 'pass'; fixture: string;
  fixtureCommitment: string; commandDefinitionCommitment: string; toolchain: Array<{ executable: string; version: string }> }>;
  artifactCommitment: string }
export interface PiiTrustedProductBinding {
  candidateEvidence: unknown;
  activationArtifact: PiiActivationEvidence;
  qualificationArtifacts: readonly PiiFamilyQualificationEvidence[];
}
export interface ValidatedPiiProductBinding {
  sourceCommit: string; artifactCommitment: string; candidateEvidenceCommitment: string;
  activationIdentity: string; activationArtifactCommitment: string; availableFamilies: string[];
  qualification: PiiFamilyQualificationEvidence[];
}

const family = (value: unknown) => typeof value === 'string' && /^pii:(?:global|[a-z]{2}):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const digest = (value: unknown, size = 64) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${size}}$`).test(value);
const slug = (value: unknown) => typeof value === 'string' && /^[a-z][a-z0-9-]{1,79}$/.test(value);
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
const commitment = (value: unknown) => {
  const { artifactCommitment: _artifactCommitment, ...projection } = value as Record<string, unknown>;
  return hash(JSON.stringify(canonical(projection)));
};
const exact = (value: unknown, keys: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');

function validRange(value: unknown) {
  return exact(value, ['start', 'end']) && Number.isInteger((value as any).start) && Number.isInteger((value as any).end) &&
    (value as any).start >= 0 && (value as any).end > (value as any).start;
}

function validInstalledConformance(value: PiiInstalledArtifactConformance | undefined) {
  if (!value || !exact(value, ['canonicalOffsetUnit', 'lanes', 'artifactCommitment']) || value.canonicalOffsetUnit !== 'utf8-byte' ||
      value.artifactCommitment !== commitment(value) || JSON.stringify(value.lanes.map(row => row.id)) !== JSON.stringify(['node-addon', 'node-wasm'])) return false;
  return value.lanes.every(lane => exact(lane, ['id', 'status', 'nativeOffsetUnit', 'observations']) && lane.status === 'pass' &&
    lane.nativeOffsetUnit === 'utf16-code-unit' && Array.isArray(lane.observations) && lane.observations.length > 0 &&
    new Set(lane.observations.map(row => row.id)).size === lane.observations.length && lane.observations.every(row =>
      exact(row, ['id', 'publicFinding', 'type', 'action', 'nativeOffsetUnit', 'nativeRange', 'canonicalRange']) && slug(row.id) &&
      row.nativeOffsetUnit === 'utf16-code-unit' && (row.publicFinding ? typeof row.type === 'string' && row.action === 'redact' &&
        validRange(row.nativeRange) && validRange(row.canonicalRange) : row.type === null && row.action === null && row.nativeRange === null && row.canonicalRange === null)));
}

function validSourceConformance(value: PiiSourceConformance | undefined, sourceCommit: string, qualificationFamily: string) {
  const contracts: Record<string, { ids: string[]; fixture: string }> = {
    'pii:global:email': { ids: ['cli-email-conformance', 'python-email-conformance', 'rust-native-email-conformance'],
      fixture: 'conformance/fixtures/pii-email-v1.json' },
    'pii:global:iban': { ids: ['cli-iban-conformance', 'python-iban-conformance', 'rust-native-iban-conformance'],
      fixture: 'conformance/fixtures/pii-iban-v1.json' },
  };
  const contract = contracts[qualificationFamily];
  if (!contract) return false;
  if (!value || !exact(value, ['sourceCommit', 'sourceState', 'lanes', 'artifactCommitment']) || value.sourceCommit !== sourceCommit ||
      value.sourceState !== 'clean' || value.artifactCommitment !== commitment(value) ||
      JSON.stringify(value.lanes.map(row => row.id).sort()) !== JSON.stringify(contract.ids)) return false;
  return value.lanes.every(lane => exact(lane, ['id', 'status', 'fixture', 'fixtureCommitment', 'commandDefinitionCommitment', 'toolchain']) &&
    lane.status === 'pass' && lane.fixture === contract.fixture && digest(lane.fixtureCommitment) &&
    digest(lane.commandDefinitionCommitment) && Array.isArray(lane.toolchain) && lane.toolchain.length > 0 && lane.toolchain.every(tool =>
      exact(tool, ['executable', 'version']) && slug(tool.executable) && typeof tool.version === 'string' && tool.version.length > 0));
}

function parseActivationIdentity(value: string) {
  const match = /^credentials=(full|common);selectors=([a-z0-9:,-]+);families=([a-z0-9:,-]+);vocabulary=pii-context\/v1$/.exec(value);
  if (!match) throw new Error('Invalid PII activation identity');
  const selectors = match[2].split(','), families = match[3].split(',');
  if (new Set(selectors).size !== selectors.length || new Set(families).size !== families.length || families.some(item => !family(item)))
    throw new Error('Invalid PII activation identity');
  return { selectors, families };
}

function selectorClosure(selectors: readonly string[], registryFamilies: readonly string[]) {
  if (JSON.stringify(selectors) !== JSON.stringify([...new Set(selectors)].sort())) throw new Error('PII selectors are not canonical');
  const closure = new Set<string>();
  for (const selector of selectors) {
    if (selector === 'pii:global') {
      registryFamilies.filter(item => item.startsWith('pii:global:')).forEach(item => closure.add(item));
      continue;
    }
    const jurisdiction = /^pii:([a-z]{2})$/.exec(selector);
    if (jurisdiction) {
      const prefix = `pii:${jurisdiction[1]}:`;
      if (!registryFamilies.some(item => item.startsWith(prefix))) throw new Error('Unknown PII jurisdiction selector');
      registryFamilies.filter(item => item.startsWith('pii:global:') || item.startsWith(prefix)).forEach(item => closure.add(item));
      continue;
    }
    const exactFamily = /^pii:family:((?:global|[a-z]{2}):[a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(selector)?.[1];
    const id = exactFamily && `pii:${exactFamily}`;
    if (!id || !registryFamilies.includes(id)) throw new Error('Unknown PII family selector');
    closure.add(id);
  }
  return [...closure].sort();
}

export function validatePiiProductBinding(input: PiiTrustedProductBinding, registryFamilies: readonly string[]): ValidatedPiiProductBinding {
  validateEvidence(input.candidateEvidence, 'candidate');
  const candidate = input.candidateEvidence as any;
  if (candidate.status !== 'complete' || candidate.selection?.scope !== 'full-suite' || candidate.benchmark?.dirty !== false ||
      candidate.candidate?.sourceState !== 'clean' ||
      !digest(candidate.candidate?.sourceCommit, 40) || !digest(candidate.candidate?.artifactSha256) ||
      candidate.candidate.artifactSha256 !== candidate.candidate.expectedArtifactSha256)
    throw new Error('Invalid trusted PII candidate evidence');
  const candidateEvidenceCommitment = hash(JSON.stringify(candidate));
  const activation = structuredClone(input.activationArtifact);
  if (!exact(activation, ['schemaVersion', 'reportType', 'supportClaims', 'product', 'profile', 'requestedSelectors', 'activationIdentity', 'availableFamilies', 'selectorChecks', 'surfaces', 'offSurfaces', 'artifactCommitment']) ||
      activation.schemaVersion !== 1 || activation.reportType !== 'pii-activation-evidence' || activation.supportClaims !== false ||
      !exact(activation.product, ['repository', 'sourceCommit', 'artifactCommitment', 'candidateEvidenceCommitment']) ||
      activation.product.repository !== 'redact-secret/redact-secret' || activation.product.sourceCommit !== candidate.candidate.sourceCommit ||
      activation.product.artifactCommitment !== candidate.candidate.artifactSha256 || activation.product.candidateEvidenceCommitment !== candidateEvidenceCommitment ||
      activation.profile?.id !== 'pii-v1' || activation.profile.version !== 1 || activation.artifactCommitment !== commitment(activation) ||
      !Array.isArray(activation.requestedSelectors) || activation.requestedSelectors.length === 0 ||
      !Array.isArray(activation.availableFamilies) || new Set(activation.availableFamilies).size !== activation.availableFamilies.length ||
      activation.availableFamilies.some(item => !registryFamilies.includes(item)) || !Array.isArray(activation.selectorChecks) || activation.selectorChecks.length < 2 ||
      !Array.isArray(activation.surfaces) || activation.surfaces.length < 2 ||
      new Set(activation.surfaces.map(row => row.id)).size !== activation.surfaces.length || !Array.isArray(activation.offSurfaces) ||
      JSON.stringify(activation.offSurfaces) !== JSON.stringify(activation.surfaces.map(row => ({ id: row.id, status: 'pass' }))))
    throw new Error('Invalid trusted PII activation evidence');
  const parsed = parseActivationIdentity(activation.activationIdentity);
  if (JSON.stringify(parsed.selectors) !== JSON.stringify(activation.requestedSelectors) ||
      JSON.stringify(parsed.families) !== JSON.stringify(activation.availableFamilies) ||
      JSON.stringify(selectorClosure(activation.requestedSelectors, activation.availableFamilies)) !== JSON.stringify(activation.availableFamilies) ||
      JSON.stringify(activation.selectorChecks[0]) !== JSON.stringify({ selectors: activation.requestedSelectors,
        activationIdentity: activation.activationIdentity, availableFamilies: activation.availableFamilies }) ||
      activation.selectorChecks.some(check => {
        const identity = parseActivationIdentity(check.activationIdentity);
        return JSON.stringify(identity.selectors) !== JSON.stringify(check.selectors) ||
          JSON.stringify(identity.families) !== JSON.stringify(check.availableFamilies) ||
          JSON.stringify(selectorClosure(check.selectors, activation.availableFamilies)) !== JSON.stringify(check.availableFamilies);
      }) || activation.surfaces.some(row => !slug(row.id) || row.status !== 'pass' ||
        JSON.stringify(row.activationChecks) !== JSON.stringify(activation.selectorChecks)))
    throw new Error('PII activation evidence does not reconcile across surfaces');
  const qualifications = structuredClone([...input.qualificationArtifacts]);
  if (new Set(qualifications.map(row => row.family)).size !== qualifications.length || qualifications.some(row => {
    const failed = row.gates.filter(gate => gate.status !== 'met' && gate.status !== 'not-applicable').map(gate => gate.id).sort();
    const extended = row.installedArtifactConformance !== undefined || row.sourceConformance !== undefined;
    const keys = ['schemaVersion', 'reportType', 'supportClaims', 'family', 'product', 'activationArtifactCommitment', 'planCommitment', 'profile', 'gates', 'classAccounting',
      ...(extended ? ['installedArtifactConformance', 'sourceConformance'] : []), 'status', 'reasonCodes', 'artifactCommitment'];
    return !exact(row, keys) ||
      row.schemaVersion !== 1 || row.reportType !== 'pii-family-qualification' || row.supportClaims !== false || !registryFamilies.includes(row.family) ||
      JSON.stringify(row.product) !== JSON.stringify(activation.product) || row.activationArtifactCommitment !== activation.artifactCommitment ||
      !digest(row.planCommitment) || row.profile?.id !== 'pii-v1' || row.profile.version !== 1 || !Array.isArray(row.gates) || row.gates.length === 0 ||
      new Set(row.gates.map(gate => gate.id)).size !== row.gates.length || row.gates.some(gate => !slug(gate.id) || !['met', 'not-met', 'unresolved', 'not-applicable'].includes(gate.status)) ||
      !Array.isArray(row.classAccounting) || row.classAccounting.length === 0 ||
      new Set(row.classAccounting.map(entry => entry.id)).size !== row.classAccounting.length || row.classAccounting.some(entry =>
        !slug(entry.id) || !['measured', 'unresolved'].includes(entry.status) || !Number.isInteger(entry.observations) || entry.observations < 0 ||
        (entry.status === 'measured' ? entry.observations === 0 : entry.observations !== 0)) ||
      (extended && (!validInstalledConformance(row.installedArtifactConformance) || !validSourceConformance(row.sourceConformance, row.product.sourceCommit, row.family) ||
        !row.gates.some(gate => gate.id === 'exact-source-conformance' && gate.status === 'met'))) ||
      row.status !== (failed.length ? 'not-qualified' : 'qualified') || JSON.stringify(row.reasonCodes) !== JSON.stringify(failed) ||
      row.artifactCommitment !== commitment(row);
  })) throw new Error('Invalid trusted PII qualification evidence');
  const sanctioned = trustedBindings.bindings.find(row => row.product.sourceCommit === activation.product.sourceCommit &&
    row.product.artifactCommitment === activation.product.artifactCommitment &&
    row.product.candidateEvidenceCommitment === candidateEvidenceCommitment &&
    row.activationArtifactCommitment === activation.artifactCommitment && row.activationIdentity === activation.activationIdentity &&
    JSON.stringify(row.availableFamilies) === JSON.stringify(activation.availableFamilies));
  if (!sanctioned || JSON.stringify(sanctioned.qualifications) !== JSON.stringify(qualifications.map(row => ({
    family: row.family, planCommitment: row.planCommitment, artifactCommitment: row.artifactCommitment,
    ...(row.sourceConformance ? { sourceConformanceCommitment: row.sourceConformance.artifactCommitment } : {}), reasonCodes: row.reasonCodes,
  })).sort((a, b) => a.family.localeCompare(b.family)))) throw new Error('PII product binding is not repository-sanctioned');
  return { sourceCommit: activation.product.sourceCommit, artifactCommitment: activation.product.artifactCommitment,
    candidateEvidenceCommitment, activationIdentity: activation.activationIdentity, activationArtifactCommitment: activation.artifactCommitment,
    availableFamilies: [...activation.availableFamilies], qualification: qualifications };
}

export const piiBindingArtifactCommitment = commitment;
