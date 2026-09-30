import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FixtureTable } from './FixtureTable';
import { familyFacts, fixtureRows, manyFixtureRows } from './storyData';

const meta = {
  title: 'Report/FixtureTable',
  component: FixtureTable,
  args: {
    familyName: 'Fine-grained personal access token',
    rows: fixtureRows,
    facts: familyFacts,
    description: '6 rows for redact-secret only. Other scanners are on the comparison pages.',
  },
} satisfies Meta<typeof FixtureTable>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FirstPageOfMany: Story = {
  args: {
    rows: manyFixtureRows,
    description: '112 rows for redact-secret only. Other scanners are on the comparison pages.',
    facts: [{ term: 'Fixtures', value: '112' }, { term: 'Left readable', value: '9' }, { term: 'Redacted too much', value: '2' }, { term: 'False alarms', value: '0' }],
    pager: { page: 1, pageCount: 3, total: 112, pageSize: 50, nextHref: '?page=2' },
  },
};

export const LastPage: Story = {
  args: { rows: manyFixtureRows.slice(0, 12), pager: { page: 3, pageCount: 3, total: 112, pageSize: 50, previousHref: '?page=2' } },
};

/** A family the corpus does not target: dashed "Not measured", no coverage claimed. */
export const NoFixtures: Story = { args: { rows: [], facts: undefined } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
