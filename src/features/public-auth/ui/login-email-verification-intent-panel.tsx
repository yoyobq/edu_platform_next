// src/features/public-auth/ui/login-email-verification-intent-panel.tsx

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Flex, Skeleton, Typography } from 'antd';
import { useNavigate } from 'react-router';

import type {
  LoginEmailVerificationReason,
  LoginEmailVerificationResult,
} from '../application/types';
import { publicAuthApi } from '../infrastructure/public-auth-api';

const PUBLIC_AUTH_RETURN_LOGIN_URL = '/login?skipRestore=1';

type LoginEmailVerificationState =
  | { status: 'loading' }
  | { loginEmail: string | null; message: string | null; status: 'success' }
  | {
      loginEmail: string | null;
      message: string;
      reason: LoginEmailVerificationReason;
      status: 'failure';
    }
  | { message: string; status: 'error' };

function resolveFailureTitle(reason: LoginEmailVerificationReason) {
  if (reason === 'EXPIRED') {
    return '验证链接已过期';
  }

  if (reason === 'USED') {
    return '验证链接已使用';
  }

  return '验证链接不可用';
}

function resolveFailureActionText(reason: LoginEmailVerificationReason) {
  if (reason === 'EXPIRED') {
    return '请返回注册页或登录页，重新发送登录邮箱验证邮件。';
  }

  if (reason === 'USED') {
    return '如果邮箱已经验证完成，可以直接返回登录。';
  }

  return '请确认邮件中的链接是否完整，或重新发送验证邮件。';
}

export function LoginEmailVerificationIntentPanel({ token }: { token: string }) {
  const navigate = useNavigate();
  const [state, setState] = useState<LoginEmailVerificationState>({ status: 'loading' });
  const verificationRequestRef = useRef<{
    promise: Promise<LoginEmailVerificationResult>;
    token: string;
  } | null>(null);

  useEffect(() => {
    let isActive = true;

    async function runWorkflow() {
      const normalizedToken = token.trim();
      const existingRequest = verificationRequestRef.current;
      const request =
        existingRequest?.token === normalizedToken
          ? existingRequest
          : {
              promise: publicAuthApi.verifyLoginEmail({
                token: normalizedToken,
              }),
              token: normalizedToken,
            };

      if (request !== existingRequest) {
        verificationRequestRef.current = request;
        setState({ status: 'loading' });
      }

      const result = await request.promise;

      if (!isActive || verificationRequestRef.current?.token !== normalizedToken) {
        return;
      }

      if (result.status === 'success') {
        setState({
          loginEmail: result.loginEmail,
          message: result.message,
          status: 'success',
        });
        return;
      }

      if (result.status === 'failure') {
        setState({
          loginEmail: result.loginEmail,
          message: result.message,
          reason: result.reason,
          status: 'failure',
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
    };
  }, [token]);

  if (state.status === 'loading') {
    return (
      <Flex vertical gap={12}>
        <Typography.Text type="secondary">正在验证登录邮箱</Typography.Text>
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      </Flex>
    );
  }

  if (state.status === 'success') {
    const description =
      state.message ||
      (state.loginEmail
        ? `登录邮箱 ${state.loginEmail} 已完成验证，现在可以前往登录。`
        : '登录邮箱已完成验证，现在可以前往登录。');

    return (
      <Flex vertical gap={16}>
        <Alert type="success" showIcon title="登录邮箱已验证" description={description} />
        <Button
          type="primary"
          onClick={() =>
            navigate(PUBLIC_AUTH_RETURN_LOGIN_URL, {
              state: state.loginEmail ? { loginName: state.loginEmail } : undefined,
            })
          }
        >
          前往登录
        </Button>
      </Flex>
    );
  }

  if (state.status === 'failure') {
    return (
      <Flex vertical gap={16}>
        <Alert
          type="error"
          showIcon
          title={resolveFailureTitle(state.reason)}
          description={state.message}
        />
        <Typography.Text type="secondary">{resolveFailureActionText(state.reason)}</Typography.Text>
        <Button type="primary" onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>
          返回登录
        </Button>
      </Flex>
    );
  }

  return (
    <Flex vertical gap={16}>
      <Alert type="error" showIcon title="验证失败" description={state.message} />
      <Button type="primary" onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>
        返回登录
      </Button>
    </Flex>
  );
}
