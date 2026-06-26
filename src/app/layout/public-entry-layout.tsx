import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router';

import { AuthRefreshFeedbackBridge, FONT_SCALE_CONFIG, useTheme } from '@/app/providers';
import { createAppThemeConfig } from '@/app/theme';

type PublicEntryLayoutProps = {
  children?: ReactNode;
};

export function PublicEntryLayout({ children }: PublicEntryLayoutProps) {
  const { isDark, fontScale } = useTheme();

  return (
    <ConfigProvider
      locale={zhCN}
      theme={createAppThemeConfig({
        fontSize: FONT_SCALE_CONFIG[fontScale].antdFontSize,
        isDark,
      })}
    >
      <AntApp component={false}>
        <AuthRefreshFeedbackBridge />
        {children ?? <Outlet />}
      </AntApp>
    </ConfigProvider>
  );
}
