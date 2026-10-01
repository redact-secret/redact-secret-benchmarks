import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DomainMethod } from './DomainMethod';
import { method } from './storyData';

const meta = {
  title: 'Evaluation/DomainMethod',
  component: DomainMethod,
  args: method,
} satisfies Meta<typeof DomainMethod>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A long meaning wraps inside its cell. */
export const LongText: Story = {
  args: {
    vocabularies: [{ title: 'Example axis', rows: [{ word: 'a-very-long-outcome-word-that-never-breaks-on-its-own-anywhere', meaning: 'A meaning that goes on for a while so the row has to wrap onto several lines on a narrow screen without clipping.' }] }],
  },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
