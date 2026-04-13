import { Card, Flex, Typography } from 'antd';
import { useParams, useSearchParams } from 'react-router';

import { logout, readStoredAuthSession } from '@/features/auth';
import {
  ResetPasswordIntentPanel,
  StaffInviteIntentPanel,
  VerifyEmailIntentPanel,
} from '@/features/public-auth';

import { BrandLockup } from '@/shared/ui/brand';

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
          <Flex vertical gap={24} className="min-w-70 flex-1">
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
                {title}
              </h1>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 520 }}>
                {description}
              </Typography.Paragraph>
            </div>
          </Flex>

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
  );
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
              fontWeight: 'var(--ant-font-weight-heading)',
              lineHeight: 'var(--ant-line-height-3)',
              margin: 0,
            }}
          >
            教职工邀请激活
          </h1>
          <Typography.Text type="secondary">
            请按步骤完成链接确认、上游身份核对与账户设置
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
      description="邀请类一次性入口保持 path-first 语义。当前仅教职工邀请已接入真实激活流程，其它类型仍保留为受限入口。"
    >
      <VerificationIntentDetails
        details={[
          { label: '邀请类型', value: inviteType },
          { label: '验证代码', value: verificationCode },
          { label: '当前状态', value: '仅保留入口与参数展示，暂未接入真实激活流程' },
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

export function ResetPasswordIntentPage() {
  const { verificationCode: verificationCodeFromPath = '' } = useParams();
  const [searchParams] = useSearchParams();
  const verificationCode = verificationCodeFromPath || searchParams.get('token') || '';

  return (
    <VerificationIntentShell
      title="设置新密码"
      description="为保证账户安全，请设置一个符合要求的新密码。修改完成后即可返回登录页继续使用。"
    >
      <ResetPasswordIntentPanel verificationCode={verificationCode} />
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
