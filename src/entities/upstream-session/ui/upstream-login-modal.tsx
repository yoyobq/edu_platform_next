import { type CSSProperties, type ReactNode, useEffect } from 'react';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  KeyOutlined,
  LockOutlined,
  SafetyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { FormInstance } from 'antd';
import {
  Button,
  Checkbox,
  ConfigProvider,
  Flex,
  Form,
  Input,
  Modal,
  theme,
  Typography,
} from 'antd';

import type { UpstreamLoginCredentials } from '../application/upstream-login-credentials';

import './upstream-login-modal.css';

export type UpstreamLoginFormValues = UpstreamLoginCredentials;

const SIDE_NOTE_ICON_COLUMN_WIDTH = '1rem';
const SIDE_NOTE_LINE_HEIGHT = '1.25rem';

type UpstreamLoginModalProps = {
  description?: ReactNode;
  form: FormInstance<UpstreamLoginFormValues>;
  hasRememberedCredentials?: boolean;
  isSubmitting?: boolean;
  loginError?: string | null;
  lockedUserId?: string | null;
  okText?: string;
  open: boolean;
  title?: ReactNode;
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
  okText = '授权并继续',
  open,
  title,
  onCancel,
  onClearRememberedCredentials,
  onFinish,
}: UpstreamLoginModalProps) {
  const normalizedLockedUserId = lockedUserId?.trim() || null;
  const { token } = theme.useToken();
  const compactBorderRadius = token.borderRadiusSM;

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

  const renderedTitle = title ?? (
    <>
      需要登录
      <br />
      智慧校园
    </>
  );
  const modalContainerStyle = {
    overflow: 'hidden',
    padding: 0,
    '--upstream-login-modal-border-radius': `${compactBorderRadius}px`,
  } as CSSProperties;

  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: compactBorderRadius,
          borderRadiusLG: compactBorderRadius,
          borderRadiusSM: compactBorderRadius,
          borderRadiusXS: compactBorderRadius,
          colorPrimary: token.colorLinkHover,
          colorPrimaryActive: token.colorLinkActive,
          colorPrimaryHover: token.colorLinkActive,
        },
      }}
    >
      <Modal
        destroyOnHidden
        footer={null}
        open={open}
        rootClassName="upstream-login-modal-compact-radius"
        styles={{
          body: { padding: 0 },
          container: modalContainerStyle,
        }}
        title={null}
        width={760}
        onCancel={onCancel}
      >
        <div className="grid min-h-107.5 grid-cols-[45fr_55fr] overflow-hidden">
          <aside
            className="flex flex-col border-r border-border px-10 py-7 pt-12"
            style={{
              backgroundColor: token.colorLinkHover,
              color: token.colorTextLightSolid,
            }}
          >
            <div>
              <Typography.Title
                level={3}
                style={{
                  color: token.colorTextLightSolid,
                  fontSize: '1.75rem',
                  lineHeight: 1.25,
                  margin: 0,
                }}
              >
                {renderedTitle}
              </Typography.Title>
              {description ? (
                <div className="mt-3 text-sm">
                  <Typography.Paragraph
                    style={{
                      color: token.colorTextLightSolid,
                      marginBottom: 0,
                      opacity: 0.78,
                    }}
                  >
                    {description}
                  </Typography.Paragraph>
                </div>
              ) : null}
            </div>

            <div className="mt-auto flex flex-col gap-5 pb-2">
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `${SIDE_NOTE_ICON_COLUMN_WIDTH} minmax(0, 1fr)`,
                }}
              >
                <span
                  className="flex items-center justify-center"
                  style={{ height: SIDE_NOTE_LINE_HEIGHT }}
                >
                  <UserOutlined
                    style={{
                      color: token.colorTextLightSolid,
                      opacity: 0.76,
                    }}
                  />
                </span>
                <div
                  className="text-xs"
                  style={{
                    color: token.colorTextLightSolid,
                    lineHeight: SIDE_NOTE_LINE_HEIGHT,
                    opacity: 0.72,
                  }}
                >
                  使用学号或工号登录校园网
                </div>
              </div>

              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `${SIDE_NOTE_ICON_COLUMN_WIDTH} minmax(0, 1fr)`,
                }}
              >
                <span
                  className="flex items-center justify-center"
                  style={{ height: SIDE_NOTE_LINE_HEIGHT }}
                >
                  <SafetyOutlined
                    style={{
                      color: token.colorTextLightSolid,
                      opacity: 0.76,
                    }}
                  />
                </span>
                <div
                  className="text-xs"
                  style={{
                    color: token.colorTextLightSolid,
                    lineHeight: SIDE_NOTE_LINE_HEIGHT,
                    opacity: 0.72,
                  }}
                >
                  登录信息仅随浏览器保存本地
                </div>
              </div>
            </div>
          </aside>

          <section className="flex items-start p-7 pt-24">
            <div className="w-full">
              {loginError ? (
                <div
                  className="mb-4 flex gap-3 border px-3 py-2.5 text-sm"
                  role="alert"
                  style={{
                    backgroundColor: 'var(--ant-color-error-bg)',
                    borderColor: 'var(--ant-color-error-border)',
                    borderRadius: compactBorderRadius,
                    color: 'var(--ant-color-error)',
                  }}
                >
                  <CloseCircleOutlined className="mt-0.5 shrink-0" />
                  <span>{loginError}</span>
                </div>
              ) : null}

              <Form<UpstreamLoginFormValues>
                form={form}
                layout="vertical"
                requiredMark={false}
                onFinish={(values) => {
                  void onFinish({
                    ...values,
                    userId: normalizedLockedUserId ?? values.userId,
                  });
                }}
              >
                <Form.Item
                  name="userId"
                  rules={[{ required: true, message: '请输入校园网账号' }]}
                  style={{ marginBottom: 16 }}
                >
                  <Input
                    autoComplete="off"
                    disabled={Boolean(normalizedLockedUserId)}
                    placeholder="学号或工号"
                    prefix={<UserOutlined className="text-text-quaternary" />}
                    size="large"
                    suffix={
                      normalizedLockedUserId ? (
                        <LockOutlined style={{ color: token.colorTextQuaternary }} />
                      ) : null
                    }
                  />
                </Form.Item>

                <Form.Item
                  extra={
                    hasRememberedCredentials ? (
                      <Flex align="center" gap={8}>
                        <CheckCircleOutlined className="text-success" />
                        <span className="text-[0.8125rem] leading-5 text-text-tertiary">
                          已填入本机保存的凭证
                        </span>
                        <Button
                          size="small"
                          style={{ fontSize: '0.8125rem', height: 'auto', padding: 0 }}
                          type="link"
                          onClick={handleClearRememberedCredentials}
                        >
                          清除
                        </Button>
                      </Flex>
                    ) : (
                      <span className="text-[0.8125rem] leading-5 text-text-tertiary">
                        学校统一身份认证密码，不是本站登录密码
                      </span>
                    )
                  }
                  name="password"
                  rules={[{ required: true, message: '请输入认证密码' }]}
                  style={{ marginBottom: 24 }}
                >
                  <Input.Password
                    autoComplete="new-password"
                    placeholder="校园网登录密码"
                    prefix={<KeyOutlined className="text-text-quaternary" />}
                    size="large"
                  />
                </Form.Item>

                <Form.Item
                  name="rememberCredentials"
                  style={{ marginBottom: 32 }}
                  valuePropName="checked"
                >
                  <Checkbox
                    style={{ color: 'var(--ant-color-text-secondary)', fontSize: '0.8125rem' }}
                  >
                    本地保存密码
                  </Checkbox>
                </Form.Item>

                <Button block htmlType="submit" loading={isSubmitting} size="large" type="primary">
                  {okText}
                </Button>
                <div className="mt-4 text-center">
                  <Button
                    htmlType="button"
                    size="small"
                    style={{ color: token.colorTextTertiary }}
                    type="text"
                    onClick={onCancel}
                  >
                    取消
                  </Button>
                </div>
              </Form>
            </div>
          </section>
        </div>
      </Modal>
    </ConfigProvider>
  );
}
