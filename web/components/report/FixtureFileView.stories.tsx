import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FixtureFileView } from './FixtureFileView';
import { inputFile, longLineFile, missedOutputFile, outputFile, partialOutputFile, unreadableFile, windowedFile } from './fixturePageData';

const meta = {
  title: 'Report/FixtureFileView',
  component: FixtureFileView,
  args: { file: inputFile },
} satisfies Meta<typeof FixtureFileView>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The input: the expected secret is a dashed frame on green, with the envelope underlined. */
export const Input: Story = {};

/** The output: the reported range is a solid bar and the bytes under it are not drawn or read out. */
export const Redacted: Story = { args: { file: outputFile } };

/** A range that covers part of a secret is hatched; the bytes it leaves are shown inside a dashed frame. */
export const PartlyExposed: Story = { args: { file: partialOutputFile } };

/** Nothing reported: the secret shows in a dashed frame. */
export const Missed: Story = { args: { file: missedOutputFile } };

/** A long file keeps the lines a mark touches and counts the rest. */
export const LongFileWindowed: Story = { args: { file: windowedFile } };

/** A BOM, zero-width and bidi characters, a NUL, a tab, a carriage return and a trailing space are drawn as symbols; the file says so. */
export const UnreadableBytes: Story = { args: { file: unreadableFile } };

/** An empty line shows an empty-set mark, not nothing. */
export const EmptyFile: Story = { args: { file: { ...inputFile, facts: '0 bytes · no line ending · UTF-8', note: undefined, rows: [{ number: 1, segments: [] }] } } };

/** Long lines and a long path scroll or wrap inside the block; the page never scrolls sideways. */
export const LongValues: Story = { args: { file: longLineFile } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
