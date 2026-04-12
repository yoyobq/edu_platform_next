import { ConfigProvider, theme as antdTheme } from 'antd';
import { Outlet } from 'react-router';

import { AuthRefreshFeedbackBridge } from '@/app/providers';

function useIsDark() {
  // 与 app-layout 共享同一 localStorage key，公共页面跟随用户偏好
  try {
    return localStorage.getItem('color-scheme') === 'dark';
  } catch {
    return false;
  }
}

function useFontScale(): number {
  try {
    const saved = localStorage.getItem('font-scale');
    if (saved === 'compact') return 13;
    if (saved === 'comfortable') return 16;
  } catch {
    // noop
  }
  return 14;
}

export function PublicEntryLayout() {
  const isDark = useIsDark();
  const antdFontSize = useFontScale();
  return (
    <ConfigProvider
      theme={{
        cssVar: {},
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#1255CC',
          colorError: '#D93025',
          colorLink: '#1255CC',
          fontSize: antdFontSize,
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
      <Outlet />
    </ConfigProvider>
  );
}
