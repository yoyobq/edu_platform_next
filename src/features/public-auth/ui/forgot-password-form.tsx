import { Alert, Button, Form, Input } from 'antd';

type ForgotPasswordFormValues = {
  email: string;
};

type ForgotPasswordFormProps = {
  errorMessage: string | null;
  onSubmit: (values: ForgotPasswordFormValues) => Promise<void>;
  submitting: boolean;
};

export function ForgotPasswordForm({
  errorMessage,
  onSubmit,
  submitting,
}: ForgotPasswordFormProps) {
  return (
    <Form<ForgotPasswordFormValues>
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
        label="邮箱"
        name="email"
        rules={[
          { required: true, message: '请输入邮箱。' },
          { type: 'email', message: '请输入有效邮箱地址。' },
        ]}
      >
        <Input placeholder="请输入邮箱" autoComplete="email" />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0 }}>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          发送重置邮件
        </Button>
      </Form.Item>
    </Form>
  );
}
