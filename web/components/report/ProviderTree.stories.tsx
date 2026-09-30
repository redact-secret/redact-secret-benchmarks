import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ProviderTree } from './ProviderTree';
import { manyProviders, providers } from './storyData';

const meta = {
  title: 'Report/ProviderTree',
  component: ProviderTree,
  args: { providers, label: 'Providers and their families' },
} satisfies Meta<typeof ProviderTree>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Open while a search or filter is active. */
export const Expanded: Story = { args: { expanded: true } };

export const WithFootnote: Story = {
  args: { footnote: '14 fixtures are global or not tied to one family and left out of this tree. They stay in the rows on the report.' },
};

export const NoMatch: Story = { args: { providers: [], footnote: undefined } };

export const ManyProviders: Story = { args: { providers: manyProviders } };

export const Phone: Story = { args: { expanded: true }, globals: { viewport: { value: 'mobile1', isRotated: false } } };
