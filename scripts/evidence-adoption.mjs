/**
 * Pure rules of the evidence adoption workflow (#690): verify a published evidence release, check that the pinned engine can read
 * its corpus snapshot, key a retry, diff two snapshots by semantic case id, and prepare the historical-receipt repin.
 * It reads no file and calls no network; `scripts/adopt-evidence-snapshot.mjs` is the entry point that hands it bytes.
 * It asserts nothing about a product and never writes the authority file or an owner acceptance. Spec: docs/specs/evidence-adoption.md.
 */
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';

export const DIGEST = /^sha256:[0-9a-f]{64}$/;
export const SNAPSHOT_ASSET = 'credential-eval-corpus-snapshot.json';
export const sha256Hex = bytes => createHash('sha256').update(bytes).digest('hex');
export const sha256Digest = bytes => `sha256:${sha256Hex(bytes)}`;

const stable = value => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
};

/** Identity of the release against what the maintainer asked for: tag, manifest digest, and the snapshot asset the manifest lists. Problems are identity failures, never engine incompatibility. */
export function releaseIdentityProblems({ tag, expectedManifestDigest, manifestBytes, manifest, snapshotBytes, snapshot }) {
  const problems = [];
  if (!DIGEST.test(expectedManifestDigest ?? '')) problems.push('the expected manifest digest must be sha256:<64 hex>');
  else if (sha256Digest(manifestBytes) !== expectedManifestDigest) problems.push(`release manifest digest is ${sha256Digest(manifestBytes)}, expected ${expectedManifestDigest}`);
  if (manifest.format !== 'credential-evidence/release-manifest') problems.push(`manifest format is ${manifest.format}`);
  if (manifest.tag !== tag) problems.push(`manifest names tag ${manifest.tag}, not ${tag}`);
  const entry = (manifest.files ?? []).find(f => f.asset === SNAPSHOT_ASSET);
  if (!entry) problems.push(`the manifest lists no ${SNAPSHOT_ASSET} asset`);
  else {
    if (entry.sha256 !== sha256Hex(snapshotBytes)) problems.push(`${SNAPSHOT_ASSET} bytes differ from the manifest sha256`);
    if (entry.bytes !== snapshotBytes.length) problems.push(`${SNAPSHOT_ASSET} has ${snapshotBytes.length} bytes, the manifest lists ${entry.bytes}`);
  }
  const identity = snapshot.identity ?? {};
  if (snapshot.schema !== 'credential-eval/corpus-snapshot/v1') problems.push(`snapshot schema is ${snapshot.schema}`);
  if (identity.source !== 'credential-evidence') problems.push(`snapshot source is ${identity.source}`);
  if (identity.revision !== `records-tree-sha256:${manifest.sourceRevision?.recordsTree?.digest}`) problems.push('snapshot revision differs from the manifest records tree');
  if (identity.evidence_schema !== `credential-evidence/schema/${manifest.schemaRevision}`) problems.push('snapshot evidence schema differs from the manifest schema revision');
  if (!DIGEST.test(identity.corpus_digest ?? '')) problems.push('snapshot identity has no corpus_digest');
  // A release may declare cases its eval export leaves out (evalExport.notExported, e.g. invalid UTF-8): the snapshot then holds
  // `exported`, and materialized = exported + notExported.total must equal the manifest's fixture count.
  const exp = manifest.evalExport;
  let expectedCases = manifest.fixtures?.count;
  if (exp) {
    expectedCases = exp.exported;
    if (exp.materialized !== manifest.fixtures?.count) problems.push(`evalExport materialized ${exp.materialized}, the manifest counts ${manifest.fixtures?.count}`);
    if (exp.exported + (exp.notExported?.total ?? 0) !== exp.materialized) problems.push(`evalExport exported ${exp.exported} + not exported ${exp.notExported?.total ?? 0} is not ${exp.materialized}`);
  }
  if (!Array.isArray(snapshot.cases) || snapshot.cases.length !== expectedCases) problems.push(`snapshot has ${snapshot.cases?.length} cases, the manifest counts ${expectedCases}`);
  else if (new Set(snapshot.cases.map(c => c.id)).size !== snapshot.cases.length) problems.push('snapshot case ids are not unique');
  return problems;
}

