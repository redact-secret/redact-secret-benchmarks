// Deterministic conversion of the benchmark-owned `b11-population-v2` plan set and its frozen Beta.13 observation
// into pii-eval inputs, one identity per population (#664). Nothing here measures anything: it restates authored
// truth (the plans) and a frozen observation (the Beta.13 candidate run) in the two input shapes the dual run needs.
//
//   - a pii-eval corpus snapshot, run manifest, observation set and schema 1.2 projection roster per population;
//   - the oracle's input (`pii-eval-parity-input/1`) over exactly the same cases and the same frozen findings.
//
// Mapping rules (the conversion never edits a case, a denominator or a threshold):
//   1. A population is one benchmark view (`oracle-plan`, `qualification-plan`, `diagnostic-balanced`,
//      `benign-heavy-stress`). Populations are never pooled; each has its own snapshot digest.
//   2. A case is representable when the plan authors an identity (`valid` or `invalid`) and a target range. Both engine
//      contracts (the oracle's `typeExpectation.state` and pii-eval's `ExpectedType`) are closed over valid/invalid, so a
//      case whose identity is `not-established` cannot be stated in either. Those cases are listed, counted and left to the
//      benchmark's own scorer; they are never given an invented identity.
//   3. Every representable case becomes one `schema-only` case with its single authored variant. The plans carry no
//      frames, benign classes, collision targets or reference evidence, so no other method is invented: the three
//      method-restricted metrics are not applicable on these populations and the report says so.
//   4. The frozen findings are the Beta.13 candidate's `node-addon`/`union` lane (selectors `pii:global`, `pii:us`). The
//      adapter policy of pii-eval (every PII finding is a sensitive classification with its family and jurisdiction) is
//      applied. A finding equal to a declared line-sensitive span is not an observation of the case target (the benchmark's
//      own rule in `b11CaseOutcome`). Findings of another PII family are carried only where the observation locates them at
//      the target (`otherPiiAtTarget`); an unlocated one cannot be placed and is counted in the census.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { B11_FAMILIES, b11CaseTables } from '../../benchmarks/evaluation/domains/pii/beta11-qualification.ts';
import { canonicalize, semanticDigest } from '../../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PLAN_SET = 'b11-population-v2';
export const VIEWS = ['oracle-plan', 'qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress'];
export const SCANNER_ID = 'redact-secret-core';
export const PARITY_INPUT_SCHEMA = 'pii-eval-parity-input/1';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const SHORT = {
  'pii:global:network-address': 'network', 'pii:global:email': 'email', 'pii:global:payment-card': 'card',
  'pii:global:iban': 'iban', 'pii:us:ssn': 'ssn', 'pii:global:phone': 'phone',
};
const DOMAIN = {
  'pii:global:network-address': 'network-address', 'pii:global:email': 'email', 'pii:global:payment-card': 'payment-card',
  'pii:global:iban': 'iban', 'pii:us:ssn': 'national-id', 'pii:global:phone': 'phone',
};
const slug = /^[a-z][a-z0-9-]{1,79}$/;
const sensitivityClass = { sensitive: 'sensitive', 'non-sensitive': 'non-sensitive', 'not-established': 'neutral' };
const sortedBy = (list, key) => [...list].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
const bytes = value => Buffer.byteLength(value, 'utf8');

export function readMigration(root = ROOT) {
  return JSON.parse(readFileSync(join(root, 'benchmarks/pii-eval-migration.json'), 'utf8'));
}

/** Read a pinned benchmark file and refuse drift from the migration record. */
function pinned(root, item) {
  const body = readFileSync(join(root, item.path));
  if (sha256(body) !== item.sha256) throw new Error(`pinned file drifted: ${item.path}`);
  return body;
}

const UNION = 'credentials=full;selectors=pii:global,pii:us;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card,pii:global:phone,pii:us:ssn;vocabulary=pii-context/v2';

/** The frozen findings of one family on the primary lane, keyed by case id. */
function laneFor(observation, family) {
  const row = observation.candidate.families.find(item => item.family === family);
  const lane = row?.lanes.find(item => item.lane === 'node-addon' && item.selection === 'union');
  if (!lane || lane.activationIdentity !== UNION) throw new Error(`no primary union lane for ${family}`);
  return lane;
}

