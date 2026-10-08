import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DomainView } from './DomainView';
import { view, viewLong, viewNotRecorded } from './storyData';

const meta = {
  title: 'Evaluation/DomainView',
  component: DomainView,
  args: view,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DomainView>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The record is missing: dashed states, each with the issue that owns it. */
export const NotRecorded: Story = { args: viewNotRecorded };

/** Worst case: a long title, many rows, an unbroken string. */
export const Long: Story = { args: viewLong };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };

/** The independent population has no recorded measurement yet, never placeholder counts. */
export const IndependentEvidence: Story = { args: {
  ...viewNotRecorded,
  head: { ...viewNotRecorded.head, eyebrow: 'Evaluation · Independent public population', title: 'PII evidence as its own population',
    lede: 'This synthetic story has no measurement record. Its population remains separate from the benchmark-owned views.',
    currentHref: '/evaluation/pii/evidence/', pairLabel: 'PII population source',
    pair: [{ label: 'Benchmark-owned PII', href: '/evaluation/pii/' }, { label: 'Independent evidence', href: '/evaluation/pii/evidence/' }], },
  glance: [
    { label: 'Public variants', value: null, detail: 'No verified record.' },
    { label: 'Source and import', value: null, detail: 'Different grains, never pooled.' },
    { label: 'Without a located range', value: null, detail: 'Not recorded.' },
  ],
  coverage: { title: 'Recorded public evidence', mode: 'Not recorded', tables: [{ id: 'independent-unavailable', caption: 'Independent evidence population', text: 'No verified comparison is present.' }], columnKey: [], scope: [] },
  status: { title: 'Where this population stands', groups: [{ title: 'Measurement record', rows: [{ id: 'independent-record', label: 'Independent public population', status: 'not-measured', statusWord: 'Not recorded', detail: 'No measurement or qualification is implied.' }] }], links: [] },
} };

/** Synthetic paired cells demonstrate measured and withheld states without ledger data. */
export const IndependentEvidenceRecorded: Story = { args: {
  ...IndependentEvidence.args,
  glance: [
    { label: 'Public variants', value: '3', detail: 'Synthetic story population only.' },
    { label: 'Authored source and import', value: '2 source cases / 3 imported cases', detail: 'Different grains, never pooled.' },
    { label: 'Without a located range', value: '1', detail: 'Synthetic unresolved range.' },
  ],
  coverage: { title: 'Recorded public evidence', mode: 'Exploratory synthetic story only',
    tables: [{ id: 'story-independent-metrics', caption: 'Scanner-neutral metrics for this population only', rowHeader: 'Metric', columns: ['Published baseline', 'Qualified candidate'], rows: [
      { id: 'example-measured', label: 'Example metric', cells: [{ figure: '0.125', detail: 'Numerator 1 / measured 8; unresolved 1; not measured 0; not applicable 0.' }, { figure: '0.250', detail: 'Numerator 2 / measured 8; unresolved 1; not measured 0; not applicable 0.' }] },
      { id: 'example-withheld', label: 'Example withheld metric', cells: [{ figure: null, unavailableLabel: 'Not measured', detail: 'Not measured; withheld.' }, { figure: null, unavailableLabel: 'Not applicable', detail: 'Not applicable; zero denominator, not a zero measurement.' }] },
    ], note: 'Each denominator belongs only to this synthetic population.' }], columnKey: [], scope: [], },
  status: { title: 'Where this population stands', groups: [{ title: 'Measurement record', rows: [
    { id: 'story-independent-record', label: 'Independent public population', status: 'info', statusWord: 'Exploratory measurement', detail: 'Synthetic paired measurements only.' },
    { id: 'story-independent-qualification', label: 'Product qualification', status: 'not-measured', statusWord: 'Not qualified', detail: 'Public measurement grants no support status.' },
  ] }], links: [], },
} };
