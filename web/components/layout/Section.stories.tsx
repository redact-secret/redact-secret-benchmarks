import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Section } from './Section';

const meta = {
  title: 'Layout/Section',
  component: Section,
  args: { title: 'What changed', children: <p>Section content goes here.</p> },
} satisfies Meta<typeof Section>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithEyebrowDescriptionAndActions: Story = {
  args: {
    eyebrow: 'PROVIDER-DOCUMENTED',
    description: 'Findings this benchmark handed to the product, newest first. Ledger snapshot, not live issue status.',
    actions: <a href="/report">All findings</a>,
  },
};

export const SubSection: Story = { args: { headingLevel: 3, rule: 'hairline', title: 'Other scanners on the same inputs' } };

export const NoRule: Story = { args: { rule: 'none' } };

export const LongTitle: Story = {
  args: {
    title: 'A very long section title that should wrap onto several lines and stay balanced without breaking the layout of the actions beside it',
    actions: <a href="/report">Open</a>,
  },
};
