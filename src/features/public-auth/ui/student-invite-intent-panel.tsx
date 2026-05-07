import { useEffect, useState } from 'react';
import { MailOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Skeleton, Typography } from 'antd';
import { useNavigate } from 'react-router';

import type { PublicInviteInfo, VerificationFailureReason } from '../application/types';
import { publicAuthApi } from '../infrastructure/public-auth-api';

const PUBLIC_AUTH_RETURN_LOGIN_URL = '/login?skipRestore=1';

type StudentInvitePhase = 'loading' | 'invite-preview' | 'invite-failure' | 'error';

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

function getInviteStatusLabel(statusReason: PublicInviteInfo['statusReason']) {
  switch (statusReason) {
    case 'AVAILABLE':
      return '可继续';
    case 'CONSUMED':
      return '已使用';
    case 'EXPIRED':
      return '已过期';
    case 'INVALID':
      return '无效';
  }
}

function StudentInviteSummaryCard({ invite }: { invite: PublicInviteInfo }) {
  return (
    <div className="rounded-card p-4" style={{ background: 'var(--ant-color-fill-quaternary)' }}>
      <Flex vertical gap={12}>
        <Flex gap={8} align="center">
          <MailOutlined
            style={{ color: 'var(--ant-color-primary)', fontSize: 'var(--ant-font-size-lg)' }}
          />
          <Typography.Text strong>{invite.invitedEmail}</Typography.Text>
        </Flex>
        <Flex gap={24} wrap style={{ paddingLeft: 24 }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
              当前状态
            </Typography.Text>
            <div style={{ marginTop: 2 }}>
              <Typography.Text>{getInviteStatusLabel(invite.statusReason)}</Typography.Text>
            </div>
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
              过期时间
            </Typography.Text>
            <div style={{ marginTop: 2 }}>
              <Typography.Text>{formatDateTime(invite.expiresAt)}</Typography.Text>
            </div>
          </div>
          {invite.issuer && (
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
                邀请人
              </Typography.Text>
              <div style={{ marginTop: 2 }}>
                <Typography.Text>{invite.issuer}</Typography.Text>
              </div>
            </div>
          )}
        </Flex>
      </Flex>
    </div>
  );
}

function StudentInviteFailureState({
  invite,
  message,
  reason,
}: {
  invite: PublicInviteInfo | null;
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
          : '暂时无法继续处理学生邀请';

  return (
    <Flex vertical gap={16}>
      {invite ? <StudentInviteSummaryCard invite={invite} /> : null}
      <Alert type="error" showIcon title={title} description={message} />
      <Button
        type="primary"
        icon={<RightOutlined />}
        iconPlacement="end"
        onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}
      >
        返回登录
      </Button>
    </Flex>
  );
}

function StudentInviteFlowSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Flex vertical gap={24}>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
      </div>
      {children}
    </Flex>
  );
}

export function StudentInviteIntentPanel({ verificationCode }: { verificationCode: string }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<StudentInvitePhase>('loading');
  const [invite, setInvite] = useState<PublicInviteInfo | null>(null);
  const [inviteFailure, setInviteFailure] = useState<{
    invite: PublicInviteInfo | null;
    message: string;
    reason: VerificationFailureReason;
  } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function runWorkflow() {
      setPhase('loading');
      setInvite(null);
      setInviteFailure(null);
      setPageError(null);

      const result = await publicAuthApi.getPublicInviteInfo({
        inviteType: 'student',
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
          invite: result.invite,
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
      <StudentInviteFlowSection title="确认邀请详情">
        <Flex vertical gap={12}>
          <Typography.Text type="secondary">正在确认邀请状态</Typography.Text>
          <Skeleton active paragraph={{ rows: 4 }} title={false} />
        </Flex>
      </StudentInviteFlowSection>
    );
  }

  if (phase === 'invite-failure' && inviteFailure) {
    return (
      <StudentInviteFlowSection title="邀请无法继续">
        <StudentInviteFailureState
          invite={inviteFailure.invite}
          message={inviteFailure.message}
          reason={inviteFailure.reason}
        />
      </StudentInviteFlowSection>
    );
  }

  if (phase === 'error' && pageError) {
    return (
      <StudentInviteFlowSection title="暂时无法继续">
        <Flex vertical gap={16}>
          <Alert type="error" showIcon title="操作失败" description={pageError} />
          <Flex gap={8} justify="flex-end">
            <Button onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>返回登录</Button>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => setReloadKey((current) => current + 1)}
            >
              重新确认邀请状态
            </Button>
          </Flex>
        </Flex>
      </StudentInviteFlowSection>
    );
  }

  if (!invite) {
    return null;
  }

  return (
    <StudentInviteFlowSection title="学生邀请">
      <Flex vertical gap={16}>
        <StudentInviteSummaryCard invite={invite} />

        <Alert
          type="info"
          showIcon
          title="学生邀请暂时还不能在线注册"
          description="已为你确认学生邀请链接。当前可以查看邀请状态；在线注册接口尚未开放，请联系管理员协助完成后续处理。邀请链接签发后 48 小时内有效。"
        />

        <Flex gap={8} justify="flex-end" wrap>
          <Button onClick={() => setReloadKey((current) => current + 1)}>重新确认邀请状态</Button>
          <Button
            type="primary"
            icon={<RightOutlined />}
            iconPlacement="end"
            onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}
          >
            返回登录
          </Button>
        </Flex>
      </Flex>
    </StudentInviteFlowSection>
  );
}
