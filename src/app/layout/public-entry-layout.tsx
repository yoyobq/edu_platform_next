import { ConfigProvider, theme as antdTheme } from 'antd';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router';

import { AuthRefreshFeedbackBridge, FONT_SCALE_CONFIG, useTheme } from '@/app/providers';

type PublicEntryLayoutProps = {
  children?: ReactNode;
};

export function PublicEntryLayout({ children }: PublicEntryLayoutProps) {
  const { isDark, fontScale } = useTheme();

  return (
    <ConfigProvider
      theme={{
        cssVar: {},
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#1255CC',
          colorError: '#D93025',
          colorLink: '#1255CC',
          fontSize: FONT_SCALE_CONFIG[fontScale].antdFontSize,
          ...(isDark
            ? {}
            : {
                colorBgLayout: '#F4F6FA',
                colorBgContainer: '#FFFFFF',
              }),
          borderRadius: 8,
          borderRadiusLG: 12,
          borderRadiusSM: 4,
        },
      }}
    >
      <AuthRefreshFeedbackBridge />
      {children ?? <Outlet />}
    </ConfigProvider>
  );
}
