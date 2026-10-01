import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FixtureText } from './FixtureText';

const meta = {
  title: 'Report/FixtureText',
  component: FixtureText,
  args: { text: 'key=value', withTitle: true },
} satisfies Meta<typeof FixtureText>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Plain: Story = {};

/** The file views draw only the spaces that end a line. */
export const TrailingSpaces: Story = { args: { text: 'value   ', spaces: 'trailing', trailingFrom: 5 } };

/** The lane view draws every space, so its glyphs line up under the bytes. */
export const EverySpace: Story = { args: { text: 'a b  c', spaces: 'all' } };

/** Characters nobody can see, each named for a pointer: hover or focus reads "zero-width space, U+200B". */
export const InvisibleCharacters: Story = {
  args: { text: 'tab\there\r\u0000\u007f\u00a0\u00ad\u200b\u200c\u200d\u200e\u202e\u2060\u2066\ufeff end' },
};

export const LongText: Story = { args: { text: `${'0123456789'.repeat(12)}\u200b${'abcdefghij'.repeat(6)}` } };
