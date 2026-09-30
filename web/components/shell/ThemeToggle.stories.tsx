import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { ThemeToggle } from './ThemeToggle';

const meta = {
  title: 'Shell/ThemeToggle',
  component: ThemeToggle,
} satisfies Meta<typeof ThemeToggle>;
export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Proves the styling contract in Storybook: MUI supplies the behaviour, the CSS
 * Module wins the cascade. MUI's small ToggleButton has 13px text and 7px x 11px
 * padding; ThemeToggle.module.css sets 14px text and 12px side padding inside
 * `@layer components`, so the module values only show up when the layer order
 * (theme/layers.ts, .storybook/preview-head.html) is working.
 */
export const CssModuleLayersOverMui: Story = {
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Light' });
    const style = getComputedStyle(button);
    await expect(style.fontSize).toBe('14px');
    await expect(style.paddingLeft).toBe('12px');
  },
};
