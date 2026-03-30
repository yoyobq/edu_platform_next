// src/pages/login/index.tsx

import { useState } from 'react';
import { Button, Card, Flex, Typography } from 'antd';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { login, LoginForm, useAuthSessionState } from '@/features/auth';

function sanitizeRedirectTarget(candidate: string | null): string {
  if (!candidate || !candidate.startsWith('/')) {
    return '/';
  }

  if (candidate.startsWith('//')) {
    return '/';
  }

  try {
    const parsedURL = new URL(candidate, window.location.origin);

    if (parsedURL.origin !== window.location.origin) {
      return '/';
    }

    return `${parsedURL.pathname}${parsedURL.search}${parsedURL.hash}`;
  } catch {
    return '/';
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const authSession = useAuthSessionState();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const redirectTarget = sanitizeRedirectTarget(
    new URLSearchParams(location.search).get('redirect'),
  );

  if (authSession.status === 'authenticated') {
    return <Navigate to={redirectTarget} replace />;
  }

  return (
    <div className="min-h-screen bg-bg-layout px-6 py-12 text-text">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center">
        <Flex gap={32} className="w-full" wrap>
          <Flex vertical gap={20} className="min-w-[280px] flex-1">
            <div>
              <Typography.Text type="secondary">Workbench Entry / P0-2</Typography.Text>
              <Typography.Title style={{ marginBottom: 12, marginTop: 8 }}>
                登录后再进入工作台
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 520 }}>
                当前阶段先建立最小可恢复会话基础。登录成功后会优先回到你原本要访问的站内目标，
                若没有目标，则回到工作台入口。
              </Typography.Paragraph>
            </div>

            <Flex gap={12} wrap>
              <Button size="large" onClick={() => navigate('/')}>
                返回首页
              </Button>
            </Flex>
          </Flex>

          <div className="min-w-[320px] flex-1">
            <Card styles={{ body: { padding: 24 } }}>
              <Flex vertical gap={20}>
                <div>
                  <Typography.Title level={3} style={{ marginBottom: 8 }}>
                    账户登录
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    使用后端 `login` mutation 建立首阶段 session snapshot。
                  </Typography.Paragraph>
                </div>

                <LoginForm
                  errorMessage={submitError ?? authSession.lastError}
                  submitting={submitting}
                  onSubmit={async (values) => {
                    setSubmitting(true);
                    setSubmitError(null);

                    try {
                      await login({
                        audience: 'DESKTOP',
                        loginName: values.loginName,
                        loginPassword: values.loginPassword,
                        type: 'PASSWORD',
                      });

                      navigate(redirectTarget, { replace: true });
                    } catch (error) {
                      setSubmitError(error instanceof Error ? error.message : '登录失败。');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                />
              </Flex>
            </Card>
          </div>
        </Flex>
      </div>
    </div>
  );
}
