import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SECTIONS } from '../../lib/routes';
import { SiteHeader } from './SiteHeader';

const meta = {
  title: 'Shell/SiteHeader',
  component: SiteHeader,
  args: { sections: SECTIONS, currentPath: '/report/' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SiteHeader>;
export default meta;

type Story = StoryObj<typeof meta>;

export const ReportCurrent: Story = {};
export const ComparisonCurrent: Story = { args: { currentPath: '/comparison/runtime/' } };
export const Narrow: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