/**
 * Can the pinned engine read this snapshot? The engine's own closed corpus-snapshot schema is the contract (the engine refuses a
 * snapshot that does not satisfy it), so every case is validated against it. Cases are named by id, never printed.
 * Result: { compatible, cases, incompatibleCases, groups: [{ rule, count, caseIds }] }.
 */
export function snapshotCompatibility(snapshot, schema) {
  const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
  const validate = ajv.compile(schema);
  const cases = Array.isArray(snapshot.cases) ? snapshot.cases : [];
  const groups = new Map();
  const bad = new Set();
  const note = (rule, id) => {
    const g = groups.get(rule) ?? { rule, count: 0, caseIds: [] };
    g.count++;
    if (g.caseIds.length < 25) g.caseIds.push(id);
    groups.set(rule, g);
  };
  if (!validate({ ...snapshot, cases: [] })) for (const e of validate.errors ?? []) note(`snapshot${e.instancePath} ${e.message}`, '(document)');
  // Validate the cases one at a time against the schema's Case definition: the same rule, attributed to a semantic id.
  const caseSchema = { $schema: schema.$schema, $defs: schema.$defs, $ref: '#/$defs/Case' };
  const validateCase = new Ajv2020({ strict: false, allErrors: true, validateFormats: false }).compile(caseSchema);
  for (const c of cases) {
    if (validateCase(c)) continue;
    bad.add(c?.id);
    const seen = new Set();
    for (const e of validateCase.errors ?? []) {
      if (e.keyword === 'oneOf' || e.keyword === 'anyOf') continue;
      const rule = `case${e.instancePath.replace(/\/\d+/g, '/*')} ${e.keyword === 'required' ? `is missing required field '${e.params.missingProperty}'` : e.message}`;
      if (seen.has(rule)) continue;
      seen.add(rule);
      note(rule, c?.id);
    }
  }
  return { compatible: bad.size === 0 && groups.size === 0, cases: cases.length, incompatibleCases: bad.size, groups: [...groups.values()].sort((a, b) => b.count - a.count || a.rule.localeCompare(b.rule)) };
}

/** Human-readable incompatibility report. Names rules and counts, never case content. */
export function incompatibilityMessage(compat, engine) {
  const lines = [`The pinned engine ${engine.tag} (${engine.protocol}) cannot read this snapshot: ${compat.incompatibleCases} of ${compat.cases} cases violate its corpus-snapshot v1 contract.`];
  for (const g of compat.groups) lines.push(`  - ${g.count} case(s): ${g.rule} (e.g. ${g.caseIds.slice(0, 3).join(', ')})`);
  lines.push('No pin was changed and no pull request was opened. The snapshot cannot be altered here (its bytes are verified against the manifest); the fix is a credential-evidence release the engine can read or an engine change. Owner decision.');
  return lines.join('\n');
}

/** The retry key: one adoption per snapshot digest + manifest digest + engine, configuration and scanner pins. */
export function adoptionKey({ tag, manifestDigest, snapshotDigest, registry }) {
  const pins = {
    tag, manifestDigest, snapshotDigest,
    engine: { tag: registry.engine.tag, revision: registry.engine.revision, protocol: registry.engine.protocol, runArtifactSchema: registry.engine.runArtifactSchema.sha256 },
    config: Object.fromEntries(Object.entries(registry.config.platforms).map(([p, v]) => [p, v.file])),
    scanners: registry.scanners.map(s => ({ id: s.id, version: s.version, pin: s.executableSha256 ?? s.integrity ?? null })),
  };
  return sha256Hex(stable(pins));
}
export const adoptionBranch = (tag, key) => `adopt-evidence/${tag}-${key.slice(0, 12)}`;

