import { useState } from 'react';
import { Button, Card, Flex, Typography } from 'antd';
import { useNavigate } from 'react-router';

import { ForgotPasswordForm, requestPasswordReset } from '@/features/public-auth';

import { isGraphQLIngressError } from '@/shared/graphql';

const PUBLIC_AUTH_RETURN_LOGIN_URL = '/login?skipRestore=1';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-bg-layout px-6 py-12 text-text">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center">
        <div className="w-full">
          <Flex gap={32} wrap>
            <div className="min-w-70 flex-1">
              <Flex vertical gap={24}>
                <div className="login-brand-mark">
                  <img alt="" aria-hidden="true" src="/logo.svg" className="login-brand-logo" />
                  <div>
                    <span className="login-brand-name">智教随行</span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--ant-font-size)',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        lineHeight: 1.35,
                        marginBottom: 0,
                        marginTop: 0,
                      }}
                    >
                      EDU MATE
                    </span>
                  </div>
                </div>
                <div>
                  <h1
                    style={{
                      fontSize: 'var(--ant-font-size-heading-3)',
                      fontWeight: 600,
                      lineHeight: 'var(--ant-line-height-heading-3)',
                      marginBottom: 12,
                      marginTop: 8,
                    }}
                  >
                    找回你的账户密码
                  </h1>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 520 }}>
                    输入账户绑定邮箱，按邮件中的链接重新设置密码
                  </Typography.Paragraph>
                </div>
              </Flex>
            </div>

            <div className="min-w-[320px] flex-1">
              <Card styles={{ body: { padding: 24 } }}>
                <Flex vertical gap={24}>
                  {submitted ? (
                    <>
                      <div>
                        <Typography.Title level={4} style={{ marginBottom: 8 }}>
                          请检查你的邮箱
                        </Typography.Title>
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                          如果邮箱匹配已有账户，重置邮件会发送到该邮箱。请在邮件有效期内打开链接并设置新密码
                        </Typography.Paragraph>
                      </div>

                      <Button type="primary" onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>
                        返回登录
                      </Button>
                    </>
                  ) : (
                    <>
                      <div>
                        <Typography.Title level={4} style={{ marginBottom: 8 }}>
                          发送重置邮件
                        </Typography.Title>
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                          输入账户绑定邮箱，我们会发送一封密码重置邮件
                        </Typography.Paragraph>
                      </div>

                      <ForgotPasswordForm
                        errorMessage={submitError}
                        submitting={submitting}
                        onSubmit={async (values) => {
                          setSubmitting(true);
                          setSubmitError(null);

                          try {
                            await requestPasswordReset({
                              email: values.email,
                            });
                            setSubmitted(true);
                          } catch (error) {
                            setSubmitError(
                              isGraphQLIngressError(error)
                                ? error.userMessage
                                : error instanceof Error
                                  ? error.message
                                  : '暂时无法发送重置邮件。',
                            );
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                      />

                      <Button
                        type="link"
                        style={{ paddingLeft: 0, width: 'fit-content' }}
                        onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}
                      >
                        返回登录
                      </Button>
                    </>
                  )}
                </Flex>
              </Card>
            </div>
          </Flex>
        </div>
      </div>
    </div>
  );
}
