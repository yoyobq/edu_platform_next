// src/entities/academic-semester/ui/academic-semester-form-item.tsx

import type { FormItemProps } from 'antd';
import { Form } from 'antd';
import type { ReactNode } from 'react';

import type { AcademicSemesterSelectProps } from './academic-semester-select';
import { AcademicSemesterSelect } from './academic-semester-select';

type AcademicSemesterFormItemProps = {
  disabled?: boolean;
  emptyText?: ReactNode;
  help?: ReactNode;
  label?: ReactNode;
  loading?: boolean;
  name?: FormItemProps['name'];
  placeholder?: string;
  records: AcademicSemesterSelectProps['records'];
  required?: boolean;
  selectProps?: Omit<
    AcademicSemesterSelectProps,
    'disabled' | 'emptyText' | 'loading' | 'placeholder' | 'records'
  >;
  validateStatus?: FormItemProps['validateStatus'];
};

function resolveRequiredMessage(label: ReactNode) {
  return typeof label === 'string' ? `请选择${label}` : '请选择学期';
}

export function AcademicSemesterFormItem({
  disabled = false,
  emptyText,
  help,
  label = '学期',
  loading = false,
  name = 'semesterId',
  placeholder,
  records,
  required = false,
  selectProps,
  validateStatus,
}: AcademicSemesterFormItemProps) {
  return (
    <Form.Item
      help={help}
      label={label}
      name={name}
      rules={required ? [{ required: true, message: resolveRequiredMessage(label) }] : undefined}
      validateStatus={validateStatus}
    >
      <AcademicSemesterSelect
        {...selectProps}
        disabled={disabled}
        emptyText={emptyText}
        loading={loading}
        placeholder={placeholder}
        records={records}
      />
    </Form.Item>
  );
}
