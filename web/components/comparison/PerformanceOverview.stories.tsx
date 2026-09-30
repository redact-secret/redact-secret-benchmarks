import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PerformanceOverview } from './PerformanceOverview';
import { overviewRows, ticks } from './performance-fixtures';

const meta = {
  title: 'Comparison/PerformanceOverview',
  component: PerformanceOverview,
  args: {
    title: 'Every text, one scale',
    note: 'Each mark is one text, at its usual time. The wider a row spreads, the more that library’s time depends on the text.',
    ticks,
    rows: [overviewRows.a, overviewRows.b],
  },
} satisfies Meta<typeof PerformanceOverview>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** One side has no times at all: its row says "Not measured" and draws no marks. */
export const OneSideNotMeasured: Story = { args: { rows: [overviewRows.a, { ...overviewRows.b, span: '', marks: [] }] } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
