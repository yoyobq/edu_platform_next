import type { FormInstance } from 'antd';
import { Alert, Button, Form, Input, Modal } from 'antd';

import './upstream-login-modal.css';

export type UpstreamLoginFormValues = {
  password: string;
  userId: string;
};

type UpstreamLoginModalProps = {
  form: FormInstance<UpstreamLoginFormValues>;
  isSubmitting?: boolean;
  loginError?: string | null;
  okText?: string;
  open: boolean;
  title?: string;
  onCancel: () => void;
  onFinish: (values: UpstreamLoginFormValues) => void | Promise<void>;
};

export function UpstreamLoginModal({
  form,
  isSubmitting = false,
  loginError,
  okText = '登录并继续',
  open,
  title = '登录校园网',
  onCancel,
  onFinish,
}: UpstreamLoginModalProps) {
  return (
    <Modal destroyOnHidden footer={null} open={open} title={title} onCancel={onCancel}>
      <div className="upstream-login-modal">
        {loginError ? <Alert message={loginError} showIcon type="error" /> : null}
        <Form<UpstreamLoginFormValues>
          form={form}
          layout="vertical"
          onFinish={(values) => {
            void onFinish(values);
          }}
        >
          <Form.Item
            label="校园网账号"
            name="userId"
            rules={[{ required: true, message: '请输入校园网账号' }]}
          >
            <Input autoComplete="username" placeholder="请输入校园网账号" />
          </Form.Item>
          <Form.Item
            label="校园网密码"
            name="password"
            rules={[{ required: true, message: '请输入校园网密码' }]}
          >
            <Input.Password autoComplete="current-password" placeholder="请输入校园网密码" />
          </Form.Item>

          <div className="upstream-login-modal-actions">
            <Button htmlType="button" onClick={onCancel}>
              取消
            </Button>
            <Button htmlType="submit" loading={isSubmitting} type="primary">
              {okText}
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
}
