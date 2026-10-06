import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QualificationOverview } from './QualificationOverview';
import { overview, reviewDisclosure } from './storyData';

const meta = {
  title: 'Evaluation/Qualification/QualificationOverview',
  component: QualificationOverview,
  parameters: { layout: 'fullscreen' },
  args: overview,
} satisfies Meta<typeof QualificationOverview>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Every status, the three populations side by side, the scanners and one family with a recorded hold. */
export const Default: Story = {};

/** The configuration ran its methods: no methods note, and the population row names them. */
export const MethodsRun: Story = {
  args: {
    summary: { ...overview.summary, methodsNote: null },
    populations: { ...overview.populations, rows: overview.populations.rows.map(r => ({ ...r, methods: 'metamorphic, mutation, differential' })) },
  },
};

/** No family, no scanner and no known-gap record: each table says so instead of showing zeros. */
export const Empty: Story = {
  args: {
    populations: { ...overview.populations, rows: [] },
    scanners: { ...overview.scanners, rows: [] },
    families: { ...overview.families, rows: [], undetected: { ...overview.families.undetected, items: [] } },
    gaps: { ...overview.gaps, rows: [] },
  },
};

/**
 * An optional scanner this run did not measure (#763): the contract's sentence, why, and the pointer to its last measurement (run, engine, configuration, date).
 * No table row, no count and no zero stands in for it.
 */
export const OptionalScannerNotMeasured: Story = {
  args: {
    scanners: {
      ...overview.scanners,
      notMeasured: [{
        key: 'beta-scan-default',
        statement: 'Beta Scan default: not measured in this run (optional)',
        reason: 'The default profile is a slow, manual measurement and never blocks other scanners or core verification. Its earlier results stay as history with their run identity.',
        lastMeasurement: 'Last measurement: run-a@linux-x64 (configuration sha256:0123456789ab) · engine 0.0.1 · recorded 2026-01-01. It stays labelled with that run identity and is never combined with another profile or another run.',
      }],
    },
  },
};

/** No earlier measurement is recorded: the note says so instead of pointing at nothing. */
export const OptionalScannerNeverMeasured: Story = {
  args: {
    scanners: {
      ...overview.scanners,
      notMeasured: [{ key: 'beta-scan-default', statement: 'Beta Scan default: not measured in this run (optional)', reason: 'The default profile is a manual measurement.', lastMeasurement: 'No earlier measurement of it is recorded. Nothing is shown in its place.' }],
    },
  },
};

/**
 * Two profiles of one scanner (#764), labelled separately: what each detects, its configuration identity, and the disclosure that results differ by configuration.
 * The profile has never had an official measurement, so it says so and points at its decision; no number stands in for it. Synthetic names and values.
 */
export const ProfilesOfOneScanner: Story = {
  args: {
    scanners: {
      ...overview.scanners,
      profiles: {
        title: 'Profiles of one scanner',
        description: 'The same package runs under two configurations. Each is its own scanner with its own results and history; they are never added together or spliced.',
        rows: [
          { key: 'beta-scan', label: 'Beta Scan default (all patterns)', scanner: 'beta-scan', detects: 'Every built-in pattern: credentials and also personal data.', identity: 'Every built-in pattern; its history is labelled with each run, engine, configuration and date', status: 'Not measured in this view' },
          { key: 'beta-scan-credentials', label: 'Beta Scan credential profile (3 types)', scanner: 'beta-scan-credentials', detects: 'Only the 3 credential-bearing pattern types.', identity: 'beta-scan-credentials adapter 1 · beta-scan 1.0.0 · 3 types · configuration sha256:0123456789ab', status: 'Not measured in this view' },
        ],
        disclosure: 'Both are Beta Scan under different configurations. The profile scans less, so its results differ by configuration: it is not a more accurate Beta Scan, and no accuracy claim is made for either profile.',
      },
      notMeasured: [
        { key: 'beta-scan', statement: 'Beta Scan default (all patterns): not measured in this run (optional)', reason: 'A slow, manual measurement.', lastMeasurement: 'Last measurement: run-a@linux-x64 (configuration sha256:0123456789ab) · engine 0.0.1 · recorded 2026-01-01.' },
        { key: 'beta-scan-credentials', statement: 'Beta Scan credential profile (3 types): not measured in an official run (local exploratory diagnostics only: see ADR)', reason: 'No pinned engine configuration measures it yet.', lastMeasurement: 'No earlier measurement of it is recorded. Nothing is shown in its place.', officialMeasurement: 'Official measurement: pending: requires owner approval.' },
      ],
    },
  },
};

/** Fixtures behind the numbers carry the maintainer-reviewed label. */
export const WithReviewDisclosure: Story = { args: { disclosure: reviewDisclosure } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
