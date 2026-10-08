import type { PipelineStampProps } from '../../qualification/types';
/**
 * The data the evaluation-domain blocks take (#611). Every value is already formatted text: a block never derives
 * a count, rate or status from another prop. `resolvers/domains.ts` reads the ledger and hands the result over, one
 * shape for both domains, so `/evaluation/pii/` and `/evaluation/credential/` read as a pair.
 */
import type { Status } from '../../feedback';

/** One of the three facts under the head. A value that is not recorded is `null` and shows the dashed "Not recorded". */
export interface GlanceItem {
  label: string;
  value: string | null;
  /** What the value covers and the mode it came from. */
  detail: string;
}

export interface MethodStep { title: string; text: string }

/** A word an outcome or a level can take, and what it means. */
export interface VocabularyRow { word: string; meaning: string }
export interface Vocabulary { title: string; rows: VocabularyRow[] }

export interface DefinitionRow { term: string; text: string }

/** One metric as the profile defines it: its own population, what is counted, and which direction is better. */
export interface MetricRow { id: string; population: string; counts: string; better: string }
export interface MetricDefinitions { summary: string; text: string; rows: MetricRow[] }

export interface DomainMethodData {
  title: string;
  steps: MethodStep[];
  vocabularies: Vocabulary[];
  /** Who decides the expected answer. */
  oracle: DefinitionRow[];
  /** The methods that build cases. */
  methods: DefinitionRow[];
  /** The metrics, defined and never valued here: each has its own population, so there is no total row. */
  metrics: MetricDefinitions;
  /** "Recorded, not graded": what it means for this domain. */
  recorded: { title: string; text: string };
}

/** A table cell: the figure, and a second line that says what it is made of. A `null` figure is "Not recorded" unless its explicit unavailable label states a recorded withheld value. */
export interface CoverageCell { figure: string | null; detail?: string; unavailableLabel?: 'Not measured' | 'Not applicable' | 'Withheld' }
export interface CoverageRow { id: string; label: string; detail?: string; cells: CoverageCell[] }
export interface CoverageTable { id: string; caption: string; rowHeader: string; columns: string[]; rows: CoverageRow[]; note?: string }
/** A table the ledger has no record for: a dashed box with the words, and the issue that owns it. */
export interface CoverageNotRecorded { id: string; caption: string; text: string; issue?: { number: number; href: string } }

export interface DomainCoverageData {
  title: string;
  /** Which record the counts are from, and the mode. */
  mode: string;
  tables: (CoverageTable | CoverageNotRecorded)[];
  columnKey: DefinitionRow[];
  scope: DefinitionRow[];
}

export interface StatusLink { label: string; href: string; external?: boolean }
export interface StatusRowData {
  id: string;
  /** A stable address for this recorded family/view, independent of its values. */
  anchor?: string;
  label: string;
  status: Status;
  /** The status word. */
  statusWord: string;
  /** The recorded value ("5 provisional, 1 pending"). Absent for a not-measured row. */
  value?: string;
  detail: string;
  link?: StatusLink;
}
export interface StatusGroup { title: string; rows: StatusRowData[]; navigation?: StatusLink[] }
export interface DomainStatusData {
  title: string;
  groups: StatusGroup[];
  links: StatusLink[];
}

export interface SourceLink { label: string; path: string; href: string }
export interface DomainReadingData {
  title: string;
  items: DefinitionRow[];
  sources: SourceLink[];
}

export interface DomainHeadData {
  domain: 'pii' | 'credential';
  eyebrow: string;
  title: string;
  lede: string;
  meta: { label: string; value: string }[];
  /** The pair switch: both domains, in a fixed order. */
  pair: { label: string; href: string }[];
  currentHref: string;
  /** Names the pair switch for assistive technology. */
  pairLabel: string;
  breadcrumb: { label: string; href?: string }[];
}

export interface DomainViewData {
  head: DomainHeadData;
  /** Which pipeline produced the credential numbers (#608). Only the credential page has one: the PII domain has a single pipeline. */
  pipeline?: PipelineStampProps;
  glance: GlanceItem[];
  method: DomainMethodData;
  coverage: DomainCoverageData;
  status: DomainStatusData;
  reading: DomainReadingData;
}
