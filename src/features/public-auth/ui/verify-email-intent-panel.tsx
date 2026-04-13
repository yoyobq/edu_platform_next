import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Flex, Skeleton, Typography } from 'antd';
import { useNavigate } from 'react-router';

import type { VerificationFailureReason } from '../application/types';
import { publicAuthApi } from '../infrastructure/public-auth-api';

const PUBLIC_AUTH_RETURN_LOGIN_URL = '/login?skipRestore=1';

type VerifyEmailIntentState =
  | { status: 'loading' }
  | {
      loginEmail: string | null;
      oldLoginEmail: string | null;
      status: 'ready';
    }
  | {
      loginEmail: string | null;
      message: string | null;
      oldLoginEmail: string | null;
      status: 'success';
    }
  | { message: string; reason: VerificationFailureReason; status: 'failure' }
  | { message: string; status: 'error' };

function resolveFailureTitle(reason: VerificationFailureReason) {
  if (reason === 'expired') {
    return '验证链接已过期';
  }

  if (reason === 'used') {
    return '验证链接已使用';
  }

  return '验证链接不可用';
}

function resolveFailureDescription(reason: VerificationFailureReason, message: string) {
  if (message.trim()) {
    return message;
  }

  if (reason === 'expired') {
    return '这个邮箱验证链接已经过期，请重新发起登录邮箱变更。';
  }

  if (reason === 'used') {
    return '这个邮箱验证链接已经被使用，当前无需再次验证。';
  }

  if (reason === 'invalid') {
    return '这个邮箱验证链接无效，请检查邮件中的链接是否完整。';
  }

  return '暂时无法确认这个邮箱验证链接的状态，请稍后再试。';
}

function formatLoginEmailValue(value: string | null) {
  return value || '未返回';
}

function VerifyEmailFailureState({
  message,
  reason,
}: {
  message: string;
  reason: VerificationFailureReason;
}) {
  const navigate = useNavigate();

  return (
    <Flex vertical gap={16}>
      <Alert
        type="error"
        showIcon
        title={resolveFailureTitle(reason)}
        description={resolveFailureDescription(reason, message)}
      />
      <Button type="primary" onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>
        返回登录
      </Button>
      <Typography.Text type="secondary">
        如需重新发起登录邮箱变更，请在登录后前往相应设置页面操作。
      </Typography.Text>
    </Flex>
  );
}

export function VerifyEmailIntentPanel({
  verificationCode,
  accessToken,
  onConsumeSuccess,
}: {
  accessToken?: string | null;
  onConsumeSuccess?: () => Promise<void>;
  verificationCode: string;
}) {
  const navigate = useNavigate();
  const [state, setState] = useState<VerifyEmailIntentState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const loadedVerificationCodeRef = useRef<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function runWorkflow() {
      const normalizedVerificationCode = verificationCode.trim();

      if (!normalizedVerificationCode) {
        setState({
          status: 'failure',
          reason: 'invalid',
          message: '这个邮箱验证链接无效，请检查邮件中的链接是否完整。',
        });
        return;
      }

      if (loadedVerificationCodeRef.current === normalizedVerificationCode) {
        return;
      }

      loadedVerificationCodeRef.current = normalizedVerificationCode;
      setState({ status: 'loading' });
      setSubmitError(null);

      const result = await publicAuthApi.getChangeLoginEmailIntent({
        verificationCode: normalizedVerificationCode,
      });

      if (!isActive) {
        return;
      }

      if (result.status === 'ready') {
        setState({
          loginEmail: result.loginEmail,
          oldLoginEmail: result.oldLoginEmail,
          status: 'ready',
        });
        return;
      }

      if (result.status === 'failure') {
        setState({
          status: 'failure',
          reason: result.reason,
          message: resolveFailureDescription(result.reason, ''),
        });
        return;
      }

      setState({
        status: 'error',
        message: result.message,
      });
    }

    void runWorkflow();

    return () => {
      isActive = false;
      loadedVerificationCodeRef.current = null;
    };
  }, [verificationCode]);

  if (state.status === 'loading') {
    return (
      <Flex vertical gap={12}>
        <Typography.Text type="secondary">正在确认登录邮箱变更链接</Typography.Text>
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      </Flex>
    );
  }

  if (state.status === 'ready') {
    return (
      <Flex vertical gap={16}>
        <div>
          <Typography.Title level={4} style={{ marginBottom: 8 }}>
            确认更换登录邮箱
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            确认后，系统会更新当前账户的登录邮箱，并要求你重新登录。
          </Typography.Paragraph>
        </div>

        <Alert
          type="info"
          showIcon
          title="本次将进行以下变更"
          description={
            <Flex vertical gap={8}>
              <div>
                当前登录邮箱：
                <Typography.Text strong>
                  {formatLoginEmailValue(state.oldLoginEmail)}
                </Typography.Text>
              </div>
              <div>
                新的登录邮箱：
                <Typography.Text strong>{formatLoginEmailValue(state.loginEmail)}</Typography.Text>
              </div>
            </Flex>
          }
        />

        {submitError ? <Alert type="error" showIcon title={submitError} /> : null}

        <Flex gap={8} wrap>
          <Button
            type="primary"
            loading={submitting}
            onClick={async () => {
              setSubmitting(true);
              setSubmitError(null);

              try {
                const result = await publicAuthApi.consumeChangeLoginEmail({
                  accessToken,
                  verificationCode,
                });

                if (result.status === 'success') {
                  await onConsumeSuccess?.();

                  setState({
                    loginEmail: result.loginEmail,
                    message: result.message,
                    oldLoginEmail: result.oldLoginEmail,
                    status: 'success',
                  });
                  return;
                }

                if (result.status === 'failure') {
                  setState({
                    status: 'failure',
                    reason: result.reason,
                    message: result.message,
                  });
                  return;
                }

                setSubmitError(result.message);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            确认更换并重新登录
          </Button>
          <Button onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>暂不更换</Button>
        </Flex>
      </Flex>
    );
  }

  if (state.status === 'success') {
    const description = state.message?.trim()
      ? state.message
      : state.oldLoginEmail && state.loginEmail
        ? `登录邮箱已从 ${state.oldLoginEmail} 更新为 ${state.loginEmail}。`
        : state.loginEmail
          ? `登录邮箱已更新为 ${state.loginEmail}。`
          : '登录邮箱已完成验证并更新。';

    return (
      <Flex vertical gap={16}>
        <Alert type="success" showIcon title="登录邮箱已更新" description={description} />
        <Alert
          type="info"
          showIcon
          title="请重新登录"
          description="为保证账户状态一致，当前浏览器需要重新登录后再继续使用。"
        />
        <Button type="primary" onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>
          前往登录
        </Button>
      </Flex>
    );
  }

  if (state.status === 'error') {
    return (
      <Flex vertical gap={16}>
        <Alert type="error" showIcon title="邮箱验证失败" description={state.message} />
        <Button type="primary" onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>
          返回登录
        </Button>
        <Typography.Text type="secondary">
          如需重新发起登录邮箱变更，请在登录后前往相应设置页面操作。
        </Typography.Text>
      </Flex>
    );
  }

  return <VerifyEmailFailureState message={state.message} reason={state.reason} />;
}
