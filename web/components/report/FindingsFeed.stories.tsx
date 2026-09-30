import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FindingsFeed } from './FindingsFeed';
import { findings, longFinding } from './storyData';

const meta = {
  title: 'Report/FindingsFeed',
  component: FindingsFeed,
  args: {
    title: 'What changed',
    description: 'Findings this benchmark handed to the product, newest first. Ledger snapshot 2026-09-25; not live issue status.',
    findings,
    allHref: '/coverage?show=inventory',
    allLabel: 'All 57 findings',
    id: 'news',
  },
} satisfies Meta<typeof FindingsFeed>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { findings: [] } };

export const WorstCase: Story = {
  args: { findings: [longFinding, ...findings, ...findings.map(f => ({ ...f, id: `${f.id}-b` })), ...findings.map(f => ({ ...f, id: `${f.id}-c` }))] },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
