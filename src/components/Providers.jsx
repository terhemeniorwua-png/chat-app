'use client';

import { ThemeProvider } from '@/context/ThemeContext';

/**
 * Client-side providers for the whole app. Theme must mount above every route
 * (auth screens and the dashboard shell) so Light/Dark is always available.
 */
export default function Providers({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}