// src/labs/student-registration-cards/access.ts
export const studentRegistrationCardsLabAccess = {
  env: ['dev', 'prod'],
  allowedAccessLevels: ['admin', 'staff'],
  menu: true,
} as const;
