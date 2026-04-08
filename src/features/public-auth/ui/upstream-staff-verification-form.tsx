import { Alert, Button, Form, Input } from 'antd';

type UpstreamStaffVerificationFormValues = {
  password: string;
  userId: string;
};

type UpstreamStaffVerificationFormProps = {
  errorMessage: string | null;
  onSubmit: (values: UpstreamStaffVerificationFormValues) => Promise<void>;
  submitting: boolean;
};

export function UpstreamStaffVerificationForm({
  errorMessage,
  onSubmit,
  submitting,
}: UpstreamStaffVerificationFormProps) {
  return (
    <Form<UpstreamStaffVerificationFormValues>
      layout="vertical"
      requiredMark={false}
      onFinish={onSubmit}
      autoComplete="on"
      size="large"
    >
      {errorMessage ? (
        <Form.Item>
          <Alert type="error" showIcon title={errorMessage} />
        </Form.Item>
      ) : null}

      <Form.Item
        label="上游账号"
        name="userId"
        rules={[{ required: true, message: '请输入上游账号。', whitespace: true }]}
      >
        <Input placeholder="请输入上游账号" autoComplete="username" />
      </Form.Item>

      <Form.Item
        label="上游密码"
        name="password"
        rules={[{ required: true, message: '请输入上游密码。' }]}
      >
        <Input.Password placeholder="请输入上游密码" autoComplete="current-password" />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0 }}>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          核对教职工身份
        </Button>
      </Form.Item>
    </Form>
  );
}
