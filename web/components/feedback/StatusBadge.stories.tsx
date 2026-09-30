import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StatusBadge } from './StatusBadge';
import type { Status } from './StatusBadge';

const ALL: Array<[Status, string]> = [
  ['pass', 'Verified'],
  ['fail', 'Failed'],
  ['unstable', 'Unstable'],
  ['review', 'In review'],
  ['withheld', 'Few samples'],
  ['info', 'Provider-documented'],
  ['not-measured', 'Not measured'],
  ['none', 'No validator'],
];

const meta = {
  title: 'Feedback/StatusBadge',
  component: StatusBadge,
  args: { status: 'pass', children: 'Verified' },
} satisfies Meta<typeof StatusBadge>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Pass: Story = {};
export const Fail: Story = { args: { status: 'fail', children: 'Failed' } };
export const Unstable: Story = { args: { status: 'unstable', children: 'Unstable' } };
export const Review: Story = { args: { status: 'review', children: 'In review' } };
export const Withheld: Story = { args: { status: 'withheld', children: 'Few samples' } };
export const Info: Story = { args: { status: 'info', children: 'Provider-documented' } };
export const NotMeasured: Story = { args: { status: 'not-measured', children: 'Not measured' } };
export const None: Story = { args: { status: 'none', children: 'No validator' } };

export const AllStatuses: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
      {ALL.map(([status, label]) => <StatusBadge key={status} status={status}>{label}</StatusBadge>)}
    </div>
  ),
};

export const LongWord: Story = { args: { children: 'Left a secret readable on provider-documented inputs' } };
