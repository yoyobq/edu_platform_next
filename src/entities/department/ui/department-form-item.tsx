// src/entities/department/ui/department-form-item.tsx

import type { FormItemProps } from 'antd';
import { Form } from 'antd';
import type { ReactNode } from 'react';

import type { DepartmentSelectOption } from '../application/department-select-options';

import type { DepartmentSelectProps } from './department-select';
import { DepartmentSelect } from './department-select';

type DepartmentFormItemProps = {
  disabled?: boolean;
  emptyText?: ReactNode;
  help?: ReactNode;
  label?: ReactNode;
  loading?: boolean;
  name?: FormItemProps['name'];
  options: readonly DepartmentSelectOption[];
  placeholder?: string;
  required?: boolean;
  selectProps?: Omit<
    DepartmentSelectProps,
    'disabled' | 'emptyText' | 'loading' | 'options' | 'placeholder'
  >;
  validateStatus?: FormItemProps['validateStatus'];
};

function resolveRequiredMessage(label: ReactNode) {
  return typeof label === 'string' ? `请选择${label}` : '请选择院系';
}

export function DepartmentFormItem({
  disabled = false,
  emptyText,
  help,
  label = '院系',
  loading = false,
  name = 'departmentId',
  options,
  placeholder,
  required = false,
  selectProps,
  validateStatus,
}: DepartmentFormItemProps) {
  return (
    <Form.Item
      help={help}
      label={label}
      name={name}
      rules={required ? [{ required: true, message: resolveRequiredMessage(label) }] : undefined}
      validateStatus={validateStatus}
    >
      <DepartmentSelect
        {...selectProps}
        disabled={disabled}
        emptyText={emptyText}
        loading={loading}
        options={options}
        placeholder={placeholder}
      />
    </Form.Item>
  );
}
