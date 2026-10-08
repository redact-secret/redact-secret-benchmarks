// Separate public measurement evidence. Never projects support or consumes PII authority.
import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../../../schemas/pii-candidate-comparison-v1.json' with { type: 'json' };
import { createHash } from 'node:crypto';
import { consume, loadPins, parseStrictJson, canonicalize } from './pii-eval-artifact-consumer.mjs';
const validateReceipt = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
export const SIDES = ['baseline', 'candidate'];
export const documentDigest = value => createHash('sha256').update(JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)).digest('hex');
export const comparisonDigest = value => createHash('sha256').update(canonicalize(value)).digest('hex');
const same = (a, b) => canonicalize(a) === canonicalize(b);
export const ACTIVATION_FAMILIES = ['pii:global:email', 'pii:global:iban', 'pii:global:network-address', 'pii:global:payment-card', 'pii:global:phone', 'pii:us:ssn'];
export const ACTIVATION_SELECTORS = [[], ['pii:global'], ['pii:us'], ['pii:global', 'pii:us'], ...ACTIVATION_FAMILIES.map(f => [f.replace('pii:', 'pii:family:')])];
function activationProblems(activation) {
  for (const side of SIDES) {
    const surfaces = activation[side].surfaces;
    if (new Set(surfaces.map(s => s.surface)).size !== 2) return true;
    for (const surface of surfaces) {
      const bySelectors = new Map(surface.checks.map(check => [check.requestedSelectors.join(','), check]));
      if (bySelectors.size !== ACTIVATION_SELECTORS.length) return true;
      for (const selectors of ACTIVATION_SELECTORS.map(s => s.join(','))) {
        const c = bySelectors.get(selectors);
        if (!c || c.artifact !== (surface.surface === 'node-addon' ? 'addon' : 'wasm')) return true;
        const match = /^credentials=full;selectors=([^;]+);families=([^;]*);vocabulary=pii-context\/v[0-9]+$/.exec(c.activationIdentity);
        if (!match || match[1] !== (selectors || 'off')) return true;
        const families = match[2].split(',');
        const expected = !selectors ? [] : selectors === 'pii:global' ? ACTIVATION_FAMILIES.filter(f => f.startsWith('pii:global:')) : selectors === 'pii:us' || selectors === 'pii:global,pii:us' ? ACTIVATION_FAMILIES : [selectors.replace('pii:family:', 'pii:')];
        if (!same(expected, match[2] ? families : [])) return true;
      }
      const familiesOf = key => bySelectors.get(key).activationIdentity.split(';families=')[1].split(';')[0].split(',');
      const union = [...new Set([...familiesOf('pii:global'), ...familiesOf('pii:us')])].sort();
      if (!same(union, familiesOf('pii:global,pii:us').sort())) return true;
    }
    if (!same(surfaces[0].checks.map(c => c.activationIdentity), surfaces[1].checks.map(c => c.activationIdentity))) return true;
  }
  return false;
}
const fail = reason => ({ state: 'invalid', reason, publicOnly: true, supportClaims: false, qualified: false });
function pairedCells(a, b) {
  const flatten = rows => rows.flatMap(row => [
    ...row.metrics.map(metric => ({ key: `${row.family}/family/${metric.metric.id}`, family: row.family, stratum: 'family', populationCounts: row.counts, metric })),
    ...['byLanguage', 'byControlClass'].flatMap(axis => (row[axis] ?? []).flatMap(stratum => stratum.metrics.map(metric => ({ key: `${row.family}/${axis}/${stratum.language ?? stratum.controlClass}/${metric.metric.id}`, family: row.family, stratum: `${axis}:${stratum.language ?? stratum.controlClass}`, populationCounts: stratum.counts, metric })))),
  ]);
  const left = flatten(a), right = new Map(flatten(b).map(cell => [cell.key, cell]));
  if (left.length !== right.size) throw new Error('comparison-strata-mismatch');
  return left.map(cell => {
    const other = right.get(cell.key);
    if (!other) throw new Error('comparison-strata-mismatch');
    if (!same(cell.populationCounts, other.populationCounts)) throw new Error('comparison-denominator-mismatch');
    return { key: cell.key, family: cell.family, stratum: cell.stratum, metricId: cell.metric.metric.id, baseline: cell.metric, candidate: other.metric,
      delta: cell.metric.value?.state === 'measured' && other.metric.value?.state === 'measured' && cell.metric.status === 'measured' && other.metric.status === 'measured' ? other.metric.value.point.mantissa / 10 ** other.metric.value.point.scale - cell.metric.value.point.mantissa / 10 ** cell.metric.value.point.scale : null };
  });
}
export function loadPiiCandidateComparison({ plan, receipt, artifacts = [], record, allowUnrecordedOfficial = false } = {}) {
  if (!plan || !receipt) return { state: 'absent', reason: 'current-comparison-not-recorded', publicOnly: true, supportClaims: false, qualified: false };
  try {
    if (!validateReceipt(receipt)) return fail('comparison-receipt-malformed');
    if (receipt.mode === 'official' && !receipt.github) return fail('comparison-github-execution-identity-missing');
    if (receipt.mode === 'exploratory' && receipt.github) return fail('comparison-record-mode-mismatch');
    if (receipt.mode === 'official' && plan.dispatch?.authorised === true) plan = { ...plan, mode: 'official' };
    if (activationProblems(receipt.activation)) return fail('comparison-activation-mismatch');
    if (receipt.engine.commit !== plan.engine.commit || receipt.engine.shimSha256 !== plan.engine.shimSha256 || (receipt.mode === 'official' ? !receipt.engine.canonical || receipt.engine.platform !== 'linux-x64' || receipt.engine.binarySha256 !== plan.engine.binarySha256 || plan.dispatch?.authorised !== true || !plan.dispatch?.costDecision : receipt.engine.canonical || receipt.engine.platform !== 'darwin-arm64' || receipt.engine.binarySha256 !== plan.execution.localDarwinBinarySha256)) return fail('comparison-execution-mismatch');
    if (receipt.candidate.tarballs.core !== plan.candidate.coreTarballSha256 || receipt.candidate.tarballs.wasm !== plan.candidate.piiWasmTarballSha256 || receipt.candidate.tarballs.node !== (receipt.engine.canonical ? plan.candidate.nativeLinuxTarballSha256 : plan.candidate.localNativeDarwinTarballSha256)) return fail('comparison-product-mismatch');
    for (const [key, name] of Object.entries({core:'@redact-secret/core', wasm:'@redact-secret/wasm', node: receipt.engine.platform === 'linux-x64' ? '@redact-secret/node-linux-x64-gnu' : '@redact-secret/node-darwin-arm64'})) if (receipt.baseline.tarballIntegrity[key] !== plan.baseline.packages[name]?.integrity) return fail('comparison-baseline-integrity-mismatch');
    if (plan.schema !== 'pii-candidate-comparison-plan/1' || receipt.schema !== 'pii-candidate-comparison-receipt/1' || plan.supportClaims !== false || plan.publicOnly !== true || receipt.supportClaims !== false || receipt.authorityChanged !== false || receipt.ownerAcceptance !== null) return fail('comparison-contract-mismatch');
    if (receipt.planDigest !== comparisonDigest(plan) || receipt.mode !== plan.mode || !['exploratory', 'official'].includes(plan.mode)) return fail('comparison-plan-mismatch');
    if (!Array.isArray(plan.populations) || plan.populations.length !== 4 || new Set(plan.populations.map(p => p.view)).size !== 4 || artifacts.length !== 8) return fail('comparison-population-incomplete');
    const reports = {};
    for (const side of SIDES) {
      const identity = receipt[side];
      if (!identity || identity.sourceCommit !== plan[side].sourceCommit || identity.version !== plan[side].version || !/^[a-f0-9]{64}$/.test(identity.packageTreeSha256) || !/^[a-f0-9]{64}$/.test(identity.addonTreeSha256) || !/^[a-f0-9]{64}$/.test(identity.wasmTreeSha256)) return fail('comparison-product-mismatch');
      const pins = loadPins(JSON.stringify(receipt.pins?.[side]));
      if (pins.artifactSchema.version !== plan.protocol.artifactSchema || pins.engine.name !== 'pii-eval' || pins.engine.version !== '0.0.0' || pins.protocol.id !== plan.protocol.id || pins.protocol.version !== plan.protocol.revision || pins.build.commit !== plan.engine.commit || pins.build.cargoLockSha256 !== plan.engine.cargoLockSha256 || pins.build.sourceArchiveSha256 !== plan.engine.sourceArchiveSha256 || pins.build.binarySha256 !== receipt.engine.binarySha256 || pins.populations.length !== 4) return fail('comparison-engine-mismatch');
      const inputs = artifacts.filter(a => a.side === side);
      if (inputs.length !== 4 || new Set(inputs.map(a => a.view)).size !== 4) return fail('comparison-population-incomplete');
      for (const pin of pins.populations) {
        const p = plan.populations.find(p => p.view === pin.label), s = pin.scanners?.[0];
        if (!p || pin.population.populationDigest !== p.snapshotDigest || pin.population.populationId !== p.populationId || pin.projection.rosterDigest !== p.rosterDigest || pin.projection.mode !== plan.mode || pin.scanners.length !== 1 || !same(pin.projection.requiredViews, [p.view]) || s.artifactDigest !== identity.packageTreeSha256 || !same(s.product, { kind: 'candidate', candidateDigest: identity.packageTreeSha256 }) || s.candidateSourceCommit !== identity.sourceCommit || s.scannerVersion !== identity.version || s.configurationDigest !== plan.scanner.configurationDigest || s.activationDigest !== plan.scanner.activationDigest || !same(s.adapter, { adapterId: plan.scanner.adapter.id, adapterVersion: plan.scanner.adapter.version, normalizationVersion: plan.scanner.adapter.normalizationVersion })) return fail('comparison-pin-mismatch');
        const input = inputs.find(a => a.view === p.view), doc = parseStrictJson(input?.text);
        if (doc.semantic?.populationCounts?.authoredCases !== p.memberships) return fail('comparison-membership-mismatch');
      }
      const report = consume(pins, inputs.map(a => ({ name: `${side}.${a.view}.json`, text: a.text })));
      if (!report.complete) return fail('comparison-artifact-rejected');
      reports[side] = report;
    }
    if (receipt.baseline.nativePackageProvenance !== 'published-npm-lockfile' || receipt.candidate.nativePackageProvenance !== (receipt.engine.canonical ? 'qualified-inventory-whole-package' : 'local-repacked-qualified-payloads')) return fail('comparison-package-provenance-mismatch');
    if (receipt.baseline.packageTreeSha256 === receipt.candidate.packageTreeSha256) return fail('comparison-identities-not-distinct');
    if (receipt.mode === 'official' && !allowUnrecordedOfficial && !comparisonRecordValid({ plan, receipt, artifacts, record })) return fail('comparison-official-provenance-missing-or-mismatched');
    if (receipt.mode === 'exploratory' && record) return fail('comparison-record-mode-mismatch');
    const populations = plan.populations.map(p => {
      const baseline = reports.baseline.populations.find(x => x.label === p.view), candidate = reports.candidate.populations.find(x => x.label === p.view);
      if (!same(baseline.populationCounts, candidate.populationCounts)) throw new Error('comparison-denominator-mismatch');
      return { view: p.view, memberships: p.memberships, population: baseline.population, baseline, candidate, metrics: pairedCells(baseline.productProjection.rows, candidate.productProjection.rows) };
    });
    return { state: 'recorded', publicOnly: true, supportClaims: false, qualified: false, mode: receipt.mode, engine: receipt.engine,
      baseline: { ...receipt.baseline, provenance: plan.baseline.provenance }, candidate: { ...receipt.candidate, provenance: plan.candidate.provenance },
      activation: receipt.activation, artifactBinding: { core: 'engine-semantic-tree-identity', nativeAndWasm: 'receipt-producer-verified-extra-artifacts; not present in the public semantic artifact' }, validator: { state: 'not-measured', reason: 'product-validator-primitive-seam-unavailable' }, populations };
  } catch (error) { return fail(error.message === 'comparison-denominator-mismatch' || error.message === 'comparison-strata-mismatch' ? error.message : 'comparison-document-invalid'); }
}

