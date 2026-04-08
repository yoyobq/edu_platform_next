import { useEffect, useState } from 'react';
import { Alert, Button, Flex, Skeleton, Typography } from 'antd';
import { useNavigate } from 'react-router';

import {
  loadStaffInviteIntent,
  submitStaffInvite,
  verifyStaffInviteIdentity,
} from '../application/staff-invite-workflow';
import type {
  StaffInviteIdentity,
  StaffInviteInfo,
  VerificationFailureReason,
} from '../application/types';
import { publicAuthApi } from '../infrastructure/public-auth-api';

import { StaffInviteRegisterForm } from './staff-invite-register-form';
import { UpstreamStaffVerificationForm } from './upstream-staff-verification-form';

const PUBLIC_AUTH_RETURN_LOGIN_URL = '/login?skipRestore=1';

const publicAuthPorts = {
  api: publicAuthApi,
};

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Paragraph style={{ marginBottom: 0, marginTop: 4 }}>{value}</Typography.Paragraph>
    </div>
  );
}

function StaffInviteFailureState({
  message,
  reason,
}: {
  message: string;
  reason: VerificationFailureReason;
}) {
  const navigate = useNavigate();
  const title =
    reason === 'expired'
      ? '邀请已过期'
      : reason === 'used'
        ? '邀请已使用'
        : reason === 'invalid'
          ? '邀请不可用'
          : '暂时无法继续邀请注册';

  return (
    <Flex vertical gap={16}>
      <Alert type="error" showIcon title={title} description={message} />
      <Button type="primary" onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>
        返回登录
      </Button>
    </Flex>
  );
}

