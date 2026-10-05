import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ScopeAccounting } from './ScopeAccounting';
import { scopeAccounting, scopeRows } from './storyData';

const meta = {
  title: 'Evaluation/Qualification/ScopeAccounting',
  component: ScopeAccounting,
  parameters: { layout: 'fullscreen' },
  args: scopeAccounting,
} satisfies Meta<typeof ScopeAccounting>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A default result, its credential profile, an older artifact with unknown coverage and a scanner with no reviewed table. */
export const Default: Story = {};

/** Only a legacy artifact: every count is "Unknown" in a dashed badge, never zero unmapped. */
export const LegacyOnly: Story = { args: { rows: scopeRows.filter(r => r.key === 'p/legacy'), profiles: { ...scopeAccounting.profiles, rows: [] } } };

/** A completed scanner that produced no finding: a measured zero, with its native-label coverage stated. */
export const ZeroFindings: Story = {
  args: { rows: [{ ...scopeRows[0], key: 'p/zero', coverage: '0 of 0 findings carry a native label', mapped: '0', credentialRelated: '0', outOfScope: '0', ambiguous: '0', unavailable: '0', unrecognized: '0', labels: [] }], profiles: { ...scopeAccounting.profiles, rows: [] } },
};

/** Many native types and a long label: the list scrolls inside its disclosure and says how many were left out. */
export const ManyNativeTypes: Story = {
  args: {
    rows: [{ ...scopeRows[0], key: 'p/many', labels: Array.from({ length: 12 }, (_, i) => ({ label: `A_VERY_LONG_SYNTHETIC_NATIVE_TYPE_NAME_NUMBER_${i}`, findings: `${100 - i} findings`, scope: 'personal data', reason: 'reviewed: not a credential' })), labelsMore: '563 more native types are not listed here.' }],
  },
};

export const NothingRecorded: Story = { args: { rows: [], profiles: { ...scopeAccounting.profiles, rows: [] } } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
