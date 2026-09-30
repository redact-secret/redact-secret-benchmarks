import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FixtureDetail } from './FixtureDetail';
import { fixtureDetail, fixtureDetailLong, fixtureDetailNoRun } from './fixtureStoryData';

const meta = {
  title: 'Report/FixtureDetail',
  component: FixtureDetail,
  args: { fixture: fixtureDetail },
} satisfies Meta<typeof FixtureDetail>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The run left this suite's report out: the expectation stands, no scanner has a lane. */
export const NoRun: Story = { args: { fixture: fixtureDetailNoRun } };

/** A long id and long lines do not stretch the page. */
export const LongContent: Story = { args: { fixture: fixtureDetailLong } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
