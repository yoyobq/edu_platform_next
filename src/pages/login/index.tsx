import { useEffect, useState } from 'react';
import {
  BankOutlined,
  CopyrightOutlined,
  RobotOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
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

import { hasGraphQLErrorCode } from '@/shared/graphql';

type LoginLocationState = {
  loginName?: string;
};

function readLoginNameFromLocationState(state: unknown) {
  if (!state || typeof state !== 'object') {
    return null;
  }

  const loginName = (state as LoginLocationState).loginName;

  return typeof loginName === 'string' && loginName.trim() ? loginName.trim() : null;
}

function resolveLoginSubmitErrorMessage(error: unknown) {
  if (hasGraphQLErrorCode(error, 'AUTH_LOGIN_EMAIL_NOT_VERIFIED')) {
    return '请先验证登录邮箱。';
  }

  return error instanceof Error ? error.message : '登录失败。';
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const authSession = useAuthSessionState();
  const copyrightYear = new Date().getFullYear();
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
  const initialLoginName = readLoginNameFromLocationState(location.state);

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

  if (authSession.status === 'hydrating' && !submitting) {
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
            className={`login-story-column min-w-70 flex-1${
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
                    fontSize: 27,
                    fontWeight: 800,
                    letterSpacing: 0,
                    lineHeight: 1.1,
                    marginBottom: 0,
                    marginTop: 0,
                  }}
                >
                  EDU MATE
                </h1>
              </div>
            </div>

            {isNarrowViewport ? null : (
              <p className="login-story-copy">
                面向学生、教师与教职工的智能伴侣，
                <br />
                帮助安排事务、协调流程并引导 AI 融入日常工作（并不能）
              </p>
            )}

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
                <div className="login-feature-chip-row">
                  <span className="login-feature-chip">
                    <BankOutlined aria-hidden="true" />
                    对齐校园网数据
                  </span>
                  <span className="login-feature-chip">
                    <RobotOutlined aria-hidden="true" />
                    AI 介入工作流
                  </span>
                  <span className="login-feature-chip">
                    <ScheduleOutlined aria-hidden="true" />
                    更懂教务场景
                  </span>
                </div>
              </div>
            )}
          </section>

          <div className="login-form-column min-w-0 flex-1">
            <div className="login-card-shell">
              <Card
                styles={{
                  body: {
                    padding: isNarrowViewport
                      ? '32px 26px'
                      : 'clamp(42px, 3.1vw, 52px) clamp(38px, 3.2vw, 54px) clamp(34px, 2.5vw, 42px)',
                  },
                }}
                variant="borderless"
              >
                <Flex vertical>
                  <div className="login-card-heading">
                    <Typography.Title level={3} style={{ marginBottom: 0 }}>
                      账号登录
                    </Typography.Title>
                  </div>

                  <LoginForm
                    errorMessage={submitError ?? authSession.lastError}
                    initialLoginName={initialLoginName}
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
                        setSubmitError(resolveLoginSubmitErrorMessage(error));
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  />

                  <div className="login-recovery-link-shell">
                    <Button type="link" onClick={() => navigate('/forgot-password')}>
                      忘记密码？
                    </Button>
                  </div>

                  <div className="login-security-note">
                    <div className="login-legal-divider" aria-hidden="true" />
                    <div className="login-legal-copy">
                      <span className="login-copyright-copy">
                        <span className="login-copyright-mark" aria-hidden="true">
                          <CopyrightOutlined />
                        </span>
                        信息工程系 2023-{copyrightYear}
                      </span>
                      <a
                        className="login-legal-link"
                        href="https://beian.miit.gov.cn/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        苏ICP备2025181449号-1
                      </a>
                    </div>
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
