import dayjs, { type Dayjs } from 'dayjs';

import type { AdminDepartmentOption } from '../../application/get-admin-department-options';

export function getDepartmentDisplayName(
  departmentId: string | null | undefined,
  departmentMap: ReadonlyMap<string, AdminDepartmentOption>,
) {
  if (!departmentId) {
    return '—';
  }

  const department = departmentMap.get(departmentId);

  if (!department) {
    return departmentId;
  }

  return department.departmentName || department.id;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
  });
}

export function formatOptionalValue(value: string | null | undefined) {
  return value && value.trim() ? value : '—';
}

export function formatCount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function normalizeOptionalTextValue(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  const nextValue = value.trim();

  return nextValue ? nextValue : null;
}

export function normalizeRequiredTextValue(value: string) {
  return value.trim();
}

export function normalizeBirthDateValue(value: Dayjs | null | undefined) {
  if (!value || !value.isValid()) {
    return null;
  }

  return value.format('YYYY-MM-DD');
}

export function toBirthDatePickerValue(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const dateValue = dayjs(value);

  return dateValue.isValid() ? dateValue : undefined;
}

export function areStringArraysEqual(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
