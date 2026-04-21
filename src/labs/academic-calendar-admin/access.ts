import type { AuthAccessGroup } from '@/shared/auth-access';
import { hasAdminOrAcademicOfficerAccess } from '@/shared/auth-access';

export const academicCalendarAdminLabAccess = {
  allowedAccessLevels: ['admin', 'staff'],
  env: ['dev', 'prod'],
  menu: true,
  requiredSlotGroup: 'ACADEMIC_OFFICER',
} as const;

type AcademicCalendarAdminLabAccessInput = {
  accessGroup?: readonly AuthAccessGroup[];
  slotGroup?: readonly string[];
};

export function hasAcademicCalendarAdminLabAccess(input: AcademicCalendarAdminLabAccessInput) {
  return hasAdminOrAcademicOfficerAccess(input);
}
