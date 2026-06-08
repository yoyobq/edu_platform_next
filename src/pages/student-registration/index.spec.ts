// src/pages/student-registration/index.spec.ts

import { describe, expect, it } from 'vitest';

import { resolveStudentRegistrationLead } from './copy';

describe('student registration page copy', () => {
  it('guides directly to login when email verification is not required', () => {
    expect(
      resolveStudentRegistrationLead({
        currentStep: 2,
        emailVerificationRequired: false,
        info: null,
        phase: 'pending-email',
      }),
    ).toBe('注册信息已提交，账号已可直接登录。');
  });

  it('keeps email verification guidance when verification is required', () => {
    expect(
      resolveStudentRegistrationLead({
        currentStep: 2,
        emailVerificationRequired: true,
        info: null,
        phase: 'pending-email',
      }),
    ).toBe('注册信息已提交，接下来请验证登录邮箱。');
  });
});
