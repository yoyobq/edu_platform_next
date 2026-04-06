import { useState } from 'react';
import { Button, Card, Flex, Typography } from 'antd';
import { useNavigate } from 'react-router';

import { ForgotPasswordForm, requestPasswordReset } from '@/features/public-auth';

import { isGraphQLIngressError } from '@/shared/graphql';
import { BrandLockup } from '@/shared/ui/brand';

const PUBLIC_AUTH_RETURN_LOGIN_URL = '/login?skipRestore=1';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-bg-layout px-6 py-12 text-text">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center">
        <Flex gap={32} className="w-full" wrap>
          <Flex vertical gap={24} className="min-w-[280px] flex-1">
            <BrandLockup variant="public-entry" />
            <div>
              <h1
                style={{
                  fontSize: 'var(--ant-font-size-heading-3)',
                  fontWeight: 'var(--ant-font-weight-heading)',
                  lineHeight: 'var(--ant-line-height-heading-3)',
                  marginBottom: 12,
                  marginTop: 8,
                }}
              >
                找回你的账户密码
              </h1>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 520 }}>
                当前阶段先补齐最小自助恢复闭环。输入邮箱后，我们会按统一反馈处理，不暴露账户是否存在。
              </Typography.Paragraph>
            </div>
          </Flex>

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
                        若该账户存在，我们已发送重置邮件。你可以稍后从邮件中的链接继续完成密码重置。
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
                        输入你的邮箱，我们会发送一封用于重置密码的邮件。
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
  );
}
