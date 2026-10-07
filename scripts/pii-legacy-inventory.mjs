#!/usr/bin/env node
// The caller inventory of the legacy PII measurement code (#666), in the style of scripts/legacy-callers.mjs: every removal candidate named,
// with its owner after retirement, its callers (split into callers that are themselves candidates and callers that are not, which are the
// ones to repoint first) and the prerequisite for removing it. Read-only for the repository: it removes and changes nothing, and it asserts
// nothing about product output. The candidate list is the upstream ownership map accepted at pii-eval 212d500 (docs/migration/ownership-map.md),
// restricted to this repository.
//
//   node scripts/pii-legacy-inventory.mjs             print the summary
//   node scripts/pii-legacy-inventory.mjs --write     write docs/generated/pii-legacy-inventory.json
//   node scripts/pii-legacy-inventory.mjs --check     fail when the committed inventory differs from the tree (pii:legacy-inventory:check)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callersOf } from './legacy-callers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const INVENTORY_FILE = 'docs/generated/pii-legacy-inventory.json';
const D = 'benchmarks/evaluation/domains/pii';
const list = (dir, names, ext = '') => names.map(n => `${dir}/${n}${ext}`);

/** The groups, each with the rule that governs removal. A path appears in exactly one group. */
export const GROUPS = [
  {
    id: 'generic-engine',
    disposition: 'removal-candidate',
    owner: 'redact-secret/pii-eval (reimplemented in Rust; the TypeScript is the oracle until the exit)',
    prerequisite: 'authority is new for a bounded oracle period, every exit criterion of benchmarks/pii-authority.json is met, a removal PR lists these callers first and repoints each external caller at validated pii-eval artifacts',
    paths: [
      ...list(D, ['accounting', 'assessment', 'benign-collision-classes', 'benign-collision-evidence', 'cases', 'context-evidence', 'context-languages', 'contract-model', 'contract', 'execution', 'identity', 'jurisdictions', 'operators', 'outcome-validation', 'types', 'validators'], '.ts'),
      ...list(`${D}/methods`, ['benign', 'common', 'context-discrimination', 'index', 'jurisdiction-collision', 'mutation', 'reference-differential', 'schema-only', 'type-validation'], '.ts'),
      ...list('schemas', ['pii-accounting-report-v1', 'pii-assessment-v1', 'pii-benign-collision-evidence-v1', 'pii-context-evidence-v1', 'pii-population-contract-v1', 'pii-validator-observation-v1'], '.json'),
    ],
  },
  {
    id: 'oracle-behaviour-tests',
    disposition: 'removal-candidate',
    owner: 'redact-secret/pii-eval (its parity vectors replace them)',
    prerequisite: 'removed together with the generic-engine file each one tests, never before it; pii-eval keeps its own oracle-parity vectors',
    paths: list('tests', ['pii-accounting', 'pii-benign-collision-evidence', 'pii-context-evidence', 'pii-domain', 'pii-identity-oracle', 'pii-methods', 'pii-validator-qualification'], '.test.mjs'),
  },
  {
    id: 'mixed-split',
    disposition: 'split-then-decide',
    owner: 'benchmarks keeps the product verdict; the neutral calculation is pii-eval',
    prerequisite: 'a reviewed split of each file into the neutral calculation (removable) and the product decision (kept), recorded before any line moves',
    paths: [
      ...list(D, ['holdout-corpus', 'holdout', 'identity-oracle', 'populations', 'profile', 'qualification', 'validator-qualification'], '.ts'),
      'qualification/pii-v1.json', 'scanners/candidate.mjs', 'scripts/observe-pii-populations.mjs', 'scripts/score-pii-port-suffix.mjs',
      ...list('schemas', ['pii-population-comparison-v1', 'pii-population-report-v1', 'pii-qualification-profile-v1', 'pii-validator-qualification-v1'], '.json'),
    ],
  },
  {
    id: 'benchmark-scorer',
    disposition: 'retain-until-criterion',
    owner: 'benchmarks (the benchmark scorer b11ScoreTable and its population plans)',
    prerequisite: 'criterion population-dual-run-complete: an engine contract that can state the 156 not-established case memberships, or an explicit owner decision to drop them, and criterion scorer-basis-decided',
    paths: list(D, ['beta11-qualification', 'beta11-population-v2', 'beta11-disposition', 'beta11-protected'], '.ts'),
  },
  {
    id: 'product-policy',
    disposition: 'retain',
    owner: 'benchmarks (product thresholds, support status, activation, publication and protected support bindings)',
    prerequisite: 'none: product-owned evidence and policy are never removal candidates',
    paths: [
      ...list(D, ['support', 'support-v2', 'support-semantics', 'product-binding', 'protected-support-binding', 'pii-eval-artifact-consumer', 'custodian-consumer'], '.ts').map(p => (/(pii-eval-artifact-consumer|custodian-consumer)\.ts$/.test(p) ? p.replace(/\.ts$/, '.mjs') : p)),
      'scripts/publish-pii-support.ts', 'scripts/pii-publication-inputs.ts', 'web/services/domains.ts',
    ],
  },
];

/**
 * The retained (non-candidate, non-test) code that reaches a removal candidate through the import graph, following candidate-only chains.
 * A candidate with any retained consumer is part of the oracle or of a specialized consumer and cannot be removed until that consumer is
 * repointed; this is the per-file evidence behind the removal decision (#666).
 */
