import { Fragment, useEffect, useState } from 'react';
import {
  CheckCircleFilled,
  CheckOutlined,
  LeftOutlined,
  MailOutlined,
  ReloadOutlined,
  RightOutlined,
  SafetyOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { Alert, Button, Flex, Form, Skeleton, Typography } from 'antd';
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
const UPSTREAM_VERIFICATION_FORM_ID = 'staff-invite-upstream-verification-form';
const REGISTER_FORM_ID = 'staff-invite-register-form';

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

type StaffInvitePhase =
  | 'loading'
  | 'invite-preview'
  | 'invite-failure'
  | 'upstream-auth'
  | 'register-ready'
  | 'submit-failure'
  | 'success'
  | 'error';

const INVITE_STEP_CONFIG = [
  { Icon: MailOutlined, label: '确认邀请' },
  { Icon: SafetyOutlined, label: '身份核对' },
  { Icon: UserAddOutlined, label: '设置账户' },
];

function InviteStepBar({ activeIndex }: { activeIndex: number }) {
  return (
    <Flex align="flex-start" justify="center" style={{ padding: '0 0 8px' }}>
      {INVITE_STEP_CONFIG.map((step, index) => {
        const isDone = activeIndex > index;
        const isActive = activeIndex === index;
        const { Icon } = step;

        return (
          <Fragment key={index}>
            <Flex vertical align="center" gap={8} style={{ flex: '0 0 88px' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--ant-font-size-lg)',
                  background: isDone
                    ? 'var(--ant-color-primary)'
                    : isActive
                      ? 'var(--ant-color-primary-bg)'
                      : 'transparent',
                  border: isDone
                    ? '2px solid var(--ant-color-primary)'
                    : isActive
                      ? '2px solid var(--ant-color-primary)'
                      : '1.5px solid var(--ant-color-border)',
                  color: isDone
                    ? 'var(--ant-color-white)'
                    : isActive
                      ? 'var(--ant-color-primary)'
                      : 'var(--ant-color-text-quaternary)',
                  transition: 'all 0.2s ease',
                }}
              >
                {isDone ? <CheckOutlined /> : <Icon />}
              </div>
              <Typography.Text
                style={{
                  fontSize: 'var(--ant-font-size-sm)',
                  fontWeight: isActive ? 600 : 400,
                  color: isDone
                    ? 'var(--ant-color-text-secondary)'
                    : isActive
                      ? 'var(--ant-color-text)'
                      : 'var(--ant-color-text-quaternary)',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.4,
                  transition: 'color 0.2s ease',
                }}
              >
                {step.label}
              </Typography.Text>
            </Flex>

            {index < INVITE_STEP_CONFIG.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  marginTop: 17,
                  borderRadius: 1,
                  background:
                    activeIndex > index ? 'var(--ant-color-primary)' : 'var(--ant-color-border)',
                  transition: 'background 0.25s ease',
                }}
              />
            )}
          </Fragment>
        );
      })}
    </Flex>
  );
}

function getStaffInviteCardMeta(phase: StaffInvitePhase): {
  title: string;
  stepNumber?: number;
} {
  switch (phase) {
    case 'loading':
    case 'invite-preview':
      return { title: '确认邀请详情', stepNumber: 1 };
    case 'invite-failure':
      return { title: '邀请无法继续' };
    case 'upstream-auth':
      return { title: '核对上游身份', stepNumber: 2 };
    case 'register-ready':
    case 'submit-failure':
      return { title: '设置平台账户', stepNumber: 3 };
    case 'success':
      return { title: '激活完成' };
    case 'error':
      return { title: '暂时无法继续' };
  }
}

function StaffInviteFlowSection({
  children,
  phase,
}: {
  children: React.ReactNode;
  phase: StaffInvitePhase;
}) {
  const { title, stepNumber } = getStaffInviteCardMeta(phase);

  return (
    <Flex vertical gap={24}>
      {stepNumber !== undefined && <InviteStepBar activeIndex={stepNumber - 1} />}
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
      </div>
      {children}
    </Flex>
  );
}

