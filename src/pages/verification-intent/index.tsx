import { Card, Flex, Tag, Typography } from 'antd';
import { useParams } from 'react-router';

function VerificationIntentShell({
  description,
  details,
  title,
}: {
  description: string;
  details: readonly { label: string; value: string }[];
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

                {details.map((detail) => (
                  <div key={detail.label}>
                    <Typography.Text type="secondary">{detail.label}</Typography.Text>
                    <Typography.Paragraph style={{ marginBottom: 0, marginTop: 4 }}>
                      {detail.value}
                    </Typography.Paragraph>
                  </div>
                ))}
              </Flex>
            </Card>
          </div>
        </Flex>
      </div>
    </div>
  );
}

export function InviteIntentPage() {
  const { inviteType = '', verificationCode = '' } = useParams();

  return (
    <VerificationIntentShell
      title="邀请入口"
      description="邀请类一次性入口保持 path-first 语义，后续可在此处继续校验 invite intent 并决定是否要求登录。"
      details={[
        { label: '邀请类型', value: inviteType },
        { label: '验证代码', value: verificationCode },
      ]}
    />
  );
}

export function VerifyEmailIntentPage() {
  const { verificationCode = '' } = useParams();

  return (
    <VerificationIntentShell
      title="邮箱验证入口"
      description="邮箱验证入口独立于普通 redirect 回跳，便于后续接入专门的 intent 预解析与继续流程。"
      details={[{ label: '验证代码', value: verificationCode }]}
    />
  );
}

export function ResetPasswordIntentPage() {
  const { verificationCode = '' } = useParams();

  return (
    <VerificationIntentShell
      title="重置密码入口"
      description="重置密码流程使用显式 path 承载一次性业务语义，避免和普通登录后回跳参数混写。"
      details={[{ label: '验证代码', value: verificationCode }]}
    />
  );
}

export function MagicLinkIntentPage() {
  const { verificationCode = '' } = useParams();

  return (
    <VerificationIntentShell
      title="Magic Link 入口"
      description="Magic Link 入口保留为公共分流路径，后续可以在这里串联 token 校验、登录续接与站内落点决策。"
      details={[{ label: '验证代码', value: verificationCode }]}
    />
  );
}
