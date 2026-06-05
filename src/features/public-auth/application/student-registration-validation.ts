// src/features/public-auth/application/student-registration-validation.ts

export const studentRegistrationPasswordValidationMessage =
  '密码至少 8 位，且需包含字母、数字、符号中的至少两种。';

export function getStudentRegistrationPasswordRuleState(password: string) {
  const hasLetter = /\p{L}/u.test(password);
  const hasNumber = /\p{N}/u.test(password);
  const hasSymbol = /[\p{P}\p{S}]/u.test(password);
  const satisfiedCategoryCount = [hasLetter, hasNumber, hasSymbol].filter(Boolean).length;

  return {
    hasMinLength: password.length >= 8,
    hasRequiredCharacterMix: satisfiedCategoryCount >= 2,
  };
}

export function isValidStudentRegistrationIdCardLastSix(value: string) {
  return /^[0-9A-Za-z]{6}$/.test(value);
}

export function isValidStudentRegistrationLoginName(value: string | undefined) {
  const normalizedValue = value?.trim() ?? '';

  if (!normalizedValue) {
    return true;
  }

  return /^[A-Za-z0-9_-]{4,30}$/.test(normalizedValue);
}
