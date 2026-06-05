import { useMemo, useState } from 'react';
import { CopyOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Radio, Space, Tag, Typography } from 'antd';

import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import { inviteIssuerLabAccess } from './access';
import {
  adminRequestPasswordResetEmail,
  issueStaffInvite,
  issueStudentRegistrationLink,
} from './api';
import { inviteIssuerLabMeta } from './meta';

type InviteIssuerType = 'staff' | 'studentRegistration' | 'welcomeBack';

type InviteIssuerFormValues = {
  accountId?: string;
  classCode?: string;
  inviteType: InviteIssuerType;
  invitedEmail?: string;
  staffId?: string;
  studentId?: string;
};

type InviteIssueResult = {
  accountId: number | null;
  classCode: string | null;
  expiresAt: string | null;
  inviteLink: string | null;
  message: string | null;
  recordId: number | null;
  secondaryLink: string | null;
  studentId: string | null;
  token: string | null;
  type: 'INVITE_STAFF' | 'PASSWORD_RESET' | 'STUDENT_REGISTRATION_LINK' | null;
};

const inviteTypeOptions = [
  { label: '教职工邀请', value: 'staff' },
  { label: '学生注册链接', value: 'studentRegistration' },
  { label: '老用户回归', value: 'welcomeBack' },
] satisfies readonly { label: string; value: InviteIssuerType }[];

function formatDateTime(value: string | null) {
  if (!value) {
    return '未返回';
  }

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
    second: '2-digit',
  });
}

function ResultItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Paragraph copyable={{ text: value }} style={{ marginBottom: 0 }}>
        {value}
      </Typography.Paragraph>
    </div>
  );
}

function buildAbsoluteLink(origin: string, path: string) {
  return origin ? `${origin}${path}` : path;
}

