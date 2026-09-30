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

/** A list that narrows to one evidence level; the counts in the list follow the choice. */
export const WithLevel: Story = {
  args: {
    levels: {
      label: 'Evidence level', value: 'all', onChange: () => {},
      options: [
        { value: 'all', label: 'All levels' }, { value: 'T1', label: 'Provider-documented' },
        { value: 'T2', label: 'Tool-corroborated' }, { value: 'T3', label: 'Project policy' }, { value: 'T0', label: 'Pending review' },
      ],
    },
  },
  render: args => {
    const [query, setQuery] = useState(args.query);
    const [show, setShow] = useState<ReportShow>(args.show);
    const [level, setLevel] = useState('all');
    return <ReportFilterBar {...args} query={query} onQueryChange={setQuery} show={show} onShowChange={setShow} levels={{ ...args.levels!, value: level, onChange: setLevel }} />;
  },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