const sig = c => ({ content: sha256Hex(Buffer.from(c.content ?? '\0missing')), expected: stable(c.expected ?? null), grouping: stable(c.grouping ?? null), twin: stable(c.twin ?? null), path: c.path });
const bump = (map, key, n = 1) => map.set(key, (map.get(key) ?? 0) + n);
const obj = map => Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
const provider = c => String(c.grouping?.family ?? '').split(':')[0] || '(none)';

/** Change report between two corpus snapshots, keyed by stable semantic case id. */
export function diffSnapshots(oldSnapshot, newSnapshot) {
  const before = new Map(oldSnapshot.cases.map(c => [c.id, c]));
  const after = new Map(newSnapshot.cases.map(c => [c.id, c]));
  const added = [], removed = [], changed = [];
  const addedKinds = new Map(), addedEvidence = new Map(), addedGroups = new Map(), transitions = new Map(), changedFields = new Map();
  for (const [id, c] of after) {
    const old = before.get(id);
    if (!old) { added.push(id); bump(addedKinds, c.grouping?.kind ?? '(none)'); bump(addedEvidence, c.grouping?.evidence_class ?? '(none)'); bump(addedGroups, c.grouping?.group ?? '(none)'); continue; }
    const a = sig(old), b = sig(c);
    const fields = Object.keys(a).filter(k => a[k] !== b[k]);
    if (!fields.length) continue;
    changed.push({ id, fields, kind: [old.grouping?.kind, c.grouping?.kind], evidenceClass: [old.grouping?.evidence_class ?? null, c.grouping?.evidence_class ?? null], expectedSpans: [(old.expected ?? []).length, (c.expected ?? []).length] });
    for (const f of fields) bump(changedFields, f);
    if (old.grouping?.evidence_class !== c.grouping?.evidence_class) bump(transitions, `${old.grouping?.evidence_class ?? '(none)'} -> ${c.grouping?.evidence_class ?? '(none)'}`);
  }
  for (const id of before.keys()) if (!after.has(id)) removed.push(id);
  const oldProviders = new Set(oldSnapshot.cases.map(provider));
  const newProviders = new Set(newSnapshot.cases.map(provider));
  const addedFamilies = new Set(added.map(id => after.get(id).grouping?.family).filter(Boolean));
  const oldFamilies = new Set(oldSnapshot.cases.map(c => c.grouping?.family).filter(Boolean));
  const sorted = a => [...a].sort();
  return {
    cases: { old: before.size, new: after.size, added: added.length, removed: removed.length, changed: changed.length, unchanged: after.size - added.length - changed.length },
    added: sorted(added), removed: sorted(removed), changed: changed.sort((x, y) => x.id.localeCompare(y.id)),
    addedByKind: obj(addedKinds), addedByEvidenceClass: obj(addedEvidence), addedByGroup: obj(addedGroups),
    changedFields: obj(changedFields), evidenceClassTransitions: obj(transitions),
    diversity: {
      providers: { old: oldProviders.size, new: newProviders.size, added: sorted([...newProviders].filter(p => !oldProviders.has(p))), removed: sorted([...oldProviders].filter(p => !newProviders.has(p))) },
      families: { old: oldFamilies.size, new: new Set(newSnapshot.cases.map(c => c.grouping?.family).filter(Boolean)).size, addedFamilies: sorted([...addedFamilies].filter(f => !oldFamilies.has(f))) },
    },
  };
}

/**
 * What the release says about representation (credential-eval representation contract 1; credential-evidence#150): the facts' own digest and counts from the
 * manifest, and what the cases carry, by transformation operation, codec, fragment mechanism, input validity and decoded-span codec. Counts only, no case content;
 * a snapshot without facts yields `{ present: false }`. These are the release's facts, not a measurement: whether the engine scores them is the replay's finding.
 */
