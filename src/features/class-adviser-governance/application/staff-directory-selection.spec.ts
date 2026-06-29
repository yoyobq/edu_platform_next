// src/features/class-adviser-governance/application/staff-directory-selection.spec.ts

import { describe, expect, it } from 'vitest';

import {
  resolveAssignableClassAdviserStaffId,
  resolveClassAdviserGovernanceStaffName,
} from './staff-directory-selection';

const teachers = [
  {
    name: '张老师',
    staffId: 'T1001',
  },
  {
    name: '李老师',
    staffId: 'T1002',
  },
] as const;

describe('class adviser governance staff directory selection', () => {
  it('resolves selected public directory labels to stable staff id and name', () => {
    expect(resolveAssignableClassAdviserStaffId('T1001 张老师', teachers)).toBe('T1001');
    expect(resolveClassAdviserGovernanceStaffName('T1001 张老师', teachers)).toBe('张老师');
    expect(resolveAssignableClassAdviserStaffId('张老师', teachers)).toBe('T1001');
    expect(resolveClassAdviserGovernanceStaffName('T1002', teachers)).toBe('李老师');
  });

  it('keeps manual staff id entry possible while deriving manual name only when present', () => {
    expect(resolveAssignableClassAdviserStaffId('T9001 王老师', teachers)).toBe('T9001');
    expect(resolveClassAdviserGovernanceStaffName('T9001 王老师', teachers)).toBe('王老师');
    expect(resolveAssignableClassAdviserStaffId('T9001', teachers)).toBe('T9001');
    expect(resolveClassAdviserGovernanceStaffName('T9001', teachers)).toBe('');
  });

  it('rejects invalid staff ids before assigning class adviser', () => {
    expect(() => resolveAssignableClassAdviserStaffId('', teachers)).toThrow('请输入教职工 ID');
    expect(() => resolveAssignableClassAdviserStaffId("T'1001", teachers)).toThrow(
      '教职工 ID 不能包含空白或单引号',
    );
    expect(() => resolveAssignableClassAdviserStaffId('T10010001', teachers)).toThrow(
      '教职工 ID 不能超过 8 个字符',
    );
  });
});
