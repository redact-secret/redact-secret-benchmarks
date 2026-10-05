/**
 * The peer scanners' rules mapped to the credential families of
 * `benchmarks/support/taxonomy.json` (#558), and the registry that says what kind
 * of tool each peer is. Two committed files, both authored and reviewed:
 *
 *  - `scanners/peer-rule-families.json`  which rule of which pinned peer targets which family;
 *  - `scanners/peer-registry.json`       each peer's kind and one-sentence description.
 *
 * They live beside the adapters but are not part of the adapter identity
 * (`scanners/index.mjs`, `scanners/families.mjs` are hashed into a peer snapshot's
 * identity and are never edited for this), so adding or correcting a row here
 * re-keys nothing in the ledger.
 *
 * This module only validates. It reads no file: the caller passes the parsed files,
 * the taxonomy and each peer's rule inventory. The report pages read the map to say
 * which inputs a peer's own rules target; nothing here ranks a peer.
 *
 * What a mapping states. A peer rule targets a family when the rule's own pattern,
 * as written in the pinned rule file, can match a well-formed credential of that
 * family (with the keyword gate or wrapper the rule requires), or when the rule is
 * the peer's rule for that credential class. A rule for the same provider but a
 * different token class (a different prefix or shape) is not mapped and, when its
 * name looks like a provider, is listed in `reviewedNoFamily` with the reason. The
 * map is never derived from what a peer found on the fixtures: that would make
 * "left readable on the inputs its rules target" true by construction.
 */
import type { Taxonomy } from '../support/taxonomy';

export const PEER_IDS = ['gitleaks', 'trufflehog', 'flare-redact', 'openredaction'] as const;
export type PeerId = (typeof PEER_IDS)[number];

export interface RuleMapping { families: string[]; basis: string }
export interface PeerRuleSet {
  /** The pinned rule file the rules were read from, so a change of pin fails validation until the map is re-reviewed. */
  source: { version: string; revision?: string; sha256?: string; path?: string };
  /** Rules in the pinned rule file (unique ids). */
  ruleCount: number;
  /** Rule id -> the families it targets and the pattern evidence. */
  rules: Record<string, RuleMapping>;
  /** Rules whose name looks like a provider but that target no taxonomy family, each with the reason. */
  reviewedNoFamily: Record<string, string>;
}
export interface PeerRuleFamilies {
  schemaVersion: 1;
  reviewedAt: string;
  method: string;
  scanners: Record<string, PeerRuleSet>;
}

export interface PeerProfile {
  kind: PeerKind;
  description: string;
  /** What this benchmark does not run or measure for the scanner, one plain statement each (#612). */
  outOfScope: string[];
}
export type PeerKind = 'repository-scanner' | 'runtime-library';
export const PEER_KINDS: Record<PeerKind, string> = { 'repository-scanner': 'Repository scanner', 'runtime-library': 'Runtime library' };
export interface PeerRegistry { schemaVersion: 1; scanners: Record<string, PeerProfile> }

/** What a validator needs to know about a peer's rules. `undefined` skips the membership check (the package is not read here). */
export type PeerInventories = Partial<Record<PeerId, string[]>>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Copy about a scanner states what it targets and what was recorded; it never ranks. */
const RANKING_WORDS = /\b(better|worse|best|worst|superior|inferior|outperforms?|beats?|leader|winning|fails?|failed|failure|vulnerable)\b/i;

/** Words of a provider's name that identify no provider on their own. */
const GENERIC_WORDS = new Set(['cloud', 'token', 'services', 'web', 'enterprise', 'index', 'python', 'package', 'hub', 'labs', 'docker', 'weights', 'biases', 'azure', 'entra', 'devops', 'face', 'relic', 'amazon']);
const normalise = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Provider tokens (id parts and name words of four or more characters) a rule name is checked for. */
export function providerTokens(taxonomy: Pick<Taxonomy, 'providers'>): string[] {
  const tokens = new Set<string>();
  for (const provider of taxonomy.providers) {
    const parts = [provider.id, ...provider.id.split('-'), ...provider.name.split(/[^A-Za-z0-9]+/)].map(normalise);
    for (const part of parts) if (part.length >= 4 && !GENERIC_WORDS.has(part)) tokens.add(part);
  }
  return [...tokens].sort();
}

