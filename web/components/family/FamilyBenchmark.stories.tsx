import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FamilyBenchmark } from './FamilyBenchmark';
import { benchmark, benchmarkCandidate, benchmarkNoFixtures, benchmarkNoRun, benchmarkOneLevel } from './storyData';

const meta = {
  title: 'Family/FamilyBenchmark',
  component: FamilyBenchmark,
  args: benchmark,
} satisfies Meta<typeof FamilyBenchmark>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Published mode, three evidence levels, five scanners in run order. A scanner with no recorded row reads "—" and "Not measured". */
export const Default: Story = {};

/** Counts from an unreleased build say so in the section's own sentence. */
export const CandidateMode: Story = { args: benchmarkCandidate };

/** One evidence level: no per-level table, the sentence names the level. */
export const OneLevel: Story = { args: benchmarkOneLevel };

/** A family the corpus does not target: a dashed "Not measured" box, no zeros. */
export const NoFixtures: Story = { args: benchmarkNoFixtures };

/** No run is published: the fixtures are counted, every outcome is "—" and "Not measured". */
export const NoRun: Story = { args: benchmarkNoRun };

/** Thousands of fixtures and long scanner modes: the tables scroll inside their own region. */
export const ManyFixtures: Story = {
  args: {
    facts: [{ term: 'Fixtures', value: '1,309' }, { term: 'Left readable', value: '112' }, { term: 'Redacted too much', value: '48' }, { term: 'False alarms', value: '27' }],
    kinds: '1,309 fixtures: 700 expect a redaction, 601 must stay quiet, 8 record project policy.',
    scanners: benchmark.scanners.map(s => ({ ...s, fixtures: '1,309', detail: `${s.detail} · a long mode line that names the rule set, the directory scan and the version it ran`, leftReadable: s.leftReadable === '—' ? s.leftReadable : '1,024' })),
  },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
