import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FamilyAbout } from './FamilyAbout';
import { familyAbout } from './storyData';

const meta = {
  title: 'Report/FamilyAbout',
  component: FamilyAbout,
  args: familyAbout,
} satisfies Meta<typeof FamilyAbout>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DescriptionOnly: Story = { args: { note: undefined, sources: undefined } };

export const ManySources: Story = {
  args: {
    sources: [
      { href: 'https://vercel.com/changelog/new-token-formats-and-secret-scanning', host: 'vercel.com' },
      { href: 'https://vercel.com/docs/accounts/access-tokens', host: 'vercel.com' },
      { href: 'https://github.com/vercel/vercel/blob/main/packages/cli/test/unit/commands/ai-gateway/coding-agents-setup.test.ts', host: 'github.com' },
    ],
  },
};

export const LongNote: Story = {
  args: { note: `${familyAbout.note} ${familyAbout.note} ${familyAbout.note}` },
};