export function representationSummary(snapshot, manifest) {
  const contract = snapshot.identity?.representation;
  if (!contract) return { present: false };
  const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
  const ops = new Map(), codecs = new Map(), mechanisms = new Map(), validity = new Map(), decoded = new Map(), derivation = new Map();
  let withFacts = 0, fragmentedSpans = 0, decodedSpans = 0;
  for (const c of snapshot.cases) {
    const r = c.representation;
    if (r) {
      withFacts++;
      if (r.input_validity) bump(validity, typeof r.input_validity === 'string' ? r.input_validity : JSON.stringify(r.input_validity));
      if (r.derivation?.kind) bump(derivation, r.derivation.kind);
      const seen = new Set();
      for (const step of r.transformation?.steps ?? []) {
        seen.add(step.op);
        if (step.codec) seen.add(`${step.op}:${step.codec}`);
        if (step.op === 'fragment') bump(mechanisms, step.mechanism);
      }
      for (const k of seen) bump(k.includes(':') ? codecs : ops, k);
    }
    for (const e of c.expected ?? []) {
      if (e.fragments?.length) fragmentedSpans++;
      if (e.decoded) { decodedSpans++; for (const via of Array.isArray(e.decoded.via) ? e.decoded.via : [e.decoded.via]) bump(decoded, via?.codec ?? JSON.stringify(via)); }
    }
  }
  const obj = m => Object.fromEntries([...m].sort(([a], [b]) => (a < b ? -1 : 1)));
  return {
    present: true, contract, factsDigest: manifest.evalExport?.representation?.facts_digest ?? null, manifestCounts: manifest.evalExport?.representation ?? null,
    casesWithFacts: withFacts, derivation: obj(derivation), inputValidity: obj(validity), casesByTransformationOp: obj(ops), casesByEncodeCodec: obj(codecs), fragmentMechanisms: obj(mechanisms),
    expectedSpansWithFragments: fragmentedSpans, expectedSpansWithDecoded: decodedSpans, decodedByCodec: obj(decoded),
    notExported: { materialized: manifest.evalExport?.materialized ?? null, exported: manifest.evalExport?.exported ?? null, invalidUtf8: manifest.evalExport?.notExported ?? null, twinLineageNotExported: manifest.evalExport?.twinLineageNotExported?.total ?? null },
  };
}

/**
 * The release's review state (credential-evidence ADR 0020, solo-maintainer period): `maintainer-only` means finalized by the sole maintainer, never reviewed and never
 * independent validation. The eval snapshot carries none of it; the manifest counts it and the records carry it per Case and Scenario (`lifecycle`). Fixtures of a
 * maintainer-only Case or Scenario are named by id here; a release count this derivation does not reach is reported as unattributed, never guessed.
 */
export function reviewStateSummary(manifest, bundle, materialized) {
  const state = manifest.reviewState ?? null;
  if (!state) return { present: false };
  const lifecycle = { case: new Set(), scenario: new Set() };
  for (const r of bundle?.records ?? []) {
    if (!r.path?.startsWith('records/') || !r.text) continue;
    let j; try { j = JSON.parse(r.text); } catch { continue; }
    if (j.lifecycle === 'maintainer-only' && lifecycle[j.kind]) lifecycle[j.kind].add(j.id);
  }
  const ids = [], byOutcome = {};
  for (const f of materialized?.fixtures ?? []) {
    const owner = f.target?.type === 'scenario' ? lifecycle.scenario.has(f.target.id) : lifecycle.case.has(f.case ?? f.target?.id);
    if (!owner) continue;
    ids.push(f.id); byOutcome[f.expected?.outcome ?? '(none)'] = (byOutcome[f.expected?.outcome ?? '(none)'] ?? 0) + 1;
  }
  const declared = state.maintainerOnly?.fixtures ?? null;
  return { present: true, contract: state.contract, rule: state.rule, note: state.note, fixtures: state.fixtures, maintainerOnly: state.maintainerOnly, attributedFixtures: ids.length, attributedByOutcome: byOutcome, unattributedFixtures: declared === null ? null : declared - ids.length, maintainerOnlyFixtureIds: ids.sort() };
}

