// src/features/public-auth/application/staff-invite-login-name-validation.spec.ts

import { describe, expect, it } from 'vitest';

import { validateStaffInviteLoginName } from './staff-invite-login-name-validation';

describe('validateStaffInviteLoginName', () => {
  it('允许留空或合法登录名', () => {
    expect(validateStaffInviteLoginName(undefined)).toBeNull();
    expect(validateStaffInviteLoginName('')).toBeNull();
    expect(validateStaffInviteLoginName('teacher_01')).toBeNull();
  });

  it('与教职工邀请后端约束保持一致', () => {
    expect(validateStaffInviteLoginName('abc')).toBe('登录名至少 4 个字符。');
    expect(validateStaffInviteLoginName('1234')).toBe('登录名不得为纯数字。');
    expect(validateStaffInviteLoginName('_teacher')).toContain('不得以');
    expect(validateStaffInviteLoginName('teacher.01')).toContain('只允许');
    expect(validateStaffInviteLoginName('a'.repeat(31))).toBe('登录名最多 30 个字符。');
  });
});
