import '../theme/layers.css';
import '../theme/measures.css';
import '../../src/tokens.css';
import '../app/globals.css';
import { useEffect } from 'react';
import type { Preview } from '@storybook/nextjs-vite';
import { StyledEngineProvider } from '@mui/material/styles';
import { ThemeRoot } from '../theme/ThemeRoot';

// The same provider stack as app/layout.tsx: emotion styles inside `@layer mui`,
// then the MUI theme. layers.css is imported first, which fixes the layer order.
// The toolbar theme switch sets the same `data-theme` attribute the app uses, so
// every story can be read in both themes (the system defines both).
const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === 'dark' ? 'dark' : 'light';
      useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
      }, [theme]);
      return (
        <StyledEngineProvider enableCssLayer>
          <ThemeRoot>
            <Story />
          </ThemeRoot>
        </StyledEngineProvider>
      );
    },
  ],
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'error' },
    layout: 'padded',
  },
};
export default preview;
