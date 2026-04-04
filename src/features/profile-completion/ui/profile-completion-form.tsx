import { Alert, Button, Form, Input, Radio } from 'antd';

import {
  PROFILE_COMPLETION_TARGET_IDENTITIES,
  type ProfileCompletionTargetIdentity,
} from '../application/types';

export type ProfileCompletionFormValues = {
  departmentId?: string;
  name: string;
  nickname?: string;
  phone?: string;
  targetIdentity?: ProfileCompletionTargetIdentity;
};

type ProfileCompletionFormProps = {
  errorMessage: string | null;
  initialValues?: Partial<ProfileCompletionFormValues>;
  onSubmit: (values: ProfileCompletionFormValues) => Promise<void>;
  submitting: boolean;
  submittingLabel?: string;
};

const targetIdentityOptions = PROFILE_COMPLETION_TARGET_IDENTITIES.map((value) => ({
  label: value === 'STAFF' ? '我是教职工' : '我是学生',
  value,
}));

export function ProfileCompletionForm({
  errorMessage,
  initialValues,
  onSubmit,
  submitting,
  submittingLabel = '提交并继续',
}: ProfileCompletionFormProps) {
  return (
    <Form<ProfileCompletionFormValues>
      layout="vertical"
      requiredMark={false}
      onFinish={onSubmit}
      autoComplete="on"
      size="large"
      initialValues={initialValues}
    >
      {errorMessage ? (
        <Form.Item>
          <Alert type="error" showIcon title={errorMessage} />
        </Form.Item>
      ) : null}

      <Form.Item
        label="目标身份"
        name="targetIdentity"
        rules={[{ required: true, message: '请选择目标身份。' }]}
      >
        <Radio.Group optionType="button" buttonStyle="solid" options={targetIdentityOptions} />
      </Form.Item>

      <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名。' }]}>
        <Input placeholder="请输入你的真实姓名" autoComplete="name" maxLength={64} />
      </Form.Item>

      <Form.Item label="昵称" name="nickname">
        <Input placeholder="可选，用于站内展示" maxLength={64} />
      </Form.Item>

      <Form.Item label="手机号" name="phone">
        <Input placeholder="可选，用于后续联系" autoComplete="tel" maxLength={32} />
      </Form.Item>

      <Form.Item label="归属部门 ID" name="departmentId">
        <Input placeholder="可选，按后端当前 contract 传递" maxLength={64} />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0 }}>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          {submitting ? submittingLabel : '提交并继续'}
        </Button>
      </Form.Item>
    </Form>
  );
}
