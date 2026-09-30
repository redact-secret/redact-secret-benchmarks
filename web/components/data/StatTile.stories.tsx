import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StatusBadge } from '../feedback/StatusBadge';
import { IntervalBar } from './IntervalBar';
import { StatGrid, StatTile } from './StatTile';

const meta = {
  title: 'Data/StatTile',
  component: StatTile,
  args: { label: 'Does it miss real secrets?', value: '3.6%', qualifier: 'at most' },
} satisfies Meta<typeof StatTile>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Full: Story = {
  args: {
    href: '#rows',
    observation: <><b>26 of 1,065</b> secret spans leaked</>,
    definition: 'Leaked span rate. Lower is better. 95% pessimistic bound, corpus-relative.',
    children: <IntervalBar ariaLabel="Observed 2.4%. Published bound: at most 3.6%. Axis 0% to 5%." axisMin="0%" axisMax="5%" observed={0.4883} bound={0.7106} range={[0.4883, 0.7106]} />,
  },
};

export const WithStatus: Story = {
  args: {
    label: 'Does it flag safe values?',
    value: '27.8%',
    observation: <><b>0 of 10</b> controls flagged</>,
    status: <StatusBadge status="withheld">Few samples</StatusBadge>,
  },
};

export const Compact: Story = { args: { size: 'compact', label: 'Providers', value: '82', observation: <><b>81</b> with fixtures in this corpus.</> } };

export const NotMeasured: Story = {
  args: { label: 'Candidate stable count', value: 'Not measured', observation: 'No candidate build has been run against this ledger.' },
};

export const LongValue: Story = { args: { value: '0.000000000000000000000000000000000000001234567%' } };

export const Grid: Story = {
  render: () => (
    <StatGrid>
      <StatTile label="Does it miss real secrets?" qualifier="at most" value="3.6%" observation={<><b>26 of 1,065</b> secret spans leaked</>} definition="Lower is better." />
      <StatTile label="Does it flag safe values?" qualifier="at most" value="27.8%" observation={<><b>0 of 10</b> controls flagged</>} status={<StatusBadge status="withheld">Few samples</StatusBadge>} definition="Few controls keep the bound wide." />
      <StatTile label="Does it tell near-twins apart?" qualifier="at least" value="95.9%" observation={<><b>662 of 680</b> pairs discriminated</>} definition="Higher is better." />
    </StatGrid>
  ),
};
