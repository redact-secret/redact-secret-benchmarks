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
export const LongContent: Story = { args: { sources: [{ name: 'a-source', detail: `${'a very long description of where a claim was read '.repeat(6)}https://example.invalid/${'path/'.repeat(20)}` }] } };
