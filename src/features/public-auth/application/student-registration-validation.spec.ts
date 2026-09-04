// src/features/public-auth/application/student-registration-validation.spec.ts

import { describe, expect, it } from 'vitest';

import {
  isValidStudentRegistrationIdCardLastSix,
  isValidStudentRegistrationLoginName,
} from './student-registration-validation';

describe('student registration validation', () => {
  it('accepts only 6 alphanumeric characters for id card suffix', () => {
    expect(isValidStudentRegistrationIdCardLastSix('12AB9z')).toBe(true);
    expect(isValidStudentRegistrationIdCardLastSix('12AB9')).toBe(false);
    expect(isValidStudentRegistrationIdCardLastSix('12AB9字')).toBe(false);
  });

  it('accepts optional login names with stable account-safe characters', () => {
    expect(isValidStudentRegistrationLoginName(undefined)).toBe(true);
    expect(isValidStudentRegistrationLoginName('')).toBe(true);
    expect(isValidStudentRegistrationLoginName('stu_001-A')).toBe(true);
    expect(isValidStudentRegistrationLoginName('abc')).toBe(false);
    expect(isValidStudentRegistrationLoginName('student.name')).toBe(false);
  });
});
