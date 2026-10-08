import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FamilyResearchRecord } from './FamilyResearchRecord';
import { researchRecord, researchRecordAbsent, researchRecordSimple } from './storyData';

const meta = {
  title: 'Family/FamilyResearchRecord',
  component: FamilyResearchRecord,
  args: { name: 'Personal token', ...researchRecord },
} satisfies Meta<typeof FamilyResearchRecord>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A superseded revision stays listed beside the current one; two blocker parts; one ruling by its reference. */
export const Default: Story = {};

/** One revision and nothing blocking or ruled. */
export const SingleRevision: Story = { args: researchRecordSimple };

/** The release has no record of the family: every cell is "Not recorded", dashed, with the reason. */
export const NotRecorded: Story = { args: researchRecordAbsent };

/** Long rulings and blockers wrap inside the column. */
export const LongContent: Story = {
  args: {
    ...researchRecord,
    rulings: Array.from({ length: 4 }, (_, i) => ({ ref: `review-acme-personal-token-with-a-long-history-id#${i + 2}`, at: '2099-01-03', text: 'A ruling that goes on for a while, '.repeat(12) })),
  },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
