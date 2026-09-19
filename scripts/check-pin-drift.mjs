import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import {
  checkPinConsistency, checkPinAncestry, collectKnownGapCommits, PRODUCT_REPO, PRODUCT_BRANCH,
} from '../benchmarks/lib/pin-drift.ts';

const DETECTORS_PATH = 'crates/secret-scan-core/src/detectors';

function compare(base, head) {
  return JSON.parse(execFileSync('gh', ['api', `repos/${PRODUCT_REPO}/compare/${base}...${head}`], { encoding: 'utf8' }));
}
const isAncestor = status => status === 'identical' || status === 'ahead';

async function main() {
  const root = new URL('../', import.meta.url);
  const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const [registry, inventory, packageJson, knownGaps] = await Promise.all([
    read('benchmarks/detectors.json'),
    read('benchmarks/detector-inventory.json'),
    read('package.json'),
    read('benchmarks/known-gaps.json'),
  ]);
  const facts = {
    registrySourceRevision: registry.sourceRevision,
    inventoryRedactSecretRevision: inventory.redactSecretRevision,
    inventoryRedactSecretVersion: inventory.redactSecretVersion,
    packageVersion: packageJson.dependencies['@redact-secret/core'],
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
      detectorsPathChangedSinceRegistry: (registryCompare.files ?? []).some(f => f.filename.startsWith(DETECTORS_PATH)),
      knownGapCommitIsAncestor,
    }));
  }

  if (failures.length) {
    console.error(`Pin drift detected:\n${failures.map(f => `  - ${f}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('No pin drift detected.');
  }
}

await main();
