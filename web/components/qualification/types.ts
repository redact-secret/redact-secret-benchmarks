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

export interface QualificationOverviewProps {
  breadcrumb: Crumb[];
  eyebrow: string;
  title: string;
  lede: string;
  meta: MetaItem[];
  boundary: { title: string; paragraphs: string[] };
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
  scanners: { title: string; description: string; rows: ScannerRow[] };
  families: { title: string; description: string; rows: FamilyRow[]; undetected: { title: string; text: string; items: string[] } };
  /** The cases no detector family claims, per population, on pages of their own. */
  unattributed: { title: string; description: string; href: string; label: string };
  gaps: { title: string; description: string; rows: GapRow[] };
}

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
