import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FixtureSpans } from './FixtureSpans';
import { spanRows, spanRowsControl, spanRowsEvery, spanRowsNotMeasured, spanRowsPolicy } from './fixturePageData';

const meta = {
  title: 'Report/FixtureSpans',
  component: FixtureSpans,
  args: { rows: spanRows },
} satisfies Meta<typeof FixtureSpans>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Exact: Story = {};

/** Every outcome kind, a companion span that is context, two ranges over one span and a range outside every span. */
export const EveryOutcome: Story = { args: { rows: spanRowsEvery } };

/** Policy outcomes carry the info status, never a failure. */
export const Policy: Story = { args: { rows: spanRowsPolicy } };

/** A fixture that expects no secret lists the ranges that were reported. */
export const ControlWithFindings: Story = { args: { rows: spanRowsControl } };

export const NotMeasured: Story = { args: { rows: spanRowsNotMeasured } };

export const Phone: Story = { args: { rows: spanRowsEvery }, globals: { viewport: { value: 'mobile1', isRotated: false } } };