function retainedConsumers(path, candidateSet) {
  const seen = new Set([path]);
  const queue = [path];
  const retained = new Set();
  while (queue.length) {
    for (const c of callersOf(queue.pop())) {
      if (seen.has(c.file) || c.file === 'scripts/pii-legacy-inventory.mjs' || c.file === 'docs/generated/pii-legacy-inventory.json') continue;
      seen.add(c.file);
      if (candidateSet.has(c.file)) queue.push(c.file);
      else if (c.class !== 'test') retained.add(c.file);
    }
  }
  return [...retained].sort();
}

export function buildInventory() {
  const candidateSet = new Set(GROUPS.filter(g => g.disposition !== 'retain').flatMap(g => g.paths));
  const seen = new Map();
  const entries = [];
  for (const group of GROUPS) {
    for (const path of group.paths) {
      if (seen.has(path)) throw new Error(`${path} is in two groups: ${seen.get(path)} and ${group.id}`);
      seen.set(path, group.id);
      if (!existsSync(join(ROOT, path))) throw new Error(`${path} (${group.id}) no longer exists: update the inventory, do not drop the row silently`);
      const callers = callersOf(path).filter(c => c.file !== 'scripts/pii-legacy-inventory.mjs' && c.file !== 'docs/generated/pii-legacy-inventory.json');
      const external = callers.filter(c => !candidateSet.has(c.file) && c.class !== 'test');
      const testCallers = callers.filter(c => !candidateSet.has(c.file) && c.class === 'test').length;
      const byClass = {};
      for (const c of external) byClass[c.class] = (byClass[c.class] ?? 0) + 1;
      const isCandidate = group.disposition === 'removal-candidate';
      const reach = isCandidate && group.id !== 'oracle-behaviour-tests' ? retainedConsumers(path, candidateSet) : [];
      // Authority is new (#666), but the oracle period has not run: the further measured release, the repeated rehearsal and a reviewed removal PR are unmet. So no candidate is removed now, and the row says why.
      const retention = isCandidate
        ? { removalDecision: 'retain-for-oracle-period', reachedByRetainedCode: reach.length > 0, informational: { retainedConsumerCount: reach.length, retainedConsumers: reach.slice(0, 5) }, reason: group.id === 'oracle-behaviour-tests' ? 'the test of a retained oracle file; removed with that file' : reach.length ? 'reached by retained code (the oracle, the mixed files or a specialized consumer)' : 'no retained consumer; held by the unmet oracle-period exit' }
        : { removalDecision: group.disposition === 'retain' ? 'retain' : group.disposition === 'retain-until-criterion' ? 'retain-until-criterion' : 'split-then-decide' };
      entries.push({
        path, group: group.id, disposition: group.disposition, retention, owner: group.owner, prerequisite: group.prerequisite,
        callers: { total: callers.length, withinCandidates: callers.filter(c => candidateSet.has(c.file)).length, testCallers, external: external.length, externalByClass: Object.fromEntries(Object.entries(byClass).sort()), externalFiles: external.map(c => `${c.file} (${c.class}, ${c.via})`) },
      });
    }
  }
  const byGroup = Object.fromEntries(GROUPS.map(g => [g.id, { disposition: g.disposition, files: g.paths.length, externalCallerFiles: new Set(entries.filter(e => e.group === g.id).flatMap(e => e.callers.externalFiles)).size }]));
  return {
    schemaVersion: 1, reportType: 'pii-legacy-inventory', supportClaims: false, removesNothing: true,
    removalReview: { authority: 'new (public/synthetic), 2026-10-07', removed: [], decision: 'No legacy file is removed: every removal candidate is either reached by retained code or is held by the oracle-period exit (one further measured release through both pipelines, a repeated rehearsal, a reviewed removal PR).' },
    source: 'redact-secret/pii-eval docs/migration/ownership-map.md at 212d500de90ce97461275be1e8b9dd8acd663fb3, restricted to this repository',
    groups: GROUPS.map(({ paths, ...g }) => ({ ...g, files: paths.length })),
    summary: { files: entries.length, byGroup },
    entries,
  };
}

const render = inventory => `${JSON.stringify(inventory, null, 1)}\n`;

/**
 * What a drift check compares: the candidates, their groups and the callers that would block a removal (everything but a test). The count of
 * test callers, the totals and the sample of retained consumers (`retention.informational`) are informational, so an unrelated pull request that adds a test naming a candidate does not turn the gate red;
 * a new script, workflow, page or service that uses one does, because that caller has to be repointed before the file can go.
 */
export function comparable(inventory) {
  return JSON.stringify({ ...inventory, entries: inventory.entries.map(e => ({ ...e, retention: { ...e.retention, informational: undefined }, callers: { external: e.callers.external, externalByClass: e.callers.externalByClass, externalFiles: e.callers.externalFiles } })) });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const inventory = buildInventory();
  if (process.argv.includes('--write')) { writeFileSync(join(ROOT, INVENTORY_FILE), render(inventory)); console.log(`wrote ${INVENTORY_FILE}`); }
  else if (process.argv.includes('--check')) {
    const committed = existsSync(join(ROOT, INVENTORY_FILE)) ? readFileSync(join(ROOT, INVENTORY_FILE), 'utf8') : '';
    if (!committed || comparable(JSON.parse(committed)) !== comparable(inventory)) { console.error(`${INVENTORY_FILE} differs from the tree: run node scripts/pii-legacy-inventory.mjs --write and review the change`); process.exit(1); }
    console.log(`${INVENTORY_FILE} matches the tree (${inventory.summary.files} files).`);
  } else console.log(JSON.stringify(inventory.summary, null, 1));
}
