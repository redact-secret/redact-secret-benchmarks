import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SiteFooter } from './SiteFooter';

const LINKS = [
  { label: 'example.com', href: 'https://example.com' },
  { label: 'GitHub · product', href: 'https://example.com/product' },
  { label: 'GitHub · benchmarks', href: 'https://example.com/benchmarks' },
  { label: 'Security', href: 'https://example.com/security' },
];

const meta = {
  title: 'Shell/SiteFooter',
  component: SiteFooter,
  args: {
    links: LINKS,
    legal: <>© 2026 Example Org · Code and data under the <a href="https://example.com/license" rel="noreferrer">MIT License</a>. This site records measurements and does not assert product output.</>,
    build: 'redact-secret 0.0.0-example · 1,234 inputs · run 2026-01-01',
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SiteFooter>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** A build with no run to name shows no build line. */
export const NoBuildLine: Story = { args: { build: null } };
export const LongBuildLine: Story = { args: { build: 'redact-secret candidate abc1234 (unreleased) · 1,234,567 inputs · run 2026-01-01'.repeat(2) } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const DarkTheme: Story = { globals: { theme: 'dark' } };
