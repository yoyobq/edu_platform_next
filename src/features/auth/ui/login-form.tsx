// src/features/auth/ui/login-form.tsx

import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input } from 'antd';

type LoginFormValues = {
  loginName: string;
  loginPassword: string;
};

type LoginFormProps = {
  errorMessage: string | null;
  initialLoginName?: string | null;
  onSubmit: (values: LoginFormValues) => Promise<void>;
  submitting: boolean;
};

export function LoginForm({
  errorMessage,
  initialLoginName,
  onSubmit,
  submitting,
}: LoginFormProps) {
  return (
    <Form<LoginFormValues>
      layout="vertical"
      requiredMark={false}
      onFinish={onSubmit}
      autoComplete="on"
      size="large"
      initialValues={{
        loginName: initialLoginName ?? undefined,
      }}
    >
      {errorMessage ? (
        <Form.Item>
          <Alert type="error" showIcon title={errorMessage} />
        </Form.Item>
      ) : null}

      <Form.Item
        label="登录名或邮箱"
        name="loginName"
        rules={[{ required: true, message: '请输入登录名或邮箱。' }]}
      >
        <Input
          placeholder="请输入登录名或邮箱"
          autoComplete="username"
          prefix={<UserOutlined aria-hidden="true" />}
        />
      </Form.Item>

      <Form.Item
        label="密码"
        name="loginPassword"
        rules={[{ required: true, message: '请输入密码。' }]}
      >
        <Input.Password
          placeholder="请输入密码"
          autoComplete="current-password"
          prefix={<LockOutlined aria-hidden="true" />}
        />
      </Form.Item>

      <div className="login-submit-action">
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            登录
          </Button>
        </Form.Item>
      </div>
    </Form>
  );
}
