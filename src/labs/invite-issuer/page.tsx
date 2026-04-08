import { useMemo, useState } from 'react';
import { CopyOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Radio, Space, Tag, Typography } from 'antd';

import { inviteIssuerLabAccess } from './access';
import { issueStaffInvite, issueStudentInvite } from './api';
import { inviteIssuerLabMeta } from './meta';

type InviteIssuerType = 'staff' | 'student';

type InviteIssuerFormValues = {
  inviteType: InviteIssuerType;
  invitedEmail: string;
  staffId?: string;
  studentId?: string;
};

type InviteIssueResult = {
  expiresAt: string | null;
  inviteLink: string | null;
  message: string | null;
  recordId: number | null;
  token: string | null;
  type: 'INVITE_STAFF' | 'INVITE_STUDENT' | null;
};

const inviteTypeOptions = [
  { label: '教职工邀请', value: 'staff' },
  { label: '学生邀请', value: 'student' },
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

export function InviteIssuerLabPage() {
  const [form] = Form.useForm<InviteIssuerFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteIssueResult | null>(null);
  const inviteType = Form.useWatch('inviteType', form) || 'staff';
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const resultTitle = useMemo(() => {
    if (result?.type === 'INVITE_STUDENT') {
      return '学生邀请已签发';
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
            `inviteStudent` mutation，并把返回 token 组装成可直接访问的邀请链接。
          </Typography.Paragraph>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,520px)_minmax(0,1fr)]">
        <Card title="签发邀请">
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
                const issued =
                  values.inviteType === 'student'
                    ? await issueStudentInvite({
                        invitedEmail: values.invitedEmail.trim(),
                        studentId: values.studentId?.trim() || undefined,
                      })
                    : await issueStaffInvite({
                        invitedEmail: values.invitedEmail.trim(),
                        staffId: values.staffId?.trim() || undefined,
                      });

                const invitePath =
                  issued.token && issued.type === 'INVITE_STUDENT'
                    ? `/invite/student/${issued.token}`
                    : issued.token
                      ? `/invite/staff/${issued.token}`
                      : null;

                setResult({
                  ...issued,
                  inviteLink: invitePath && origin ? `${origin}${invitePath}` : invitePath,
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
              label="被邀请邮箱"
              name="invitedEmail"
              rules={[
                { required: true, message: '请输入被邀请邮箱。' },
                { type: 'email', message: '请输入有效邮箱地址。' },
              ]}
            >
              <Input placeholder="请输入被邀请邮箱" autoComplete="email" />
            </Form.Item>

            {inviteType === 'student' ? (
              <Form.Item label="学生 ID" name="studentId">
                <Input placeholder="可选，按后端当前 contract 传 studentId" />
              </Form.Item>
            ) : (
              <Form.Item label="教职工 ID" name="staffId">
                <Input placeholder="可选，按后端当前 contract 传 staffId" />
              </Form.Item>
            )}

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block loading={submitting}>
                签发邀请
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
                复制链接
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
                description={result.message || '后端已返回可用的邀请结果。'}
              />

              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <ResultItem label="邀请类型" value={result.type || '未返回'} />
                <ResultItem label="记录 ID" value={String(result.recordId ?? '未返回')} />
                <ResultItem label="Token" value={result.token || '未返回'} />
                <ResultItem label="过期时间" value={formatDateTime(result.expiresAt)} />
                <ResultItem label="邀请链接" value={result.inviteLink || '未返回'} />
              </Space>
            </div>
          ) : (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              签发成功后，这里会展示 token、过期时间和可直接打开的邀请链接。
            </Typography.Paragraph>
          )}
        </Card>
      </div>
    </div>
  );
}
