import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DomainCoverage } from './DomainCoverage';
import { coverage, viewLong, viewNotRecorded } from './storyData';

const meta = {
  title: 'Evaluation/DomainCoverage',
  component: DomainCoverage,
  args: coverage,
} satisfies Meta<typeof DomainCoverage>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No record for the mode: a dashed box that names the owning issue. */
export const NotRecorded: Story = { args: viewNotRecorded.coverage };

/** Many rows, a long name and an unbroken string. */
export const Long: Story = { args: viewLong.coverage };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
