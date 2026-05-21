// src/app/theme/index.ts

import { theme as antdTheme, type ThemeConfig } from 'antd';

type AppThemeConfigInput = {
  fontSize: number;
  isDark: boolean;
};

const APP_BRAND_TOKEN = {
  colorPrimary: '#1255CC',
  colorError: '#D93025',
  colorLink: '#1255CC',
} as const;

const APP_LIGHT_SURFACE_TOKEN = {
  colorBgLayout: '#F4F6FA',
  colorBgContainer: '#FFFFFF',
} as const;

const APP_RADIUS_TOKEN = {
  borderRadius: 8,
  borderRadiusLG: 12,
  borderRadiusSM: 4,
} as const;

export function createAppThemeConfig({ fontSize, isDark }: AppThemeConfigInput): ThemeConfig {
  return {
    cssVar: {},
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      ...APP_BRAND_TOKEN,
      fontSize,
      ...(isDark ? {} : APP_LIGHT_SURFACE_TOKEN),
      ...APP_RADIUS_TOKEN,
    },
  };
}
