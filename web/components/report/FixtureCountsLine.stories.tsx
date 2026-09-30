import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FixtureCountsLine } from './FixtureCountsLine';

const meta = {
  title: 'Report/FixtureCountsLine',
  component: FixtureCountsLine,
  args: { counts: { leftReadable: '2', tooMuch: '0', falseAlarms: '1' } },
} satisfies Meta<typeof FixtureCountsLine>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllZero: Story = { args: { counts: { leftReadable: '0', tooMuch: '0', falseAlarms: '0' } } };

export const WithNotMeasured: Story = { args: { counts: { leftReadable: '2', tooMuch: '0', falseAlarms: '0', notMeasured: '3' } } };

/** No fixtures is not zero: it is dashed and says so. */
export const NoFixtures: Story = { args: { counts: null } };

export const LargeCounts: Story = { args: { counts: { leftReadable: '1,234', tooMuch: '12,345', falseAlarms: '123,456', notMeasured: '1,234,567' } } };
