import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Breadcrumb } from './Breadcrumb';
import { PageHead } from './PageHead';

const meta = {
  title: 'Page/PageHead',
  component: PageHead,
  args: { title: 'What the benchmark shows' },
} satisfies Meta<typeof PageHead>;
export default meta;

type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {};

export const Full: Story = {
  args: {
    eyebrow: 'redact-secret 0.1.0-beta.11',
    lede: 'Synthetic inputs, the same for every scanner, scored span by span. Start from a provider, a family or a detector, or see what changed.',
    meta: [{ label: 'Run', value: '2026-09-30' }, { label: 'Accounting', value: 'v1.1' }],
    actions: <a href="/how-to-read">How to read these numbers</a>,
  },
};

export const WithBreadcrumb: Story = {
  args: {
    before: <Breadcrumb items={[{ label: 'Comparison', href: '/comparison' }, { label: 'Feature' }]} />,
    eyebrow: 'Comparison · Features',
    title: 'What can each one do?',
  },
};

export const LongTitle: Story = {
  args: {
    title: 'hashicorp-terraform:organization-token-with-an-unusually-long-identifier-that-cannot-break-anywhere-sensible',
    lede: 'A long unbroken title must wrap inside the column, not push the page sideways.',
  },
};
