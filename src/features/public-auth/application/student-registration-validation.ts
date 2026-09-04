// src/features/public-auth/application/student-registration-validation.ts

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
