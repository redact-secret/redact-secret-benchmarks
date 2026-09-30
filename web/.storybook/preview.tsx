import '../theme/layers.css';
import '../../src/tokens.css';
import '../app/globals.css';
import type { Preview } from '@storybook/nextjs-vite';
import { StyledEngineProvider } from '@mui/material/styles';
import { ThemeRoot } from '../theme/ThemeRoot';

// The same provider stack as app/layout.tsx: emotion styles inside `@layer mui`,
// then the MUI theme. layers.css is imported first, which fixes the layer order.
const preview: Preview = {
  decorators: [
    Story => (
      <StyledEngineProvider enableCssLayer>
        <ThemeRoot>
          <Story />
        </ThemeRoot>
      </StyledEngineProvider>
    ),
  ],
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'error' },
  },
};
export default preview;
