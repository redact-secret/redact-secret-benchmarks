import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Pager } from './Pager';

const meta = {
  title: 'Nav/Pager',
  component: Pager,
  args: { page: 2, pageCount: 5, total: 430, pageSize: 100, onPrevious: () => {}, onNext: () => {} },
} satisfies Meta<typeof Pager>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Middle: Story = {};
export const FirstPage: Story = { args: { page: 1 } };
export const LastPage: Story = { args: { page: 5, total: 430 } };
export const SinglePage: Story = { args: { page: 1, pageCount: 1, total: 12, pageSize: 100 } };
export const NoTotal: Story = { args: { total: undefined, pageSize: undefined } };
export const EmptyResult: Story = { args: { page: 1, pageCount: 0, total: 0, pageSize: 100 } };
export const AsLinks: Story = { args: { previousHref: '?page=1', nextHref: '?page=3', onPrevious: undefined, onNext: undefined } };
export const ThousandsFormatted: Story = { args: { page: 12, pageCount: 51, total: 5034, pageSize: 100, itemLabel: 'fixtures' } };

/** The parent owns the page number; local state here only demonstrates the buttons. */
export const Interactive: Story = {
  render: args => {
    const [page, setPage] = useState(1);
    return <Pager {...args} page={page} onPrevious={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />;
  },
};
