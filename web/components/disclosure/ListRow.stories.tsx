import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StatusBadge } from '../feedback/StatusBadge';
import { ListRow, RowList } from './ListRow';

const meta = {
  title: 'Disclosure/ListRow',
  component: RowList,
  args: {
    label: 'What changed',
    children: (
      <>
        <ListRow leading={<StatusBadge status="pass">Verified</StatusBadge>} trailing="2026-09-28">
          <a href="#949">#949 · generic-token warns on provider-prefixed placeholders</a>
          <small>Flagged a safe value · 3 fixtures</small>
        </ListRow>
        <ListRow leading={<StatusBadge status="withheld">Policy</StatusBadge>} trailing="2026-09-28">
          <a href="#936">#936 · Policy: keyword co-occurrence spans warn instead of redact</a>
          <small>Left a secret readable · 8 fixtures</small>
        </ListRow>
      </>
    ),
  },
} satisfies Meta<typeof RowList>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutLeading: Story = {
  args: {
    children: (
      <>
        <ListRow trailing="0.4 ms">Default settings</ListRow>
        <ListRow trailing="1.1 s">Full settings</ListRow>
      </>
    ),
  },
};

export const Empty: Story = { args: { children: null } };

export const LongContent: Story = {
  args: {
    children: (
      <ListRow leading={<StatusBadge status="fail">Failed</StatusBadge>} trailing="2026-09-28">
        <a href="#x">{'#933 · Context-gated legacy keys missed when the provider context is on the previous line '.repeat(3)}</a>
        <small>Left a secret readable · 3 fixtures</small>
      </ListRow>
    ),
  },
};
