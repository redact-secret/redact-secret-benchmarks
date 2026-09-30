import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import '../theme/layers.css';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from '../theme/theme';
import { ThemeRoot } from '../theme/ThemeRoot';
import { AppChrome } from './AppChrome';
import '../../src/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Redact Secret Benchmarks', template: '%s | Redact Secret Benchmarks' },
  description: 'What the redact-secret benchmark ledger records, and how it compares. Measured, never ranked.',
  // The preview build is not the published site; keep it out of indexes.
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', colorScheme: 'light dark' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Same families as the existing site; Noto KR faces cover Hangul, which Montserrat, Roboto and Merriweather lack. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Merriweather:wght@700&family=Roboto:wght@400;600&family=Noto+Sans+KR:wght@400;600;700;800&family=Noto+Serif+KR:wght@700&display=swap"
        />
      </head>
      <body>
        {/* Applies the saved or OS theme before first paint, so nothing re-renders on load. */}
        <InitColorSchemeScript attribute={THEME_ATTRIBUTE} modeStorageKey={THEME_STORAGE_KEY} defaultMode="system" />
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <ThemeRoot>
            <AppChrome>{children}</AppChrome>
          </ThemeRoot>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
