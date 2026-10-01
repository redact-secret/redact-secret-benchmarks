import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FixtureTwins } from './FixtureTwins';
import { original, twin, twinFlagged } from './fixturePageData';

const meta = {
  title: 'Report/FixtureTwins',
  component: FixtureTwins,
  args: { items: [twin] },
} satisfies Meta<typeof FixtureTwins>;
export default meta;

type Story = StoryObj<typeof meta>;

export const OneTwin: Story = {};

/** Two twins, one where the product recorded a finding: each has its own file, outcome and link. */
export const TwoTwins: Story = { args: { items: [twin, twinFlagged] } };

/** On a twin's own page the related file is the original it was made from. */
export const TheOriginal: Story = { args: { items: [original] } };

export const LongDescription: Story = {
  args: { items: [{ ...twin, description: `${twin.description}; ${'a long note about what exactly was changed, written by the corpus author, '.repeat(4)}` }] },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
