import { useMemo, useState } from 'react';
import { Alert, Button, Card, Form, Input, Space, Tag, Typography } from 'antd';

import { changeLoginEmailLabAccess } from './access';
import { requestChangeLoginEmail } from './api';
import { changeLoginEmailLabMeta } from './meta';

type ChangeLoginEmailFormValues = {
  newLoginEmail: string;
};

type ChangeLoginEmailSubmitResult = {
  callbackPattern: string;
  message: string | null;
  newLoginEmail: string;
};

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
            description="当前页面只负责触发 requestChangeLoginEmail。邮件中的真实验证 token 不会返回给前端，邮件跳转地址是否正确取决于后端 CHANGE_LOGIN_EMAIL_FRONTEND_URL 配置。"
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
                const response = await requestChangeLoginEmail({
                  newLoginEmail,
                });

                setResult({
                  callbackPattern,
                  message: response.message,
                  newLoginEmail,
                });
              } catch (error) {
                setResult(null);
                setSubmitError(
                  error instanceof Error ? error.message : '暂时无法发送登录邮箱变更邮件。',
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

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block loading={submitting}>
                发送验证邮件
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card title="发送结果">
          {result ? (
            <div className="flex flex-col gap-4">
              <Alert
                type="success"
                showIcon
                title="验证邮件已请求发送"
                description={
                  result.message || '后端已接受请求，请到目标邮箱中继续点击验证链接完成变更。'
                }
              />

              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
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
