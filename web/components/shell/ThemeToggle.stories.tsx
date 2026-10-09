import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { ThemeToggle } from './ThemeToggle';

const meta = {
  title: 'Shell/ThemeToggle',
  component: ThemeToggle,
} satisfies Meta<typeof ThemeToggle>;
export default meta;

type Story = StoryObj<typeof meta>;

export const IconButton: Story = {
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: /Color theme:/ });
    await expect(button).toHaveAttribute('data-mode');
    await expect(button.querySelector('svg')).not.toBeNull();
  },
};
