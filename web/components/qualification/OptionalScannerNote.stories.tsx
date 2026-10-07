import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { OptionalScannerNote } from './OptionalScannerNote';
import { optionalNotMeasured } from './storyData';

const meta = {
  title: 'Evaluation/Qualification/OptionalScannerNote',
  component: OptionalScannerNote,
  args: { scanners: optionalNotMeasured },
} satisfies Meta<typeof OptionalScannerNote>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The contract sentence, why, the last measurement with its run, engine, configuration and date, where its artifacts are kept and what scope accounting it carries. */
export const RetainedMeasurement: Story = {};

/** On a report page, beside the numbers: the sentence, the reason and the pointer. */
export const Compact: Story = { args: { variant: 'compact' } };

/** No earlier measurement is recorded: the note says so instead of pointing at nothing. */
export const NeverMeasured: Story = {
  args: { scanners: [{ key: 'beta-scan', statement: 'Beta Scan default: not measured in this run (optional)', reason: 'The default profile is a manual measurement.', lastMeasurement: 'No earlier measurement of it is recorded. Nothing is shown in its place.' }] },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
