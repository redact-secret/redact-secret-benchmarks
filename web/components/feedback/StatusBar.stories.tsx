import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StatusBadge } from './StatusBadge';
import { StatusBar } from './StatusBar';

const meta = {
  title: 'Feedback/StatusBar',
  component: StatusBar,
  args: {
    label: 'Ledger health',
    items: [
      { label: 'Ledger', value: 'Consistent', tone: 'success' },
      { label: 'Stable', value: '49 of 108 (published)' },
      { label: 'Gates', value: <><StatusBadge status="fail">Failed</StatusBadge>1 open</>, tone: 'danger', href: '/report' },
      { label: 'Candidate', value: 'Not measured', tone: 'not-measured' },
      { label: 'Run', value: '2026-09-30' },
    ],
  },
} satisfies Meta<typeof StatusBar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllNeutral: Story = {
  args: { items: [{ label: 'Run', value: '2026-09-30' }, { label: 'Corpus', value: '5,034 inputs' }, { label: 'Release', value: '0.1.0-beta.11' }] },
};

export const TwoCells: Story = { args: { items: [{ label: 'Warning', value: 'Pin drifted', tone: 'warning' }, { label: 'Run', value: '2026-09-30' }] } };

export const LongValues: Story = {
  args: {
    items: [
      { label: 'Ledger', value: 'A very long recorded value that has to wrap inside its cell without breaking the row' },
      { label: 'Source', value: 'benchmarks/known-gaps.json#product-404-with-a-long-anchor' },
    ],
  },
};
