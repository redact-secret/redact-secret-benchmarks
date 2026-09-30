import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FamilyTable } from './FamilyTable';
import { families, manyFamilies } from './storyData';

const meta = {
  title: 'Report/FamilyTable',
  component: FamilyTable,
  args: { families, caption: 'Families' },
} satisfies Meta<typeof FamilyTable>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoMatch: Story = { args: { families: [] } };

export const ManyRows: Story = { args: { families: manyFamilies } };

/** Below the phone breakpoint each row becomes a labelled block; no sideways scroll. */
export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
