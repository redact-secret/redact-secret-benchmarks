/**
 * What the ledger holds about each peer scanner beyond its results (#558): what kind
 * of tool it is, one plain sentence about what it is built for, and which taxonomy
 * families its own rules target. Two committed, reviewed files beside the adapters:
 * `scanners/peer-registry.json` and `scanners/peer-rule-families.json`.
 *
 * Both are validated here with the validator the ledger pipeline runs
 * (`benchmarks/lib/peer-rule-families.ts`, `npm run peer-rules:check`): a rule that
 * is not in the pinned rule file, a family that is not in the taxonomy or a
 * registry sentence that ranks a scanner fails the build. Gitleaks, TruffleHog and
 * flare-redact rules are checked against the committed snapshot of their pinned rule
 * files (`benchmarks/detector-inventory.json`); OpenRedaction's rule list is checked
 * by the pipeline test against the installed package, so here its ids are trusted.
 */
import {
  PEER_KINDS, peerRegistryProblems, peerRuleFamilyProblems, targetedFamilies,
  type PeerId, type PeerInventories, type PeerKind, type PeerRegistry, type PeerRuleFamilies,
} from '../../benchmarks/lib/peer-rule-families';
import type { Taxonomy } from '../../benchmarks/support/taxonomy';
import { once, readJson } from './repo';

export interface PeerProfile {
  id: string;
  kind: PeerKind;
  /** "Repository scanner", "Runtime library". */
  kindLabel: string;
  description: string;
  /** The taxonomy families at least one of the scanner's own rules targets. */
  families: Set<string>;
  /** Rules that map to a family, and the rules in the pinned rule file. */
  mappedRules: number;
  ruleCount: number;
  /** The pinned rule file the map was reviewed against, e.g. "8.30.1". */
  ruleFileVersion: string;
  reviewedAt: string;
}

export function loadPeerProfiles(): Promise<Map<string, PeerProfile>> {
  return once('peer-profiles', async () => {
    const [registry, map, taxonomy, inventory] = await Promise.all([
      readJson<PeerRegistry>('scanners/peer-registry.json'),
      readJson<PeerRuleFamilies>('scanners/peer-rule-families.json'),
      readJson<Taxonomy>('benchmarks/support/taxonomy.json'),
      readJson<{ entries: { tool: string; id: string }[] }>('benchmarks/detector-inventory.json'),
    ]);
    const ids = (tool: string): string[] => [...new Set(inventory.entries.filter(e => e.tool === tool).map(e => e.id))];
    const inventories: PeerInventories = { gitleaks: ids('gitleaks'), trufflehog: ids('trufflehog'), 'flare-redact': ids('flare-redact') };
    const problems = [...peerRuleFamilyProblems(map, taxonomy, inventories), ...peerRegistryProblems(registry, Object.keys(registry.scanners ?? {}))];
    if (problems.length) throw new Error(`the peer rule map or registry is invalid: ${problems.join('; ')}`);
    const profiles = new Map<string, PeerProfile>();
    for (const [id, entry] of Object.entries(registry.scanners)) {
      const set = map.scanners[id as PeerId];
      const { families, mappedRules } = targetedFamilies(set);
      profiles.set(id, {
        id, kind: entry.kind, kindLabel: PEER_KINDS[entry.kind], description: entry.description,
        families, mappedRules, ruleCount: set.ruleCount, ruleFileVersion: set.source.version, reviewedAt: map.reviewedAt,
      });
    }
    return profiles;
  });
}
