// src/app/layout/exam-standalone-layout.tsx

import { type ReactNode, useMemo } from 'react';
import { ConfigProvider, Layout } from 'antd';
import { Outlet } from 'react-router';

import { AuthRefreshFeedbackBridge, FONT_SCALE_CONFIG, useTheme } from '@/app/providers';
import { createAppThemeConfig } from '@/app/theme';

import { useAuthSessionState } from '@/features/auth';

type ExamStandaloneLayoutProps = {
  children?: ReactNode;
};

export function ExamStandaloneLayout({ children }: ExamStandaloneLayoutProps) {
  const authSession = useAuthSessionState();
  const { fontScale, isDark, setIsDark } = useTheme();
  const activeSnapshot = authSession.status === 'authenticated' ? authSession.snapshot : null;
  const outletContext = useMemo(
    () => ({
      activeSnapshot,
      isDark,
      presentation: 'exam-standalone' as const,
      setIsDark,
    }),
    [activeSnapshot, isDark, setIsDark],
  );

  return (
    <ConfigProvider
      theme={createAppThemeConfig({
        fontSize: FONT_SCALE_CONFIG[fontScale].antdFontSize,
        isDark,
      })}
    >
      <AuthRefreshFeedbackBridge />
      <Layout
        style={{
          background: 'var(--ant-color-bg-layout)',
          color: 'var(--ant-color-text)',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {children ?? <Outlet context={outletContext} />}
      </Layout>
    </ConfigProvider>
  );
}
