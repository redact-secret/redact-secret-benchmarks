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

/** Fixtures behind the numbers carry the maintainer-reviewed label. */
export const WithReviewDisclosure: Story = { args: { disclosure: reviewDisclosure } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
