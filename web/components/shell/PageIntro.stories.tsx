import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PageIntro } from './PageIntro';

const meta = {
  title: 'Shell/PageIntro',
  component: PageIntro,
  args: {
    eyebrow: 'Report',
    title: 'Providers',
    lede: 'Every provider in the taxonomy and what the ledger records for it.',
  },
} satisfies Meta<typeof PageIntro>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Plain: Story = {};

export const WithFactsAndSource: Story = {
  args: {
    facts: [
      { label: 'Providers', value: '92' },
      { label: 'Families', value: '173' },
      { label: 'Release', value: '0.1.0-beta.11' },
    ],
    source: 'Published mode: @redact-secret/core 0.1.0-beta.11, read from the ledger at build time.',
  },
};

export const Placeholder: Story = {
  args: { placeholder: 'Placeholder. The page blocks arrive with the Storybook block issues.' },
};