export function buildConversion({ root = ROOT } = {}) {
  const migration = readMigration(root);
  const populations = migration.benchmarkPopulations;
  const observationBody = pinned(root, populations.observation);
  pinned(root, populations.report);
  const observation = JSON.parse(observationBody.toString('utf8'));
  const candidate = populations.candidate;
  if (observation.candidate.sourceCommit !== candidate.sourceCommit || observation.candidate.artifactSetCommitment !== candidate.artifactSetCommitment)
    throw new Error('the frozen observation is not the pinned candidate');
  const planByFamily = new Map(populations.plans.map(item => [item.family, item]));
  for (const item of populations.plans) pinned(root, item);

  const byView = new Map(VIEWS.map(view => [view, { view, cases: [], excluded: [], unlocatedOtherFamily: 0, lineSensitiveDropped: 0 }]));
  const slugs = new Set();
  for (const family of B11_FAMILIES) {
    const { frozen, reviewed } = b11CaseTables(family, PLAN_SET);
    if (JSON.stringify(frozen.map(row => row.id)) !== JSON.stringify(reviewed.map(row => row.id))) throw new Error('v2 tables must not be overlaid');
    const lane = laneFor(observation, family);
    if (JSON.stringify(lane.cases.map(row => row.id)) !== JSON.stringify(reviewed.map(row => row.id))) throw new Error(`lane is not one-to-one with the ${family} table`);
    reviewed.forEach((row, index) => {
      if (row.views.length === 0 || row.views.some(view => !byView.has(view))) throw new Error(`case ${row.id} names an unknown view`);
      const seen = lane.cases[index];
      const id = `${SHORT[family]}-${row.id}`;
      const rangeless = row.identity === 'not-established' && row.candidate === null && row.sensitivity === 'not-established' && !row.lineSensitive.length;
      if (row.identity === 'not-established' && !rangeless && row.candidate === null) throw new Error(`not-established case is not range-less not-established: ${row.id}`);
      if (row.identity === 'not-established' && row.candidate !== null) throw new Error(`unexpected located not-established case: ${row.id}`);
      const representable = (row.identity !== 'not-established' && row.candidate !== null) || rangeless;
      if (representable) {
        if (!slug.test(id) || slugs.has(id)) throw new Error(`case id is not a unique pii-eval id: ${id}`);
        slugs.add(id);
      }
      const start = row.candidate?.start, end = row.candidate?.end;
      let split = null, kept = [];
      if (rangeless) {
        const buffer = Buffer.from(row.input, 'utf8');
        split = { prefix: row.input, value: '', suffix: '' };
        kept = seen.family.slice();
        if (buffer.length === 0) throw new Error(`empty text: ${id}`);
      } else if (representable) {
        const buffer = Buffer.from(row.input, 'utf8');
        if (end > buffer.length || start >= end) throw new Error(`range outside text: ${id}`);
        const prefix = buffer.subarray(0, start).toString('utf8'), value = buffer.subarray(start, end).toString('utf8'), suffix = buffer.subarray(end).toString('utf8');
        if (bytes(prefix) !== start || bytes(value) !== end - start || `${prefix}${value}${suffix}` !== row.input) throw new Error(`range is not on character boundaries: ${id}`);
        split = { prefix, value, suffix };
        kept = seen.family.filter(([s, e]) => !row.lineSensitive.some(span => span.start === s && span.end === e));
        if (seen.otherPii.length > 0 && seen.otherPiiAtTarget) throw new Error(`located other-family finding has no type mapping: ${id}`);
      }
      // A case that sits in several benchmark views is a member of each population; each population is its own artifact.
      for (const view of row.views) {
        const bucket = byView.get(view);
        if (!representable) {
          bucket.excluded.push({ family, caseId: row.id, reason: 'identity-not-established', sensitivity: row.sensitivity, hasTarget: row.target !== null });
          continue;
        }
        bucket.lineSensitiveDropped += seen.family.length - kept.length;
        if (seen.otherPii.length > 0 && !rangeless) bucket.unlocatedOtherFamily += 1;
        bucket.cases.push({
          id, family, benchmarkCaseId: row.id, source: row.source, language: row.language, text: row.input, ...split,
          candidate: rangeless ? null : { start, end }, rangeless, type: row.identity, sensitivity: row.sensitivity, axis: row.axis,
          findings: kept.map(([s, e, action]) => ({ start: s, end: e, family, action })), jurisdiction: family === 'pii:us:ssn' ? 'US' : null,
        });
      }
    });
  }
  const out = VIEWS.map(view => {
    const bucket = byView.get(view);
    bucket.cases = sortedBy(bucket.cases, c => c.id);
    bucket.excluded = sortedBy(bucket.excluded, c => `${c.family}/${c.caseId}`);
    const frozenView = populations.views.find(item => item.id === view);
    if (bucket.cases.length + bucket.excluded.length !== frozenView.cases) throw new Error(`${view}: converted ${bucket.cases.length + bucket.excluded.length} cases, pinned ${frozenView.cases}`);
    return bucket;
  });
  return { migration, candidate, planByFamily, populations: out };
}

