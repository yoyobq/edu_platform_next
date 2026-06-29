// src/features/class-adviser-governance/application/staff-directory-selection.ts

import {
  formatStaffDirectoryTeacherLabel,
  resolveStaffDirectoryTeacherStaffId,
  type StaffDirectoryEntry,
} from '@/entities/upstream-session';

function normalizeTeacherInput(value: string | undefined) {
  return value?.trim() ?? '';
}

function findStaffDirectoryTeacher(value: string, teachers: readonly StaffDirectoryEntry[]) {
  const normalizedValue = normalizeTeacherInput(value);

  if (!normalizedValue) {
    return null;
  }

  return (
    teachers.find(
      (teacher) =>
        teacher.staffId === normalizedValue ||
        teacher.name === normalizedValue ||
        formatStaffDirectoryTeacherLabel(teacher) === normalizedValue,
    ) ?? null
  );
}

function removeStaffIdFromTeacherName(value: string, staffId: string) {
  const normalizedValue = value.trim();
  const normalizedStaffId = staffId.trim();

  if (!normalizedValue || !normalizedStaffId) {
    return normalizedValue;
  }

  if (normalizedValue === normalizedStaffId) {
    return '';
  }

  if (!normalizedValue.startsWith(normalizedStaffId)) {
    return '';
  }

  return normalizedValue
    .slice(normalizedStaffId.length)
    .replace(/^[\s:：\-()（）]+/, '')
    .trim();
}

export function resolveClassAdviserGovernanceStaffName(
  value: string | undefined,
  teachers: readonly StaffDirectoryEntry[],
) {
  const normalizedValue = normalizeTeacherInput(value);
  const matchedTeacher = findStaffDirectoryTeacher(normalizedValue, teachers);

  if (matchedTeacher) {
    return matchedTeacher.name;
  }

  return removeStaffIdFromTeacherName(
    normalizedValue,
    resolveStaffDirectoryTeacherStaffId(normalizedValue, teachers),
  );
}

export function resolveAssignableClassAdviserStaffId(
  value: string | undefined,
  teachers: readonly StaffDirectoryEntry[],
) {
  const staffId = resolveStaffDirectoryTeacherStaffId(normalizeTeacherInput(value), teachers);

  if (!staffId) {
    throw new Error('请输入教职工 ID');
  }

  if (staffId.length > 8) {
    throw new Error('教职工 ID 不能超过 8 个字符');
  }

  if (/\s/.test(staffId) || staffId.includes("'")) {
    throw new Error('教职工 ID 不能包含空白或单引号');
  }

  return staffId;
}

export function validateClassAdviserGovernanceStaffId(
  value: string | undefined,
  teachers: readonly StaffDirectoryEntry[],
) {
  try {
    resolveAssignableClassAdviserStaffId(value, teachers);
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
}
