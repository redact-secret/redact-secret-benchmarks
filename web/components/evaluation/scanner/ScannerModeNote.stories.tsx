import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ScannerModeNote } from './ScannerModeNote';
import { candidateNote, noRunNote, publishedNote } from './storyData';

const meta = {
  title: 'Evaluation/Scanner/ScannerModeNote',
  component: ScannerModeNote,
  args: publishedNote,
} satisfies Meta<typeof ScannerModeNote>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Published: Story = {};

/** A candidate run names the unreleased build it measured. */
export const Candidate: Story = { args: candidateNote };

export const NoRun: Story = { args: noRunNote };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
