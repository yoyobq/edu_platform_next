import { useCallback, useRef, useState } from 'react';
import { Card, Flex, Typography } from 'antd';
import { useParams, useSearchParams } from 'react-router';

import { logout, readStoredAuthSession } from '@/features/auth';
import {
  LoginEmailVerificationIntentPanel,
  type PasswordResetPreview,
  ResetPasswordIntentPanel,
  type ResetPasswordIntentPanelCopy,
  StaffInviteIntentPanel,
  StudentRegistrationLinkPanel,
  type StudentRegistrationPanelContext,
  VerifyEmailIntentPanel,
} from '@/features/public-auth';

import { BrandLockup } from '@/shared/ui/brand';
import { useWidthBand } from '@/shared/ui/responsive-layout';

function VerificationIntentShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: React.ReactNode;
  title: string;
}) {
  return (
    <div className="min-h-screen bg-bg-layout px-6 py-12 text-text">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center">
        <div className="w-full">
          <Flex gap={32} wrap>
            <div className="min-w-70 flex-1">
              <Flex vertical gap={24}>
                <BrandLockup variant="public-entry" />
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
                    {title}
                  </h1>
                  {typeof description === 'string' ? (
                    <Typography.Paragraph
                      type="secondary"
                      style={{ marginBottom: 0, maxWidth: 520 }}
                    >
                      {description}
                    </Typography.Paragraph>
                  ) : (
                    description
                  )}
                </div>
              </Flex>
            </div>

            <div className="min-w-85 flex-1">
              <Card styles={{ body: { padding: 24 } }}>
                <Flex vertical gap={24}>
                  {children}
                </Flex>
              </Card>
            </div>
          </Flex>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_RESET_PASSWORD_PAGE_COPY = {
  description: '为保证账户安全，请设置一个符合要求的新密码。修改完成后即可返回登录页继续使用。',
  panel: {
    readyDescription: '输入过程中会即时检查密码规则，确认通过后即可完成更新。',
    readyTitle: '输入新密码',
    successDescription: '你现在可以使用新密码重新登录。',
    successTitle: '密码已更新',
  },
  title: '设置新密码',
} satisfies {
  description: string;
  panel: ResetPasswordIntentPanelCopy;
  title: string;
};

const WELCOME_BACK_RESET_PASSWORD_PAGE_COPY = {
  description:
    '欢迎回到平台。为保障账户安全，请先设置一个符合要求的新密码，修改完成后即可返回登录页继续使用。',
  panel: {
    readyDescription: '输入过程中会即时检查密码规则，通过后即可完成更新。',
    readyTitle: '设置你的新登录密码',
    successDescription: '欢迎回来，你现在可以使用新密码重新登录。',
    successTitle: '密码已更新',
  },
  title: '欢迎回来，请设置新密码',
} satisfies {
  description: string;
  panel: ResetPasswordIntentPanelCopy;
  title: string;
};

function buildWelcomeBackResetPasswordPageCopy(
  preview: PasswordResetPreview,
): typeof WELCOME_BACK_RESET_PASSWORD_PAGE_COPY {
  const nickname = preview.nickname ? preview.nickname.trim() : '';

  return {
    ...WELCOME_BACK_RESET_PASSWORD_PAGE_COPY,
    title: nickname
      ? `${nickname} 老师，欢迎回来，请设置新密码`
      : WELCOME_BACK_RESET_PASSWORD_PAGE_COPY.title,
  };
}

function ResetPasswordDescription({
  fallback,
  preview,
}: {
  fallback: string;
  preview: PasswordResetPreview | null;
}) {
  const loginEmailMasked = preview?.loginEmailMasked ? preview.loginEmailMasked.trim() : '';

  if (preview?.kind !== 'legacy-user-password-reset' || !loginEmailMasked) {
    return (
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 520 }}>
        {fallback}
      </Typography.Paragraph>
    );
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        欢迎回来。我们更新了密码策略，为了继续保护你的账户，请先设置一个符合要求的新密码。
      </Typography.Paragraph>
      <div
        style={{
          alignItems: 'center',
          background: 'var(--ant-color-fill-tertiary)',
          border: '1px solid var(--ant-color-border-secondary)',
          borderRadius: 8,
          display: 'flex',
          gap: 10,
          padding: '8px 10px',
          width: 'fit-content',
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          登录邮箱
        </Typography.Text>
        <span
          style={{
            color: 'var(--ant-color-text)',
            fontFamily: 'var(--ant-font-family-code)',
            fontSize: 14,
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
          }}
        >
          {loginEmailMasked}
        </span>
      </div>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 12 }}>
        修改完成后，就可以返回登录页继续使用。
      </Typography.Paragraph>
    </div>
  );
}

