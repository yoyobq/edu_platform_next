import type { FormInstance } from 'antd';
import { Alert, Form, Input, Typography } from 'antd';

type UpstreamStaffVerificationFormValues = {
  password: string;
  userId: string;
};

type UpstreamStaffVerificationFormProps = {
  errorMessage: string | null;
  form: FormInstance<UpstreamStaffVerificationFormValues>;
  formId: string;
  onSubmit: (values: UpstreamStaffVerificationFormValues) => Promise<void>;
};

export function UpstreamStaffVerificationForm({
  errorMessage,
  form,
  formId,
  onSubmit,
}: UpstreamStaffVerificationFormProps) {
  return (
    <Form<UpstreamStaffVerificationFormValues>
      form={form}
      id={formId}
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

      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        这里填写的是校园网账号，不是当前平台登录账号。
      </Typography.Paragraph>

      <Form.Item
        label="校园网工号"
        name="userId"
        rules={[{ required: true, message: '请输入校园网工号。', whitespace: true }]}
      >
        <Input placeholder="请输入校园网工号" autoComplete="username" />
      </Form.Item>

      <Form.Item
        label="校园网密码"
        name="password"
        rules={[{ required: true, message: '请输入校园网密码。' }]}
      >
        <Input.Password placeholder="请输入校园网密码" autoComplete="current-password" />
      </Form.Item>
    </Form>
  );
}
