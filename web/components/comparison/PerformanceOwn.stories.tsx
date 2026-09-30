import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PerformanceOwn } from './PerformanceOwn';
import { own } from './performance-fixtures';

const meta = {
  title: 'Comparison/PerformanceOwn',
  component: PerformanceOwn,
  args: own,
} satisfies Meta<typeof PerformanceOwn>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** The accepted run is not committed, or failed its check: a stated "Not measured yet", no rows. */
export const NotMeasuredYet: Story = { args: { rows: [], source: '', empty: 'evidence/…/summary.json is absent: the accepted run’s summary has not been committed.' } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
