// src/features/academic-integrated-plan-corrections/application/correction-view-policy.ts
import type { AcademicViewerRole } from '@/shared/auth-access';

export function canViewIntegratedPlanCorrectionRepairGroups(viewerRole: AcademicViewerRole) {
  return viewerRole === 'admin';
}
