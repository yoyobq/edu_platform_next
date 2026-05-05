import { useEffect, useState } from 'react';
import { ArrowRightOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Typography } from 'antd';
import { Navigate, useLocation, useNavigate } from 'react-router';

import {
  login,
  LoginForm,
  readAuthRefreshFeedbackFlash,
  resolveAuthenticatedRedirectTarget,
  resolveLoginRedirectTarget,
  useAuthSessionState,
} from '@/features/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const authSession = useAuthSessionState();
  const [isNarrowViewport, setIsNarrowViewport] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 860px)').matches,
  );
  const [submitError, setSubmitError] = useState<string | null>(() => {
    const flash = readAuthRefreshFeedbackFlash();

    return flash?.type === 'error' ? flash.content : null;
  });
  const [submitting, setSubmitting] = useState(false);
  const redirectTarget = resolveAuthenticatedRedirectTarget(
    new URLSearchParams(location.search).get('redirect'),
    {
      needsProfileCompletion: authSession.snapshot?.needsProfileCompletion ?? false,
    },
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 860px)');
    const syncViewport = () => setIsNarrowViewport(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);

    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  if (authSession.status === 'authenticated') {
    return <Navigate to={redirectTarget} replace />;
  }

  if (authSession.status === 'hydrating') {
    return (
      <Navigate
        to={resolveLoginRedirectTarget(new URLSearchParams(location.search).get('redirect'))}
        replace
      />
    );
  }

  return (
    <div
      className={`login-page-shell min-h-screen text-text${
        isNarrowViewport ? ' login-page-shell-narrow' : ''
      }`}
    >
      <div className="login-page-frame">
        <div className="login-page-grid">
          <section
            className={`login-story-column min-w-[280px] flex-1${
              isNarrowViewport ? ' login-story-column-narrow' : ''
            }`}
            aria-labelledby="login-page-title"
          >
            <div className="login-brand-mark">
              <img alt="" aria-hidden="true" src="/logo.svg" className="login-brand-logo" />
              <div>
                <span className="login-brand-name">智教随行</span>
                <h1
                  id="login-page-title"
                  style={{
                    fontSize: 'var(--ant-font-size)',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    lineHeight: 1.35,
                    marginBottom: 0,
                    marginTop: 0,
                  }}
                >
                  EDU MATE
                </h1>
              </div>
            </div>

            {isNarrowViewport ? null : (
              <div className="login-hero-block">
                <div className="login-hero-image-shell">
                  <img
                    src="/images/login.jpg"
                    alt=""
                    aria-hidden="true"
                    className="login-hero-image"
                  />
                </div>
              </div>
            )}
          </section>

          <div className="login-form-column min-w-0 flex-1">
            <div className="login-card-shell">
              <Card styles={{ body: { padding: '32px 32px' } }} variant="borderless">
                <Flex vertical gap={24}>
                  <div className="login-card-heading">
                    <Typography.Title level={4} style={{ marginBottom: 4 }}>
                      账户登录
                    </Typography.Title>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      使用你的教务账户进入 EDU MATE。
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

                        navigate(
                          resolveLoginRedirectTarget(
                            new URLSearchParams(location.search).get('redirect'),
                          ),
                          { replace: true },
                        );
                      } catch (error) {
                        setSubmitError(error instanceof Error ? error.message : '登录失败。');
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  />

                  <div className="login-recovery-link-shell">
                    <Button type="link" onClick={() => navigate('/forgot-password')}>
                      忘记密码？ <ArrowRightOutlined aria-hidden="true" />
                    </Button>
                  </div>
                </Flex>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
