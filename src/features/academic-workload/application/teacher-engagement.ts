// src/features/academic-workload/application/teacher-engagement.ts
export type AcademicTeacherEngagementType =
  | 'ADMINISTRATIVE_TEACHING'
  | 'EXTERNAL_TEACHER'
  | 'FULL_TIME_TEACHER'
  | 'PUBLIC_WELFARE_POST';

export type AcademicWorkloadEngagementFilter = 'ALL' | AcademicTeacherEngagementType;

export type AcademicWorkloadEngagementTab = {
  hidden?: boolean;
  key: AcademicWorkloadEngagementFilter;
  label: string;
};

export const ACADEMIC_WORKLOAD_ENGAGEMENT_LABELS: Record<AcademicTeacherEngagementType, string> = {
  ADMINISTRATIVE_TEACHING: '行政兼课',
  EXTERNAL_TEACHER: '外聘教师',
  FULL_TIME_TEACHER: '专任教师',
  PUBLIC_WELFARE_POST: '公益性岗位',
};

export const ACADEMIC_WORKLOAD_ENGAGEMENT_ORDER: Record<AcademicTeacherEngagementType, number> = {
  FULL_TIME_TEACHER: 1,
  ADMINISTRATIVE_TEACHING: 2,
  PUBLIC_WELFARE_POST: 3,
  EXTERNAL_TEACHER: 4,
};

export const ACADEMIC_WORKLOAD_REPORT_ENGAGEMENT_TABS: AcademicWorkloadEngagementTab[] = [
  { key: 'ALL', label: '全部教师' },
  { key: 'FULL_TIME_TEACHER', label: '专任教师' },
  { key: 'ADMINISTRATIVE_TEACHING', label: '行政兼课' },
  { key: 'PUBLIC_WELFARE_POST', label: '公益性岗位' },
  { key: 'EXTERNAL_TEACHER', label: '外聘教师' },
];

export const ACADEMIC_WORKLOAD_DEDUCTION_SUMMARY_ENGAGEMENT_TABS: AcademicWorkloadEngagementTab[] =
  [
    { key: 'ALL', label: '全部教师' },
    { key: 'FULL_TIME_TEACHER', label: '专任教师' },
    { key: 'ADMINISTRATIVE_TEACHING', label: '行政兼课' },
    { key: 'PUBLIC_WELFARE_POST', label: '公益性岗位' },
    { hidden: true, key: 'EXTERNAL_TEACHER', label: '外聘教师' },
  ];

export function getAcademicWorkloadEngagementLabel(
  key: AcademicWorkloadEngagementFilter,
  fallback = '当前表',
) {
  if (key === 'ALL') {
    return '全部教师';
  }

  return ACADEMIC_WORKLOAD_ENGAGEMENT_LABELS[key] ?? fallback;
}
