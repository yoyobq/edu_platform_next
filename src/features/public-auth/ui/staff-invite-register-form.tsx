import { UserOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { Alert, Flex, Form, Input, Typography } from 'antd';

import { validateAccountPassword } from '../application/account-password-validation';
import { validateStaffInviteLoginName } from '../application/staff-invite-login-name-validation';
import type { StaffInviteIdentity } from '../application/types';

type StaffInviteRegisterFormValues = {
  confirmPassword: string;
  loginName?: string;
  loginPassword: string;
  nickname?: string;
};

type StaffInviteRegisterFormProps = {
  errorMessage: string | null;
  form: FormInstance<StaffInviteRegisterFormValues>;
  formId: string;
  identity: StaffInviteIdentity;
  inviteEmail: string;
  inviteStaffId: string;
  onSubmit: (values: StaffInviteRegisterFormValues) => Promise<void>;
};

function IdentityBlock({
  identity,
  inviteEmail,
  inviteStaffId,
}: {
  identity: StaffInviteIdentity;
  inviteEmail: string;
  inviteStaffId: string;
}) {
  const departmentDisplayName = identity.departmentName || identity.orgId;
  const staffIdDisplayName = inviteStaffId.trim() || identity.personId;

  return (
    <div className="rounded-card p-4" style={{ background: 'var(--ant-color-fill-quaternary)' }}>
      <Flex vertical gap={12}>
        <Flex gap={8} align="center">
          <UserOutlined
            style={{ color: 'var(--ant-color-primary)', fontSize: 'var(--ant-font-size-lg)' }}
          />
          <Typography.Text strong>{identity.personName}</Typography.Text>
        </Flex>
        <Flex gap={24} wrap style={{ paddingLeft: 24 }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
              邀请邮箱
            </Typography.Text>
            <div style={{ marginTop: 2 }}>
              <Typography.Text>{inviteEmail}</Typography.Text>
            </div>
          </div>
          {departmentDisplayName && (
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
                部门
              </Typography.Text>
              <div style={{ marginTop: 2 }}>
                <Typography.Text>{departmentDisplayName}</Typography.Text>
              </div>
            </div>
          )}
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
              工号
            </Typography.Text>
            <div style={{ marginTop: 2 }}>
              <Typography.Text>{staffIdDisplayName}</Typography.Text>
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
  inviteStaffId,
  onSubmit,
}: StaffInviteRegisterFormProps) {
  return (
    <Flex vertical gap={16}>
      <IdentityBlock identity={identity} inviteEmail={inviteEmail} inviteStaffId={inviteStaffId} />

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

        <Form.Item label="昵称（可选）" name="nickname" extra="留空时系统会自动生成昵称。">
          <Input placeholder="可选填写昵称" autoComplete="nickname" />
        </Form.Item>

        <Form.Item
          label="登录名（可选）"
          name="loginName"
          extra="留空时可直接使用邀请邮箱登录。"
          validateTrigger={['onChange', 'onBlur']}
          rules={[
            {
              validator(_, value: string | undefined) {
                const message = validateStaffInviteLoginName(value);
                return message ? Promise.reject(new Error(message)) : Promise.resolve();
              },
            },
          ]}
        >
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

                const validationMessage = validateAccountPassword(value);
                if (!validationMessage) {
                  return Promise.resolve();
                }

                return Promise.reject(new Error(validationMessage));
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
