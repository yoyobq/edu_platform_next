// src/entities/department/ui/department-select.tsx

import type { SelectProps } from 'antd';
import { Select } from 'antd';
import type { ReactNode } from 'react';

import type { DepartmentSelectOption } from '../application/department-select-options';

export type DepartmentSelectProps = Omit<SelectProps<string>, 'options'> & {
  emptyText?: ReactNode;
  options: readonly DepartmentSelectOption[];
};

export function DepartmentSelect({ emptyText, options, ...props }: DepartmentSelectProps) {
  const hasNoOptions = options.length === 0;

  return (
    <Select
      {...props}
      notFoundContent={hasNoOptions ? (emptyText ?? '当前没有可选院系') : props.notFoundContent}
      optionFilterProp="label"
      options={options.map((option) => ({
        label: option.label,
        value: option.value,
      }))}
      showSearch
    />
  );
}
