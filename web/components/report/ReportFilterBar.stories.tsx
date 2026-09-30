import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ReportFilterBar } from './ReportFilterBar';
import type { ReportShow } from './types';

const meta = {
  title: 'Report/ReportFilterBar',
  component: ReportFilterBar,
  args: { label: 'Filter providers', query: '', show: 'all', resultText: '12 providers · 31 families', onQueryChange: () => {}, onShowChange: () => {} },
  render: args => {
    const [query, setQuery] = useState(args.query);
    const [show, setShow] = useState<ReportShow>(args.show);
    return <ReportFilterBar {...args} query={query} onQueryChange={setQuery} show={show} onShowChange={setShow} />;
  },
} satisfies Meta<typeof ReportFilterBar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Searching: Story = { args: { query: 'stripe', resultText: '1 provider · 5 families' } };

export const NoResults: Story = { args: { query: 'zzzz', show: 'empty', resultText: '0 providers · 0 families' } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
