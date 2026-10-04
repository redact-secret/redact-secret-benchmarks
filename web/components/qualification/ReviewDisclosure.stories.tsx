import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ReviewDisclosure } from './ReviewDisclosure';
import { reviewDisclosure } from './storyData';

const meta = {
  title: 'Evaluation/Qualification/ReviewDisclosure',
  component: ReviewDisclosure,
  args: reviewDisclosure,
} satisfies Meta<typeof ReviewDisclosure>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongCount: Story = {
  args: { count: `${'1,000,000 fixtures of the 1,000,000,000 in evidence release snapshot-9999.99.99.99-with-a-very-long-identifier '.repeat(2)}carry this label.` },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
