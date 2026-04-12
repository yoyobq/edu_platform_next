import { type ReactNode, useEffect, useState } from 'react';

import { FONT_SCALE_CONFIG, type FontScale } from './theme-constants';
import { ThemeContext } from './use-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem('color-scheme') === 'dark';
    } catch {
      return false;
    }
  });

  const [fontScale, setFontScale] = useState<FontScale>(() => {
    try {
      const saved = localStorage.getItem('font-scale');

      if (
        saved === 'compact' ||
        saved === 'standard' ||
        saved === 'comfortable' ||
        saved === 'xlarge'
      )
        return saved;
    } catch {
      return 'standard';
    }

    return 'standard';
  });

  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SCALE_CONFIG[fontScale].htmlFontSize;

    try {
      localStorage.setItem('font-scale', fontScale);
    } catch {
      // noop
    }
  }, [fontScale]);

  useEffect(() => {
    const root = document.documentElement;

    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    try {
      localStorage.setItem('color-scheme', isDark ? 'dark' : 'light');
    } catch {
      // noop
    }
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ fontScale, isDark, setFontScale, setIsDark }}>
      {children}
    </ThemeContext.Provider>
  );
}
