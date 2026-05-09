// src/shared/upstream/staff-directory-teacher-autocomplete.tsx
import { AutoComplete, type AutoCompleteProps } from 'antd';
import type { ReactNode } from 'react';

import {
  formatStaffDirectoryTeacherInputValue,
  formatStaffDirectoryTeacherLabel,
  resolveStaffDirectoryTeacherInputValue,
  type StaffDirectoryEntry,
} from './staff-directory';

export type StaffDirectoryTeacherAutoCompleteProps = Omit<
  AutoCompleteProps<string>,
  'filterOption' | 'notFoundContent' | 'onChange' | 'options' | 'value'
> & {
  directoryUnavailableContent?: ReactNode;
  loading?: boolean;
  onChange?: (value: string) => void;
  teachers: readonly StaffDirectoryEntry[];
  value?: string;
};

export function StaffDirectoryTeacherAutoComplete({
  directoryUnavailableContent,
  loading = false,
  onChange,
  teachers,
  value = '',
  ...autoCompleteProps
}: StaffDirectoryTeacherAutoCompleteProps) {
  const options = teachers.map((teacher) => {
    const label = formatStaffDirectoryTeacherLabel(teacher);

    return {
      label,
      value: teacher.staffId,
    };
  });

  return (
    <AutoComplete
      {...autoCompleteProps}
      filterOption={(inputValue, option) =>
        String(option?.label || '')
          .toLowerCase()
          .includes(inputValue.trim().toLowerCase()) ||
        String(option?.value || '')
          .toLowerCase()
          .includes(inputValue.trim().toLowerCase())
      }
      notFoundContent={loading ? '读取中' : directoryUnavailableContent}
      options={options}
      value={formatStaffDirectoryTeacherInputValue(value, teachers)}
      onChange={(nextValue) =>
        onChange?.(resolveStaffDirectoryTeacherInputValue(nextValue, teachers))
      }
    />
  );
}
