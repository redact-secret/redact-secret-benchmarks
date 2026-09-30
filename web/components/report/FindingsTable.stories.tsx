import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FindingsTable } from './FindingsTable';
import { findingRows } from './fixtureStoryData';

const meta = {
  title: 'Report/FindingsTable',
  component: FindingsTable,
  args: { findings: findingRows, caption: 'Findings handed to the product' },
} satisfies Meta<typeof FindingsTable>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A fixture the corpus no longer holds is text, not a dead link. */
export const Default: Story = {};

export const Empty: Story = { args: { findings: [] } };

export const Many: Story = {
  args: { findings: Array.from({ length: 30 }, (_, i) => ({ ...findingRows[i % findingRows.length], id: `f-${i}`, number: `#${900 + i}` })) },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
