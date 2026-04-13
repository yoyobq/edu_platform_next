import { useEffect, useState } from 'react';
import { Alert, Button, Flex, Skeleton, Typography } from 'antd';
import { useNavigate } from 'react-router';

import type { VerificationFailureReason } from '../application/types';
import { publicAuthApi } from '../infrastructure/public-auth-api';

const PUBLIC_AUTH_RETURN_LOGIN_URL = '/login?skipRestore=1';

type SessionSyncStatus = 'skipped' | 'synced' | 'failed';

type VerifyEmailIntentState =
  | { status: 'loading' }
  | {
      loginEmail: string | null;
      message: string | null;
      sessionSyncStatus: SessionSyncStatus;
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
    </Flex>
  );
}

export function VerifyEmailIntentPanel({
  verificationCode,
  accessToken,
  onSessionSync,
}: {
  accessToken?: string | null;
  onSessionSync?: () => Promise<SessionSyncStatus>;
  verificationCode: string;
}) {
  const navigate = useNavigate();
  const [state, setState] = useState<VerifyEmailIntentState>({ status: 'loading' });

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

      setState({ status: 'loading' });

      const result = await publicAuthApi.consumeChangeLoginEmail({
        accessToken,
        verificationCode: normalizedVerificationCode,
      });

      if (!isActive) {
        return;
      }

      if (result.status === 'success') {
        let sessionSyncStatus: SessionSyncStatus = 'skipped';

        if (onSessionSync) {
          sessionSyncStatus = await onSessionSync();
          if (!isActive) {
            return;
          }
        }

        setState({
          loginEmail: result.loginEmail,
          message: result.message,
          sessionSyncStatus,
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

      setState({
        status: 'error',
        message: result.message,
      });
    }

    void runWorkflow();

    return () => {
      isActive = false;
    };
  }, [accessToken, onSessionSync, verificationCode]);

  if (state.status === 'loading') {
    return (
      <Flex vertical gap={12}>
        <Typography.Text type="secondary">正在完成邮箱验证</Typography.Text>
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      </Flex>
    );
  }

  if (state.status === 'success') {
    const description = state.message?.trim()
      ? state.message
      : state.loginEmail
        ? `登录邮箱已更新为 ${state.loginEmail}。`
        : '登录邮箱已完成验证并更新。';

    return (
      <Flex vertical gap={16}>
        <Alert type="success" showIcon title="邮箱验证已完成" description={description} />
        {state.loginEmail ? (
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            当前登录邮箱：
            <Typography.Text strong>{state.loginEmail}</Typography.Text>
          </Typography.Paragraph>
        ) : null}
        {state.sessionSyncStatus === 'synced' ? (
          <Alert
            type="info"
            showIcon
            title="当前浏览器会话已同步"
            description="后续在站内看到的登录邮箱会使用最新值。"
          />
        ) : null}
        {state.sessionSyncStatus === 'failed' ? (
          <Alert
            type="warning"
            showIcon
            title="当前浏览器会话尚未同步"
            description="登录邮箱已经更新成功，但当前浏览器未能同步最新会话，请重新登录后继续。"
          />
        ) : null}
        <Flex gap={8} wrap>
          {state.sessionSyncStatus === 'synced' ? (
            <Button type="primary" onClick={() => navigate('/')}>
              继续进入工作台
            </Button>
          ) : (
            <Button type="primary" onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>
              返回登录
            </Button>
          )}
          {state.sessionSyncStatus === 'synced' ? (
            <Button onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>返回登录</Button>
          ) : null}
        </Flex>
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
      </Flex>
    );
  }

  return <VerifyEmailFailureState message={state.message} reason={state.reason} />;
}
