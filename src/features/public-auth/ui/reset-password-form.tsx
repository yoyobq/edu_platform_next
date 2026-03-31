import { Alert, Button, Form, Input } from 'antd';

type ResetPasswordFormValues = {
  confirmPassword: string;
  newPassword: string;
};

type ResetPasswordFormProps = {
  errorMessage: string | null;
  onSubmit: (values: ResetPasswordFormValues) => Promise<void>;
  submitting: boolean;
};

export function ResetPasswordForm({ errorMessage, onSubmit, submitting }: ResetPasswordFormProps) {
  return (
    <Form<ResetPasswordFormValues>
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
        label="新密码"
        name="newPassword"
        rules={[
          { required: true, message: '请输入新密码。' },
          { min: 8, message: '新密码至少需要 8 位。' },
        ]}
      >
        <Input.Password placeholder="请输入新密码" autoComplete="new-password" />
      </Form.Item>

      <Form.Item
        label="确认新密码"
        name="confirmPassword"
        dependencies={['newPassword']}
        rules={[
          { required: true, message: '请再次输入新密码。' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('newPassword') === value) {
                return Promise.resolve();
              }

              return Promise.reject(new Error('两次输入的密码不一致。'));
            },
          }),
        ]}
      >
        <Input.Password placeholder="请再次输入新密码" autoComplete="new-password" />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0 }}>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          更新密码
        </Button>
      </Form.Item>
    </Form>
  );
}
