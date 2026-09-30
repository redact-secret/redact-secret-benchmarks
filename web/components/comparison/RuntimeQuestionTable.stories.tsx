import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RuntimeQuestionTable } from './RuntimeQuestionTable';
import { credentialQuestions, externalColumns, internalColumns, missingMeasurements, olderSnapshot, piiQuestions, wideColumns, wideQuestion } from './fixtures';

const meta = {
  title: 'Comparison/RuntimeQuestionTable',
  component: RuntimeQuestionTable,
  args: { question: piiQuestions[0], columns: externalColumns, columnKind: 'library' },
} satisfies Meta<typeof RuntimeQuestionTable>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Question 1, external view: redact-secret with PII + US next to two peers. */
export const External: Story = {};
/** Internal view: redact-secret's own settings; Default reads "Switch off". */
export const Internal: Story = { args: { columns: internalColumns, columnKind: 'redact-secret setting' } };
export const SpeedOnly: Story = { args: { view: 'speed' } };
export const AccuracyOnly: Story = { args: { view: 'accuracy' } };
export const FakeValues: Story = { args: { question: piiQuestions[1] } };
export const Context: Story = { args: { question: piiQuestions[2] } };
/** A cell, a share and a time nobody measured read as dashed "Not measured", never as zero. */
export const MissingMeasurements: Story = { args: { question: missingMeasurements } };
/** An older snapshot recorded times but not outcomes. */
export const OutcomesNotRecorded: Story = { args: { question: olderSnapshot } };
/** No credential text has been timed across these libraries yet. */
export const NotMeasuredYet: Story = { args: { question: credentialQuestions[0] } };
/** Worst case: six columns with long names; the table scrolls inside its own region. */
export const ManyColumns: Story = { args: { question: wideQuestion, columns: wideColumns } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