function resolveResetPasswordPageCopy(scene: string | null) {
  return scene === 'welcome-back'
    ? WELCOME_BACK_RESET_PASSWORD_PAGE_COPY
    : DEFAULT_RESET_PASSWORD_PAGE_COPY;
}

function resolveResetPasswordPageCopyByIntent(
  scene: string | null,
  passwordResetPreview: PasswordResetPreview | null,
) {
  return passwordResetPreview?.kind === 'legacy-user-password-reset'
    ? buildWelcomeBackResetPasswordPageCopy(passwordResetPreview)
    : resolveResetPasswordPageCopy(scene);
}

function InviteFlowShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-layout px-6 py-12 text-text">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-160 flex-col justify-center gap-6">
        {children}
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

type StudentRegistrationWidthBand = 'compact' | 'regular';

const STUDENT_REGISTRATION_WIDTH_RULES: { max: number; value: StudentRegistrationWidthBand }[] = [
  { max: 760, value: 'compact' },
];

function resolveStudentRegistrationLead(context: StudentRegistrationPanelContext) {
  if (context.phase === 'loading') {
    return '正在读取注册链接，请稍候。';
  }

  if (context.phase === 'failure' || context.phase === 'error') {
    return '当前注册链接暂不可用，请根据页面提示处理。';
  }

  if (context.phase === 'pending-email') {
    return '注册信息已提交，接下来请验证登录邮箱。';
  }

  return '请按步骤核对身份并设置平台账号。';
}

export function InviteIntentPage() {
  const { inviteType = '', verificationCode = '' } = useParams();
  const normalizedInviteType = inviteType.trim().toLowerCase();

  if (normalizedInviteType === 'staff') {
    return (
      <InviteFlowShell>
        <Flex vertical gap={8} align="center" style={{ textAlign: 'center' }}>
          <BrandLockup variant="public-entry" />
          <h1
            style={{
              fontSize: 'var(--ant-font-size-heading-3)',
              fontWeight: 600,
              lineHeight: 'var(--ant-line-height-3)',
              margin: 0,
            }}
          >
            教职工邀请激活
          </h1>
          <Typography.Text type="secondary">
            请按页面提示完成邀请确认、身份核对与账户设置
          </Typography.Text>
        </Flex>
        <div className="shadow-card">
          <Card styles={{ body: { padding: '32px 24px' } }}>
            <StaffInviteIntentPanel verificationCode={verificationCode} />
          </Card>
        </div>
      </InviteFlowShell>
    );
  }

  return (
    <VerificationIntentShell
      title="邀请入口"
      description="当前支持教职工邀请链接与学生注册链接。学生注册链接入口为 /invite/student-registration/:token。"
    >
      <VerificationIntentDetails
        details={[
          { label: '邀请类型', value: inviteType },
          { label: '验证代码', value: verificationCode },
          { label: '当前状态', value: '暂不支持这个邀请类型，请确认邮件中的链接是否完整' },
        ]}
      />
    </VerificationIntentShell>
  );
}

export function VerifyEmailIntentPage() {
  const { verificationCode = '' } = useParams();
  const storedSession = readStoredAuthSession();
  const accessToken = storedSession?.accessToken ?? null;

  return (
    <VerificationIntentShell
      title="确认登录邮箱"
      description="验证成功后，系统会把当前账户的登录邮箱更新为邮件中的目标地址。"
    >
      <VerifyEmailIntentPanel
        accessToken={accessToken}
        onConsumeSuccess={storedSession ? async () => logout() : undefined}
        verificationCode={verificationCode}
      />
    </VerificationIntentShell>
  );
}

