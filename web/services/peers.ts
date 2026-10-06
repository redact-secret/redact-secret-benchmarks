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
  DECLARED_SCOPES, PEER_KINDS, peerRegistryProblems, peerRuleFamilyProblems, targetedFamilies,
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
  /** What this benchmark does not run or measure for the scanner (`outOfScope` in the registry). */
  outOfScope: string[];
  /** The taxonomy families at least one of the scanner's own rules targets. */
  families: Set<string>;
  /** The scanner's own rules that target a family, with the reviewed pattern evidence (`basis`), by family id. */
  rulesByFamily: Map<string, { rule: string; basis: string }[]>;
  /** Rules that map to a family, and the rules in the pinned rule file. */
  mappedRules: number;
  ruleCount: number;
  /** The pinned rule file the map was reviewed against, e.g. "8.30.1". */
  ruleFileVersion: string;
  /** Where the rule file lives, as the map records it: a path, and for a rule file in a repository the commit. */
  ruleFilePath: string | null;
  ruleFileRevision: string | null;
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
      const rulesByFamily = new Map<string, { rule: string; basis: string }[]>();
      for (const [rule, mapping] of Object.entries(set.rules)) {
        for (const family of mapping.families) (rulesByFamily.get(family) ?? rulesByFamily.set(family, []).get(family)!).push({ rule, basis: mapping.basis });
      }
      profiles.set(id, {
        id, kind: entry.kind, kindLabel: PEER_KINDS[entry.kind], description: entry.description, outOfScope: entry.outOfScope,
        families, rulesByFamily, mappedRules, ruleCount: set.ruleCount, ruleFileVersion: set.source.version, ruleFilePath: set.source.path ?? null, ruleFileRevision: set.source.revision ?? null, reviewedAt: map.reviewedAt,
      });
    }
    return profiles;
  });
}

/** A scanner id's declared configuration for the scope tables (#724): the peer's default, or a declared diagnostic profile of it. */
export interface DeclaredConfiguration { scanner: string; of: string | null; label: string; description: string }

/** From the same reviewed registry as the peer profiles (#558): no second registry. Product and unknown scanner ids have no entry. */
export function loadDeclaredConfigurations(): Promise<Map<string, DeclaredConfiguration>> {
  return once('declared-configurations', async () => {
    const registry = await readJson<PeerRegistry>('scanners/peer-registry.json');
    const out = new Map<string, DeclaredConfiguration>();
    for (const [id, entry] of Object.entries(registry.scanners ?? {})) {
      out.set(id, { scanner: id, of: null, label: 'Default configuration', description: entry.description });
      for (const [profileId, profile] of Object.entries(entry.diagnosticProfiles ?? {})) out.set(profileId, { scanner: profileId, of: id, label: `Diagnostic profile: ${DECLARED_SCOPES[profile.declaredScope].toLowerCase()}`, description: profile.description });
    }
    return out;
  });
}
