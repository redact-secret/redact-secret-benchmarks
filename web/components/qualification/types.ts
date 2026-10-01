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
