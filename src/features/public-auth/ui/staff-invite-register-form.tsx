import { Alert, Button, Form, Input } from 'antd';

import type { StaffInviteIdentity } from '../application/types';

type StaffInviteRegisterFormValues = {
  confirmPassword: string;
  loginName: string;
  loginPassword: string;
  nickname: string;
};

type StaffInviteRegisterFormProps = {
  errorMessage: string | null;
  identity: StaffInviteIdentity;
  inviteEmail: string;
  onSubmit: (values: StaffInviteRegisterFormValues) => Promise<void>;
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

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <Form.Item label={label}>
      <Input readOnly value={value} />
    </Form.Item>
  );
}

export function StaffInviteRegisterForm({
  errorMessage,
  identity,
  inviteEmail,
  onSubmit,
  submitting,
}: StaffInviteRegisterFormProps) {
  return (
    <Form<StaffInviteRegisterFormValues>
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

      <ReadonlyField label="邀请邮箱" value={inviteEmail} />
      <ReadonlyField label="教职工姓名" value={identity.personName} />
      <ReadonlyField label="部门 ID" value={identity.orgId || '未提供'} />
      <ReadonlyField label="教职工编号" value={identity.personId} />
      <ReadonlyField label="上游登录账号" value={identity.upstreamLoginId} />

      <Form.Item
        label="昵称"
        name="nickname"
        rules={[{ required: true, message: '请输入昵称。', whitespace: true }]}
      >
        <Input placeholder="请输入昵称" autoComplete="nickname" />
      </Form.Item>

      <Form.Item label="登录名（可选）" name="loginName" extra="留空时可直接使用邀请邮箱登录。">
        <Input placeholder="可选填写一个单独的登录名" autoComplete="username" />
      </Form.Item>

      <Form.Item
        label="登录密码"
        name="loginPassword"
        validateFirst
        validateTrigger={['onChange', 'onBlur']}
        rules={[
          { required: true, message: '请输入登录密码。' },
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
        <Input.Password placeholder="请输入登录密码" autoComplete="new-password" />
      </Form.Item>

      <Form.Item
        label="确认登录密码"
        name="confirmPassword"
        dependencies={['loginPassword']}
        validateTrigger={['onChange', 'onBlur']}
        rules={[
          { required: true, message: '请再次输入登录密码。' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('loginPassword') === value) {
                return Promise.resolve();
              }

              return Promise.reject(new Error('两次输入的密码不一致。'));
            },
          }),
        ]}
      >
        <Input.Password placeholder="请再次输入登录密码" autoComplete="new-password" />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0 }}>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          完成邀请注册
        </Button>
      </Form.Item>
    </Form>
  );
}