export function InviteIssuerLabPage() {
  const [form] = Form.useForm<InviteIssuerFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteIssueResult | null>(null);
  const inviteType = Form.useWatch('inviteType', form) || 'staff';
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const resultTitle = useMemo(() => {
    if (result?.type === 'PASSWORD_RESET') {
      return '老用户回归邮件已触发';
    }

    if (result?.type === 'STUDENT_REGISTRATION_LINK') {
      return '学生注册链接已签发';
    }

    return '教职工邀请已签发';
  }, [result?.type]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              临时邀请签发页
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {inviteIssuerLabMeta.purpose}
            </Typography.Paragraph>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tag color="blue">负责人：{inviteIssuerLabMeta.owner}</Tag>
            <Tag color="purple">复核时间：{inviteIssuerLabMeta.reviewAt}</Tag>
            <Tag color="green">环境：{inviteIssuerLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">访问级别：{inviteIssuerLabAccess.allowedAccessLevels.join(', ')}</Tag>
          </div>

          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            这是临时联调工具，不承担正式管理后台职责。当前直接调用后端 `inviteStaff` /
            `issueStudentRegistrationLink` / `adminRequestPasswordResetEmail` mutation，并把返回
            token 或入口链接展示出来便于核对。
          </Typography.Paragraph>
        </div>
      </Card>

      <ResponsiveGrid
        className="gap-4"
        columns={{ compact: 1, wide: 'minmax(320px, 520px) minmax(0, 1fr)' }}
      >
        <Card title="签发">
          <Form<InviteIssuerFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            size="large"
            initialValues={{ inviteType: 'staff' }}
            onFinish={async (values) => {
              setSubmitting(true);
              setSubmitError(null);

              try {
                if (values.inviteType === 'welcomeBack') {
                  const accountId = Number(values.accountId);

                  if (!Number.isInteger(accountId) || accountId <= 0) {
                    throw new Error('请输入有效的账号 ID。');
                  }

                  const issued = await adminRequestPasswordResetEmail({
                    accountId,
                  });
                  const resetPath = '/reset-password?token={token}';
                  const legacyResetPath = '/welcome-back/reset-password?token={token}';

                  setResult({
                    accountId,
                    classCode: null,
                    expiresAt: null,
                    inviteLink: buildAbsoluteLink(origin, resetPath),
                    message:
                      issued.message ||
                      '已向该账号注册邮箱发送密码设置邮件。前端会根据 verification payload 中的 preview.kind、nickname、loginEmailMasked 自动展示老用户回归文案。',
                    recordId: null,
                    secondaryLink: buildAbsoluteLink(origin, legacyResetPath),
                    studentId: null,
                    token: null,
                    type: 'PASSWORD_RESET',
                  });
                  return;
                }

                if (values.inviteType === 'studentRegistration') {
                  const classCode = values.classCode?.trim() || '';

                  if (!classCode) {
                    throw new Error('请输入班级代码。');
                  }

                  const issued = await issueStudentRegistrationLink({
                    classCode,
                    studentId: values.studentId?.trim() || undefined,
                  });

                  setResult({
                    accountId: null,
                    classCode: issued.classCode,
                    expiresAt: issued.expiresAt,
                    inviteLink: issued.link,
                    message: '已签发学生注册链接，学生打开后会进入公开注册主线。',
                    recordId: issued.recordId,
                    secondaryLink: null,
                    studentId: issued.studentId,
                    token: issued.token,
                    type: 'STUDENT_REGISTRATION_LINK',
                  });
                  return;
                }

                const invitedEmail = values.invitedEmail?.trim() || '';
                const issued = await issueStaffInvite({
                  invitedEmail,
                  staffId: values.staffId?.trim() || undefined,
                });
                const invitePath = issued.token ? `/invite/staff/${issued.token}` : null;

                setResult({
                  accountId: null,
                  classCode: null,
                  ...issued,
                  inviteLink: invitePath && origin ? `${origin}${invitePath}` : invitePath,
                  secondaryLink: null,
                  studentId: null,
                });
              } catch (error) {
                setResult(null);
                setSubmitError(error instanceof Error ? error.message : '邀请签发失败。');
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitError ? (
              <Form.Item>
                <Alert type="error" showIcon title={submitError} />
              </Form.Item>
            ) : null}

            <Form.Item
              label="邀请类型"
              name="inviteType"
              rules={[{ required: true, message: '请选择邀请类型。' }]}
            >
              <Radio.Group optionType="button" buttonStyle="solid" options={inviteTypeOptions} />
            </Form.Item>

            <Form.Item
              label={
                inviteType === 'welcomeBack'
                  ? '账号 ID'
                  : inviteType === 'studentRegistration'
                    ? '班级代码'
                    : '被邀请邮箱'
              }
              name={
                inviteType === 'welcomeBack'
                  ? 'accountId'
                  : inviteType === 'studentRegistration'
                    ? 'classCode'
                    : 'invitedEmail'
              }
              validateTrigger={['onChange', 'onBlur']}
              rules={
                inviteType === 'welcomeBack'
                  ? [
                      { required: true, message: '请输入账号 ID。' },
                      {
                        pattern: /^[1-9]\d*$/,
                        message: '账号 ID 必须是正整数。',
                      },
                    ]
                  : inviteType === 'studentRegistration'
                    ? [{ required: true, message: '请输入班级代码。', whitespace: true }]
                    : [
                        { required: true, message: '请输入被邀请邮箱。' },
                        { type: 'email', message: '请输入有效邮箱地址。' },
                      ]
              }
            >
              <Input
                placeholder={
                  inviteType === 'welcomeBack'
                    ? '请输入目标账号 ID'
                    : inviteType === 'studentRegistration'
                      ? '请输入班级代码'
                      : '请输入被邀请邮箱'
                }
                autoComplete={
                  inviteType === 'studentRegistration' || inviteType === 'welcomeBack'
                    ? 'off'
                    : 'email'
                }
              />
            </Form.Item>

            {inviteType === 'welcomeBack' ? (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
                title="将按账号 ID 触发密码找回邮件"
                description="后端会在 verification payload 中写入 preview.kind=legacy-user-password-reset、nickname 和 loginEmailMasked。邮件里的 token 仍由后端签发并发送给注册邮箱，用户打开链接后继续走现有 resetPassword(token, newPassword)。"
              />
            ) : null}

            {inviteType === 'staff' ? (
              <Form.Item label="教职工 ID" name="staffId">
                <Input placeholder="可选，按后端当前 contract 传 staffId" />
              </Form.Item>
            ) : inviteType === 'studentRegistration' ? (
              <Form.Item label="学生编号（可选）" name="studentId">
                <Input placeholder="留空签发班级共享链接；填写后签发指定学生链接" />
              </Form.Item>
            ) : null}

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block loading={submitting}>
                {inviteType === 'welcomeBack'
                  ? '发送回归改密邮件'
                  : inviteType === 'studentRegistration'
                    ? '签发学生注册链接'
                    : '签发邀请'}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card
          title="签发结果"
          extra={
            result?.inviteLink ? (
              <Button
                icon={<CopyOutlined />}
                onClick={async () => {
                  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
                    return;
                  }

                  await navigator.clipboard.writeText(result.inviteLink || '');
                }}
              >
                {result.type === 'PASSWORD_RESET' ? '复制入口模板' : '复制链接'}
              </Button>
            ) : null
          }
        >
          {result ? (
            <div className="flex flex-col gap-4">
              <Alert
                type="success"
                showIcon
                title={resultTitle}
                description={result.message || '后端已返回可用的签发结果。'}
              />

              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <ResultItem label="类型" value={result.type || '未返回'} />
                {result.accountId ? (
                  <ResultItem label="目标账号 ID" value={String(result.accountId)} />
                ) : null}
                {result.classCode ? <ResultItem label="班级代码" value={result.classCode} /> : null}
                {result.studentId ? <ResultItem label="学生编号" value={result.studentId} /> : null}
                {result.recordId ? (
                  <ResultItem label="记录 ID" value={String(result.recordId)} />
                ) : null}
                <ResultItem label="Token" value={result.token || '邮件发送，前端不返回 token'} />
                <ResultItem label="过期时间" value={formatDateTime(result.expiresAt)} />
                <ResultItem
                  label={result.type === 'PASSWORD_RESET' ? '普通入口模板' : '入口链接'}
                  value={result.inviteLink || '未返回'}
                />
                {result.secondaryLink ? (
                  <ResultItem label="回归入口模板" value={result.secondaryLink} />
                ) : null}
              </Space>
            </div>
          ) : (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              签发成功后，这里会展示 token、过期时间和可核对的入口链接。老用户回归邮件不会把真实
              token 返回给前端。
            </Typography.Paragraph>
          )}
        </Card>
      </ResponsiveGrid>
    </div>
  );
}
