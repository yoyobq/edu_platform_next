// src/labs/staff-semester-profiles/lib/labels.ts
import type {
  AcademicTeacherEngagementType,
  StaffSemesterProfileBackfillAction,
  StaffSemesterProfileBackfillBlockingReason,
} from '../api';

export const EMPTY_CELL_TEXT = '—';

export const TEACHER_ENGAGEMENT_TYPE_LABELS: Record<AcademicTeacherEngagementType, string> = {
  ADMINISTRATIVE_TEACHING: '行政兼课',
  EXTERNAL_TEACHER: '外聘教师',
  FULL_TIME_TEACHER: '专任教师',
  PUBLIC_WELFARE_POST: '公益岗',
};

export const TEACHER_ENGAGEMENT_TYPE_TAG_COLORS: Record<AcademicTeacherEngagementType, string> = {
  ADMINISTRATIVE_TEACHING: 'purple',
  EXTERNAL_TEACHER: 'orange',
  FULL_TIME_TEACHER: 'green',
  PUBLIC_WELFARE_POST: 'cyan',
};

export const TEACHER_ENGAGEMENT_TYPE_OPTIONS = Object.entries(TEACHER_ENGAGEMENT_TYPE_LABELS).map(
  ([value, label]) => ({
    label,
    value,
  }),
);

export const BACKFILL_ACTION_LABELS: Record<StaffSemesterProfileBackfillAction, string> = {
  already_exists: '已存在',
  blocked: '需处理',
  created: '已创建',
  would_create: '待创建',
};

export const BACKFILL_ACTION_TAG_COLORS: Record<StaffSemesterProfileBackfillAction, string> = {
  already_exists: 'default',
  blocked: 'red',
  created: 'green',
  would_create: 'blue',
};

export const BACKFILL_BLOCKING_REASON_LABELS: Record<
  NonNullable<StaffSemesterProfileBackfillBlockingReason>,
  string
> = {
  teaching_group_not_found: '历史教研组不存在',
  teaching_group_workload_department_mismatch: '历史教研组与本次工作量归口系不一致',
};
