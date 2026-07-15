// src/features/student-profile-filing/ui/student-profile-filing-page-content.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CloudSyncOutlined,
  FileDoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  DatePicker,
  Drawer,
  Empty,
  Form,
  Input,
  Progress,
  Radio,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';

import {
  formatUpstreamSessionDateTime,
  isExpiredUpstreamSessionError,
  type StoredUpstreamSession,
  UpstreamLoginModal,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import {
  countStudentProfileFilingCompleteness,
  formatStudentProfileFilingClassLabel,
  isStudentProfileFilingDroppedStudent,
  listMissingStudentProfileFilingCompletenessLabels,
  listStudentProfileFilingRefreshableStudentIds,
  listVisibleMissingStudentProfileFilingCompletenessLabels,
  resolveStudentProfileFilingActionIntent,
  resolveStudentProfileFilingDroppedSemesterNotice,
  shouldShowStudentProfileFilingInitialClassEmptyState,
  STUDENT_PROFILE_FILING_ACTION_LABELS,
  STUDENT_PROFILE_FILING_COMPLETENESS_ITEMS,
  summarizeStudentProfileFilingStudents,
} from '../application/student-profile-filing-view-model';
import {
  getStudentProfileFilingClassOverview,
  getStudentProfileFilingSupplementSummary,
  listStudentProfileFilingClassOptions,
  refreshStudentProfileFilingClass,
  refreshStudentProfileFilingStudent,
  resolveUpstreamErrorMessage,
  type StudentProfileFilingBatchRefreshItem,
  type StudentProfileFilingClassOption,
  type StudentProfileFilingClassOverview,
  type StudentProfileFilingEducationSupplementInput,
  type StudentProfileFilingStudent,
  type StudentProfileFilingSupplementEducationResume,
  type StudentProfileFilingSupplementFamilyMember,
  type StudentProfileFilingSupplementSummary,
  type StudentProfileFilingSupplementWriteResult,
  writeStudentProfileFilingEducationSupplement,
  writeStudentProfileFilingFamilySupplement,
} from '../infrastructure/student-profile-filing-api';

import './student-profile-filing-page-content.css';

type CurrentAccount = {
  accountId: number;
  displayName: string;
  lockedUpstreamLoginUserId: string | null;
  staffId: string | null;
};

export type StudentProfileFilingPageContentProps = {
  currentAccount: CurrentAccount;
};

type StudentProfileFilingSupplementSection = 'education' | 'family';

type StudentProfileFilingSupplementSummarySection = 'education' | 'family';

type FamilySupplementFormValues = {
  name: string;
  phone?: string;
  relationshipCode: string;
  workplace?: string;
};

type EducationSupplementFormValues = {
  endDate?: Dayjs | null;
  organization?: string;
  reference?: string;
  startDate?: Dayjs | null;
};

type EducationSupplementDefaultValues = Pick<
  EducationSupplementFormValues,
  'endDate' | 'startDate'
>;

type AppliedEducationSupplementDefaults = {
  endMonth: string | null;
  startMonth: string | null;
  studentId: string;
};

type PendingFilingAction =
  | {
      classId: string;
      studentName: string;
      studentId: string;
      type: 'student';
    }
  | {
      classId: string;
      classLabel: string | null;
      requestedCount: number;
      type: 'class';
    }
  | {
      classId: string;
      expectedSectionBaselineToken: string;
      member: FamilySupplementFormValues;
      studentId: string;
      type: 'family-supplement';
    }
  | {
      classId: string;
      expectedSectionBaselineToken: string;
      resume: StudentProfileFilingEducationSupplementInput['resume'];
      studentId: string;
      type: 'education-supplement';
    };

type UpstreamActionRequest = {
  action: PendingFilingAction;
  session: StoredUpstreamSession;
};

type SupplementDrawerState = {
  activeSection: StudentProfileFilingSupplementSection;
  availableSections: StudentProfileFilingSupplementSection[];
  student: StudentProfileFilingStudent;
  summary: StudentProfileFilingSupplementSummary | null;
};

type SupplementFeedback = {
  description?: string;
  message: string;
  type: 'error' | 'info' | 'success' | 'warning';
};

type EducationResumeDisplayItem = {
  key: string;
  organization: string;
  period: string;
  reference: string;
  source: 'inferred' | 'upstream';
};

type FamilyMemberDisplayItem = {
  key: string;
  name: string;
  phone: string;
  relationship: string;
  workplace: string;
};

type RefreshDigest = {
  expiresAt: string | null;
  failureCount: number;
  requestedCount: number;
  results: StudentProfileFilingBatchRefreshItem[];
  scopeLabel: string;
  successCount: number;
  traceId: string | null;
};

type FilingProgressState = {
  expectedDurationMs: number;
  label: string;
  percent: number;
  requestedCount: number;
  scope: 'class' | 'student';
  status: 'active' | 'success';
};

type StudentProfileFilingNoticeTag = {
  color: string;
  key: string;
  label: string;
  textClassName?: string;
};

const FILING_PROGRESS_INITIAL_PERCENT = 6;
const FILING_PROGRESS_MAX_RUNNING_PERCENT = 96;
const FILING_PROGRESS_RESET_DELAY_MS = 900;
const FILING_PROGRESS_TICK_MS = 700;
const STUDENT_FILING_EXPECTED_DURATION_MS = 30_000;
const CLASS_FILING_BASE_EXPECTED_DURATION_MS = 18_000;
const CLASS_FILING_PER_STUDENT_EXPECTED_DURATION_MS = 1_800;
const CLASS_FILING_MAX_EXPECTED_DURATION_MS = 150_000;

const MISSING_PROFILE_TAG_TEXT_CLASS_NAMES: Record<string, string> = {
  基本信息: 'student-profile-filing-missing-tag-text-personal',
  '证件/银行卡': 'student-profile-filing-missing-tag-text-sensitive',
  照片: 'student-profile-filing-missing-tag-text-photo',
  家庭: 'student-profile-filing-missing-tag-text-family',
  教育简历: 'student-profile-filing-missing-tag-text-education',
  学籍异动: 'student-profile-filing-missing-tag-text-record',
};

const SUPPLEMENT_SECTION_LABELS: Record<StudentProfileFilingSupplementSection, string> = {
  education: '教育简历',
  family: '家庭',
};

const SUPPLEMENT_SECTION_KEYS: Record<
  StudentProfileFilingSupplementSection,
  StudentProfileFilingSupplementSummarySection
> = {
  education: 'education',
  family: 'family',
};
const CURRENT_SCHOOL_NAME = '江苏省苏州技师学院';
const FAMILY_RELATIONSHIP_LABELS: Record<string, string> = {
  '1': '父亲',
  '2': '母亲',
  '3': '祖父母',
  '4': '兄弟姐妹',
};

function buildRefreshableTooltip(student: StudentProfileFilingStudent) {
  const actionIntent = resolveStudentProfileFilingActionIntent(student);

  if (actionIntent === 'CREATE') {
    return '从学工系统读取资料并建立本地快照';
  }

  if (actionIntent === 'UPDATE') {
    return '从学工系统更新本地资料快照';
  }

  return '缺少学工系统学生关联，无法建档';
}

function buildStudentRefreshDigest(input: {
  changedSections: readonly string[];
  expiresAt: string | null;
  studentId: string;
  success: boolean;
  traceId: string | null;
  warningCodes: readonly string[];
}) {
  return {
    expiresAt: input.expiresAt,
    failureCount: input.success ? 0 : 1,
    requestedCount: 1,
    results: [
      {
        changedSections: [...input.changedSections],
        errorCode: null,
        errorMessage: null,
        snapshotUpdated: input.success,
        status: input.success ? 'SUCCESS' : 'FAILED',
        studentId: input.studentId,
        warningCodes: [...input.warningCodes],
      },
    ],
    scopeLabel: '单人建档',
    successCount: input.success ? 1 : 0,
    traceId: input.traceId,
  };
}

function renderRefreshIssue(result: StudentProfileFilingBatchRefreshItem) {
  if (result.errorMessage) {
    return result.errorMessage;
  }

  if (result.errorCode) {
    return result.errorCode;
  }

  if (result.warningCodes.length > 0) {
    return result.warningCodes.join('、');
  }

  return '无';
}

function calculateFilingProgressPercent(input: { elapsedMs: number; expectedDurationMs: number }) {
  const expectedDurationMs = Math.max(input.expectedDurationMs, FILING_PROGRESS_TICK_MS);
  const ratio = Math.min(input.elapsedMs / expectedDurationMs, 1);
  const easedRatio = 1 - (1 - ratio) ** 2;

  return Math.min(
    FILING_PROGRESS_MAX_RUNNING_PERCENT,
    Math.max(
      FILING_PROGRESS_INITIAL_PERCENT,
      Math.round(
        FILING_PROGRESS_INITIAL_PERCENT +
          (FILING_PROGRESS_MAX_RUNNING_PERCENT - FILING_PROGRESS_INITIAL_PERCENT) * easedRatio,
      ),
    ),
  );
}

function resolveClassFilingExpectedDurationMs(requestedCount: number) {
  return Math.min(
    CLASS_FILING_MAX_EXPECTED_DURATION_MS,
    CLASS_FILING_BASE_EXPECTED_DURATION_MS +
      Math.max(requestedCount, 1) * CLASS_FILING_PER_STUDENT_EXPECTED_DURATION_MS,
  );
}

function formatMissingProfileTagLabel(label: string) {
  if (label === '照片') {
    return '缺照片，请去校园网上传';
  }

  return `缺${label}信息`;
}

function resolveMissingProfileTagTextClassName(label: string) {
  return [
    'student-profile-filing-missing-tag-text',
    MISSING_PROFILE_TAG_TEXT_CLASS_NAMES[label] ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

function listStudentProfileFilingSupplementSections(
  student: StudentProfileFilingStudent,
): StudentProfileFilingSupplementSection[] {
  if (!student.snapshotPresent || !student.upstreamIdPresent) {
    return [];
  }

  return ['family', 'education'];
}

function formatStudentProfileFilingSupplementActionLabel(
  sections: readonly StudentProfileFilingSupplementSection[],
) {
  if (sections.length === 1) {
    return `补充${SUPPLEMENT_SECTION_LABELS[sections[0]]}`;
  }

  return '补充家庭/教育简历';
}

function resolveStudentProfileFilingSupplementSectionBaseline(input: {
  section: StudentProfileFilingSupplementSection;
  summary: StudentProfileFilingSupplementSummary | null;
}) {
  const sectionKey = SUPPLEMENT_SECTION_KEYS[input.section];

  return (
    input.summary?.sectionStatuses.find((sectionStatus) => sectionStatus.section === sectionKey)
      ?.sectionBaselineToken ?? null
  );
}

function displaySupplementText(value: string | null | undefined) {
  return value?.trim() || '—';
}

function formatFamilyRelationshipLabel(relationshipCode: string) {
  return FAMILY_RELATIONSHIP_LABELS[relationshipCode] ?? `关系 ${relationshipCode}`;
}

function toFamilyMemberDisplayItem(
  member: StudentProfileFilingSupplementFamilyMember,
): FamilyMemberDisplayItem {
  return {
    key: member.itemKey,
    name: displaySupplementText(member.maskedName),
    phone: displaySupplementText(member.maskedPhone),
    relationship: formatFamilyRelationshipLabel(member.relationshipCode),
    workplace: displaySupplementText(member.maskedWorkplace),
  };
}

function listFamilyMemberDisplayItems(summary: StudentProfileFilingSupplementSummary | null) {
  return summary?.familyMembers.map((member) => toFamilyMemberDisplayItem(member)) ?? [];
}

function resolveDefaultFamilyRelationshipCode(
  summary: StudentProfileFilingSupplementSummary | null,
) {
  const existingRelationshipCodes = new Set(
    summary?.familyMembers.map((member) => member.relationshipCode) ?? [],
  );

  if (!existingRelationshipCodes.has('1')) {
    return '1';
  }

  if (!existingRelationshipCodes.has('2')) {
    return '2';
  }

  return '1';
}

function formatEducationResumeMonth(value: string | null | undefined) {
  const normalizedValue = value?.trim() ?? '';
  const match = /^(\d{4})-(\d{2})$/.exec(normalizedValue);

  if (!match) {
    return normalizedValue || '—';
  }

  return `${match[1]} 年 ${Number(match[2])} 月`;
}

function formatEducationResumePeriod(input: {
  endMonth: string | null | undefined;
  startMonth: string | null | undefined;
}) {
  return `${formatEducationResumeMonth(input.startMonth)} - ${
    input.endMonth ? formatEducationResumeMonth(input.endMonth) : '至今'
  }`;
}

function toEducationResumeDisplayItem(
  resume: StudentProfileFilingSupplementEducationResume,
): EducationResumeDisplayItem {
  return {
    key: resume.itemKey,
    organization: displaySupplementText(resume.maskedOrganization),
    period: formatEducationResumePeriod({
      endMonth: resume.endMonth,
      startMonth: resume.startMonth,
    }),
    reference: displaySupplementText(resume.maskedReference),
    source: 'upstream',
  };
}

function resolveStudentProfileFilingEnrollmentYear(studentId: string) {
  const admissionYearText = studentId.trim().slice(1, 3);

  if (!/^\d{2}$/.test(admissionYearText)) {
    return null;
  }

  return 2000 + Number(admissionYearText);
}

function buildDefaultEducationSupplementFormValues(
  student: StudentProfileFilingStudent,
  summary?: StudentProfileFilingSupplementSummary | null,
): EducationSupplementDefaultValues {
  const enrollmentYear = resolveStudentProfileFilingEnrollmentYear(student.studentId);

  if (!enrollmentYear) {
    return {
      endDate: null,
      startDate: null,
    };
  }

  const defaultMiddleSchoolStartMonth = `${enrollmentYear - 3}-09`;
  const defaultMiddleSchoolEndMonth = `${enrollmentYear}-06`;
  const hasDefaultMiddleSchoolResume = Boolean(
    summary?.educationResumes.some(
      (resume) =>
        resume.startMonth === defaultMiddleSchoolStartMonth &&
        resume.endMonth === defaultMiddleSchoolEndMonth,
    ),
  );

  if (hasDefaultMiddleSchoolResume) {
    return {
      endDate: dayjs(`${enrollmentYear - 3}-06-01`),
      startDate: dayjs(`${enrollmentYear - 9}-09-01`),
    };
  }

  return {
    endDate: dayjs(`${enrollmentYear}-06-01`),
    startDate: dayjs(`${enrollmentYear - 3}-09-01`),
  };
}

function formatEducationSupplementFormMonth(value: Dayjs | null | undefined) {
  return value ? value.startOf('month').format('YYYY-MM') : null;
}

function shouldApplyEducationSupplementDefaults(input: {
  appliedDefaults: AppliedEducationSupplementDefaults | null;
  currentValues: Pick<EducationSupplementFormValues, 'endDate' | 'startDate'>;
  studentId: string;
}) {
  const currentStartMonth = formatEducationSupplementFormMonth(input.currentValues.startDate);
  const currentEndMonth = formatEducationSupplementFormMonth(input.currentValues.endDate);

  if (!currentStartMonth && !currentEndMonth) {
    return true;
  }

  if (input.appliedDefaults?.studentId !== input.studentId) {
    return false;
  }

  return (
    currentStartMonth === input.appliedDefaults.startMonth &&
    currentEndMonth === input.appliedDefaults.endMonth
  );
}

function formatEducationSupplementFormDate(value: Dayjs | null | undefined) {
  return value ? value.startOf('month').format('YYYY-MM-DD') : undefined;
}

function buildEducationSupplementWriteResume(
  values: EducationSupplementFormValues,
): StudentProfileFilingEducationSupplementInput['resume'] {
  return {
    endDate: formatEducationSupplementFormDate(values.endDate),
    organization: values.organization,
    reference: values.reference,
    startDate: formatEducationSupplementFormDate(values.startDate),
  };
}

function formatStudentProfileFilingClassAdviserNames(option: StudentProfileFilingClassOption) {
  return option.classAdvisers
    .map((adviser) => {
      const name = adviser.staffName.trim() || adviser.staffId.trim();

      if (!name) {
        return null;
      }

      return adviser.isTemporary ? `${name}（临时）` : name;
    })
    .filter((name): name is string => Boolean(name));
}

function resolveInferredCurrentSchoolEndText(option: StudentProfileFilingClassOption | null) {
  const expectedGraduationYear = option?.classExpectedGraduationYear;

  if (typeof expectedGraduationYear !== 'number') {
    return '至今';
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const hasReachedGraduationMonth =
    currentYear > expectedGraduationYear ||
    (currentYear === expectedGraduationYear && currentMonth >= 6);

  if (option?.classInSchool === false || hasReachedGraduationMonth) {
    return `${expectedGraduationYear} 年 6 月`;
  }

  return '至今';
}

function buildInferredCurrentSchoolEducationResume(
  student: StudentProfileFilingStudent,
  classOption: StudentProfileFilingClassOption | null,
): EducationResumeDisplayItem | null {
  const enrollmentYear = resolveStudentProfileFilingEnrollmentYear(student.studentId);

  if (!enrollmentYear) {
    return null;
  }

  return {
    key: 'inferred-current-school',
    organization: CURRENT_SCHOOL_NAME,
    period: `${enrollmentYear} 年 9 月 - ${resolveInferredCurrentSchoolEndText(classOption)}`,
    reference: classOption
      ? formatStudentProfileFilingClassAdviserNames(classOption).join('、')
      : '',
    source: 'inferred',
  };
}

function listEducationResumeDisplayItems(input: {
  classOption: StudentProfileFilingClassOption | null;
  student: StudentProfileFilingStudent;
  summary: StudentProfileFilingSupplementSummary | null;
}) {
  const upstreamItems =
    input.summary?.educationResumes.map((resume) => toEducationResumeDisplayItem(resume)) ?? [];
  const inferredCurrentSchoolItem = buildInferredCurrentSchoolEducationResume(
    input.student,
    input.classOption,
  );

  return inferredCurrentSchoolItem ? [...upstreamItems, inferredCurrentSchoolItem] : upstreamItems;
}

function hasStudentProfileFilingClassContext(option: StudentProfileFilingClassOption) {
  return (
    option.classAdvisers.length > 0 ||
    typeof option.classEnrollmentYear === 'number' ||
    typeof option.classExpectedGraduationYear === 'number' ||
    option.classInSchool !== null ||
    Boolean(option.classSchoolYearRangeLabel?.trim()) ||
    Boolean(option.majorName?.trim()) ||
    typeof option.trainingYears === 'number'
  );
}

function formatStudentProfileFilingClassAdviserText(option: StudentProfileFilingClassOption) {
  const advisers = formatStudentProfileFilingClassAdviserNames(option);

  return advisers.length > 0 ? advisers.join('、') : '未配置';
}

function formatStudentProfileFilingClassSchoolYearText(option: StudentProfileFilingClassOption) {
  const rangeLabel = option.classSchoolYearRangeLabel?.trim();

  if (rangeLabel) {
    return rangeLabel;
  }

  if (
    typeof option.classEnrollmentYear === 'number' &&
    typeof option.classExpectedGraduationYear === 'number'
  ) {
    return `${option.classEnrollmentYear}-${option.classExpectedGraduationYear}`;
  }

  return '未配置';
}

function formatStudentProfileFilingClassMajorText(option: StudentProfileFilingClassOption) {
  const majorName = option.majorName?.trim();
  const trainingYears =
    typeof option.trainingYears === 'number' ? `${option.trainingYears} 年制` : null;
  const parts = [majorName, trainingYears].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(' · ') : '未配置';
}

function renderStudentProfileFilingClassInSchoolTag(option: StudentProfileFilingClassOption) {
  if (option.classInSchool === null) {
    return null;
  }

  return (
    <Tag color={option.classInSchool ? 'processing' : 'default'}>
      {option.classInSchool ? '在校' : '已离校'}
    </Tag>
  );
}

function formatFilingDateTimeParts(value: string | null | undefined) {
  if (!value) {
    return {
      date: '未建档',
      time: null,
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: value,
      time: null,
    };
  }

  return {
    date: date.toLocaleDateString('zh-CN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
    }),
  };
}

export function StudentProfileFilingPageContent({
  currentAccount,
}: StudentProfileFilingPageContentProps) {
  const { message } = AntApp.useApp();
  const [familySupplementForm] = Form.useForm<FamilySupplementFormValues>();
  const [educationSupplementForm] = Form.useForm<EducationSupplementFormValues>();
  const [classOptions, setClassOptions] = useState<StudentProfileFilingClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [overview, setOverview] = useState<StudentProfileFilingClassOverview | null>(null);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [isClassFiling, setIsClassFiling] = useState(false);
  const [isLoadingSupplementSummary, setIsLoadingSupplementSummary] = useState(false);
  const [isSubmittingSupplement, setIsSubmittingSupplement] = useState(false);
  const [filingStudentId, setFilingStudentId] = useState<string | null>(null);
  const [supplementStudentId, setSupplementStudentId] = useState<string | null>(null);
  const [upstreamActionRequest, setUpstreamActionRequest] = useState<UpstreamActionRequest | null>(
    null,
  );
  const [pendingUpstreamActionKind, setPendingUpstreamActionKind] = useState<
    'filing' | 'supplement' | null
  >(null);
  const [supplementDrawerState, setSupplementDrawerState] = useState<SupplementDrawerState | null>(
    null,
  );
  const [supplementFeedback, setSupplementFeedback] = useState<SupplementFeedback | null>(null);
  const [refreshDigest, setRefreshDigest] = useState<RefreshDigest | null>(null);
  const [filingProgress, setFilingProgress] = useState<FilingProgressState | null>(null);
  const educationDefaultsAppliedRef = useRef<AppliedEducationSupplementDefaults | null>(null);
  const filingProgressStartedAtRef = useRef<number | null>(null);
  const filingProgressResetTimerRef = useRef<number | null>(null);
  const lockedUpstreamLoginUserId = currentAccount.lockedUpstreamLoginUserId;

  const clearFilingProgressResetTimer = useCallback(() => {
    if (filingProgressResetTimerRef.current) {
      window.clearTimeout(filingProgressResetTimerRef.current);
      filingProgressResetTimerRef.current = null;
    }
  }, []);

  const startFilingProgress = useCallback(
    (input: Omit<FilingProgressState, 'percent' | 'status'>) => {
      clearFilingProgressResetTimer();
      filingProgressStartedAtRef.current = Date.now();
      setFilingProgress({
        ...input,
        percent: FILING_PROGRESS_INITIAL_PERCENT,
        status: 'active',
      });
    },
    [clearFilingProgressResetTimer],
  );

  const completeFilingProgress = useCallback(() => {
    clearFilingProgressResetTimer();
    filingProgressStartedAtRef.current = null;
    setFilingProgress((current) =>
      current
        ? {
            ...current,
            percent: 100,
            status: 'success',
          }
        : current,
    );
    filingProgressResetTimerRef.current = window.setTimeout(() => {
      setFilingProgress(null);
      filingProgressResetTimerRef.current = null;
    }, FILING_PROGRESS_RESET_DELAY_MS);
  }, [clearFilingProgressResetTimer]);

  const cancelFilingProgress = useCallback(() => {
    clearFilingProgressResetTimer();
    filingProgressStartedAtRef.current = null;
    setFilingProgress(null);
  }, [clearFilingProgressResetTimer]);

  useEffect(() => {
    if (filingProgress?.status !== 'active') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const startedAt = filingProgressStartedAtRef.current;

      if (!startedAt) {
        return;
      }

      setFilingProgress((current) => {
        if (!current || current.status !== 'active') {
          return current;
        }

        return {
          ...current,
          percent: calculateFilingProgressPercent({
            elapsedMs: Date.now() - startedAt,
            expectedDurationMs: current.expectedDurationMs,
          }),
        };
      });
    }, FILING_PROGRESS_TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [filingProgress?.status]);

  useEffect(
    () => () => {
      clearFilingProgressResetTimer();
    },
    [clearFilingProgressResetTimer],
  );

  const loadOverview = useCallback(
    async (classId: string) => {
      setIsLoadingOverview(true);

      try {
        const nextOverview = await getStudentProfileFilingClassOverview({ classId });

        setOverview(nextOverview);
      } catch (error) {
        setOverview(null);
        message.error(resolveUpstreamErrorMessage(error, '暂时无法加载班级建档概览。'));
      } finally {
        setIsLoadingOverview(false);
      }
    },
    [message],
  );

  const loadClassOptions = useCallback(
    async (preferredClassId?: string | null) => {
      setIsLoadingClasses(true);

      try {
        const nextClassOptions = [...(await listStudentProfileFilingClassOptions())].sort(
          (left, right) => {
            const gradeCompare = (right.gradeYear ?? -1) - (left.gradeYear ?? -1);

            if (gradeCompare !== 0) {
              return gradeCompare;
            }

            return left.classCode.localeCompare(right.classCode, 'zh-CN', {
              numeric: true,
              sensitivity: 'base',
            });
          },
        );
        const nextClassId =
          nextClassOptions.find((item) => item.id === preferredClassId)?.id ??
          nextClassOptions[0]?.id ??
          null;

        setClassOptions(nextClassOptions);
        setSelectedClassId(nextClassId);

        if (nextClassId) {
          await loadOverview(nextClassId);
        } else {
          setOverview(null);
        }
      } catch (error) {
        setClassOptions([]);
        setSelectedClassId(null);
        setOverview(null);
        message.error(resolveUpstreamErrorMessage(error, '暂时无法加载可建档班级。'));
      } finally {
        setIsLoadingClasses(false);
      }
    },
    [loadOverview, message],
  );

  const handleClassChange = useCallback(
    async (classId: string) => {
      setSelectedClassId(classId);
      setRefreshDigest(null);
      setSupplementDrawerState(null);
      setSupplementFeedback(null);
      await loadOverview(classId);
    },
    [loadOverview],
  );

  const {
    modalProps: upstreamLoginModalProps,
    openLoginModal,
    openLoginModalForExpiredSession,
    persistSessionFromResult,
    refreshSession,
    session: upstreamSession,
  } = useUpstreamLoginModalController<PendingFilingAction>({
    account: currentAccount,
    keepAlive: true,
    lockedUserId: lockedUpstreamLoginUserId,
    resolveLoginErrorMessage: (error) =>
      resolveUpstreamErrorMessage(error, '学工系统登录失败，请检查账号或密码。'),
    onLoginSuccess: ({ pendingAction, session }) => {
      setPendingUpstreamActionKind(null);

      if (pendingAction) {
        setUpstreamActionRequest({
          action: pendingAction,
          session,
        });
      }
    },
  });

  const runStudentFilingWithSession = useCallback(
    async (
      session: StoredUpstreamSession,
      action: Extract<PendingFilingAction, { type: 'student' }>,
    ) => {
      setFilingStudentId(action.studentId);
      setRefreshDigest(null);
      startFilingProgress({
        expectedDurationMs: STUDENT_FILING_EXPECTED_DURATION_MS,
        label: `${action.studentName}（${action.studentId}）`,
        requestedCount: 1,
        scope: 'student',
      });

      let completed = false;
      try {
        const result = await refreshStudentProfileFilingStudent({
          studentId: action.studentId,
          upstreamSessionToken: session.upstreamSessionToken,
        });

        persistSessionFromResult(session, result);
        setRefreshDigest(
          buildStudentRefreshDigest({
            changedSections: result.changedSections,
            expiresAt: result.expiresAt,
            studentId: result.studentId,
            success: result.success,
            traceId: result.traceId,
            warningCodes: result.warnings.map((warning) => warning.code),
          }),
        );
        await loadOverview(action.classId);
        completed = true;
        completeFilingProgress();

        if (result.success) {
          message.success('学生建档快照已更新。');
        } else {
          message.warning('学生建档请求已返回，请检查结果。');
        }
      } finally {
        if (!completed) {
          cancelFilingProgress();
        }
        setFilingStudentId(null);
      }
    },
    [
      cancelFilingProgress,
      completeFilingProgress,
      loadOverview,
      message,
      persistSessionFromResult,
      startFilingProgress,
    ],
  );

  const runClassFilingWithSession = useCallback(
    async (
      session: StoredUpstreamSession,
      action: Extract<PendingFilingAction, { type: 'class' }>,
    ) => {
      setIsClassFiling(true);
      setRefreshDigest(null);
      startFilingProgress({
        expectedDurationMs: resolveClassFilingExpectedDurationMs(action.requestedCount),
        label: action.classLabel ?? '当前班级',
        requestedCount: action.requestedCount,
        scope: 'class',
      });

      let completed = false;
      try {
        const result = await refreshStudentProfileFilingClass({
          classId: action.classId,
          upstreamSessionToken: session.upstreamSessionToken,
        });

        persistSessionFromResult(session, result);
        setRefreshDigest({
          expiresAt: result.expiresAt,
          failureCount: result.failureCount,
          requestedCount: result.requestedCount,
          results: result.results,
          scopeLabel: '整班建档',
          successCount: result.successCount,
          traceId: result.traceId,
        });
        await loadOverview(action.classId);
        completed = true;
        completeFilingProgress();

        if (result.failureCount > 0) {
          message.warning('整班建档已完成，部分学生需要检查。');
        } else {
          message.success('整班建档快照已更新。');
        }
      } finally {
        if (!completed) {
          cancelFilingProgress();
        }
        setIsClassFiling(false);
      }
    },
    [
      cancelFilingProgress,
      completeFilingProgress,
      loadOverview,
      message,
      persistSessionFromResult,
      startFilingProgress,
    ],
  );

  const runSupplementWithSession = useCallback(
    async (
      session: StoredUpstreamSession,
      action: Extract<PendingFilingAction, { type: 'education-supplement' | 'family-supplement' }>,
    ) => {
      setIsSubmittingSupplement(true);
      setSupplementStudentId(action.studentId);
      setSupplementFeedback(null);

      try {
        const result: StudentProfileFilingSupplementWriteResult =
          action.type === 'family-supplement'
            ? await writeStudentProfileFilingFamilySupplement({
                expectedSectionBaselineToken: action.expectedSectionBaselineToken,
                member: action.member,
                studentId: action.studentId,
                upstreamSessionToken: session.upstreamSessionToken,
              })
            : await writeStudentProfileFilingEducationSupplement({
                expectedSectionBaselineToken: action.expectedSectionBaselineToken,
                resume: action.resume,
                studentId: action.studentId,
                upstreamSessionToken: session.upstreamSessionToken,
              });
        const sectionLabel =
          action.type === 'family-supplement'
            ? SUPPLEMENT_SECTION_LABELS.family
            : SUPPLEMENT_SECTION_LABELS.education;
        const resultWarnings =
          result.warningCodes.length > 0 ? `警告码：${result.warningCodes.join('、')}` : undefined;

        let nextSession = persistSessionFromResult(session, result);
        let profileRefreshFailed = false;

        if (result.success && result.upstreamSaved && !result.localSnapshotRefreshed) {
          try {
            const refreshResult = await refreshStudentProfileFilingStudent({
              studentId: action.studentId,
              upstreamSessionToken: nextSession.upstreamSessionToken,
            });

            nextSession = persistSessionFromResult(nextSession, refreshResult);
          } catch {
            profileRefreshFailed = true;
          }
        }

        await loadOverview(action.classId);

        if (result.success && result.upstreamSaved) {
          message.success(`${sectionLabel}信息已写回学工系统。`);
          let nextSummary: StudentProfileFilingSupplementSummary | null = null;

          try {
            nextSummary = await getStudentProfileFilingSupplementSummary({
              studentId: action.studentId,
            });
          } catch {
            nextSummary = null;
          }

          setSupplementFeedback({
            description: profileRefreshFailed
              ? '写回已完成，但该学生资料刷新失败。请手动更新该学生资料后确认提醒状态。'
              : result.summaryRefreshFailed || !nextSummary
                ? '写回已完成，但资料摘要刷新失败。请刷新当前学生资料后确认最新列表。'
                : result.localSnapshotRefreshed
                  ? '该学生资料已更新，当前列表和班级概览已刷新。'
                  : '已主动更新该学生资料，当前列表和班级概览已刷新。',
            message: `${sectionLabel}信息已写回学工系统`,
            type:
              profileRefreshFailed || result.summaryRefreshFailed || !nextSummary
                ? 'warning'
                : 'success',
          });

          if (action.type === 'education-supplement') {
            educationSupplementForm.resetFields();

            if (nextSummary) {
              setSupplementDrawerState((current) =>
                current?.student.studentId === action.studentId
                  ? {
                      ...current,
                      summary: nextSummary,
                    }
                  : current,
              );
            }
          } else {
            familySupplementForm.resetFields();

            familySupplementForm.setFieldValue(
              'relationshipCode',
              nextSummary ? resolveDefaultFamilyRelationshipCode(nextSummary) : '1',
            );
            if (nextSummary) {
              setSupplementDrawerState((current) =>
                current?.student.studentId === action.studentId
                  ? {
                      ...current,
                      summary: nextSummary,
                    }
                  : current,
              );
            }
          }
        } else {
          message.warning(`${sectionLabel}信息写回请求已返回，请检查结果。`);
          setSupplementFeedback({
            description: resultWarnings ?? '学工系统未确认保存成功，请稍后重试或刷新后检查。',
            message: `${sectionLabel}信息写回请求已返回`,
            type: 'warning',
          });
        }
      } finally {
        setIsSubmittingSupplement(false);
        setSupplementStudentId(null);
      }
    },
    [
      educationSupplementForm,
      familySupplementForm,
      loadOverview,
      message,
      persistSessionFromResult,
    ],
  );

  const executeFilingAction = useCallback(
    async (session: StoredUpstreamSession, action: PendingFilingAction) => {
      const runAction = async (nextSession: StoredUpstreamSession) => {
        if (action.type === 'class') {
          await runClassFilingWithSession(nextSession, action);
          return;
        }

        if (action.type === 'family-supplement' || action.type === 'education-supplement') {
          await runSupplementWithSession(nextSession, action);
          return;
        }

        await runStudentFilingWithSession(nextSession, action);
      };

      try {
        await runAction(session);
      } catch (error) {
        if (!isExpiredUpstreamSessionError(error)) {
          const isSupplementAction =
            action.type === 'family-supplement' || action.type === 'education-supplement';
          const errorMessage = resolveUpstreamErrorMessage(
            error,
            isSupplementAction ? '暂时无法补充资料。' : '暂时无法完成学生建档。',
          );

          if (isSupplementAction) {
            setSupplementFeedback({
              description: errorMessage,
              message: '补充资料失败',
              type: 'error',
            });
          }

          message.error(errorMessage);
          return;
        }

        try {
          const refreshedSession = await refreshSession(session);

          await runAction(refreshedSession);
        } catch (refreshError) {
          const isSupplementAction =
            action.type === 'family-supplement' || action.type === 'education-supplement';

          if (isSupplementAction) {
            setSupplementFeedback({
              description: '请重新登录学工系统，登录成功后会继续提交当前资料。',
              message: '学工系统登录已失效',
              type: 'warning',
            });
          }

          setPendingUpstreamActionKind(isSupplementAction ? 'supplement' : 'filing');
          openLoginModalForExpiredSession({
            loginError: resolveUpstreamErrorMessage(
              refreshError,
              isSupplementAction
                ? '学工系统会话已失效，请重新登录后继续补充资料。'
                : '学工系统会话已失效，请重新登录后继续建档。',
            ),
            pendingAction: action,
            session,
          });
        }
      }
    },
    [
      message,
      openLoginModalForExpiredSession,
      refreshSession,
      runClassFilingWithSession,
      runStudentFilingWithSession,
      runSupplementWithSession,
    ],
  );

  const requestFilingAction = useCallback(
    (action: PendingFilingAction) => {
      if (upstreamSession) {
        void executeFilingAction(upstreamSession, action);
        return;
      }

      const isSupplementAction =
        action.type === 'family-supplement' || action.type === 'education-supplement';

      if (isSupplementAction) {
        setSupplementFeedback({
          description: '登录完成后会继续提交当前补充资料。',
          message: '需要先登录学工系统',
          type: 'info',
        });
      }

      setPendingUpstreamActionKind(isSupplementAction ? 'supplement' : 'filing');
      openLoginModal({
        fallbackUserId: lockedUpstreamLoginUserId ?? currentAccount.staffId,
        pendingAction: action,
      });
    },
    [
      currentAccount.staffId,
      executeFilingAction,
      lockedUpstreamLoginUserId,
      openLoginModal,
      upstreamSession,
    ],
  );

  useEffect(() => {
    void loadClassOptions(null);
  }, [loadClassOptions]);

  useEffect(() => {
    if (!upstreamActionRequest) {
      return;
    }

    setUpstreamActionRequest(null);
    void executeFilingAction(upstreamActionRequest.session, upstreamActionRequest.action);
  }, [executeFilingAction, upstreamActionRequest]);

  const students = useMemo(() => overview?.students ?? [], [overview?.students]);
  const summary = useMemo(() => summarizeStudentProfileFilingStudents(students), [students]);
  const refreshableStudentIds = useMemo(
    () => listStudentProfileFilingRefreshableStudentIds(students),
    [students],
  );
  const selectedClassOption = useMemo(
    () => classOptions.find((item) => item.id === selectedClassId) ?? null,
    [classOptions, selectedClassId],
  );
  const shouldShowSelectedClassContext =
    selectedClassOption !== null && hasStudentProfileFilingClassContext(selectedClassOption);
  const selectOptions = useMemo(
    () =>
      classOptions.map((item) => ({
        label: formatStudentProfileFilingClassLabel(item),
        value: item.id,
      })),
    [classOptions],
  );

  const handleClassFiling = useCallback(() => {
    if (!selectedClassId) {
      message.warning('请先选择班级。');
      return;
    }

    if (refreshableStudentIds.length === 0) {
      message.warning('当前班级没有可建档或可更新的学生。');
      return;
    }

    requestFilingAction({
      classId: selectedClassId,
      classLabel: selectedClassOption
        ? formatStudentProfileFilingClassLabel(selectedClassOption)
        : null,
      requestedCount: refreshableStudentIds.length,
      type: 'class',
    });
  }, [message, refreshableStudentIds, requestFilingAction, selectedClassId, selectedClassOption]);

  const openSupplementDrawer = useCallback(
    async (student: StudentProfileFilingStudent) => {
      const availableSections = listStudentProfileFilingSupplementSections(student);

      if (availableSections.length === 0) {
        message.warning('当前学生没有可补充的家庭或教育简历信息。');
        return;
      }

      familySupplementForm.setFieldsValue({
        name: undefined,
        phone: undefined,
        relationshipCode: '1',
        workplace: undefined,
      });
      educationSupplementForm.resetFields();
      educationDefaultsAppliedRef.current = null;
      setSupplementFeedback(null);
      setSupplementDrawerState({
        activeSection: availableSections[0],
        availableSections,
        student,
        summary: null,
      });
      setSupplementStudentId(student.studentId);
      setIsLoadingSupplementSummary(true);

      try {
        const nextSummary = await getStudentProfileFilingSupplementSummary({
          studentId: student.studentId,
        });

        familySupplementForm.setFieldValue(
          'relationshipCode',
          resolveDefaultFamilyRelationshipCode(nextSummary),
        );
        setSupplementDrawerState((current) =>
          current?.student.studentId === student.studentId
            ? {
                ...current,
                summary: nextSummary,
              }
            : current,
        );
      } catch (error) {
        setSupplementDrawerState(null);
        message.error(resolveUpstreamErrorMessage(error, '暂时无法读取学生资料版本。'));
      } finally {
        setIsLoadingSupplementSummary(false);
        setSupplementStudentId(null);
      }
    },
    [educationSupplementForm, familySupplementForm, message],
  );

  const closeSupplementDrawer = useCallback(() => {
    setSupplementDrawerState(null);
    setSupplementFeedback(null);
    educationDefaultsAppliedRef.current = null;
    familySupplementForm.resetFields();
    educationSupplementForm.resetFields();
  }, [educationSupplementForm, familySupplementForm]);

  const handleSupplementSectionChange = useCallback(
    (section: StudentProfileFilingSupplementSection) => {
      setSupplementDrawerState((current) =>
        current
          ? {
              ...current,
              activeSection: section,
            }
          : current,
      );
    },
    [],
  );

  useEffect(() => {
    if (supplementDrawerState?.activeSection !== 'education' || !supplementDrawerState.student) {
      return;
    }

    const currentValues = educationSupplementForm.getFieldsValue(['startDate', 'endDate']);

    if (
      !shouldApplyEducationSupplementDefaults({
        appliedDefaults: educationDefaultsAppliedRef.current,
        currentValues,
        studentId: supplementDrawerState.student.studentId,
      })
    ) {
      return;
    }

    const defaultValues = buildDefaultEducationSupplementFormValues(
      supplementDrawerState.student,
      supplementDrawerState.summary,
    );
    educationSupplementForm.setFieldsValue(defaultValues);
    educationDefaultsAppliedRef.current = {
      endMonth: formatEducationSupplementFormMonth(defaultValues.endDate),
      startMonth: formatEducationSupplementFormMonth(defaultValues.startDate),
      studentId: supplementDrawerState.student.studentId,
    };
  }, [
    educationSupplementForm,
    supplementDrawerState?.activeSection,
    supplementDrawerState?.summary,
    supplementDrawerState?.student,
  ]);

  const submitSupplementSection = useCallback(
    async (section: StudentProfileFilingSupplementSection) => {
      if (!supplementDrawerState) {
        return;
      }

      const classId = overview?.classId ?? selectedClassId;

      if (!classId) {
        setSupplementFeedback({
          description: '请选择班级后再提交补充资料。',
          message: '暂时无法提交',
          type: 'warning',
        });
        message.warning('请先选择班级。');
        return;
      }

      const expectedSectionBaselineToken = resolveStudentProfileFilingSupplementSectionBaseline({
        section,
        summary: supplementDrawerState.summary,
      });

      if (!expectedSectionBaselineToken) {
        const errorMessage = `${SUPPLEMENT_SECTION_LABELS[section]}信息缺少资料版本校验码，请先更新资料。`;

        setSupplementFeedback({
          description: errorMessage,
          message: '暂时无法提交',
          type: 'error',
        });
        message.error(errorMessage);
        return;
      }

      setSupplementFeedback(null);

      if (section === 'family') {
        const values = await familySupplementForm.validateFields();

        requestFilingAction({
          classId,
          expectedSectionBaselineToken,
          member: values,
          studentId: supplementDrawerState.student.studentId,
          type: 'family-supplement',
        });
        return;
      }

      const values = await educationSupplementForm.validateFields();

      requestFilingAction({
        classId,
        expectedSectionBaselineToken,
        resume: buildEducationSupplementWriteResume(values),
        studentId: supplementDrawerState.student.studentId,
        type: 'education-supplement',
      });
    },
    [
      educationSupplementForm,
      familySupplementForm,
      message,
      overview?.classId,
      requestFilingAction,
      selectedClassId,
      supplementDrawerState,
    ],
  );

  const classFilingActionLabel = useMemo(() => {
    const updatableCount = summary.filedCount + summary.warningCount;

    if (summary.pendingCount > 0 && updatableCount > 0) {
      return '建档/更新当前班级';
    }

    if (updatableCount > 0) {
      return '更新当前班级';
    }

    return '建档当前班级';
  }, [summary.filedCount, summary.pendingCount, summary.warningCount]);
  const shouldShowInitialClassEmptyState =
    overview !== null &&
    !isLoadingOverview &&
    shouldShowStudentProfileFilingInitialClassEmptyState(summary);
  const tableStudents = shouldShowInitialClassEmptyState ? [] : students;

  const columns = useMemo<ColumnsType<StudentProfileFilingStudent>>(
    () => [
      {
        dataIndex: 'studentName',
        fixed: 'left',
        key: 'student',
        render: (_, record) => (
          <div className="student-profile-filing-student-cell">
            <span className="student-profile-filing-student-name-row">
              <span className="student-profile-filing-student-name">{record.studentName}</span>
              {isStudentProfileFilingDroppedStudent(record) ? (
                <Tag color="volcano">退学</Tag>
              ) : null}
            </span>
            <span className="student-profile-filing-muted">{record.studentId}</span>
          </div>
        ),
        title: '学生',
        width: 100,
      },
      {
        key: 'completeness',
        render: (_, record) => {
          if (!record.snapshotPresent) {
            return (
              <Tooltip title="建档后显示资料进度">
                <Tag color="processing">待建档</Tag>
              </Tooltip>
            );
          }

          const observedCount = countStudentProfileFilingCompleteness(
            record.profileCompletenessFlags,
          );
          const totalCount = STUDENT_PROFILE_FILING_COMPLETENESS_ITEMS.length;
          const missingLabels = listMissingStudentProfileFilingCompletenessLabels(
            record.profileCompletenessFlags,
          );

          return (
            <Tooltip title={missingLabels.length > 0 ? `缺：${missingLabels.join('、')}` : '完整'}>
              <Progress
                percent={Math.round((observedCount / totalCount) * 100)}
                size="small"
                status={observedCount === totalCount ? 'success' : 'active'}
                format={() => `${observedCount}/${totalCount}`}
              />
            </Tooltip>
          );
        },
        title: '资料进度',
        width: 190,
      },
      {
        key: 'warnings',
        render: (_, record) => {
          const droppedSemesterNotice = resolveStudentProfileFilingDroppedSemesterNotice(record);
          const missingCompletenessLabels =
            listVisibleMissingStudentProfileFilingCompletenessLabels(record);
          const tags: StudentProfileFilingNoticeTag[] = [
            ...(!record.upstreamIdPresent
              ? [
                  {
                    color: 'error',
                    key: 'upstream-id-missing',
                    label: '缺学工关联',
                  },
                ]
              : []),
            ...(record.upstreamIdPresent && !record.snapshotPresent
              ? [
                  {
                    color: 'processing',
                    key: 'missing-snapshot',
                    label: '待建档',
                  },
                ]
              : []),
            ...missingCompletenessLabels.map((label) => ({
              color: 'default',
              key: `missing:${label}`,
              label: formatMissingProfileTagLabel(label),
              textClassName: resolveMissingProfileTagTextClassName(label),
            })),
            ...(record.manualOverrideActive
              ? [
                  {
                    color: 'warning',
                    key: 'manual-override',
                    label: '人工修正',
                  },
                ]
              : []),
            ...(record.upstreamChangedSinceManualPatch
              ? [
                  {
                    color: 'warning',
                    key: 'upstream-changed',
                    label: '上游已变化',
                  },
                ]
              : []),
            ...record.warningCodes.map((code) => ({
              color: 'warning',
              key: `warning:${code}`,
              label: code,
            })),
            ...(droppedSemesterNotice
              ? [
                  {
                    color: 'volcano',
                    key: 'dropped-effective-semester',
                    label: droppedSemesterNotice,
                  },
                ]
              : []),
          ];

          if (tags.length === 0) {
            return <span className="student-profile-filing-muted">无</span>;
          }

          return (
            <Space size={[4, 4]} wrap>
              {tags.map((tag) => (
                <Tag color={tag.color} key={tag.key}>
                  {tag.textClassName ? (
                    <span className={tag.textClassName}>{tag.label}</span>
                  ) : (
                    tag.label
                  )}
                </Tag>
              ))}
            </Space>
          );
        },
        title: '提醒',
        width: 340,
      },
      {
        dataIndex: 'lastSyncedAt',
        key: 'lastSyncedAt',
        render: (value: string | null) => {
          const display = formatFilingDateTimeParts(value);

          return (
            <span className="student-profile-filing-date-cell">
              <span className="student-profile-filing-date">{display.date}</span>
              {display.time ? (
                <span className="student-profile-filing-time">{display.time}</span>
              ) : null}
            </span>
          );
        },
        title: '最近同步',
        width: 88,
      },
      {
        fixed: 'right',
        key: 'actions',
        render: (_, record) => {
          const actionIntent = resolveStudentProfileFilingActionIntent(record);
          const supplementSections = listStudentProfileFilingSupplementSections(record);

          return (
            <Space orientation="vertical" size={4}>
              <Tooltip title={buildRefreshableTooltip(record)}>
                <Button
                  disabled={
                    actionIntent === 'UNAVAILABLE' ||
                    isClassFiling ||
                    (filingStudentId !== null && filingStudentId !== record.studentId)
                  }
                  icon={<CloudSyncOutlined />}
                  loading={filingStudentId === record.studentId}
                  size="small"
                  onClick={() =>
                    requestFilingAction({
                      classId: overview?.classId ?? selectedClassId ?? '',
                      studentName: record.studentName,
                      studentId: record.studentId,
                      type: 'student',
                    })
                  }
                >
                  {STUDENT_PROFILE_FILING_ACTION_LABELS[actionIntent]}
                </Button>
              </Tooltip>
              {supplementSections.length > 0 ? (
                <Button
                  disabled={isClassFiling || isSubmittingSupplement || isLoadingSupplementSummary}
                  icon={<PlusOutlined />}
                  loading={supplementStudentId === record.studentId}
                  size="small"
                  onClick={() => {
                    void openSupplementDrawer(record);
                  }}
                >
                  {formatStudentProfileFilingSupplementActionLabel(supplementSections)}
                </Button>
              ) : null}
            </Space>
          );
        },
        title: '操作',
        width: 148,
      },
    ],
    [
      filingStudentId,
      isClassFiling,
      isLoadingSupplementSummary,
      isSubmittingSupplement,
      openSupplementDrawer,
      overview?.classId,
      requestFilingAction,
      selectedClassId,
      supplementStudentId,
    ],
  );

  const supplementSectionOptions =
    supplementDrawerState?.availableSections.map((section) => ({
      label: SUPPLEMENT_SECTION_LABELS[section],
      value: section,
    })) ?? [];
  const activeSupplementSection = supplementDrawerState?.activeSection ?? 'family';
  const activeSupplementStudent = supplementDrawerState?.student ?? null;
  const activeEducationResumeItems = activeSupplementStudent
    ? listEducationResumeDisplayItems({
        classOption: selectedClassOption,
        student: activeSupplementStudent,
        summary: supplementDrawerState?.summary ?? null,
      })
    : [];
  const activeFamilyMemberItems = listFamilyMemberDisplayItems(
    supplementDrawerState?.summary ?? null,
  );
  const upstreamLoginDescription =
    pendingUpstreamActionKind === 'supplement'
      ? '补充资料需要写回学工系统，授权后会刷新本地资料快照。'
      : '学生建档需要读取学工系统资料，授权后会写入本地基础资料快照。';
  const upstreamLoginOkText =
    pendingUpstreamActionKind === 'supplement' ? '授权并补充资料' : '授权并建档';

  return (
    <div className="student-profile-filing-page">
      <DecoratedPageHeader
        description="同步学生基础资料快照，保证后续业务能基于本地建档数据继续流转。"
        icon={<FileDoneOutlined />}
        title="学生建档"
      />

      <Card>
        <div className="student-profile-filing-toolbar">
          <div className="student-profile-filing-toolbar-main">
            <div className="student-profile-filing-class-picker">
              <div className="student-profile-filing-class-select">
                <Select
                  disabled={isLoadingClasses || isClassFiling}
                  loading={isLoadingClasses}
                  options={selectOptions}
                  placeholder="选择班级"
                  showSearch
                  value={selectedClassId}
                  optionFilterProp="label"
                  onChange={(value) => {
                    void handleClassChange(value);
                  }}
                />
              </div>
              {selectedClassOption && shouldShowSelectedClassContext ? (
                <div className="student-profile-filing-class-context">
                  <span className="student-profile-filing-class-context-item">
                    <span className="student-profile-filing-class-context-label">班主任</span>
                    <span className="student-profile-filing-class-context-value">
                      {formatStudentProfileFilingClassAdviserText(selectedClassOption)}
                    </span>
                  </span>
                  <span className="student-profile-filing-class-context-item">
                    <span className="student-profile-filing-class-context-label">班级年份</span>
                    <span className="student-profile-filing-class-context-value">
                      {formatStudentProfileFilingClassSchoolYearText(selectedClassOption)}
                    </span>
                  </span>
                  <span className="student-profile-filing-class-context-item">
                    <span className="student-profile-filing-class-context-label">专业</span>
                    <span className="student-profile-filing-class-context-value">
                      {formatStudentProfileFilingClassMajorText(selectedClassOption)}
                    </span>
                  </span>
                  {renderStudentProfileFilingClassInSchoolTag(selectedClassOption)}
                </div>
              ) : null}
            </div>
            <Button
              disabled={!selectedClassId || isClassFiling}
              icon={<ReloadOutlined />}
              loading={isLoadingOverview}
              onClick={() => {
                if (selectedClassId) {
                  void loadOverview(selectedClassId);
                }
              }}
            >
              刷新概览
            </Button>
          </div>
          <Button
            disabled={!selectedClassId || isLoadingOverview || refreshableStudentIds.length === 0}
            icon={<SolutionOutlined />}
            loading={isClassFiling}
            type="primary"
            onClick={handleClassFiling}
          >
            {classFilingActionLabel}
          </Button>
        </div>
      </Card>

      {filingProgress ? (
        <Alert
          showIcon
          description={
            <div className="student-profile-filing-upstream-progress">
              <Progress
                percent={filingProgress.percent}
                status={filingProgress.status === 'success' ? 'success' : 'active'}
              />
              <div className="student-profile-filing-upstream-progress-meta">
                <span className="student-profile-filing-upstream-progress-label">
                  {filingProgress.scope === 'class' ? '范围' : '学生'}：{filingProgress.label}
                </span>
                <span className="student-profile-filing-upstream-progress-count">
                  本次 {filingProgress.requestedCount} 人
                </span>
              </div>
            </div>
          }
          message={
            filingProgress.status === 'success' ? '学工系统资料读取完成' : '正在读取学工系统资料'
          }
          type={filingProgress.status === 'success' ? 'success' : 'info'}
        />
      ) : refreshDigest ? (
        <Alert
          showIcon
          description={`成功 ${refreshDigest.successCount}，失败 ${
            refreshDigest.failureCount
          }，会话有效期 ${formatUpstreamSessionDateTime(refreshDigest.expiresAt)}。`}
          message={`${refreshDigest.scopeLabel}完成，共 ${refreshDigest.requestedCount} 人`}
          type={refreshDigest.failureCount > 0 ? 'warning' : 'success'}
        />
      ) : null}

      <section className="student-profile-filing-workbench-section">
        <div className="student-profile-filing-workbench">
          <div className="student-profile-filing-table-pane">
            <Table<StudentProfileFilingStudent>
              columns={columns}
              dataSource={tableStudents}
              loading={isLoadingOverview}
              locale={
                shouldShowInitialClassEmptyState
                  ? {
                      emptyText: (
                        <div className="student-profile-filing-table-empty">
                          <Empty
                            description="当前班级尚未建立本地资料快照"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                          >
                            <Button
                              disabled={
                                !selectedClassId ||
                                isLoadingOverview ||
                                refreshableStudentIds.length === 0
                              }
                              icon={<SolutionOutlined />}
                              loading={isClassFiling}
                              type="primary"
                              onClick={handleClassFiling}
                            >
                              建档当前班级
                            </Button>
                          </Empty>
                        </div>
                      ),
                    }
                  : undefined
              }
              pagination={{
                defaultPageSize: 30,
                pageSizeOptions: [30, 60],
                showSizeChanger: true,
              }}
              rowKey="studentId"
              scroll={{ x: 900 }}
              size="middle"
              summary={() =>
                refreshDigest && refreshDigest.failureCount > 0 ? (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell colSpan={5} index={0}>
                        <Space size={[8, 8]} wrap>
                          {refreshDigest.results
                            .filter((result) => result.status !== 'SUCCESS')
                            .slice(0, 6)
                            .map((result) => (
                              <Tag color="warning" key={result.studentId}>
                                {result.studentId}: {renderRefreshIssue(result)}
                              </Tag>
                            ))}
                        </Space>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                ) : null
              }
            />
          </div>
        </div>
      </section>

      <Drawer
        destroyOnHidden
        open={Boolean(supplementDrawerState)}
        size={480}
        title={
          activeSupplementStudent ? (
            <span className="student-profile-filing-supplement-drawer-title">
              <span className="student-profile-filing-supplement-drawer-title-context">
                补充资料
              </span>
              <span className="student-profile-filing-supplement-drawer-title-student">
                {activeSupplementStudent.studentName}
              </span>
              <span className="student-profile-filing-supplement-drawer-title-id">
                {activeSupplementStudent.studentId}
              </span>
            </span>
          ) : (
            '补充资料'
          )
        }
        onClose={closeSupplementDrawer}
      >
        {supplementDrawerState ? (
          <Spin spinning={isLoadingSupplementSummary}>
            <div className="student-profile-filing-supplement-drawer-content">
              {supplementSectionOptions.length > 1 ? (
                <Segmented
                  block
                  options={supplementSectionOptions}
                  value={activeSupplementSection}
                  onChange={(value) =>
                    handleSupplementSectionChange(value as StudentProfileFilingSupplementSection)
                  }
                />
              ) : null}

              {supplementFeedback ? (
                <Alert
                  closable
                  description={supplementFeedback.description}
                  showIcon
                  title={supplementFeedback.message}
                  type={supplementFeedback.type}
                  onClose={() => setSupplementFeedback(null)}
                />
              ) : null}

              {activeSupplementSection === 'family' ? (
                <div className="student-profile-filing-family-supplement">
                  <div className="student-profile-filing-supplement-section-title">
                    当前家庭信息
                  </div>
                  {activeFamilyMemberItems.length > 0 ? (
                    <div className="student-profile-filing-family-member-list">
                      {activeFamilyMemberItems.map((item) => (
                        <div className="student-profile-filing-family-member-item" key={item.key}>
                          <div className="student-profile-filing-family-member-main">
                            <span className="student-profile-filing-family-member-name">
                              {item.relationship} · {item.name}
                            </span>
                            <span className="student-profile-filing-family-member-detail">
                              <span>电话：{item.phone}</span>
                              <span>单位：{item.workplace}</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description="暂无家庭信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}

                  <Form<FamilySupplementFormValues>
                    form={familySupplementForm}
                    layout="vertical"
                    requiredMark={false}
                    onFinish={() => {
                      void submitSupplementSection('family');
                    }}
                  >
                    <div className="student-profile-filing-supplement-section-title">
                      新增家庭信息
                    </div>
                    <Form.Item
                      label="家庭关系"
                      name="relationshipCode"
                      rules={[{ required: true, message: '请选择家庭关系。' }]}
                    >
                      <Radio.Group
                        optionType="button"
                        options={[
                          { label: '父亲', value: '1' },
                          { label: '母亲', value: '2' },
                          { label: '祖父母', value: '3' },
                          { label: '兄弟姐妹', value: '4' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item
                      label="姓名"
                      name="name"
                      rules={[
                        { required: true, message: '请输入家庭成员姓名。', whitespace: true },
                      ]}
                    >
                      <Input autoComplete="off" />
                    </Form.Item>
                    <Form.Item label="电话" name="phone">
                      <Input autoComplete="off" />
                    </Form.Item>
                    <Form.Item label="工作单位" name="workplace">
                      <Input autoComplete="off" />
                    </Form.Item>
                    <div className="student-profile-filing-supplement-drawer-actions">
                      <Button onClick={closeSupplementDrawer}>取消</Button>
                      <Button
                        htmlType="submit"
                        loading={isSubmittingSupplement && activeSupplementSection === 'family'}
                        type="primary"
                      >
                        提交家庭信息
                      </Button>
                    </div>
                  </Form>
                </div>
              ) : (
                <div className="student-profile-filing-education-supplement">
                  <div className="student-profile-filing-supplement-section-title">
                    当前教育简历
                  </div>
                  <div className="student-profile-filing-education-resume-list">
                    {activeEducationResumeItems.map((item) => (
                      <div
                        className={
                          item.source === 'inferred'
                            ? 'student-profile-filing-education-resume-item student-profile-filing-education-resume-item-inferred'
                            : 'student-profile-filing-education-resume-item'
                        }
                        key={item.key}
                      >
                        {item.source === 'inferred' ? (
                          <span className="student-profile-filing-education-resume-source-tag">
                            <Tag color="default">本校推算</Tag>
                          </span>
                        ) : null}
                        <div className="student-profile-filing-education-resume-main">
                          <span className="student-profile-filing-education-resume-period">
                            {item.period}
                          </span>
                          <span className="student-profile-filing-education-resume-detail">
                            <span>{item.organization}</span>
                            {item.reference ? <span>证明人：{item.reference}</span> : null}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Form<EducationSupplementFormValues>
                    form={educationSupplementForm}
                    initialValues={
                      activeSupplementStudent
                        ? buildDefaultEducationSupplementFormValues(
                            activeSupplementStudent,
                            supplementDrawerState?.summary,
                          )
                        : undefined
                    }
                    key={`education-supplement-${activeSupplementStudent?.studentId ?? 'none'}`}
                    layout="vertical"
                    requiredMark={false}
                    onFinish={() => {
                      void submitSupplementSection('education');
                    }}
                  >
                    <div className="student-profile-filing-supplement-section-title">
                      新增教育简历
                    </div>
                    <Form.Item
                      label="开始月份"
                      name="startDate"
                      rules={[{ required: true, message: '请选择开始月份。' }]}
                    >
                      <DatePicker
                        allowClear
                        format="YYYY-MM"
                        picker="month"
                        placeholder="请选择开始月份"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                    <Form.Item
                      label="结束月份"
                      name="endDate"
                      rules={[{ required: true, message: '请选择结束月份。' }]}
                    >
                      <DatePicker
                        allowClear
                        format="YYYY-MM"
                        picker="month"
                        placeholder="请选择结束月份"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                    <Form.Item
                      label="学校"
                      name="organization"
                      rules={[{ required: true, message: '请输入学校。', whitespace: true }]}
                    >
                      <Input autoComplete="off" />
                    </Form.Item>
                    <Form.Item
                      label="证明人"
                      name="reference"
                      rules={[{ required: true, message: '请输入证明人。', whitespace: true }]}
                    >
                      <Input autoComplete="off" />
                    </Form.Item>
                    <div className="student-profile-filing-supplement-drawer-actions">
                      <Button onClick={closeSupplementDrawer}>取消</Button>
                      <Button
                        htmlType="submit"
                        loading={isSubmittingSupplement && activeSupplementSection === 'education'}
                        type="primary"
                      >
                        提交教育简历
                      </Button>
                    </div>
                  </Form>
                </div>
              )}
            </div>
          </Spin>
        ) : null}
      </Drawer>

      <UpstreamLoginModal
        description={upstreamLoginDescription}
        okText={upstreamLoginOkText}
        title="登录学工系统"
        {...upstreamLoginModalProps}
      />
    </div>
  );
}
