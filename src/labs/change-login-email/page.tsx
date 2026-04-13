import { useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Form, Input, Space, Tag, Typography } from 'antd';

import { changeLoginEmailLabAccess } from './access';
import { adminRequestChangeLoginEmail, requestChangeLoginEmail } from './api';
import { changeLoginEmailLabMeta } from './meta';

type ChangeLoginEmailFormValues = {
  newLoginEmail: string;
  targetAccountId?: string;
};

type ChangeLoginEmailSubmitResult = {
  accountId: string | null;
  callbackPattern: string;
  message: string | null;
  newLoginEmail: string;
  requestMode: 'admin' | 'self';
};

type SubmitMode = 'admin' | 'self';

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

export function ChangeLoginEmailLabPage() {
  const [form] = Form.useForm<ChangeLoginEmailFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ChangeLoginEmailSubmitResult | null>(null);
  const submitModeRef = useRef<SubmitMode>('self');
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const callbackPattern = useMemo(() => {
    const pathPattern = '/verify/email/{verificationCode}';

    return origin ? `${origin}${pathPattern}` : pathPattern;
  }, [origin]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              登录邮箱变更发信页
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {changeLoginEmailLabMeta.purpose}
            </Typography.Paragraph>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tag color="blue">负责人：{changeLoginEmailLabMeta.owner}</Tag>
            <Tag color="purple">复核时间：{changeLoginEmailLabMeta.reviewAt}</Tag>
            <Tag color="green">环境：{changeLoginEmailLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">
              访问级别：{changeLoginEmailLabAccess.allowedAccessLevels.join(', ')}
            </Tag>
          </div>

          <Alert
            type="info"
            showIcon
            message="联调说明"
            description="当前页面支持两种签发：给当前登录账号自己发，或以 admin 身份给指定 accountId 发。邮件中的真实验证 token 不会返回给前端，邮件跳转地址是否正确取决于后端 CHANGE_LOGIN_EMAIL_FRONTEND_URL 配置。"
          />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,520px)_minmax(0,1fr)]">
        <Card title="发送验证邮件">
          <Form<ChangeLoginEmailFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            size="large"
            onFinish={async (values) => {
              setSubmitting(true);
              setSubmitError(null);

              try {
                const newLoginEmail = values.newLoginEmail.trim();
                const targetAccountId = values.targetAccountId?.trim() || null;
                const submitMode = submitModeRef.current;
                let response;

                if (submitMode === 'admin') {
                  if (!targetAccountId) {
                    form.setFields([
                      {
                        name: 'targetAccountId',
                        errors: ['请输入目标账号 ID。'],
                      },
                    ]);
                    return;
                  }

                  if (!/^\d+$/.test(targetAccountId)) {
                    form.setFields([
                      {
                        name: 'targetAccountId',
                        errors: ['目标账号 ID 必须是正整数。'],
                      },
                    ]);
                    return;
                  }

                  response = await adminRequestChangeLoginEmail({
                    accountId: Number.parseInt(targetAccountId, 10),
                    newLoginEmail,
                  });
                } else {
                  response = await requestChangeLoginEmail({
                    newLoginEmail,
                  });
                }

                setResult({
                  accountId: submitMode === 'admin' ? targetAccountId : null,
                  callbackPattern,
                  message: response.message,
                  newLoginEmail,
                  requestMode: submitMode,
                });
              } catch (error) {
                setResult(null);
                setSubmitError(
                  error instanceof Error
                    ? error.message
                    : submitModeRef.current === 'admin'
                      ? '暂时无法为指定账号发送登录邮箱变更邮件。'
                      : '暂时无法发送登录邮箱变更邮件。',
                );
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
              label="新的登录邮箱"
              name="newLoginEmail"
              rules={[
                { required: true, message: '请输入新的登录邮箱。' },
                { type: 'email', message: '请输入有效邮箱地址。' },
              ]}
            >
              <Input placeholder="请输入新的登录邮箱" autoComplete="email" />
            </Form.Item>

            <Form.Item
              label="目标账号 ID"
              name="targetAccountId"
              extra="仅在使用 admin 为别人签发时必填。给自己发时可以留空。"
              rules={[
                {
                  validator: async (_, value) => {
                    const normalizedValue = typeof value === 'string' ? value.trim() : '';

                    if (!normalizedValue || /^\d+$/.test(normalizedValue)) {
                      return;
                    }

                    throw new Error('目标账号 ID 必须是正整数。');
                  },
                },
              ]}
            >
              <Input placeholder="请输入目标账号 ID" inputMode="numeric" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Space.Compact block>
                <Button
                  type="primary"
                  block
                  loading={submitting && submitModeRef.current === 'self'}
                  onClick={() => {
                    submitModeRef.current = 'self';
                    form.submit();
                  }}
                >
                  给自己发送验证邮件
                </Button>
                <Button
                  block
                  loading={submitting && submitModeRef.current === 'admin'}
                  onClick={() => {
                    submitModeRef.current = 'admin';
                    form.submit();
                  }}
                >
                  以 admin 身份为指定账号发送
                </Button>
              </Space.Compact>
            </Form.Item>
          </Form>
        </Card>

        <Card title="发送结果">
          {result ? (
            <div className="flex flex-col gap-4">
              <Alert
                type="success"
                showIcon
                title={
                  result.requestMode === 'admin'
                    ? '指定账号的验证邮件已请求发送'
                    : '验证邮件已请求发送'
                }
                description={
                  result.message || '后端已接受请求，请到目标邮箱中继续点击验证链接完成变更。'
                }
              />

              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <ResultItem
                  label="签发方式"
                  value={
                    result.requestMode === 'admin' ? 'admin 为指定账号签发' : '当前登录账号自己发起'
                  }
                />
                {result.accountId ? (
                  <ResultItem label="目标账号 ID" value={result.accountId} />
                ) : null}
                <ResultItem label="目标登录邮箱" value={result.newLoginEmail} />
                <ResultItem label="前端验证链接格式" value={result.callbackPattern} />
              </Space>

              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                邮件里的真实链接会把 {'{verificationCode}'} 替换成后端签发的
                token。如果收到的邮件没有跳到当前站点的
                {' /verify/email/{verificationCode} '}，需要去后端环境检查
                `CHANGE_LOGIN_EMAIL_FRONTEND_URL`。
              </Typography.Paragraph>
            </div>
          ) : (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              发送成功后，这里会展示目标邮箱与当前前端期望承接的验证链接格式。
            </Typography.Paragraph>
          )}
        </Card>
      </div>
    </div>
  );
}