export function StaffInviteIntentPanel({ verificationCode }: { verificationCode: string }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<
    | 'loading'
    | 'invite-preview'
    | 'invite-failure'
    | 'upstream-auth'
    | 'register-ready'
    | 'submit-failure'
    | 'success'
    | 'error'
  >('loading');
  const [invite, setInvite] = useState<StaffInviteInfo | null>(null);
  const [identity, setIdentity] = useState<StaffInviteIdentity | null>(null);
  const [inviteFailure, setInviteFailure] = useState<{
    message: string;
    reason: VerificationFailureReason;
  } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [upstreamError, setUpstreamError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitFailureMessage, setSubmitFailureMessage] = useState<string | null>(null);
  const [verifyingIdentity, setVerifyingIdentity] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function runWorkflow() {
      setPhase('loading');
      setInvite(null);
      setIdentity(null);
      setInviteFailure(null);
      setPageError(null);
      setUpstreamError(null);
      setSubmitError(null);
      setSubmitFailureMessage(null);

      const result = await loadStaffInviteIntent(publicAuthPorts, {
        verificationCode,
      });

      if (!isActive) {
        return;
      }

      if (result.status === 'ready') {
        setInvite(result.invite);
        setPhase('invite-preview');
        return;
      }

      if (result.status === 'failure') {
        setInviteFailure({
          message: result.message,
          reason: result.reason,
        });
        setPhase('invite-failure');
        return;
      }

      setPageError(result.message);
      setPhase('error');
    }

    void runWorkflow();

    return () => {
      isActive = false;
    };
  }, [reloadKey, verificationCode]);

  if (phase === 'loading') {
    return (
      <Flex vertical gap={12}>
        <Typography.Text type="secondary">正在确认邀请状态</Typography.Text>
        <Skeleton active paragraph={{ rows: 4 }} title={false} />
      </Flex>
    );
  }

  if (phase === 'invite-failure' && inviteFailure) {
    return (
      <StaffInviteFailureState message={inviteFailure.message} reason={inviteFailure.reason} />
    );
  }

  if (phase === 'error' && pageError) {
    return (
      <Flex vertical gap={16}>
        <Alert type="error" showIcon title="操作失败" description={pageError} />
        <Button type="primary" onClick={() => setReloadKey((current) => current + 1)}>
          重新检查邀请
        </Button>
        <Button onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>返回登录</Button>
      </Flex>
    );
  }

  if (!invite) {
    return null;
  }

  if (phase === 'invite-preview') {
    return (
      <Flex vertical gap={16}>
        <div>
          <Typography.Title level={4} style={{ marginBottom: 8 }}>
            确认教职工邀请
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            先确认邀请信息，再使用上游账号完成教职工身份核对。
          </Typography.Paragraph>
        </div>

        <DetailItem label="邀请标题" value={invite.title || '教职工邀请'} />
        <DetailItem label="邀请邮箱" value={invite.invitedEmail} />
        <DetailItem label="签发人" value={invite.issuer || '未提供'} />
        <DetailItem label="过期时间" value={formatDateTime(invite.expiresAt)} />
        <DetailItem
          label="说明"
          value={invite.description || '请完成上游身份核对后继续邀请注册。'}
        />

        <Button
          type="primary"
          onClick={() => {
            setUpstreamError(null);
            setPhase('upstream-auth');
          }}
        >
          继续身份核对
        </Button>
        <Button onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>返回登录</Button>
      </Flex>
    );
  }

  if (phase === 'upstream-auth') {
    return (
      <Flex vertical gap={16}>
        <div>
          <Typography.Title level={4} style={{ marginBottom: 8 }}>
            核对教职工身份
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            输入你的上游账号与密码。核对通过后，教职工身份信息会只读回填到注册表单。
          </Typography.Paragraph>
        </div>

        <UpstreamStaffVerificationForm
          errorMessage={upstreamError}
          submitting={verifyingIdentity}
          onSubmit={async (values) => {
            setVerifyingIdentity(true);
            setUpstreamError(null);

            try {
              const result = await verifyStaffInviteIdentity(publicAuthPorts, {
                password: values.password,
                userId: values.userId.trim(),
              });

              if (result.status === 'success') {
                setIdentity(result.identity);
                setSubmitError(null);
                setSubmitFailureMessage(null);
                setPhase('register-ready');
                return;
              }

              setUpstreamError(result.message);
            } finally {
              setVerifyingIdentity(false);
            }
          }}
        />

        <Button onClick={() => setPhase('invite-preview')}>返回邀请信息</Button>
      </Flex>
    );
  }

  if (phase === 'register-ready' && identity) {
    return (
      <Flex vertical gap={16}>
        <div>
          <Typography.Title level={4} style={{ marginBottom: 8 }}>
            设置账户信息
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            登录邮箱会自动使用本次邀请对应的邮箱。完成提交后，请回到登录页继续使用。
          </Typography.Paragraph>
        </div>

        <StaffInviteRegisterForm
          errorMessage={submitError}
          identity={identity}
          inviteEmail={invite.invitedEmail}
          submitting={submitting}
          onSubmit={async (values) => {
            setSubmitting(true);
            setSubmitError(null);

            try {
              const result = await submitStaffInvite(publicAuthPorts, {
                verificationCode,
                upstreamSessionToken: identity.upstreamSessionToken,
                loginPassword: values.loginPassword,
                loginName: values.loginName?.trim() || undefined,
                nickname: values.nickname?.trim() || '',
                staffName: identity.personName,
                staffDepartmentId: identity.orgId,
              });

              if (result.status === 'success') {
                setPhase('success');
                return;
              }

              if (result.status === 'failure') {
                setSubmitFailureMessage(result.message);
                setPhase('submit-failure');
                return;
              }

              setSubmitError(result.message);
            } finally {
              setSubmitting(false);
            }
          }}
        />

        <Button
          onClick={() => {
            setIdentity(null);
            setUpstreamError(null);
            setSubmitError(null);
            setPhase('upstream-auth');
          }}
        >
          重新核对身份
        </Button>
      </Flex>
    );
  }

  if (phase === 'submit-failure' && submitFailureMessage) {
    return (
      <Flex vertical gap={16}>
        <Alert type="error" showIcon title="邀请注册未完成" description={submitFailureMessage} />
        <Button type="primary" onClick={() => setReloadKey((current) => current + 1)}>
          重新检查邀请
        </Button>
        <Button onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>返回登录</Button>
      </Flex>
    );
  }

  if (phase === 'success') {
    return (
      <Flex vertical gap={16}>
        <Alert
          type="success"
          showIcon
          title="邀请注册已完成"
          description="账号已激活完成。请返回登录页，使用邀请邮箱或你填写的登录名继续登录。"
        />
        <Button type="primary" onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>
          返回登录
        </Button>
      </Flex>
    );
  }

  return null;
}