/** True when a rule's name starts with, or has a segment starting with, a provider token. */
export function looksLikeProvider(ruleId: string, tokens: string[]): boolean {
  const segments = ruleId.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const whole = normalise(ruleId);
  return tokens.some(token => whole.startsWith(token) || segments.some(segment => segment.startsWith(token)));
}

const sorted = (values: string[]): boolean => values.every((value, i) => i === 0 || values[i - 1] < value);

export function peerRuleFamilyProblems(map: PeerRuleFamilies, taxonomy: Taxonomy, inventories: PeerInventories = {}): string[] {
  const problems: string[] = [];
  if (map?.schemaVersion !== 1) return ['peer-rule-families.json: schemaVersion must be 1'];
  if (!ISO_DATE.test(map.reviewedAt)) problems.push('peer-rule-families.json: reviewedAt must be a date');
  if (!map.method || map.method.length < 40) problems.push('peer-rule-families.json: method must say how the map was made and reviewed');
  const families = new Set(taxonomy.families.map(f => f.id));
  const tokens = providerTokens(taxonomy);
  for (const id of PEER_IDS) if (!map.scanners?.[id]) problems.push(`peer-rule-families.json: no rule set for ${id}`);
  for (const id of Object.keys(map.scanners ?? {})) if (!(PEER_IDS as readonly string[]).includes(id)) problems.push(`peer-rule-families.json: ${id} is not a registered peer`);

  for (const id of PEER_IDS) {
    const set = map.scanners?.[id];
    if (!set) continue;
    const at = `peer-rule-families.json ${id}`;
    if (!set.source?.version) problems.push(`${at}: source.version is required`);
    if (!Number.isInteger(set.ruleCount) || set.ruleCount <= 0) problems.push(`${at}: ruleCount must be a positive integer`);
    const inventory = inventories[id];
    const known = inventory ? new Set(inventory) : undefined;
    if (known && known.size !== set.ruleCount) problems.push(`${at}: ruleCount ${set.ruleCount} is not the ${known.size} rules in the pinned rule file`);
    const mapped = Object.keys(set.rules ?? {});
    const reviewed = Object.keys(set.reviewedNoFamily ?? {});
    if (!sorted(mapped)) problems.push(`${at}: rules must be sorted by id, without duplicates`);
    if (!sorted(reviewed)) problems.push(`${at}: reviewedNoFamily must be sorted by id, without duplicates`);
    for (const rule of mapped) {
      const entry = set.rules[rule];
      if (known && !known.has(rule)) problems.push(`${at}: rule ${rule} is not in the pinned rule file`);
      if (!Array.isArray(entry.families) || entry.families.length === 0) { problems.push(`${at}: rule ${rule} maps no family`); continue; }
      if (new Set(entry.families).size !== entry.families.length) problems.push(`${at}: rule ${rule} lists a family twice`);
      for (const family of entry.families) if (!families.has(family)) problems.push(`${at}: rule ${rule} names unknown family ${family}`);
      if (!entry.basis?.trim()) problems.push(`${at}: rule ${rule} has no pattern evidence`);
      if (RANKING_WORDS.test(entry.basis ?? '')) problems.push(`${at}: rule ${rule} basis words a judgement, not a pattern`);
    }
    for (const rule of reviewed) {
      if (known && !known.has(rule)) problems.push(`${at}: reviewed rule ${rule} is not in the pinned rule file`);
      if (set.rules?.[rule]) problems.push(`${at}: rule ${rule} is both mapped and reviewed as targeting no family`);
      if (!set.reviewedNoFamily[rule]?.trim()) problems.push(`${at}: reviewed rule ${rule} has no reason`);
    }
    // The review gate: a rule that looks like a provider is either mapped or explicitly reviewed.
    if (inventory) {
      for (const rule of known!) {
        if (set.rules?.[rule] || set.reviewedNoFamily?.[rule] !== undefined) continue;
        if (looksLikeProvider(rule, tokens)) problems.push(`${at}: rule ${rule} looks like a taxonomy provider but is neither mapped nor reviewed as targeting no family`);
      }
    }
  }
  return problems;
}