/** Per-case outcome signature in a RunArtifact scanner result: unmeasured and pending are their own values, never a zero detection. */
export function outcomeSignature(result) {
  const m = result.measurement ?? {};
  if (m.type === 'positive') return `positive:${(m.span_outcomes ?? []).join(',')}`;
  if (m.type === 'control') return `control:${m.flagged ? 'flagged' : 'clear'}`;
  return m.type ?? 'unknown';
}

/** Outcome drift between two official RunArtifacts (replays), by case id and scanner. Common-case drift is separated from added-case outcomes. */
export function diffRunArtifacts(oldArtifact, newArtifact, { addedIds = [] } = {}) {
  const added = new Set(addedIds);
  const out = {};
  for (const scanner of newArtifact.scanners) {
    const prior = oldArtifact.scanners.find(s => s.scanner === scanner.scanner);
    const priorBy = new Map((prior?.cases ?? []).map(c => [c.case_id, outcomeSignature(c)]));
    const drift = new Map(), addedOutcomes = new Map(), unmeasured = [];
    let common = 0, same = 0;
    for (const c of scanner.cases) {
      const now = outcomeSignature(c);
      if (now === 'not-measured') unmeasured.push(c.case_id);
      if (added.has(c.case_id) || !priorBy.has(c.case_id)) { bump(addedOutcomes, now); continue; }
      common++;
      const was = priorBy.get(c.case_id);
      if (was === now) same++; else bump(drift, `${was} -> ${now}`);
    }
    out[scanner.scanner] = { status: scanner.status, previousStatus: prior?.status ?? null, commonCases: common, commonUnchanged: same, commonDrift: obj(drift), addedCaseOutcomes: obj(addedOutcomes), unmeasured: unmeasured.length };
  }
  return out;
}

/** Candidate record written by `prepare`. Owner acceptance is always null: only an owner-authored change may set it. */
export function candidateRecord({ tag, manifest, manifestDigest, snapshotIdentity, key, compat, diff, registry, previous, engine = registry.engine, supersededCandidate = null }) {
  const engineChanged = engine.tag !== registry.engine.tag;
  return {
    schema: 'redact-secret/evidence-adoption/v1',
    state: 'candidate',
    candidate: {
      evidenceRelease: tag,
      sourceRevision: manifest.sourceRevision.commit,
      manifestDigest,
      snapshotDigest: snapshotIdentity.corpus_digest,
      evidenceSchema: snapshotIdentity.evidence_schema,
      evidenceRevision: snapshotIdentity.revision,
      adoptionKey: `sha256:${key}`,
      engine: { tag: engine.tag, revision: engine.revision },
      engineCompatibility: { compatible: compat.compatible, cases: compat.cases },
      supersedes: previous,
      ...(supersededCandidate ? { supersedesCandidate: supersededCandidate } : {}),
      ...(engineChanged ? { engineChange: { from: { tag: registry.engine.tag, revision: registry.engine.revision }, to: { tag: engine.tag, revision: engine.revision }, runArtifactSchemaSha256: engine.runArtifactSchema.sha256, note: 'Applied only at acceptance, by candidate.acceptance.patch; the active registry stays on the previous engine and the old accepted runs until the owner accepts.' } } : {}),
      changeSummary: diff.cases,
      changeReport: `docs/generated/evidence-adoption/${tag}.json`,
      replay: { state: 'pending', via: '.github/workflows/official-runs.yml after the acceptance repin', recordedRuns: [] },
      ownerAcceptance: null,
      deployment: { staging: null, production: null },
    },
  };
}

