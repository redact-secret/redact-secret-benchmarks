import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StatusBadge } from '../feedback/StatusBadge';
import { DataTable } from './DataTable';
import type { DataTableColumn } from './DataTable';

interface Scanner {
  name: string;
  version: string;
  kind: string;
  targeted: number;
  targetedOf: number;
  readable: number;
  note?: string;
}

const scanners: Scanner[] = [
  { name: 'Gitleaks', version: '8.30.1', kind: 'Repository scanner', targeted: 361, targetedOf: 1068, readable: 58, note: '78 of its 222 rules match a family here' },
  { name: 'TruffleHog', version: '3.97.4', kind: 'Repository scanner', targeted: 429, targetedOf: 1068, readable: 68, note: '76 of its 892 rules match a family here' },
  { name: 'flare-redact', version: '1.6.1', kind: 'Runtime library', targeted: 277, targetedOf: 1068, readable: 36 },
];

const columns: DataTableColumn<Scanner>[] = [
  { key: 'name', header: 'Scanner', rowHeader: true, cell: r => <><b>{r.name} {r.version}</b><small>{r.kind}</small></> },
  { key: 'targeted', header: 'Inputs its rules target', numeric: true, cell: r => <><b>{r.targeted}</b> of {r.targetedOf.toLocaleString('en-US')}{r.note && <small>{r.note}</small>}</> },
  { key: 'readable', header: 'Left readable', numeric: true, cell: r => <><b>{r.readable}</b> of {r.targeted} spans</> },
  { key: 'status', header: 'Samples', cell: r => (r.targeted < 300 ? <StatusBadge status="withheld">Few samples</StatusBadge> : 'Enough') },
];

const meta = {
  title: 'Data/DataTable',
  component: DataTable<Scanner>,
  args: { columns, rows: scanners, getRowKey: r => r.name, caption: 'Other scanners on the same inputs' },
} satisfies Meta<typeof DataTable<Scanner>>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const VisibleCaption: Story = { args: { showCaption: true } };
export const Wide: Story = { args: { wide: true } };
export const Empty: Story = { args: { rows: [], empty: 'No scanners recorded for this run.' } };
export const EmptyDefaultText: Story = { args: { rows: [] } };
const phone = { viewport: { defaultViewport: 'mobile1' } };

// Hard case: a table on a phone. Two ways to read it, both without squeezed cells.
// Stacked (the default) gives each row a labelled block; scrolling keeps the
// columns side by side at their natural width inside the table's own region.
export const StackedOnPhone: Story = { parameters: { ...phone } };
export const ScrollingOnPhone: Story = { args: { stackOnPhone: false }, parameters: { ...phone } };
export const WideStackedOnPhone: Story = { args: { wide: true }, parameters: { ...phone } };
export const NarrowPhoneLongContent: Story = {
  args: {
    rows: [{ ...scanners[0], name: 'Repository-history-scanner-with-a-long-hyphenated-name 8.30.1', note: 'a-long-unbroken-token-'.repeat(8) }],
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const LongContent: Story = {
  args: {
    rows: [{ ...scanners[0], name: 'A-scanner-with-an-extremely-long-name-that-must-wrap-inside-its-cell-without-pushing-the-page', note: 'x'.repeat(200) }],
  },
};

export const ManyRows: Story = {
  args: { rows: Array.from({ length: 60 }, (_, i) => ({ ...scanners[i % 3], name: `${scanners[i % 3].name} #${i + 1}` })) },
};

interface Feature { group: string; feature: string; a: string; b: string }
const features: Feature[] = [
  { group: 'WHERE IT RUNS', feature: 'Node.js', a: 'Native add-on, WebAssembly fallback', b: 'Node 20+' },
  { group: 'WHERE IT RUNS', feature: 'Web browser', a: 'WebAssembly build', b: 'Not listed' },
  { group: 'SAFETY', feature: 'Results never repeat the secret', a: 'Findings carry position and type only', b: 'Result includes the original text' },
];

export const Grouped: StoryObj<typeof DataTable<Feature>> = {
  render: () => (
    <DataTable<Feature>
      caption="What each library says it can do"
      getRowKey={r => `${r.group}-${r.feature}`}
      stackOnPhone
      columns={[
        { key: 'feature', header: 'Feature', rowHeader: true, cell: r => r.feature },
        { key: 'a', header: 'Library A', cell: r => r.a },
        { key: 'b', header: 'Library B', cell: r => r.b },
      ]}
      groups={['WHERE IT RUNS', 'SAFETY'].map(label => ({ label, rows: features.filter(f => f.group === label) }))}
    />
  ),
};
