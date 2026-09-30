import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PerformancePair } from './PerformancePair';
import { first, group, method, missingGroups, overviewRows, own, picker, sides, ticks, worstGroup } from './performance-fixtures';

const meta = {
  title: 'Comparison/PerformancePair',
  component: PerformancePair,
  parameters: { layout: 'fullscreen' },
  args: {
    breadcrumb: [{ label: 'Comparison', href: '/comparison/' }, { label: 'Performance' }],
    eyebrow: 'Comparison · One pair at a time',
    title: 'How long does it take? It depends on the text.',
    lede: 'redact-secret and flare-redact ran the same texts in the same run. The time changes with the text, so every text is shown, on one shared scale. Times are recorded, not graded. Not a ranking.',
    related: { href: '/comparison/runtime/', label: 'All three libraries at once →' },
    picker,
    sides,
    first,
    measured: {
      ticks,
      overview: { title: 'Every text, one scale', note: 'Each mark is one text, at its usual time. The wider a row spreads, the more that library’s time depends on the text.', ticks, rows: [overviewRows.a, overviewRows.b] },
      groups: [group, worstGroup],
    },
    own,
    gaps: { title: 'Not measured for this pair', description: 'Questions a pair page can answer once a run times both libraries on them. Each is a dashed “Not measured”, never a zero.', groups: missingGroups },
    method,
  },
} satisfies Meta<typeof PerformancePair>;
export default meta;

type Story = StoryObj<typeof meta>;

/** `/comparison/performance/?with=flare-redact&setting=pii-global-us`. */
export const Default: Story = {};
/** A pair whose run has no shared measurement: a stated "Not measured yet", no chart, the rest of the page intact. */
export const NoSharedMeasurement: Story = {
  args: {
    measured: undefined,
    empty: { title: 'Not measured yet', text: 'OpenRedaction has no time in the PII + US run, so this pair has no shared measurement.' },
    own: { ...own, rows: [], source: '', empty: 'evidence/…/summary.json is absent: the accepted run’s summary has not been committed.' },
  },
};
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const PhoneNoSharedMeasurement: Story = { ...NoSharedMeasurement, parameters: { viewport: { defaultViewport: 'mobile1' } } };
