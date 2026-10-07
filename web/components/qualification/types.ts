/**
 * Props for the qualification blocks (#606). Every value is already formatted by `resolvers/qualification.ts`: a block never
 * derives a count, rate or status. The product's support status and a generic scanner observation are separate props
 * on purpose, and a population is always named beside its count (no field is a sum across populations or scanners).
 */
import type { Crumb, MetaItem } from '../page';

export type StatusTone = 'info' | 'review' | 'none';
export interface StatusWord { word: string; tone: StatusTone }

export interface IdentityItem { term: string; value: string; code?: boolean }

export interface PopulationRow {
  id: string;
  role: string;
  runClass: string;
  /** Evidence source and release tag, e.g. "credential-evidence · snapshot-2026.10.01.2". */
  evidence: string;
  corpusDigest: string;
  configHash: string;
  semanticDigest: string;
  engine: string;
  /** "None run" when the configuration ran no method: those gates are not measured, never zero. */
  methods: string;
  cases: string;
}

export interface ScannerRow { key: string; population: string; scanner: string; version: string; build: string; mode: string }

export interface TileData { label: string; value: string; definition: string }

export interface FamilyRow {
  family: string;
  href: string;
  provider: string;
  status: StatusWord;
  route: string;
  tier: string;
  basis: string;
  /** What holds the family below `stable`, e.g. "methods not run". Empty for a family with no recorded hold. */
  heldBy: string[];
  /** One entry per population, never summed: "public-evidence-snapshot 60". */
  cases: string[];
}

export interface GapRow {
  id: string;
  title: string;
  status: string;
  kind: string;
  /** Per population, never summed: "regression-corpus 2 of 3 fixtures matched". */
  matched: string[];
  fixtures: { fixture: string; matches: string[] }[];
}

/** One scanner's scope accounting for one artifact (#724): every cell is already formatted. "Unknown" is a word, never a zero. */
export interface ScopeRow {
  key: string;
  population: string;
  /** "plain run" or "methods run": the two artifacts are accounted apart. */
  artifact: string;
  scanner: string;
  /** Declared configuration, e.g. "Default configuration, all built-in patterns" or "Diagnostic profile: credentials category". */
  configuration: string;
  /** Configuration hash and adapter version, shortened. */
  identity: string;
  /** Engine and classification version, e.g. "engine 0.1.0-alpha.11 · openredaction-1.1.5 · accounting v1", or why there is none. */
  classification: string;
  /** "812 of 1,020 findings carry a native label", or "Unknown". */
  coverage: string;
  mapped: string;
  credentialRelated: string;
  outOfScope: string;
  ambiguous: string;
  unavailable: string;
  unrecognized: string;
  /** True when the counts are not accounted (legacy, no table, not measured): the row is dashed. */
  unaccounted: boolean;
  /** The state word: "Accounted", "Legacy: native labels unavailable", "Not accounted", "Not measured". */
  state: string;
  /** Per native label, most findings first, already limited to `labelsShown`; `labelsMore` says how many were left out of this view. */
  labels: { label: string; findings: string; scope: string; reason: string }[];
  labelsMore: string | null;
  /** Fixed limits for this row. */
  limits: string[];
}
export interface ProfileEffectRow {
  key: string;
  population: string;
  /** "openredaction-credentials against openredaction". */
  pair: string;
  identities: string;
  outcomes: string;
  benign: string;
  findings: string;
  denominators: string;
  note: string;
}
export interface ScopeAccountingProps {
  title: string;
  description: string;
  /** Published or candidate, as the mode line elsewhere on the page. */
  mode: string;
  rows: ScopeRow[];
  profiles: { title: string; description: string; rows: ProfileEffectRow[]; empty: string };
  notes: string[];
}

export interface QualificationOverviewProps {
  breadcrumb: Crumb[];
  eyebrow: string;
  title: string;
  lede: string;
  meta: MetaItem[];
  boundary: { title: string; paragraphs: string[] };
  /** Present when fixtures of the evidence carry the maintainer-reviewed label. */
  disclosure?: ReviewDisclosureProps;
  summary: {
    title: string;
    description: string;
    /** Published or candidate, with the release it measured. A stable count states its mode. */
    mode: string;
    tiles: TileData[];
    routes: TileData[];
    methodsNote: string | null;
  };
  identity: { title: string; items: IdentityItem[] };
  populations: { title: string; description: string; rows: PopulationRow[] };
  scanners: { title: string; description: string; rows: ScannerRow[]; notMeasured?: NotMeasuredScanner[]; profiles?: ScannerProfiles };
  families: { title: string; description: string; rows: FamilyRow[]; undetected: { title: string; text: string; items: string[] } };
  /** The cases no detector family claims, per population, on pages of their own. */
  unattributed: { title: string; description: string; href: string; label: string };
  gaps: { title: string; description: string; rows: GapRow[] };
  /** Scope accounting beside the scanner counts (#724); absent when the view carries none. */
  scope?: ScopeAccountingProps;
  /** Where each scanner's observation came from, apart from the scope evidence (#724); absent when the view carries none. */
  origins?: ObservationOriginsProps;
}

/** One scanner's observation of one artifact: scanned in that run, reused from an earlier verified run, or not recorded. Provenance, never evidence. */
export interface OriginRow {
  key: string; population: string; artifact: string; scanner: string;
  state: 'fresh' | 'reused' | 'not-recorded';
  /** The state in words: "Scanned in this run", "Reused from an earlier verified run", "Not recorded". */
  origin: string;
  /** The engine's fixed-vocabulary reason, or why none is shown. */
  reason: string;
  /** For a reused observation, the digests of the source set and the input; otherwise a statement that none applies. */
  receipt: string;
}
export interface ObservationOriginsProps {
  title: string;
  description: string;
  notes: string[];
  rows: OriginRow[];
  /** Optional scanners with no observation in this view: stated, never given an origin of their own. */
  omitted: { key: string; statement: string }[];
  empty: string;
}

