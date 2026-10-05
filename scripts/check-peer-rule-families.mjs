/**
 * Validates the peer rule-to-family map and the peer registry (#558): every mapped
 * rule exists in the pinned peer's rule file, every family exists in the taxonomy,
 * every rule whose name looks like a provider is mapped or reviewed, and the
 * registry copy states what a scanner is built for without ranking it.
 *
 * Gitleaks, TruffleHog and flare-redact rules are read from the committed snapshot
 * of their pinned rule files (`benchmarks/detector-inventory.json`, refreshed by
 * `npm run detectors:refresh`); OpenRedaction's from the installed package, whose
 * version the lockfile pins. Reads only committed files and node_modules: no
 * network, no peer binary, so it does not depend on the peer scanner pin.
 *
 * Run: npm run peer-rules:check
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { peerRegistryProblems, peerRuleFamilyProblems, productScopeProblems } from '../benchmarks/lib/peer-rule-families.ts';

const root = new URL('../', import.meta.url);
const readJson = async relative => JSON.parse(await readFile(new URL(relative, root), 'utf8'));

/** The rule ids of each pinned peer, from the sources the map was reviewed against. */
export async function peerInventories() {
  const inventory = await readJson('benchmarks/detector-inventory.json');
  const ids = tool => [...new Set(inventory.entries.filter(entry => entry.tool === tool).map(entry => entry.id))];
  const { OpenRedaction } = await import('@openredaction/core');
  return {
    gitleaks: ids('gitleaks'),
    trufflehog: ids('trufflehog'),
    'flare-redact': ids('flare-redact'),
    openredaction: [...new Set(new OpenRedaction({}).getPatterns().map(pattern => pattern.type))],
    sources: inventory.sources,
  };
}

export async function problems() {
  const [map, registry, taxonomy, { scanners }] = await Promise.all([
    readJson('scanners/peer-rule-families.json'),
    readJson('scanners/peer-registry.json'),
    readJson('benchmarks/support/taxonomy.json'),
    import('../scanners/index.mjs'),
  ]);
  const { sources, ...inventories } = await peerInventories();
  const productScope = await readJson('scanners/product-scope.json');
  const found = [...peerRuleFamilyProblems(map, taxonomy, inventories), ...peerRegistryProblems(registry, scanners.map(scanner => scanner.id)), ...productScopeProblems(productScope)];
  // The map was reviewed against these exact rule files: a new pin fails here until it is re-reviewed.
  for (const id of ['gitleaks', 'trufflehog', 'flare-redact']) {
    const at = map.scanners[id]?.source, now = sources[id];
    if (at?.revision !== now.revision || at?.sha256 !== now.sha256 || at?.version !== now.version) {
      found.push(`peer-rule-families.json ${id}: reviewed against ${at?.version} ${at?.revision}, but benchmarks/detector-inventory.json snapshots ${now.version} ${now.revision}; re-review the map`);
    }
  }
  const lock = await readJson('package-lock.json');
  const openredaction = lock.packages?.['node_modules/@openredaction/core']?.version;
  if (map.scanners.openredaction?.source.version !== openredaction) found.push(`peer-rule-families.json openredaction: reviewed against ${map.scanners.openredaction?.source.version}, but package-lock.json pins ${openredaction}; re-review the map`);
  return found;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const found = await problems();
  if (found.length) {
    for (const problem of found) console.error(problem);
    process.exit(1);
  }
  console.log('peer rule map and registry are valid');
}
