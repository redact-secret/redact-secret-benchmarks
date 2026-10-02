import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LandingHero } from './LandingHero';

const meta = {
  title: 'Landing/LandingHero',
  component: LandingHero,
  args: {
    eyebrow: 'Open benchmark for example',
    headline: { before: 'How exactly does it find', emphasis: 'secrets', after: '?' },
    lede: <>This site measures one thing, <b>byte for byte</b>, on synthetic inputs whose answers were written first.</>,
    caveat: { label: 'Not a ranking', text: 'Other tools run on the same inputs for reference.' },
    aside: <div style={{ minHeight: '12rem', border: '1px dashed currentColor' }}>Aside slot</div>,
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof LandingHero>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoAside: Story = { args: { aside: undefined } };
export const LongWords: Story = { args: { headline: { before: 'How exactly does the extraordinarily long-named tool find', emphasis: 'secretsandcredentialsandtokens', after: '?' } } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Tablet: Story = { parameters: { viewport: { defaultViewport: 'tablet' } } };
export const DarkTheme: Story = { globals: { theme: 'dark' } };
