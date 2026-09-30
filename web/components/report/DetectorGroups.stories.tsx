import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DetectorGroups } from './DetectorGroups';
import { detectorGroups } from './fixtureStoryData';

const meta = {
  title: 'Report/DetectorGroups',
  component: DetectorGroups,
  args: { groups: detectorGroups, caption: 'Groups for one detector' },
} satisfies Meta<typeof DetectorGroups>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A group with a withheld figure shows the reason, never a number. Pending rows are shown but never scored. */
export const Default: Story = {};

export const OneGroup: Story = { args: { groups: detectorGroups.slice(0, 1) } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
