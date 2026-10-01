import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ScannerRoster } from './ScannerRoster';
import { rosterNotRecorded, rosterRows } from './storyData';

const meta = {
  title: 'Evaluation/Scanner/ScannerRoster',
  component: ScannerRoster,
  args: { title: 'The scanners', description: 'Every scanner this benchmark ran with, in the order the run lists them.', rows: rosterRows },
} satisfies Meta<typeof ScannerRoster>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No run is published: kind and mode are dashed "Not recorded"; the pinned version still shows. */
export const NotRecorded: Story = { args: { rows: rosterNotRecorded } };

export const Empty: Story = { args: { rows: [] } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
