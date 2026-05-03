import { type ReactNode, useEffect } from 'react';
import type { FormInstance } from 'antd';
import { Alert, Button, Checkbox, Flex, Form, Input, Modal, Typography } from 'antd';

import type { UpstreamLoginCredentials } from '../application/upstream-login-credentials';

export type UpstreamLoginFormValues = UpstreamLoginCredentials;

type UpstreamLoginModalProps = {
  description?: ReactNode;
  form: FormInstance<UpstreamLoginFormValues>;
  hasRememberedCredentials?: boolean;
  isSubmitting?: boolean;
  loginError?: string | null;
  lockedUserId?: string | null;
  lockedUserIdHelp?: ReactNode;
  okText?: string;
  open: boolean;
  title?: string;
  onCancel: () => void;
  onClearRememberedCredentials?: () => void;
  onFinish: (values: UpstreamLoginFormValues) => void | Promise<void>;
};

export function UpstreamLoginModal({
  description,
  form,
  hasRememberedCredentials = false,
  isSubmitting = false,
  loginError,
  lockedUserId,
  lockedUserIdHelp,
  okText = '登录并继续',
  open,
  title = '登录校园网',
  onCancel,
  onClearRememberedCredentials,
  onFinish,
}: UpstreamLoginModalProps) {
  const normalizedLockedUserId = lockedUserId?.trim() || null;

  useEffect(() => {
    if (!open || !normalizedLockedUserId) {
      return;
    }

    form.setFieldsValue({
      userId: normalizedLockedUserId,
    });
  }, [form, normalizedLockedUserId, open]);

  function handleClearRememberedCredentials() {
    onClearRememberedCredentials?.();
    form.setFieldsValue({
      password: '',
      rememberCredentials: false,
    });
  }

  return (
    <Modal destroyOnHidden footer={null} open={open} title={title} onCancel={onCancel}>
      <Flex vertical gap={24}>
        {description ? (
          <div className="rounded-block bg-bg-layout px-4 py-3">
            <Typography.Text type="secondary">{description}</Typography.Text>
          </div>
        ) : null}
        {loginError ? <Alert message={loginError} showIcon type="error" /> : null}
        {hasRememberedCredentials ? (
          <Alert
            action={
              <Button size="small" onClick={handleClearRememberedCredentials}>
                清除本地保存
              </Button>
            }
            message="已填入本地保存的校园网账号和密码"
            showIcon
            type="info"
          />
        ) : null}
        <Form<UpstreamLoginFormValues>
          form={form}
          layout="vertical"
          onFinish={(values) => {
            void onFinish({
              ...values,
              userId: normalizedLockedUserId ?? values.userId,
            });
          }}
        >
          <Form.Item
            label="校园网账号"
            name="userId"
            rules={[{ required: true, message: '请输入校园网账号' }]}
          >
            <Input
              autoComplete="off"
              disabled={Boolean(normalizedLockedUserId)}
              placeholder="学号或工号"
            />
          </Form.Item>
          {normalizedLockedUserId && lockedUserIdHelp ? (
            <Typography.Text type="secondary">{lockedUserIdHelp}</Typography.Text>
          ) : null}
          <Form.Item
            label="校园网密码"
            name="password"
            rules={[{ required: true, message: '请输入校园网密码' }]}
          >
            <Input.Password autoComplete="new-password" placeholder="校园网登录密码" />
          </Form.Item>

          <Form.Item name="rememberCredentials" valuePropName="checked">
            <Checkbox>登录成功后在本机保留校园网账号和密码</Checkbox>
          </Form.Item>

          <Flex justify="flex-end" gap={12}>
            <Button htmlType="button" onClick={onCancel}>
              取消
            </Button>
            <Button htmlType="submit" loading={isSubmitting} type="primary">
              {okText}
            </Button>
          </Flex>
        </Form>

        <div className="text-center">
          <Typography.Text type="secondary">
            此处填写的是校园统一身份认证系统的账号，非本站登录密码
          </Typography.Text>
        </div>
      </Flex>
    </Modal>
  );
}
