import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FixtureWhy } from './FixtureWhy';
import { facts, fixtureDetail } from './fixturePageData';

const meta = {
  title: 'Report/FixtureWhy',
  component: FixtureWhy,
  args: { facts, sources: fixtureDetail.sources, command: fixtureDetail.command, escaped: fixtureDetail.escaped, actions: fixtureDetail.actions },
} satisfies Meta<typeof FixtureWhy>;
export default meta;

type Story = StoryObj<typeof meta>;

/** "What it tests" is not in the corpus, so it says so, dashed, with the label the corpus does record. */
export const Default: Story = {};

/** Nothing recorded for the reason or the sources. */
export const NothingRecorded: Story = {
  args: {
    facts: [{ term: 'What it tests', notRecorded: true }, { term: 'Why it must stay quiet', notRecorded: true }, { term: 'Family', value: 'None', note: 'No family relationship is recorded for this fixture.' }],
    sources: [],
  },
};

/** The bytes cannot be encoded as UTF-8 (a lone surrogate): the button says why it is off. */
export const CannotDownload: Story = { args: { actions: { corpusHref: '/report/fixtures/example-suite/' } } };

export const LongValues: Story = {
  args: {
    facts: [
      { term: 'Why it must be redacted', value: 'A very long reason, written by the corpus author, that keeps going without a natural break. '.repeat(6) },
      { term: 'File', value: 'cases/a-fixture-with-an-extremely-long-path-and-an-unbroken-name-0123456789-0123456789.env', mono: true, note: '5 bytes · sha256 1e024712fd4e…' },
      { term: 'Families', links: Array.from({ length: 6 }, (_, i) => ({ label: `A family with a rather long display name number ${i + 1}`, href: `/report/families/f-${i}/` })) },
    ],
    sources: Array.from({ length: 8 }, (_, i) => ({ href: `https://example.com/source/${i}`, label: `example.com/source/${i}` })),
  },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
