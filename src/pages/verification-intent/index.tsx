import { useEffect, useState } from 'react';
import { Alert, Button, Card, Flex, Skeleton, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router';

import {
  resetPassword,
  ResetPasswordForm,
  type VerificationFailureReason,
  verifyResetPasswordIntent,
} from '@/features/public-auth';

function VerificationIntentShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="min-h-screen bg-bg-layout px-6 py-12 text-text">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center">
        <Flex gap={32} className="w-full" wrap>
          <Flex vertical gap={20} className="min-w-[280px] flex-1">
            <div>
              <Typography.Text type="secondary">Verification Intent / Path-First</Typography.Text>
              <Typography.Title style={{ marginBottom: 12, marginTop: 8 }}>
                {title}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 520 }}>
                {description}
              </Typography.Paragraph>
            </div>
          </Flex>

          <div className="min-w-[320px] flex-1">
            <Card styles={{ body: { padding: 24 } }}>
              <Flex vertical gap={16}>
                <Tag color="processing">Public Entry</Tag>
                {children}
              </Flex>
            </Card>
          </div>
        </Flex>
      </div>
    </div>
  );
}

function VerificationIntentDetails({
  details,
}: {
  details: readonly { label: string; value: string }[];
}) {
  return details.map((detail) => (
    <div key={detail.label}>
      <Typography.Text type="secondary">{detail.label}</Typography.Text>
      <Typography.Paragraph style={{ marginBottom: 0, marginTop: 4 }}>
        {detail.value}
      </Typography.Paragraph>
    </div>
  ));
}

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

export function InviteIntentPage() {
  const { inviteType = '', verificationCode = '' } = useParams();

  return (
    <VerificationIntentShell
      title="邀请入口"
      description="邀请类一次性入口保持 path-first 语义，后续可在此处继续校验 invite intent 并决定是否要求登录。"
    >
      <VerificationIntentDetails
        details={[
          { label: '邀请类型', value: inviteType },
          { label: '验证代码', value: verificationCode },
        ]}
      />
    </VerificationIntentShell>
  );
}

export function VerifyEmailIntentPage() {
  const { verificationCode = '' } = useParams();

  return (
    <VerificationIntentShell
      title="邮箱验证入口"
      description="邮箱验证入口独立于普通 redirect 回跳，便于后续接入专门的 intent 预解析与继续流程。"
    >
      <VerificationIntentDetails details={[{ label: '验证代码', value: verificationCode }]} />
    </VerificationIntentShell>
  );
}

export function ResetPasswordIntentPage() {
  const navigate = useNavigate();
  const { verificationCode = '' } = useParams();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready' }
    | { status: 'success' }
    | { reason: VerificationFailureReason; status: 'failure' }
  >({ status: 'loading' });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadIntent() {
      setState({ status: 'loading' });
      setSubmitError(null);

      if (!verificationCode.trim()) {
        setState({
          status: 'failure',
          reason: 'invalid',
        });
        return;
      }

      try {
        const result = await verifyResetPasswordIntent({ verificationCode });

        if (!isActive) {
          return;
        }

        if (result.status === 'valid') {
          setState({ status: 'ready' });
          return;
        }

        setState({
          status: 'failure',
          reason: result.reason,
        });
      } catch {
        if (!isActive) {
          return;
        }

        setState({
          status: 'failure',
          reason: 'unknown',
        });
      }
    }

    void loadIntent();

    return () => {
      isActive = false;
    };
  }, [verificationCode]);

  return (
    <VerificationIntentShell
      title="重置密码入口"
      description="重置密码流程使用显式 path 承载一次性业务语义，避免和普通登录后回跳参数混写。"
    >
      <VerificationIntentDetails details={[{ label: '验证代码', value: verificationCode }]} />

      {state.status === 'loading' ? (
        <Flex vertical gap={12}>
          <Typography.Text type="secondary">正在校验重置链接</Typography.Text>
          <Skeleton active paragraph={{ rows: 3 }} title={false} />
        </Flex>
      ) : null}

      {state.status === 'ready' ? (
        <Flex vertical gap={16}>
          <div>
            <Typography.Title level={4} style={{ marginBottom: 8 }}>
              设置新密码
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              重置链接已验证通过。输入新密码后即可回到登录页继续。
            </Typography.Paragraph>
          </div>

          <ResetPasswordForm
            errorMessage={submitError}
            submitting={submitting}
            onSubmit={async (values) => {
              setSubmitting(true);
              setSubmitError(null);

              try {
                const result = await resetPassword({
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
              } catch (error) {
                setSubmitError(error instanceof Error ? error.message : '暂时无法完成密码重置。');
              } finally {
                setSubmitting(false);
              }
            }}
          />
        </Flex>
      ) : null}

      {state.status === 'success' ? (
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
      ) : null}

      {state.status === 'failure' ? <ResetPasswordFailureState reason={state.reason} /> : null}
    </VerificationIntentShell>
  );
}

export function MagicLinkIntentPage() {
  const { verificationCode = '' } = useParams();

  return (
    <VerificationIntentShell
      title="Magic Link 入口"
      description="Magic Link 入口保留为公共分流路径，后续可以在这里串联 token 校验、登录续接与站内落点决策。"
    >
      <VerificationIntentDetails details={[{ label: '验证代码', value: verificationCode }]} />
    </VerificationIntentShell>
  );
}
