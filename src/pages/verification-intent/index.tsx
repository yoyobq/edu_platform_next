import { Card, Flex, Typography } from 'antd';
import { useParams, useSearchParams } from 'react-router';

import { ResetPasswordIntentPanel, StaffInviteIntentPanel } from '@/features/public-auth';

import { BrandLockup } from '@/shared/ui/brand';

function VerificationIntentShell({
  children,
  description,
  showEntryLabel = true,
  title,
}: {
  children: React.ReactNode;
  description: string;
  showEntryLabel?: boolean;
  title: string;
}) {
  return (
    <div className="min-h-screen bg-bg-layout px-6 py-12 text-text">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center">
        <Flex gap={32} className="w-full" wrap>
          <Flex vertical gap={24} className="min-w-[280px] flex-1">
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

          <div className="min-w-[320px] flex-1">
            <Card styles={{ body: { padding: 24 } }}>
              <Flex vertical gap={16}>
                {showEntryLabel ? (
                  <Typography.Text type="secondary">公共认证入口</Typography.Text>
                ) : null}
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

export function InviteIntentPage() {
  const { inviteType = '', verificationCode = '' } = useParams();
  const normalizedInviteType = inviteType.trim().toLowerCase();

  if (normalizedInviteType === 'staff') {
    return (
      <VerificationIntentShell
        title="教职工邀请激活"
        description="当前邀请流程会先确认链接状态，再完成上游教职工身份核对与最小注册。"
      >
        <StaffInviteIntentPanel verificationCode={verificationCode} />
      </VerificationIntentShell>
    );
  }

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
  const { verificationCode: verificationCodeFromPath = '' } = useParams();
  const [searchParams] = useSearchParams();
  const verificationCode = verificationCodeFromPath || searchParams.get('token') || '';

  return (
    <VerificationIntentShell
      title="设置新密码"
      description="为保证账户安全，请设置一个符合要求的新密码。修改完成后即可返回登录页继续使用。"
      showEntryLabel={false}
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
