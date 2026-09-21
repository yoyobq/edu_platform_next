// src/features/academic-workload/application/projection-invalid-reason.ts

export type AcademicProjectionInvalidReason =
  | 'MILITARY_TRAINING_CLASS_SCOPE_CONFLICT'
  | 'TEACHING_CLASS_LOCAL_CLASS_UNRESOLVED';

const INVALID_REASON_MESSAGES: Record<AcademicProjectionInvalidReason, string> = {
  MILITARY_TRAINING_CLASS_SCOPE_CONFLICT: '军训作用范围冲突，请检查班级招生起点或排课数据。',
  TEACHING_CLASS_LOCAL_CLASS_UNRESOLVED: '课表中的教学班无法唯一匹配本地班级，请先同步班级。',
};

export function formatAcademicProjectionInvalidReason(reason: string | null) {
  if (!reason) {
    return null;
  }

  return INVALID_REASON_MESSAGES[reason as AcademicProjectionInvalidReason] ?? reason;
}
