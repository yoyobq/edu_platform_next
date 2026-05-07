import { useEffect } from 'react';
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
  lockedUserId?: string | null;
  onSubmit: (values: UpstreamStaffVerificationFormValues) => Promise<void>;
};

export function UpstreamStaffVerificationForm({
  errorMessage,
  form,
  formId,
  lockedUserId,
  onSubmit,
}: UpstreamStaffVerificationFormProps) {
  const normalizedLockedUserId = lockedUserId?.trim() || null;

  useEffect(() => {
    if (normalizedLockedUserId) {
      form.setFieldValue('userId', normalizedLockedUserId);
    }
  }, [form, normalizedLockedUserId]);

  return (
    <Form<UpstreamStaffVerificationFormValues>
      form={form}
      id={formId}
      initialValues={normalizedLockedUserId ? { userId: normalizedLockedUserId } : undefined}
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
        请使用本次邀请指定的校园网工号完成身份核对。这里需要填写的是校园网密码，不是当前平台登录密码。
      </Typography.Paragraph>

      <Form.Item
        label="指定校园网工号"
        name="userId"
        rules={[{ required: true, message: '请确认校园网工号。', whitespace: true }]}
        extra={
          normalizedLockedUserId
            ? '工号来自本次邀请，不能在这里修改。如工号不正确，请联系管理员重新发送邀请。'
            : '未从邀请中读取到指定工号，请填写你的校园网工号。'
        }
      >
        <Input
          placeholder="请输入校园网工号"
          autoComplete="username"
          readOnly={Boolean(normalizedLockedUserId)}
        />
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
