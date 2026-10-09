import { runtimeInputPaths, validateCurrentRuntimeInput } from '../benchmarks/lib/current-runtime-inputs.mjs';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import {
  checkPinConsistency, checkPinAncestry, collectKnownGapCommits, extractRegistryIds, PRODUCT_REPO, PRODUCT_BRANCH, REGISTRY_PATH,
} from '../benchmarks/lib/pin-drift.ts';


// The registry file at a revision, read through the contents API: a semantic comparison, not a path diff (#631).
function registryIds(ref) {
  return extractRegistryIds(execFileSync('gh', [
    'api', '-H', 'Accept: application/vnd.' + 'git' + 'hub.raw', `repos/${PRODUCT_REPO}/contents/${REGISTRY_PATH}?ref=${ref}`,
  ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
}

function compare(base, head) {
  const jqFilter = '{status}';
  return JSON.parse(execFileSync('gh', [
    'api', `repos/${PRODUCT_REPO}/compare/${base}...${head}`, '--jq', jqFilter,
  ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
}
const isAncestor = status => status === 'identical' || status === 'ahead';

async function main() {
  const root = new URL('../', import.meta.url);
  const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const [registry, inventory, packageJson, knownGaps, performanceCriteria] = await Promise.all([
    read('benchmarks/detectors.json'),
    read('benchmarks/detector-inventory.json'),
    read('package.json'),
    read('benchmarks/known-gaps.json'),
    read('benchmarks/performance-criteria.json'),
  ]);
  // The runtime-comparison snapshots the site reads (#562): their redact-secret identity must follow the pin.
  const runtimeComparisonSnapshots = [];
  for (const setting of ['default', 'pii-global', 'pii-global-us']) {
    const file = runtimeInputPaths[setting];
    const snapshot = validateCurrentRuntimeInput(setting, await read(file));
    const tool = snapshot.tools.find(t => t.id === 'redact-secret');
    runtimeComparisonSnapshots.push({ file, version: tool.version, kind: tool.provenance.kind, commit: tool.provenance.commit });
  }
  const facts = {
    runtimeComparisonSnapshots,
    registrySourceRevision: registry.sourceRevision,
    inventoryRedactSecretRevision: inventory.redactSecretRevision,
    inventoryRedactSecretVersion: inventory.redactSecretVersion,
    inventoryRedactSecretReleaseRevision: inventory.redactSecretReleaseRevision,
    packageVersion: packageJson.dependencies['@redact-secret/core'],
    performanceCriteriaVerifiedCommit: performanceCriteria.baseline.verifiedCommit,
  };

  const failures = checkPinConsistency(facts);

  if (!process.argv.includes('--local-only')) {
    const registryCompare = compare(facts.registrySourceRevision, PRODUCT_BRANCH);
    const knownGapCommitIsAncestor = {};
    for (const commit of collectKnownGapCommits(knownGaps)) {
      knownGapCommitIsAncestor[commit] = isAncestor(compare(commit, PRODUCT_BRANCH).status);
    }
    failures.push(...checkPinAncestry(facts, knownGaps, {
      registrySourceRevisionIsAncestor: isAncestor(registryCompare.status),
      pinnedRegistryIds: registryIds(facts.registrySourceRevision),
      currentRegistryIds: registryIds(PRODUCT_BRANCH),
      knownGapCommitIsAncestor,
    }, registry.detectors.map(d => d.id)));
  }

  if (failures.length) {
    console.error(`Pin drift detected:\n${failures.map(f => `  - ${f}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('No pin drift detected.');
  }
}

await main();
