// src/shared/upstream/staff-directory-teacher-autocomplete.tsx
import { type ReactNode, useMemo, useState } from 'react';
import { AutoComplete, type AutoCompleteProps } from 'antd';

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
  defaultActiveFirstOption = false,
  directoryUnavailableContent,
  loading = false,
  onBlur,
  onChange,
  onFocus,
  onSelect,
  teachers,
  value = '',
  ...autoCompleteProps
}: StaffDirectoryTeacherAutoCompleteProps) {
  const [isFocused, setIsFocused] = useState(false);
  const formattedValue = useMemo(
    () => formatStaffDirectoryTeacherInputValue(value, teachers),
    [teachers, value],
  );
  const [displayValue, setDisplayValue] = useState(formattedValue);
  const renderedValue = isFocused ? displayValue : formattedValue;
  const options = useMemo(
    () =>
      teachers.map((teacher) => {
        const label = formatStaffDirectoryTeacherLabel(teacher);

        return {
          label,
          value: teacher.staffId,
        };
      }),
    [teachers],
  );

  return (
    <AutoComplete
      {...autoCompleteProps}
      defaultActiveFirstOption={defaultActiveFirstOption}
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
      value={renderedValue}
      onBlur={(event) => {
        setIsFocused(false);
        setDisplayValue(formatStaffDirectoryTeacherInputValue(displayValue, teachers));
        onBlur?.(event);
      }}
      onChange={(nextValue) => {
        setDisplayValue(nextValue);
        onChange?.(nextValue);
      }}
      onFocus={(event) => {
        setIsFocused(true);
        setDisplayValue(formattedValue);
        onFocus?.(event);
      }}
      onSelect={(nextValue, option) => {
        const resolvedValue = resolveStaffDirectoryTeacherInputValue(nextValue, teachers);

        setDisplayValue(formatStaffDirectoryTeacherInputValue(resolvedValue, teachers));
        onChange?.(resolvedValue);
        onSelect?.(nextValue, option);
      }}
    />
  );
}
