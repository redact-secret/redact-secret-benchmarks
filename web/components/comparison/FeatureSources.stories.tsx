import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FeatureSources } from './FeatureSources';
import { featureSources } from './fixtures';

const meta = {
  title: 'Comparison/FeatureSources',
  component: FeatureSources,
  args: { title: 'Where this comes from', sources: featureSources },
} satisfies Meta<typeof FeatureSources>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { sources: [] } };
export const WithLinks: Story = {
  args: {
    sources: [
      { name: 'flare-redact', detail: '1.6.1: the README shipped in the npm package.', links: [{ label: 'README', href: 'https://example.invalid/README.md' }, { label: 'package.json', href: 'https://example.invalid/package.json' }] },
    ],
  },
};
export const LongContent: Story = { args: { sources: [{ name: 'a-source', detail: `${'a very long description of where a claim was read '.repeat(6)}https://example.invalid/${'path/'.repeat(20)}` }] } };
