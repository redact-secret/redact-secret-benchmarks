import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ObservationOrigins } from './ObservationOrigins';
import { observationOrigins } from './storyData';

const meta = {
  title: 'Evaluation/Qualification/ObservationOrigins',
  component: ObservationOrigins,
  parameters: { layout: 'fullscreen' },
  args: observationOrigins,
} satisfies Meta<typeof ObservationOrigins>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A scanner scanned in the run, one reused from an earlier verified run, one with no origin recorded, and an optional scanner not measured. */
export const Default: Story = {};

/** The recorded official artifacts: the run offered no observations for reuse, so no origin is recorded and none is guessed. */
export const NotRecorded: Story = {
  args: { rows: observationOrigins.rows.filter(r => r.state === 'not-recorded'), omitted: [] },
};

/** Every scanner was scanned in the run. */
export const AllFresh: Story = {
  args: { rows: observationOrigins.rows.filter(r => r.state === 'fresh'), omitted: [] },
};

/** Only an optional scanner the run did not measure: it gets no origin of its own. */
export const OnlyOmittedOptional: Story = { args: { rows: [] } };

export const Nothing: Story = { args: { rows: [], omitted: [] } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
