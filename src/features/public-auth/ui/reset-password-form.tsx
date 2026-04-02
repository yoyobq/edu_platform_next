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

const passwordValidationMessage = '密码至少 8 位，且需包含字母、数字、符号中的至少两种。';

function getPasswordRuleState(password: string) {
  const hasLetter = /\p{L}/u.test(password);
  const hasNumber = /\p{N}/u.test(password);
  const hasSymbol = /[\p{P}\p{S}]/u.test(password);
  const satisfiedCategoryCount = [hasLetter, hasNumber, hasSymbol].filter(Boolean).length;

  return {
    hasMinLength: password.length >= 8,
    hasRequiredCharacterMix: satisfiedCategoryCount >= 2,
  };
}

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
        validateFirst
        validateTrigger={['onChange', 'onBlur']}
        rules={[
          { required: true, message: '请输入新密码。' },
          {
            validator(_, value: string | undefined) {
              if (!value) {
                return Promise.resolve();
              }

              const { hasMinLength, hasRequiredCharacterMix } = getPasswordRuleState(value);

              if (hasMinLength && hasRequiredCharacterMix) {
                return Promise.resolve();
              }

              return Promise.reject(new Error(passwordValidationMessage));
            },
          },
        ]}
      >
        <Input.Password placeholder="请输入新密码" autoComplete="new-password" />
      </Form.Item>

      <Form.Item
        label="确认新密码"
        name="confirmPassword"
        dependencies={['newPassword']}
        validateTrigger={['onChange', 'onBlur']}
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
