import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DomainGlance } from './DomainGlance';
import { glance, glanceNotRecorded } from './storyData';

const meta = {
  title: 'Evaluation/DomainGlance',
  component: DomainGlance,
  args: { items: glance },
} satisfies Meta<typeof DomainGlance>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A fact the ledger does not hold is the dashed "Not recorded", never a zero. */
export const NotRecorded: Story = { args: { items: glanceNotRecorded } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
