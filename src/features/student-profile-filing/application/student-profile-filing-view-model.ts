// src/features/student-profile-filing/application/student-profile-filing-view-model.ts

import type {
  StudentProfileFilingClassOption,
  StudentProfileFilingCompletenessFlags,
  StudentProfileFilingStudent,
} from '../infrastructure/student-profile-filing-api';

export type StudentProfileFilingStatus = 'BLOCKED' | 'FILED' | 'PENDING' | 'WARNING';

export type StudentProfileFilingActionIntent = 'CREATE' | 'UNAVAILABLE' | 'UPDATE';

export type StudentProfileFilingSummary = {
  blockedCount: number;
  filedCount: number;
  pendingCount: number;
  refreshableCount: number;
  totalCount: number;
  warningCount: number;
};

export type StudentProfileFilingCompletenessItem = {
  key: keyof StudentProfileFilingCompletenessFlags;
  label: string;
};

export const STUDENT_PROFILE_FILING_COMPLETENESS_ITEMS: readonly StudentProfileFilingCompletenessItem[] =
  [
    {
      key: 'personalObserved',
      label: '基本信息',
    },
    {
      key: 'sensitiveIdentifiersObserved',
      label: '证件/银行卡',
    },
    {
      key: 'photoObserved',
      label: '照片',
    },
    {
      key: 'familyObserved',
      label: '家庭',
    },
    {
      key: 'educationObserved',
      label: '教育经历',
    },
    {
      key: 'recordObserved',
      label: '学籍异动',
    },
  ];

export const STUDENT_PROFILE_FILING_STATUS_LABELS: Record<StudentProfileFilingStatus, string> = {
  BLOCKED: '缺学工关联',
  FILED: '已建档',
  PENDING: '待建档',
  WARNING: '需关注',
};

export const STUDENT_PROFILE_FILING_STATUS_TAG_COLORS: Record<StudentProfileFilingStatus, string> =
  {
    BLOCKED: 'error',
    FILED: 'success',
    PENDING: 'processing',
    WARNING: 'warning',
  };

export const STUDENT_PROFILE_FILING_ACTION_LABELS: Record<
  StudentProfileFilingActionIntent,
  string
> = {
  CREATE: '建档',
  UNAVAILABLE: '无法建档',
  UPDATE: '更新资料',
};

export const STUDENT_PROFILE_FILING_SECTION_LABELS: Record<string, string> = {
  EDUCATION_RESUME: '教育经历',
  FAMILY: '家庭',
  PERSONAL: '基本信息',
  PHOTO: '照片',
  RECORD: '学籍异动',
  SENSITIVE_IDENTIFIERS: '证件/银行卡',
};

function compareTextValue(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? '').localeCompare(right ?? '', 'zh-CN', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function formatStudentProfileFilingClassLabel(item: StudentProfileFilingClassOption) {
  return `${item.className || item.classCode}（${item.classCode}）`;
}

export function compareStudentProfileFilingClassOptions(
  left: StudentProfileFilingClassOption,
  right: StudentProfileFilingClassOption,
) {
  const gradeCompare = (right.gradeYear ?? -1) - (left.gradeYear ?? -1);

  if (gradeCompare !== 0) {
    return gradeCompare;
  }

  return compareTextValue(left.classCode, right.classCode);
}

export function countStudentProfileFilingCompleteness(
  flags: StudentProfileFilingCompletenessFlags,
) {
  return STUDENT_PROFILE_FILING_COMPLETENESS_ITEMS.filter((item) => flags[item.key]).length;
}

export function listMissingStudentProfileFilingCompletenessLabels(
  flags: StudentProfileFilingCompletenessFlags,
) {
  return STUDENT_PROFILE_FILING_COMPLETENESS_ITEMS.filter((item) => !flags[item.key]).map(
    (item) => item.label,
  );
}

export function resolveStudentProfileFilingStatus(
  student: Pick<
    StudentProfileFilingStudent,
    | 'attentionLevel'
    | 'manualOverrideActive'
    | 'profileCompletenessFlags'
    | 'snapshotPresent'
    | 'upstreamChangedSinceManualPatch'
    | 'upstreamIdPresent'
    | 'warningCodes'
  >,
): StudentProfileFilingStatus {
  if (!student.upstreamIdPresent || student.attentionLevel === 'UPSTREAM_ID_MISSING') {
    return 'BLOCKED';
  }

  if (!student.snapshotPresent || student.attentionLevel === 'MISSING_SNAPSHOT') {
    return 'PENDING';
  }

  if (
    student.attentionLevel === 'READY' &&
    countStudentProfileFilingCompleteness(student.profileCompletenessFlags) ===
      STUDENT_PROFILE_FILING_COMPLETENESS_ITEMS.length &&
    student.warningCodes.length === 0 &&
    !student.manualOverrideActive &&
    !student.upstreamChangedSinceManualPatch
  ) {
    return 'FILED';
  }

  return 'WARNING';
}

export function resolveStudentProfileFilingActionIntent(
  student: Pick<
    StudentProfileFilingStudent,
    | 'attentionLevel'
    | 'manualOverrideActive'
    | 'profileCompletenessFlags'
    | 'snapshotPresent'
    | 'upstreamChangedSinceManualPatch'
    | 'upstreamIdPresent'
    | 'warningCodes'
  >,
): StudentProfileFilingActionIntent {
  const status = resolveStudentProfileFilingStatus(student);

  if (status === 'BLOCKED') {
    return 'UNAVAILABLE';
  }

  if (status === 'PENDING') {
    return 'CREATE';
  }

  return 'UPDATE';
}

export function summarizeStudentProfileFilingStudents(
  students: readonly StudentProfileFilingStudent[],
): StudentProfileFilingSummary {
  const summary: StudentProfileFilingSummary = {
    blockedCount: 0,
    filedCount: 0,
    pendingCount: 0,
    refreshableCount: 0,
    totalCount: 0,
    warningCount: 0,
  };

  students.forEach((student) => {
    const status = resolveStudentProfileFilingStatus(student);

    summary.totalCount += 1;

    if (student.upstreamIdPresent) {
      summary.refreshableCount += 1;
    }

    if (status === 'BLOCKED') {
      summary.blockedCount += 1;
    } else if (status === 'FILED') {
      summary.filedCount += 1;
    } else if (status === 'PENDING') {
      summary.pendingCount += 1;
    } else {
      summary.warningCount += 1;
    }
  });

  return summary;
}

export function listStudentProfileFilingRefreshableStudentIds(
  students: readonly StudentProfileFilingStudent[],
) {
  return students
    .filter((student) => student.upstreamIdPresent)
    .map((student) => student.studentId);
}

export function formatStudentProfileFilingDateTime(value: string | null | undefined) {
  if (!value) {
    return '未建档';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatStudentProfileFilingSection(section: string | null | undefined) {
  const normalizedSection = section?.trim() ?? '';

  return STUDENT_PROFILE_FILING_SECTION_LABELS[normalizedSection] ?? (normalizedSection || '未知');
}
