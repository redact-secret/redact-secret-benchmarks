import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { EvidenceTable } from './EvidenceTable';
import { columns, edgeRows, groupedRows, linkedRows, manyColumns, manyRows, pairRows } from './storyData';

const meta = {
  title: 'Evaluation/Methods/EvidenceTable',
  component: EvidenceTable,
  args: { columns, groups: pairRows, rowHeader: 'Check', caption: 'Checks that did not hold, per scanner' },
} satisfies Meta<typeof EvidenceTable>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** A count opens the checks behind it; a zero opens nothing, and a row that opens no list says why under its label (#623). */
export const Linked: Story = { args: { groups: linkedRows } };
export const Grouped: Story = { args: { groups: groupedRows, rowHeader: 'Transform' } };

/** A scanner that did not run is "Not measured", a check that waits for review says so, and a check a scanner does not report says "No check". */
export const NotRecorded: Story = { args: { groups: edgeRows } };
export const Empty: Story = { args: { groups: [{ label: '', rows: [] }] } };

/** More scanners than the page has today: the table scrolls in its own region. */
export const ManyScanners: Story = { args: { columns: manyColumns, groups: manyRows, rowHeader: 'Taxonomy' } };
export const Phone: Story = { args: { groups: groupedRows }, parameters: { viewport: { defaultViewport: 'mobile1' } } };
