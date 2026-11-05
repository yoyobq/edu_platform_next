// src/features/student-profile-filing/ui/student-family-supplement-phone-field.tsx
import { Button, Form, Input, Space, Tooltip } from 'antd';

import type { StudentProfileFilingSupplementFamilyMember } from '../infrastructure/student-profile-filing-api';

export type FamilySupplementFormValues = {
  name: string;
  phone?: string;
  phoneSourceItemKey?: string;
  relationshipCode: string;
  workplace?: string | null;
};

export function StudentFamilySupplementPhoneField({
  members,
  disabled,
  onChange,
}: {
  members: readonly StudentProfileFilingSupplementFamilyMember[];
  disabled: boolean;
  onChange: () => void;
}) {
  const form = Form.useFormInstance<FamilySupplementFormValues>();
  const relationship = Form.useWatch('relationshipCode', form);
  const sourceKey = Form.useWatch('phoneSourceItemKey', form);
  const selectedSource = members.find((member) => member.itemKey === sourceKey);
  const parents = [
    { code: '1', label: '父亲' },
    { code: '2', label: '母亲' },
  ];

  return (
    <>
      <Form.Item name="phoneSourceItemKey" hidden>
        <Input />
      </Form.Item>
      <Form.Item label="电话" htmlFor="family-supplement-phone">
        <Space.Compact style={{ width: '100%' }}>
          <Form.Item name="phone" noStyle>
            <Input
              id="family-supplement-phone"
              autoComplete="off"
              disabled={disabled}
              placeholder={
                selectedSource
                  ? `提交时使用${selectedSource.relationshipCode === '1' ? '父亲' : '母亲'}的电话`
                  : '请输入电话'
              }
            />
          </Form.Item>
          {parents
            .filter((parent) => parent.code !== relationship)
            .map((parent) => {
              const matches = members.filter((member) => member.relationshipCode === parent.code);
              const source = matches.length === 1 ? matches[0] : undefined;
              const phone = source?.maskedPhone?.trim();
              const available = Boolean(source && phone && phone.toLowerCase() !== 'null');
              return (
                <Tooltip
                  key={parent.code}
                  title={available ? undefined : `暂无可唯一确认的${parent.label}电话，请手动填写`}
                >
                  <Button
                    disabled={disabled || !available}
                    onClick={() => {
                      if (!source) return;
                      form.setFieldsValue({ phone: '', phoneSourceItemKey: source.itemKey });
                      onChange();
                    }}
                  >
                    与{parent.label}一致
                  </Button>
                </Tooltip>
              );
            })}
        </Space.Compact>
      </Form.Item>
    </>
  );
}