function StaffInviteStepActions({
  primaryAction,
  secondaryAction,
}: {
  primaryAction: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <Flex gap={8} justify="space-between" wrap>
      <div>{secondaryAction}</div>
      <div>{primaryAction}</div>
    </Flex>
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
      <Button
        type="primary"
        icon={<RightOutlined />}
        iconPosition="end"
        onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}
      >
        返回登录
      </Button>
    </Flex>
  );
}

export function StaffInviteIntentPanel({ verificationCode }: { verificationCode: string }) {
  const navigate = useNavigate();
  const [upstreamForm] = Form.useForm<{ password: string; userId: string }>();
  const [registerForm] = Form.useForm<{
    confirmPassword: string;
    loginName: string;
    loginPassword: string;
    nickname: string;
  }>();
  const [phase, setPhase] = useState<StaffInvitePhase>('loading');
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

  useEffect(() => {
    if (phase === 'upstream-auth') {
      upstreamForm.resetFields();
    }
  }, [phase, upstreamForm]);

  useEffect(() => {
    if (phase === 'register-ready') {
      registerForm.resetFields();
    }
  }, [phase, registerForm]);

  if (phase === 'loading') {
    return (
      <StaffInviteFlowSection phase={phase}>
        <Flex vertical gap={12}>
          <Typography.Text type="secondary">正在确认邀请状态</Typography.Text>
          <Skeleton active paragraph={{ rows: 4 }} title={false} />
        </Flex>
      </StaffInviteFlowSection>
    );
  }

  if (phase === 'invite-failure' && inviteFailure) {
    return (
      <StaffInviteFlowSection phase={phase}>
        <StaffInviteFailureState message={inviteFailure.message} reason={inviteFailure.reason} />
      </StaffInviteFlowSection>
    );
  }

  if (phase === 'error' && pageError) {
    return (
      <StaffInviteFlowSection phase={phase}>
        <Flex vertical gap={16}>
          <Alert type="error" showIcon title="操作失败" description={pageError} />
          <Flex gap={8} justify="flex-end">
            <Button onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>返回登录</Button>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => setReloadKey((current) => current + 1)}
            >
              重新检查邀请
            </Button>
          </Flex>
        </Flex>
      </StaffInviteFlowSection>
    );
  }

  if (!invite) {
    return null;
  }

  if (phase === 'invite-preview') {
    return (
      <StaffInviteFlowSection phase={phase}>
        <Flex vertical gap={16}>
          <div
            className="rounded-card p-4"
            style={{ background: 'var(--ant-color-fill-quaternary)' }}
          >
            <Flex vertical gap={12}>
              <Flex gap={8} align="center">
                <MailOutlined
                  style={{ color: 'var(--ant-color-primary)', fontSize: 'var(--ant-font-size-lg)' }}
                />
                <Typography.Text strong>{invite.invitedEmail}</Typography.Text>
              </Flex>
              <Flex gap={24} wrap style={{ paddingLeft: 24 }}>
                {invite.issuer && (
                  <div>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 'var(--ant-font-size-sm)' }}
                    ></Typography.Text>
                    <div style={{ marginTop: 2 }}>
                      <Typography.Text>{invite.issuer}</Typography.Text>
                    </div>
                  </div>
                )}
                <div>
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 'var(--ant-font-size-sm)' }}
                  ></Typography.Text>
                  <div style={{ marginTop: 2 }}>
                    <Typography.Text>{formatDateTime(invite.expiresAt)}</Typography.Text>
                  </div>
                </div>
              </Flex>
            </Flex>
          </div>

          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {invite.description || '请核对邮箱，无误后进入身份核对流程。'}
          </Typography.Paragraph>

          <StaffInviteStepActions
            primaryAction={
              <Button
                type="primary"
                icon={<RightOutlined />}
                iconPosition="end"
                onClick={() => {
                  setUpstreamError(null);
                  setPhase('upstream-auth');
                }}
              >
                下一步：身份核对
              </Button>
            }
            secondaryAction={
              <Button type="link" onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>
                返回登录
              </Button>
            }
          />
        </Flex>
      </StaffInviteFlowSection>
    );
  }

  if (phase === 'upstream-auth') {
    return (
      <StaffInviteFlowSection phase={phase}>
        <Flex vertical gap={16}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            当前邀请邮箱：{invite.invitedEmail}。核对通过后，身份信息会自动锁定并回填。
          </Typography.Paragraph>

          <UpstreamStaffVerificationForm
            errorMessage={upstreamError}
            form={upstreamForm}
            formId={UPSTREAM_VERIFICATION_FORM_ID}
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

          <StaffInviteStepActions
            primaryAction={
              <Button
                type="primary"
                form={UPSTREAM_VERIFICATION_FORM_ID}
                htmlType="submit"
                icon={<RightOutlined />}
                iconPosition="end"
                loading={verifyingIdentity}
              >
                核对身份并继续
              </Button>
            }
            secondaryAction={
              <Button icon={<LeftOutlined />} onClick={() => setPhase('invite-preview')}>
                上一步
              </Button>
            }
          />
        </Flex>
      </StaffInviteFlowSection>
    );
  }

  if (phase === 'register-ready' && identity) {
    return (
      <StaffInviteFlowSection phase={phase}>
        <Flex vertical gap={16}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            登录邮箱会自动使用本次邀请对应的邮箱。完成提交后，请回到登录页继续使用。
          </Typography.Paragraph>

          <StaffInviteRegisterForm
            errorMessage={submitError}
            form={registerForm}
            formId={REGISTER_FORM_ID}
            identity={identity}
            inviteEmail={invite.invitedEmail}
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

          <StaffInviteStepActions
            primaryAction={
              <Button
                type="primary"
                form={REGISTER_FORM_ID}
                htmlType="submit"
                icon={<CheckOutlined />}
                loading={submitting}
              >
                完成激活
              </Button>
            }
            secondaryAction={
              <Button
                icon={<LeftOutlined />}
                onClick={() => {
                  setIdentity(null);
                  setUpstreamError(null);
                  setSubmitError(null);
                  setPhase('upstream-auth');
                }}
              >
                上一步
              </Button>
            }
          />
        </Flex>
      </StaffInviteFlowSection>
    );
  }

  if (phase === 'submit-failure' && submitFailureMessage) {
    return (
      <StaffInviteFlowSection phase={phase}>
        <Flex vertical gap={16}>
          <Alert type="error" showIcon title="邀请注册未完成" description={submitFailureMessage} />
          <Flex gap={8} justify="flex-end">
            <Button onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}>返回登录</Button>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => setReloadKey((current) => current + 1)}
            >
              重新检查邀请
            </Button>
          </Flex>
        </Flex>
      </StaffInviteFlowSection>
    );
  }

  if (phase === 'success') {
    return (
      <StaffInviteFlowSection phase={phase}>
        <Flex vertical align="center" gap={16} style={{ padding: '16px 0 8px' }}>
          <CheckCircleFilled style={{ fontSize: 48, color: 'var(--ant-color-success)' }} />
          <Flex vertical align="center" gap={4}>
            <Typography.Text strong style={{ fontSize: 'var(--ant-font-size-lg)' }}>
              账号已准备就绪
            </Typography.Text>
            <Typography.Text type="secondary" style={{ textAlign: 'center', maxWidth: 360 }}>
              请返回登录页，使用邀请邮箱或你填写的登录名继续登录。
            </Typography.Text>
          </Flex>
          <Button
            type="primary"
            icon={<RightOutlined />}
            iconPosition="end"
            size="large"
            onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}
          >
            前往登录
          </Button>
        </Flex>
      </StaffInviteFlowSection>
    );
  }

  return null;
}
