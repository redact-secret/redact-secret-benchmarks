import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DetectorList } from './DetectorList';
import { detectorRows } from './fixtureStoryData';

const meta = {
  title: 'Report/DetectorList',
  component: DetectorList,
  args: { detectors: detectorRows, caption: 'Detectors by fixture count' },
} satisfies Meta<typeof DetectorList>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The line on each bar is the minimum sample size; a detector at or below it says so in words. */
export const Default: Story = {};

export const Empty: Story = { args: { detectors: [] } };

export const Many: Story = {
  args: { detectors: Array.from({ length: 30 }, (_, i) => ({ ...detectorRows[i % detectorRows.length], id: `detector-${i}`, href: `#detector-${i}` })) },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
