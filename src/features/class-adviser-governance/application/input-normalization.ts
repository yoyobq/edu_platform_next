// src/features/class-adviser-governance/application/input-normalization.ts

import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
} from '@/shared/form-normalization';

import type {
  AssignClassAdviserByStaffIdInput,
  ListClassAdviserGovernanceClassesInput,
} from './types';

function compactInput<TValue extends Record<string, unknown>>(input: TValue) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<TValue>;
}

function assertMaxLength(value: string | undefined, maxLength: number, label: string) {
  if (value !== undefined && value.length > maxLength) {
    throw new Error(`${label}不能超过 ${maxLength} 个字符。`);
  }
}

function assertNoStaffIdForbiddenCharacters(value: string) {
  if (/\s/.test(value) || value.includes("'")) {
    throw new Error('教职工 ID 不能包含空白或单引号。');
  }
}

export function normalizeListClassAdviserGovernanceClassesInput(
  input: ListClassAdviserGovernanceClassesInput = {},
) {
  const departmentId = normalizeOptionalTextValue(input.departmentId, 'to_undefined');
  const keyword = normalizeOptionalTextValue(input.keyword, 'to_undefined');

  assertMaxLength(departmentId, 8, '系部 ID');
  assertMaxLength(keyword, 100, '关键词');

  return compactInput({
    departmentId,
    keyword,
    onlyMissing: input.onlyMissing === true ? true : undefined,
  });
}

export function normalizeAssignClassAdviserByStaffIdInput(input: AssignClassAdviserByStaffIdInput) {
  const classId = normalizeRequiredTextValue(input.classId, { label: '班级 ID' });
  const staffId = normalizeRequiredTextValue(input.staffId, { label: '教职工 ID' });
  const staffName = normalizeOptionalTextValue(input.staffName, 'to_undefined');
  const remarks = normalizeOptionalTextValue(input.remarks, 'to_undefined');

  assertMaxLength(classId, 8, '班级 ID');
  assertMaxLength(staffId, 8, '教职工 ID');
  assertMaxLength(staffName, 100, '班主任姓名');
  assertMaxLength(remarks, 500, '备注');
  assertNoStaffIdForbiddenCharacters(staffId);

  return compactInput({
    classId,
    remarks,
    staffId,
    staffName,
  });
}