/**
 * The engine candidate (#697): the evidence release is already the accepted pin, and what changes is the engine and the product build the
 * replay scans (credential-eval alpha.4 measuring @redact-secret/core beta.12 became alpha.5 measuring beta.13). It is recorded next to the
 * accepted adoption as `engineCandidate`, never in place of it: the accepted record, the active registry and the authority file stay as they are
 * until the owner accepts. The corpus is the identical bytes, so a later difference is an engine, configuration or product effect, and the replay
 * separates those with an attribution run (the previous product build on the new engine).
 */
export function engineCandidateRecord({ pinned, manifestDigest, key, compat, registry, engine, product, previousProduct, supersededCandidate = null }) {
  return {
    kind: 'engine-product',
    evidenceRelease: pinned.evidenceRelease,
    manifestDigest,
    snapshotDigest: pinned.snapshotDigest,
    sourceRevision: pinned.sourceRevision,
    adoptionKey: `sha256:${key}`,
    engine: { tag: engine.tag, revision: engine.revision },
    engineChange: { from: { tag: registry.engine.tag, revision: registry.engine.revision }, to: { tag: engine.tag, revision: engine.revision }, runArtifactSchemaSha256: engine.runArtifactSchema.sha256 },
    product: { package: product.package, version: product.version, integrity: product.integrity },
    productChange: { from: { version: previousProduct.version, integrity: previousProduct.integrity }, to: { version: product.version, integrity: product.integrity } },
    engineCompatibility: { compatible: compat.compatible, cases: compat.cases },
    ...(supersededCandidate ? { supersedesCandidate: supersededCandidate } : {}),
    changeReport: `docs/generated/evidence-adoption/${pinned.evidenceRelease}.engine-${engine.tag.replace(/^v0\.1\.0-/, '')}.json`,
    replay: { state: 'pending', via: '.github/workflows/official-runs.yml on a transient replay branch (engine and product pins only), plus an attribution run of the previous product build', recordedRuns: [] },
    note: 'The evidence bytes are identical to the accepted adoption. The active registry, vendored schemas, runs and authority stay on the accepted engine and product until the owner accepts this candidate; nothing here is an owner acceptance.',
    ownerAcceptance: null,
    deployment: { staging: null, production: null },
  };
}

/**
 * The acceptance repin: move the floors population's pin to the candidate and keep every previous accepted run of that population
 * as a historical receipt (never relabelled as evidence of the new pin). Returns new copies; the authority file is not an input
 * or an output. The authority check stays red on that branch until the owner renews the authorisation, by design.
 */
export function repinPopulation({ registry, inputs, population = 'public-evidence-snapshot', candidate, supersededOn }) {
  const next = JSON.parse(JSON.stringify(registry));
  const nextInputs = JSON.parse(JSON.stringify(inputs));
  const isOfPopulation = r => r.population === population;
  const moved = next.runs.filter(isOfPopulation);
  next.runs = next.runs.filter(r => !isOfPopulation(r));
  next.historicalRuns = [...(next.historicalRuns ?? []), ...moved.map(r => ({
    ...r, status: 'historical', supersededBy: { evidenceRelease: candidate.evidenceRelease, manifestDigest: candidate.manifestDigest }, supersededOn,
  }))];
  const p = next.populations.find(x => x.id === population);
  p.evidence = { ...p.evidence, revision: candidate.evidenceRevision, evidenceSchema: candidate.evidenceSchema, corpusDigest: candidate.snapshotDigest, release: { tag: candidate.evidenceRelease, manifestDigest: candidate.manifestDigest } };
  const pin = nextInputs.populations.find(x => x.id === population).pin;
  Object.assign(pin, { evidenceRelease: candidate.evidenceRelease, sourceRevision: candidate.sourceRevision, manifestDigest: candidate.manifestDigest, snapshotDigest: candidate.snapshotDigest });
  return { registry: next, inputs: nextInputs, movedRunIds: moved.map(r => r.id) };
}