// ---------------------------------------------------------------------------------------------------------------
// The oracle's input and the pii-eval documents
// ---------------------------------------------------------------------------------------------------------------
export const populationId = view => `${PLAN_SET}-${view}`;

export function oracleInput(bucket) {
  const recipes = {};
  for (const c of bucket.cases.filter(c => !c.rangeless)) {
    recipes[c.id] = { cycle: [c.findings.map(f => ({
      ds: f.start - c.candidate.start, de: f.end - c.candidate.end, raw: true, family: f.family, jurisdiction: c.jurisdiction, sensitive: true,
    }))] };
  }
  return {
    schema: PARITY_INPUT_SCHEMA,
    note: 'Public synthetic. Derived by scripts/lib/pii-population-conversion.mjs from the pinned b11-population-v2 plans and the frozen Beta.13 observation; never edited to make an engine agree.',
    population: { id: populationId(bucket.view), version: 1, visibility: 'public-synthetic' },
    cases: bucket.cases.filter(c => !c.rangeless).map(c => ({
      id: c.id, method: 'schema-only', family: c.family, scope: c.jurisdiction ? `jurisdiction:${c.jurisdiction}` : 'global', jurisdiction: c.jurisdiction,
      identityDomain: DOMAIN[c.family], language: c.language, type: c.type, sensitivity: c.sensitivity, contextClass: sensitivityClass[c.sensitivity],
      obligation: 'none', prefix: c.prefix, value: c.value, suffix: c.suffix, seed: `b11v2.${sha256(`${c.family}/${c.benchmarkCaseId}`).slice(0, 40)}`,
      accountingClass: null, competing: null, contextGroup: null, operator: null, reference: null, validator: null,
    })),
    scanners: [{ id: SCANNER_ID, status: 'complete', recipe: { cases: recipes } }],
    accountingVectors: [],
    statistics: { grid: { maxDenominator: 0, mechanics: { intervalPrecision: 6, intervalZ: '1.96', minDenominator: 4 } }, single: [] },
  };
}

const lenPrefixed = fields => Buffer.concat(fields.flatMap(f => {
  const b = Buffer.from(f, 'utf8'); const l = Buffer.alloc(4); l.writeUInt32BE(b.length); return [l, b];
}));
export const variantId = (caseId, slot) => `${slot}-${sha256(lenPrefixed(['pii-eval.variant-id/1', caseId, slot])).slice(0, 24)}`;

const seal = (schema, schemaVersion, semantic) => ({ schema, schemaVersion, semantic, semanticDigest: semanticDigest({ schema, schemaVersion, semantic }) });

export function snapshotFor(bucket, ctx) {
  const generation = { generator: 'b11-population-converter', generatorVersion: 1, seedDerivation: 'legacy-case-seed' };
  const cases = bucket.cases.map(c => {
    const plan = ctx.planByFamily.get(c.family);
    return {
      caseId: c.id, language: c.language, lineage: { sourceDigest: plan.sha256, sourceId: `${PLAN_SET}-${SHORT[c.family]}` },
      ...(c.jurisdiction ? { jurisdiction: c.jurisdiction } : {}), method: 'schema-only',
      variants: [{
        derivation: { strategy: 'authored' },
        expectations: [{
          action: c.sensitivity === 'sensitive' ? 'redact' : 'not-specified', contextClass: sensitivityClass[c.sensitivity], contextObligation: 'none', family: c.family,
          occurrenceId: 'occurrence-1', ...(c.rangeless ? {} : { range: { end: c.candidate.end, start: c.candidate.start } }), sensitivity: c.sensitivity, typeExpectation: c.type,
        }],
        text: c.text, textDigest: sha256(c.text), variantId: variantId(c.id, 'authored'),
      }],
    };
  });
  const schemaVersion = bucket.cases.some(c => c.rangeless) ? '1.4' : '1.0';
  return seal('pii-eval.corpus-snapshot', schemaVersion, {
    cases, generation, population: { populationId: populationId(bucket.view), populationVersion: 1, visibility: 'public-synthetic' },
  });
}

export const ENGINE = { name: 'pii-eval', version: '0.0.0' };
const PROTOCOL = {
  accounting: 'pii-v1', id: 'pii-v1', version: 2,
  rules: { accounting: { id: 'pii-v1-canonical-accounting', revision: 2 }, matching: { id: 'pii-v1-canonical', revision: 2 }, statistics: { id: 'pii-v1-wilson-exact', revision: 1 } },
};

