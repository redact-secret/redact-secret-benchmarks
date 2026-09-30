import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SECTIONS } from '../../lib/routes';
import { SectionNav } from './SectionNav';

const meta = {
  title: 'Shell/SectionNav',
  component: SectionNav,
  args: { section: SECTIONS[1], currentPath: '/comparison/feature/' },
} satisfies Meta<typeof SectionNav>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Comparison: Story = {};
export const Report: Story = { args: { section: SECTIONS[0], currentPath: '/report/' } };