export function peerRegistryProblems(registry: PeerRegistry, registered: string[]): string[] {
  const problems: string[] = [];
  if (registry?.schemaVersion !== 1) return ['peer-registry.json: schemaVersion must be 1'];
  const peers = registered.filter(id => id !== 'redact-secret');
  for (const id of peers) if (!registry.scanners?.[id]) problems.push(`peer-registry.json: no entry for peer ${id}`);
  for (const [id, profile] of Object.entries(registry.scanners ?? {})) {
    if (!peers.includes(id)) problems.push(`peer-registry.json: ${id} is not a registered peer`);
    if (!(profile.kind in PEER_KINDS)) problems.push(`peer-registry.json: ${id} has unknown kind ${profile.kind}`);
    if (!profile.description?.trim() || profile.description.length > 240) problems.push(`peer-registry.json: ${id} needs a description of one sentence or two, at most 240 characters`);
    if (RANKING_WORDS.test(profile.description ?? '')) problems.push(`peer-registry.json: ${id} description words a judgement; state what the scanner is built for`);
    const scope = profile.outOfScope;
    if (!Array.isArray(scope) || scope.length === 0 || scope.length > 6) problems.push(`peer-registry.json: ${id} needs one to six outOfScope statements`);
    for (const statement of Array.isArray(scope) ? scope : []) {
      if (typeof statement !== 'string' || !statement.trim() || statement.length > 200) problems.push(`peer-registry.json: ${id} has an outOfScope statement that is empty or over 200 characters`);
      else if (RANKING_WORDS.test(statement)) problems.push(`peer-registry.json: ${id} outOfScope statement words a judgement; state what is not run`);
    }
  }
  return problems;
}

/** The families each peer's mapped rules target, and how many of its rules that is. */
export function targetedFamilies(set: PeerRuleSet): { families: Set<string>; mappedRules: number } {
  const families = new Set<string>();
  for (const entry of Object.values(set.rules)) for (const family of entry.families) families.add(family);
  return { families, mappedRules: Object.keys(set.rules).length };
}

export interface ProductScope { schemaVersion: number; product: string; readAt: { repository: string; revision: string; note?: string }; description: string; outOfScope: string[]; sources: string[] }

/** The product's own out-of-scope statements (#622): what the product documents it does not do, stated without a judgement and read at a named product revision. */
export function productScopeProblems(scope: ProductScope): string[] {
  const problems: string[] = [];
  if (scope?.schemaVersion !== 1) return ['product-scope.json: schemaVersion must be 1'];
  if (scope.product !== 'redact-secret') problems.push('product-scope.json: product must be redact-secret');
  if (!/^[0-9a-f]{40}$/.test(scope.readAt?.revision ?? '')) problems.push('product-scope.json: readAt.revision must be a full 40-character product commit');
  if (!scope.description?.trim() || scope.description.length > 240) problems.push('product-scope.json: needs a description of one sentence or two, at most 240 characters');
  if (RANKING_WORDS.test(scope.description ?? '')) problems.push('product-scope.json: the description words a judgement');
  if (!Array.isArray(scope.outOfScope) || scope.outOfScope.length === 0 || scope.outOfScope.length > 8) problems.push('product-scope.json: needs one to eight outOfScope statements');
  for (const statement of Array.isArray(scope.outOfScope) ? scope.outOfScope : []) {
    if (typeof statement !== 'string' || !statement.trim() || statement.length > 200) problems.push('product-scope.json: an outOfScope statement is empty or over 200 characters');
    else if (RANKING_WORDS.test(statement)) problems.push('product-scope.json: an outOfScope statement words a judgement; state what is not covered');
  }
  if (!Array.isArray(scope.sources) || scope.sources.length === 0) problems.push('product-scope.json: needs the sources the statements restate');
  for (const source of scope.sources ?? []) if (/github\.com\/redact-secret\/redact-secret\/blob\//.test(source) && !/\/blob\/[0-9a-f]{40}\//.test(source)) problems.push(`product-scope.json: ${source} is a past-state link and needs a 40-hex permalink`);
  return problems;
}
