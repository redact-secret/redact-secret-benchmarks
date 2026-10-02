import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QualificationCases } from './QualificationCases';
import { cases } from './storyData';

const meta = {
  title: 'Evaluation/Qualification/QualificationCases',
  component: QualificationCases,
  parameters: { layout: 'fullscreen' },
  args: cases,
} satisfies Meta<typeof QualificationCases>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Two populations, each with its own rows and run identity; a pending case and a case a scanner did not measure are dashed words. */
export const Default: Story = {};

/** The last page: no next link, and the position line says so. */
export const LastPage: Story = {
  args: { pager: { page: 2, pageCount: 2, previousHref: '/evaluation/qualification/families/alpha-token/cases/1/' } },
};

/** A scope no population holds a case for says so instead of showing an empty table. */
export const Empty: Story = {
  args: { sections: [], pager: { page: 1, pageCount: 1 } },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
