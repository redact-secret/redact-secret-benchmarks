import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { KeyValueList } from './KeyValueList';

const meta = {
  title: 'Data/KeyValueList',
  component: KeyValueList,
  args: {
    items: [
      { term: 'Detector', description: 'github-token' },
      { term: 'Contract', description: 'T1, provider-documented' },
      { term: 'Fixtures', description: '14' },
      { term: 'Source', description: <a href="https://docs.github.com/">GitHub token formats</a> },
    ],
  },
} satisfies Meta<typeof KeyValueList>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Rows: Story = {};

export const Facts: Story = {
  args: {
    variant: 'facts',
    items: [
      { term: 'Providers', description: '92' },
      { term: 'Families', description: '173' },
      { term: 'Fixtures', description: '5,034' },
      { term: 'Release', description: '0.1.0-beta.11' },
    ],
  },
};

export const Empty: Story = { args: { items: [] } };

export const LongValues: Story = {
  args: {
    items: [
      { term: 'Note', description: 'redact-secret#671 (product PR #679) split the legacy bare-hex generation into datadog:application-key-legacy; this family keeps the ddapp_ shape only.' },
      { term: 'Family', description: 'hashicorp-terraform:organization-token-with-a-very-long-identifier-that-cannot-break' },
    ],
  },
};
