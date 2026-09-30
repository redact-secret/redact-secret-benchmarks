import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SegmentedNav } from './SegmentedNav';

const levels = [
  { label: 'Provider-documented', shortLabel: 'Provider', href: '/report' },
  { label: 'Tool-corroborated', shortLabel: 'Tool', href: '/report?level=T2' },
  { label: 'Project policy', shortLabel: 'Policy', href: '/report?level=T3' },
];

const meta = {
  title: 'Nav/SegmentedNav',
  component: SegmentedNav,
  args: { items: levels, currentHref: '/report', label: 'Evidence level' },
} satisfies Meta<typeof SegmentedNav>;
export default meta;

type Story = StoryObj<typeof meta>;

export const FirstCurrent: Story = {};
export const MiddleCurrent: Story = { args: { currentHref: '/report?level=T2' } };
export const NothingCurrent: Story = { args: { currentHref: '/elsewhere' } };
export const TwoSegments: Story = {
  args: { items: [{ label: 'Credentials', href: '?domain=credentials' }, { label: 'PII', href: '?domain=pii' }], currentHref: '?domain=pii', label: 'Kind of data' },
};
export const ManySegmentsScrollInside: Story = {
  args: { items: Array.from({ length: 14 }, (_, i) => ({ label: `Segment number ${i + 1}`, href: `/s/${i}` })), currentHref: '/s/3' },
};
