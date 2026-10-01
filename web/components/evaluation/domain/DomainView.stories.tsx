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
