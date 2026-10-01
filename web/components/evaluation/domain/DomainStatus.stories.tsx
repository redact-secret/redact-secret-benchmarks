import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DomainStatus } from './DomainStatus';
import { status, viewNotRecorded } from './storyData';

const meta = {
  title: 'Evaluation/DomainStatus',
  component: DomainStatus,
  args: status,
} satisfies Meta<typeof DomainStatus>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Only what is not measured: dashed words, each with its follow-up. */
export const NotMeasured: Story = { args: viewNotRecorded.status };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
