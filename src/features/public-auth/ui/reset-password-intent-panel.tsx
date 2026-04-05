import { useEffect, useState } from 'react';
import { Alert, Button, Flex, Skeleton, Typography } from 'antd';
import { useNavigate } from 'react-router';

import {
  loadResetPasswordIntent,
  type ResetPasswordIntentWorkflowState,
  submitResetPasswordIntent,
} from '../application/reset-password-intent-workflow';
import type { VerificationFailureReason } from '../application/types';
import { publicAuthApi } from '../infrastructure/public-auth-api';

import { ResetPasswordForm } from './reset-password-form';

function ResetPasswordFailureState({ reason }: { reason: VerificationFailureReason }) {
  const navigate = useNavigate();
  const description =
    reason === 'expired'
      ? '这个重置链接已经过期，请重新发起找回密码流程。'
      : reason === 'used'
        ? '这个重置链接已经被使用，请重新发起找回密码流程。'
        : reason === 'invalid'
          ? '这个重置链接无效，请检查邮件中的链接是否完整。'
          : '暂时无法确认这个重置链接的状态，请稍后再试。';

  return (
    <Flex vertical gap={16}>
      <Alert type="error" showIcon title="重置链接不可用" description={description} />
      <Button type="primary" onClick={() => navigate('/forgot-password')}>
        重新发送重置邮件
      </Button>
      <Button onClick={() => navigate('/login')}>返回登录</Button>
    </Flex>
  );
}

const publicAuthPorts = {
  api: publicAuthApi,
};

export function ResetPasswordIntentPanel({ verificationCode }: { verificationCode: string }) {
  const navigate = useNavigate();
  const [state, setState] = useState<ResetPasswordIntentWorkflowState>({ status: 'loading' });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function runWorkflow() {
      setState({ status: 'loading' });
      setSubmitError(null);

      const nextState = await loadResetPasswordIntent(publicAuthPorts, {
        verificationCode,
      });

      if (!isActive) {
        return;
      }

      setState(nextState);
    }

    void runWorkflow();

    return () => {
      isActive = false;
    };
  }, [verificationCode]);

  if (state.status === 'loading') {
    return (
      <Flex vertical gap={12}>
        <Typography.Text type="secondary">正在校验重置链接</Typography.Text>
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      </Flex>
    );
  }

  if (state.status === 'ready') {
    return (
      <Flex vertical gap={16}>
        <div>
          <Typography.Title level={4} style={{ marginBottom: 8 }}>
            输入新密码
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            输入过程中会即时检查密码规则，确认通过后即可完成更新。
          </Typography.Paragraph>
        </div>

        <ResetPasswordForm
          errorMessage={submitError}
          submitting={submitting}
          onSubmit={async (values) => {
            setSubmitting(true);
            setSubmitError(null);

            try {
              const result = await submitResetPasswordIntent(publicAuthPorts, {
                newPassword: values.newPassword,
                verificationCode,
              });

              if (result.status === 'success') {
                setState({ status: 'success' });
                return;
              }

              if (result.status === 'failure') {
                setState({
                  status: 'failure',
                  reason: result.reason,
                });
                return;
              }

              setSubmitError(result.message);
            } finally {
              setSubmitting(false);
            }
          }}
        />
      </Flex>
    );
  }

  if (state.status === 'success') {
    return (
      <Flex vertical gap={16}>
        <Alert
          type="success"
          showIcon
          title="密码已更新"
          description="你现在可以使用新密码重新登录。"
        />
        <Button type="primary" onClick={() => navigate('/login')}>
          返回登录
        </Button>
      </Flex>
    );
  }

  if (state.status === 'error') {
    return (
      <Flex vertical gap={16}>
        <Alert type="error" showIcon title="操作失败" description={state.message} />
        <Button type="primary" onClick={() => navigate('/forgot-password')}>
          重新发送重置邮件
        </Button>
        <Button onClick={() => navigate('/login')}>返回登录</Button>
      </Flex>
    );
  }

  return <ResetPasswordFailureState reason={state.reason} />;
}