/**
 * An OPTIONAL scanner this view does not carry (#763): the contract's sentence, why, and where its last measurement is. Never a zero and never a row of counts.
 * Every field is already formatted; the pointer names the run, engine, configuration and date of the earlier measurement, which stays history.
 */
export interface NotMeasuredScanner {
  key: string; statement: string; reason: string; lastMeasurement: string; officialMeasurement?: string; decision?: string;
  /** Where the artifacts of the last measurement are kept, when the registry no longer lists its runs (a retained measurement). */
  archive?: string;
  /** What scope accounting that measurement carries: a legacy engine's native labels are unavailable, so its counts are Unknown and never zero. */
  scope?: string;
  /** A link to the page that holds the full pointer. Internal only. */
  link?: { label: string; href: string };
}

/**
 * The profiles of one scanner, labelled separately (#764): what each detects, its configuration identity and whether this view measured it, with the one disclosure
 * that results differ by configuration. Every field is already formatted; nothing here is a result.
 */
export interface ScannerProfiles {
  title: string;
  description: string;
  rows: ScannerProfileRow[];
  disclosure?: string;
}
export interface ScannerProfileRow { key: string; label: string; scanner: string; detects: string; identity: string; status: string }

export interface CountsRow { key: string; population: string; role: string; scanner: string; cases: string; positives: string; outcomes: string; leaked: string; benign: string; twins: string; unmeasured: string }

export interface QualificationFamilyProps {
  breadcrumb: Crumb[];
  eyebrow: string;
  title: string;
  lede: string;
  meta: MetaItem[];
  status: {
    title: string;
    note: string;
    value: StatusWord;
    facts: IdentityItem[];
    reasons: string[];
    methodsNotRun: string[];
  };
  evidence: { title: string; description: string; facts: IdentityItem[] };
  gates: { title: string; description: string; rows: { key: string; population: string; twins: string; benign: string }[] };
  observations: { title: string; description: string; rows: CountsRow[]; empty: string };
  /** The family's case rows, per population (#606), on pages of their own. */
  cases: { title: string; description: string; href: string; label: string };
}

/** One scanner's word for one case. `state` carries the dashed "not measured" and "pending" looks; a word is never only a colour. */
export interface CaseCell {
  scanner: string;
  /** "EXACT", "EXACT 2 · MISS 1", "Flagged", "Not flagged", "Pending", "Not measured" or "Not run". */
  word: string;
  state: 'measured' | 'pending' | 'not-measured';
}

export interface CaseRowProps {
  key: string;
  id: string;
  kind: string;
  tier: string;
  group: string;
  /** The artifact's own label for the case, never a support status. "Not recorded" when it carries none. */
  evidenceClass: string;
  cells: CaseCell[];
  /** The case's own facts and what each scanner recorded, shown when the row is opened. */
  detail: IdentityItem[];
}

export interface CaseSection {
  id: string;
  role: string;
  /** "Cases 1 to 100 of this population for this scope": a count of one population, never a sum. */
  range: string;
  /** Where the population's evidence came from, so every row can be traced to a run. */
  identity: IdentityItem[];
  rows: CaseRowProps[];
}

export interface QualificationCasesProps {
  breadcrumb: Crumb[];
  eyebrow: string;
  title: string;
  lede: string;
  meta: MetaItem[];
  note: { title: string; text: string };
  /** Scanner column order. */
  scanners: string[];
  sections: CaseSection[];
  /** Shown when no population has a case in this scope. */
  empty: string;
  pager: { page: number; pageCount: number; previousHref?: string; nextHref?: string };
  back: { href: string; label: string };
}

export interface QualificationUnavailableProps {
  breadcrumb: Crumb[];
  eyebrow: string;
  title: string;
  lede: string;
  /** What state the view is in: absent, incompatible or stale. */
  state: 'not-built' | 'incompatible' | 'stale';
  heading: string;
  reason: string;
  commands: string[];
}

/** Which pipeline produced the numbers on a credential page (#608). Every value is formatted by `resolvers/run.ts`. */
/**
 * The review state some fixtures of the evidence carry, said where the numbers are shown. The words are fixed by the owner's decision
 * (docs/decisions/2026-10-04-accept-snapshot-2026-10-04-3-on-credential-eval-alpha-4.md); the count is passed in, read from the data.
 */
export interface ReviewDisclosureProps {
  /** The label in each language, exactly as decided. */
  labels: { ko: string; en: string };
  /** How many fixtures carry it, already formatted, with what they are counted in. */
  count: string;
  /** The note that says what the label means, exactly as decided. */
  note: string;
  className?: string;
}

export interface PipelineStampProps {
  pipeline: 'legacy' | 'new';
  /** `authority` when the committed value names this pipeline; `oracle` when the page is built from the other one, kept for comparison. */
  role: 'authority' | 'oracle';
  title: string;
  text: string;
  facts: { term: string; value: string; code?: boolean }[];
  link?: { label: string; href: string };
  disclosure?: ReviewDisclosureProps;
  /** Optional scanners the view did not measure (#763): the page states it beside its numbers and points at the last measurement. */
  notMeasured?: NotMeasuredScanner[];
  className?: string;
}
