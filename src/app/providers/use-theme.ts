import { createContext, useContext } from 'react';

import type { FontScale } from './theme-constants';

export type ThemeContextValue = {
  isDark: boolean;
  setIsDark: (value: boolean | ((prev: boolean) => boolean)) => void;
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