export function scannerIdentity(ctx) {
  const { migration, candidate } = ctx;
  return {
    activationDigest: migration.scanner.activationDigest,
    adapter: { adapterId: migration.scanner.adapter.id, adapterVersion: migration.scanner.adapter.version, normalizationVersion: migration.scanner.adapter.normalizationVersion },
    artifactDigest: candidate.artifactSetCommitment,
    configurationDigest: migration.scanner.configurationDigest,
    product: { candidateDigest: candidate.artifactSetCommitment, kind: 'candidate' },
    scannerId: migration.scanner.id,
    scannerVersion: candidate.version,
  };
}

export function manifestFor(snapshot, ctx) {
  const { migration } = ctx;
  const parameters = Object.entries(migration.scanner.configuration).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, value]) => ({ key, value }));
  return seal('pii-eval.run-manifest', '1.1', {
    engine: ENGINE,
    generation: snapshot.semantic.generation,
    limits: { batchVariants: 16, maxMemoryBytes: 17179869184, maxStderrBytes: 1048576, maxStdoutBytes: 16777216, maxTemporaryBytes: 4294967296, pendingTasks: 8, perScannerParallelism: 1, scannerTimeoutMs: 120000, workers: 2 },
    mechanics: { intervalPrecision: migration.engine.mechanics.intervalPrecision, intervalZ: { mantissa: 196, scale: 2 }, minDenominator: migration.engine.mechanics.minDenominator, replays: migration.engine.mechanics.replays },
    methods: sortedBy(migration.engine.methods, m => m.id).map(({ id, version }) => ({ id, version })),
    metrics: sortedBy(migration.engine.metrics, m => m).map(id => ({ id, version: 1 })),
    population: { populationDigest: snapshot.semanticDigest, ...snapshot.semantic.population },
    protocol: PROTOCOL,
    runClass: 'public-synthetic',
    scanners: [{
      configuration: { activation: migration.scanner.activation, parameters },
      identity: scannerIdentity(ctx),
    }],
    scope: { jurisdictions: ['US'], languages: ['en', 'ko'] },
  });
}

const FAMILIES = [...B11_FAMILIES].sort();
export function observationFor(bucket, snapshot, ctx) {
  const jurisdiction = family => (family === 'pii:us:ssn' ? { jurisdiction: 'US' } : {});
  const inputs = sortedBy(bucket.cases.map(c => ({
    findings: sortedBy(c.findings.map(f => ({ action: f.action, family: f.family, ...jurisdiction(f.family), range: { end: f.end, start: f.start }, sensitive: true })),
      f => `${String(f.range.start).padStart(12, '0')}/${String(f.range.end).padStart(12, '0')}`),
    inputDigest: sha256(c.text), variantId: variantId(c.id, 'authored'),
  })), x => x.variantId);
  return seal('pii-eval.observation-set', '1.1', {
    capabilities: {
      action: 'reported-action',
      families: FAMILIES.map(family => ({ family, state: 'supported' })),
      familyClassification: 'supported', jurisdictionReporting: 'supported', jurisdictions: [{ jurisdiction: 'US', state: 'supported' }],
      ranges: 'supported', sensitivityClassification: 'supported',
    },
    engine: ENGINE, inputs, populationDigest: snapshot.semanticDigest, protocol: PROTOCOL,
    replays: { agreed: true, count: ctx.migration.engine.mechanics.replays }, scanner: scannerIdentity(ctx), status: 'complete',
  });
}

export function rosterFor(bucket) {
  const classes = new Map();
  for (const c of bucket.cases) {
    if (c.sensitivity === 'sensitive') continue;
    const label = c.axis.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug.test(label)) throw new Error(`control class is not an id: ${c.axis}`);
    classes.set(label, [...(classes.get(label) ?? []), c.id]);
  }
  return {
    schema: 'pii-eval-projection-roster/1', requiredViews: [bucket.view], views: [{ view: bucket.view, cases: bucket.cases.map(c => c.id) }],
    ...(classes.size ? { controlClasses: [...classes].sort(([a], [b]) => (a < b ? -1 : 1)).map(([klass, list]) => ({ class: klass, cases: list })) } : {}),
  };
}

export const census = bucket => ({
  view: bucket.view, benchmarkCases: bucket.cases.length + bucket.excluded.length, convertedCases: bucket.cases.length, excludedCases: bucket.excluded.length,
  excludedReason: 'identity-not-established', unlocatedOtherFamilyFindings: bucket.unlocatedOtherFamily, lineSensitiveFindingsDropped: bucket.lineSensitiveDropped,
  byFamily: Object.fromEntries(B11_FAMILIES.map(f => [f, { converted: bucket.cases.filter(c => c.family === f).length, excluded: bucket.excluded.filter(c => c.family === f).length }])),
  findings: bucket.cases.reduce((n, c) => n + c.findings.length, 0), casesWithSeveralFindings: bucket.cases.filter(c => c.findings.length > 1).length,
});

export { canonicalize, semanticDigest, sha256 };
