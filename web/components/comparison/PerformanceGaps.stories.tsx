import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PerformanceGaps } from './PerformanceGaps';
import { missingGroups } from './performance-fixtures';

const meta = {
  title: 'Comparison/PerformanceGaps',
  component: PerformanceGaps,
  args: {
    title: 'Not measured for this pair',
    description: 'Questions a pair page can answer once a run times both libraries on them. Each is a dashed “Not measured”, never a zero.',
    groups: missingGroups,
  },
} satisfies Meta<typeof PerformanceGaps>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LinkedSeparateEvidence: Story = { args: { groups: [{ ...missingGroups[0], links: [{ label: 'Separate accepted own profiles and provenance', href: 'https://github.com/redact-secret/redact-secret-benchmarks/blob/develop/benchmarks/inputs/performance/current.json' }] }] } };
export const Empty: Story = { args: { groups: [] } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