export function StudentRegistrationPage() {
  const { token = '' } = useParams();
  const shellRef = useRef<HTMLDivElement>(null);
  const { band } = useWidthBand<HTMLDivElement, StudentRegistrationWidthBand>(
    shellRef,
    STUDENT_REGISTRATION_WIDTH_RULES,
    'regular',
  );
  const isCompact = band === 'compact';
  const [registrationContext, setRegistrationContext] = useState<StudentRegistrationPanelContext>({
    currentStep: 0,
    info: null,
    phase: 'loading',
  });
  const registrationClassName = registrationContext.info?.className?.trim();
  const registrationTitle = registrationClassName
    ? `${registrationClassName} 学生注册`
    : '学生注册';

  return (
    <div ref={shellRef} className="min-h-screen bg-bg-layout px-6 py-10 text-text">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl flex-col justify-center gap-6">
        <Flex
          vertical
          gap={20}
          align={isCompact ? 'center' : 'flex-start'}
          style={{ textAlign: isCompact ? 'center' : 'left' }}
        >
          <BrandLockup variant="public-entry" />
          <div style={{ maxWidth: 680 }}>
            <h1
              style={{
                fontSize: 'var(--ant-font-size-heading-3)',
                fontWeight: 600,
                lineHeight: 'var(--ant-line-height-heading-3)',
                marginBottom: 12,
                marginTop: 8,
              }}
            >
              {registrationTitle}
            </h1>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {resolveStudentRegistrationLead(registrationContext)}
            </Typography.Paragraph>
          </div>
        </Flex>

        <Card styles={{ body: { padding: isCompact ? '20px 16px' : 32 } }}>
          <StudentRegistrationLinkPanel
            compact={isCompact}
            token={token}
            onContextChange={setRegistrationContext}
          />
        </Card>
      </div>
    </div>
  );
}

export function VerifyAccountEmailIntentPage() {
  const { token = '' } = useParams();

  return (
    <VerificationIntentShell
      title="验证登录邮箱"
      description="系统会验证邮件中的链接。验证完成后，就可以使用该登录邮箱登录。"
    >
      <LoginEmailVerificationIntentPanel token={token} />
    </VerificationIntentShell>
  );
}

export function ResetPasswordIntentPage({
  scene: sceneProp,
}: {
  scene?: 'default' | 'welcome-back';
} = {}) {
  const { verificationCode: verificationCodeFromPath = '' } = useParams();
  const [searchParams] = useSearchParams();
  const verificationCode = verificationCodeFromPath || searchParams.get('token') || '';
  const scene = sceneProp || searchParams.get('scene');
  const resetIntentKey = `${scene ?? ''}:${verificationCode}`;
  const [passwordResetPreviewState, setPasswordResetPreviewState] = useState<{
    key: string;
    preview: PasswordResetPreview | null;
  } | null>(null);
  const passwordResetPreview =
    passwordResetPreviewState?.key === resetIntentKey ? passwordResetPreviewState.preview : null;
  const pageCopy = resolveResetPasswordPageCopyByIntent(scene, passwordResetPreview);
  const handleIntentPreviewChange = useCallback(
    (preview: PasswordResetPreview | null) => {
      setPasswordResetPreviewState({
        key: resetIntentKey,
        preview,
      });
    },
    [resetIntentKey],
  );

  return (
    <VerificationIntentShell
      title={pageCopy.title}
      description={
        <ResetPasswordDescription fallback={pageCopy.description} preview={passwordResetPreview} />
      }
    >
      <ResetPasswordIntentPanel
        copy={pageCopy.panel}
        onIntentPreviewChange={handleIntentPreviewChange}
        verificationCode={verificationCode}
      />
    </VerificationIntentShell>
  );
}

export function WelcomeBackResetPasswordIntentPage() {
  return <ResetPasswordIntentPage scene="welcome-back" />;
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
