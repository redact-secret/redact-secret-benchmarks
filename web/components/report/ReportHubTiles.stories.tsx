import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ReportHubTiles } from './ReportHubTiles';
import { hubTiles } from './storyData';

const meta = {
  title: 'Report/ReportHubTiles',
  component: ReportHubTiles,
  args: { tiles: hubTiles, label: 'Report sections' },
} satisfies Meta<typeof ReportHubTiles>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TwoTiles: Story = { args: { tiles: hubTiles.slice(0, 2) } };

export const LongContent: Story = {
  args: {
    tiles: [
      { ...hubTiles[0], figure: '1,234,567', text: 'with fixtures in this corpus, described at unreasonable length so the tile has to wrap onto several lines without breaking the row.' },
      { ...hubTiles[1], label: 'Credential families and their evidence', action: 'Every credential family in one list →' },
      hubTiles[2],
      hubTiles[3],
    ],
  },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