export function comparisonRecordValid({plan, receipt, artifacts, record}) {
  const closed = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && same(Object.keys(value).sort(), keys.sort());
  if (!closed(record, ['schema','supportClaims','authorityChanged','ownerAcceptance','planDigest','workflow','actionsArtifact','receipt','artifacts']) || !closed(record.workflow,['repository','path','reusablePath','runId','runAttempt','event','headSha','headBranch','conclusion']) || !closed(record.actionsArtifact,['id','name','digest','archiveSha256','sizeInBytes']) || !closed(record.receipt,['sha256','documentDigest'])) return false;
  const hex = /^[a-f0-9]{64}$/, sha = /^[a-f0-9]{40}$/;
  if (!record || record.schema !== 'pii-candidate-comparison-record/1' || record.supportClaims !== false || record.authorityChanged !== false || record.ownerAcceptance !== null || record.planDigest !== comparisonDigest(plan) || record.receipt?.documentDigest !== documentDigest(receipt)) return false;
  const w = record.workflow, a = record.actionsArtifact, g = receipt.github;
  if (!g || g.repository !== w?.repository || g.runId !== w?.runId || g.runAttempt !== w?.runAttempt || g.headSha !== w?.headSha || g.workflowRef !== `${w.repository}/${w.path}@refs/heads/${w.headBranch}`) return false;
  if (!w || w.repository !== 'redact-secret/redact-secret-benchmarks' || w.path !== '.github/workflows/pii-official-run.yml' || w.reusablePath !== '.github/workflows/pii-candidate-comparison.yml' || w.event !== 'workflow_dispatch' || w.conclusion !== 'success' || w.runAttempt !== 1 || !Number.isSafeInteger(w.runId) || w.runId <= 0 || !sha.test(w.headSha) || !w.headBranch) return false;
  if (!a || !Number.isSafeInteger(a.id) || a.id <= 0 || a.name !== 'pii-candidate-comparison' || !/^sha256:[a-f0-9]{64}$/.test(a.digest) || a.archiveSha256 !== a.digest.slice(7) || !Number.isSafeInteger(a.sizeInBytes) || a.sizeInBytes <= 0) return false;
  if (!hex.test(record.receipt.sha256) || !Array.isArray(record.artifacts) || record.artifacts.some(a=>!closed(a,['side','view','sha256'])) || record.artifacts.length !== 8 || new Set(record.artifacts.map(a=>`${a.side}/${a.view}`)).size !== 8) return false;
  return artifacts.length === 8 && artifacts.every(input => { const got = record.artifacts.find(a=>a.side === input.side && a.view === input.view); return got && hex.test(got.sha256) && createHash('sha256').update(input.text).digest('hex') === got.sha256; });
}
