import { UserOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { Alert, Flex, Form, Input, Typography } from 'antd';

import type { StaffInviteIdentity } from '../application/types';

type StaffInviteRegisterFormValues = {
  confirmPassword: string;
  loginName: string;
  loginPassword: string;
  nickname: string;
};

type StaffInviteRegisterFormProps = {
  errorMessage: string | null;
  form: FormInstance<StaffInviteRegisterFormValues>;
  formId: string;
  identity: StaffInviteIdentity;
  inviteEmail: string;
  onSubmit: (values: StaffInviteRegisterFormValues) => Promise<void>;
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

function IdentityBlock({
  identity,
  inviteEmail,
}: {
  identity: StaffInviteIdentity;
  inviteEmail: string;
}) {
  const departmentDisplayName = identity.departmentName || identity.orgId;

  return (
    <div className="rounded-card p-4" style={{ background: 'var(--ant-color-fill-quaternary)' }}>
      <Flex vertical gap={12}>
        <Flex gap={8} align="center">
          <UserOutlined style={{ color: 'var(--ant-color-primary)', fontSize: 16 }} />
          <Typography.Text strong>{identity.personName}</Typography.Text>
        </Flex>
        <Flex gap={24} wrap style={{ paddingLeft: 24 }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              邀请邮箱
            </Typography.Text>
            <div style={{ marginTop: 2 }}>
              <Typography.Text>{inviteEmail}</Typography.Text>
            </div>
          </div>
          {departmentDisplayName && (
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                部门
              </Typography.Text>
              <div style={{ marginTop: 2 }}>
                <Typography.Text>{departmentDisplayName}</Typography.Text>
              </div>
            </div>
          )}
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              工号
            </Typography.Text>
            <div style={{ marginTop: 2 }}>
              <Typography.Text>{identity.personId}</Typography.Text>
            </div>
          </div>
        </Flex>
      </Flex>
    </div>
  );
}

export function StaffInviteRegisterForm({
  errorMessage,
  form,
  formId,
  identity,
  inviteEmail,
  onSubmit,
}: StaffInviteRegisterFormProps) {
  return (
    <Flex vertical gap={16}>
      <IdentityBlock identity={identity} inviteEmail={inviteEmail} />

      <Form<StaffInviteRegisterFormValues>
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
      </Form>
    </Flex>
  );
}
