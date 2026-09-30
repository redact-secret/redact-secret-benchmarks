import type { StorybookConfig } from '@storybook/nextjs-vite';

// Framework: @storybook/nextjs-vite, so stories run on the same Next.js
// primitives (next/link, next/navigation, CSS Modules) as the app, on Vite.
// docs/decisions/2026-09-30-...; #544 builds the primitives on this setup.
const config: StorybookConfig = {
  framework: '@storybook/nextjs-vite',
  stories: ['../components/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  typescript: { check: false },
};
export default config;
