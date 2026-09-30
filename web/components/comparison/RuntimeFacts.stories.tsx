import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RuntimeFacts } from './RuntimeFacts';
import { externalFactColumns, externalFacts, factNotes, internalFactColumns, internalFacts, runMeta } from './fixtures';

const meta = {
  title: 'Comparison/RuntimeFacts',
  component: RuntimeFacts,
  args: { title: 'About the libraries', columns: externalFactColumns, rows: externalFacts, run: runMeta, notes: factNotes },
} satisfies Meta<typeof RuntimeFacts>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Libraries: Story = {};
export const Settings: Story = { args: { title: 'About the settings', columns: internalFactColumns, rows: internalFacts } };
export const Empty: Story = { args: { rows: [], run: undefined, notes: undefined } };
export const LongContent: Story = {
  args: { rows: [{ label: 'Runs in', cells: { rs: { text: 'x'.repeat(160), note: 'y'.repeat(160) }, fr: null, or: { text: 'unbrokenstring'.repeat(10), chip: 'a-long-chip-label-that-truncates-inside-its-cell' } } }] },
};
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
