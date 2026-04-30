import {
  type CSSProperties,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Collapse,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popover,
  Segmented,
  Select,
  Skeleton,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useLoaderData } from 'react-router';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';
import { type StoredUpstreamSession, useUpstreamSession } from '@/entities/upstream-session';

import { lectureJournalReconciliationLabAccess } from './access';
import {
  type AcademicIntegratedTeachingLogPrefillPreview,
  type AcademicTeachingLogSaveResult,
  fetchLectureJournalDepartmentOptions,
  fetchTeacherDirectory,
  isExpiredUpstreamSessionError,
  type LectureJournalDepartmentOption,
  type LectureJournalExpectedOccurrence,
  type LectureJournalReconciliationItem,
  resolveUpstreamErrorMessage,
  type TeacherDirectoryEntry,
  type TeacherDirectoryResult,
} from './api';
import { isIntegratedCourseCategory, isPracticeCourseCategory } from './course-category';
import {
  buildJournalDrafts,
  DEFAULT_DISCIPLINE_SITUATION,
  DEFAULT_INTEGRATED_SHIFT,
  DEFAULT_INTEGRATED_SHIFT_NAME,
  DEFAULT_SECURITY_AND_MAINTAIN,
  EMPTY_JOURNAL_DRAFT,
  type JournalDraft,
  type JournalDraftMap,
  resolveShiftName,
  reuseJournalDraftMapReferences,
} from './journal-draft-policy';
import { lectureJournalReconciliationLabMeta } from './meta';
import { initialLectureJournalQueryState, lectureJournalQueryReducer } from './query-state';
import { runLectureJournalReconciliationQueryWorkflow } from './query-workflow';
import { resolveSaveValidationError, runLectureJournalSaveWorkflow } from './save-workflow';
import { isFutureTeachingDate } from './teaching-date';

import './page.css';

type LectureJournalReconciliationLabLoaderData = {
  defaultDepartmentId?: string | null;
  defaultStaffId?: string | null;
  upstreamAccount?: {
    accountId: number;
    displayName: string;
  } | null;
  viewerKind?: 'authenticated' | 'internal';
} | null;

type UpstreamLoginFormValues = {
  password: string;
  userId: string;
};

type PendingAction = 'directory' | 'query' | null;
type ResultViewScope = 'complete' | 'missing' | 'unmatched';
type CourseCategoryFilter = 'ALL' | '1' | '2' | '3';
type FutureCourseVisibility = 'hide' | 'show';
type ResultViewScopeOption = {
  count: number;
  label: string;
  value: ResultViewScope;
};

const DEFAULT_DEPARTMENT_ID = 'ORG0302';
const DAY_OF_WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const TOPIC_RECORD_OPTIONS = ['优', '良', '正常', '一般'];
const TOPIC_RECORD_VISUAL_DEFAULT = TOPIC_RECORD_OPTIONS[0];
const COURSE_CATEGORY_TAB_ORDER = ['1', '2', '3'];
const SAVED_CARD_COLLAPSE_DURATION_MS = 240;
const COURSE_CATEGORY_META = {
  '1': {
    accentClassName: 'lecture-journal-course-category-theory',
    enumKey: 'THEORY',
    label: '理论课',
  },
  '2': {
    accentClassName: 'lecture-journal-course-category-practice',
    enumKey: 'PRACTICE',
    label: '实训课',
  },
  '3': {
    accentClassName: 'lecture-journal-course-category-integrated',
    enumKey: 'INTEGRATED',
    label: '一体化',
  },
};

type DepartmentOption = {
  id: string;
  label: string;
};

type JournalEditableCardItem = {
  blockingIssue: string | null;
  canFill: boolean;
  completeAndSummary: string | null;
  courseCategory: string | null;
  courseContent: string | null;
  courseId: string | null;
  courseName: string | null;
  dayOfWeek: number | null;
  disciplineSituation: string | null;
  homework: string | null;
  expectedOccurrences: LectureJournalExpectedOccurrence[];
  journal: LectureJournalReconciliationItem['journal'];
  key: string;
  learningSessionContent: string | null;
  learningSessionNo: number | null;
  learningSessionTarget: string | null;
  learningTaskName: string | null;
  learningTaskNo: number | null;
  learningTaskText: string | null;
  lecturePlanDetailId: string | null;
  lecturePlanId: string | null;
  lessonHours: number | null;
  matchedLectureJournalDetailId: string | null;
  problemAndSolve: string | null;
  schoolYear: string | null;
  sectionId: string | null;
  sectionName: string | null;
  securityAndMaintain: string | null;
  semester: string | null;
  shift: string | null;
  shiftName: string | null;
  status: LectureJournalReconciliationItem['status'];
  teacherId: string | null;
  teacherName: string | null;
  teachingClassId: string | null;
  teachingClassName: string | null;
  teachingDate: string | null;
  teachingUnitAchievement: string | null;
  teachingUnitContent: string | null;
  teachingUnitName: string | null;
  teachingUnitNo: number | null;
  teachingUnitTarget: string | null;
  teachingUnitText: string | null;
  warnings: string[];
  weekNumber: number | null;
  practiceDemonstrationHours: number | null;
  practiceLectureHours: number | null;
  practicePracticeHours: number | null;
  practiceTeachingChapterContent: string | null;
  practiceTopicName: string | null;
};

type JournalDraftPatch = Partial<
  Pick<
    JournalDraft,
    | 'completeAndSummary'
    | 'courseContent'
    | 'demonstrationHours'
    | 'disciplineSituation'
    | 'homeworkAssignment'
    | 'lectureHours'
    | 'problemAndSolve'
    | 'practiceHours'
    | 'productionProjectTitle'
    | 'learningObjective'
    | 'securityAndMaintain'
    | 'shift'
    | 'shiftName'
    | 'submitStatusText'
    | 'topicRecord'
  >
>;

type FieldTipConfig = {
  fields: string[];
  note?: string;
  required?: boolean;
};
type SaveFeedback = {
  text: string;
  tone: 'error' | 'success';
};
type SaveFeedbackMap = Record<string, SaveFeedback | undefined>;

const reconciliationEditableItemCache = new WeakMap<
  LectureJournalReconciliationItem,
  JournalEditableCardItem
>();
const integratedPreviewEditableItemCache = new WeakMap<
  AcademicIntegratedTeachingLogPrefillPreview,
  JournalEditableCardItem
>();

function sortSemesters(records: AcademicSemesterRecord[]) {
  return [...records].sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1;
    }

    if (left.schoolYear !== right.schoolYear) {
      return right.schoolYear - left.schoolYear;
    }

    if (left.termNumber !== right.termNumber) {
      return right.termNumber - left.termNumber;
    }

    return right.id - left.id;
  });
}

function pickNextSemesterId(records: AcademicSemesterRecord[], currentSelection: number | null) {
  if (currentSelection !== null && records.some((record) => record.id === currentSelection)) {
    return currentSelection;
  }

  return records.find((record) => record.isCurrent)?.id ?? records[0]?.id ?? null;
}

function normalizeOptionalString(value: string) {
  const normalizedValue = value.trim();

  return normalizedValue ? normalizedValue : '';
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '未返回';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatTeachingDate(value: string | null | undefined) {
  if (!value) {
    return '待识别';
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

function resolveCampusSubmitStatusDotTone(statusText: string) {
  const normalizedStatus = statusText.trim();

  if (normalizedStatus === '审核中') {
    return 'processing';
  }

  if (normalizedStatus === '待提交') {
    return 'warning';
  }

  if (normalizedStatus === '已审核' || normalizedStatus === '审核通过') {
    return 'success';
  }

  return normalizedStatus ? 'default' : 'default';
}

function resolveCampusSubmitStatusTagLabel(statusText: string) {
  const normalizedStatus = statusText.trim();

  if (normalizedStatus === '审核中') {
    return '校园网审核中';
  }

  if (normalizedStatus === '待提交') {
    return '校园网待提交';
  }

  if (normalizedStatus === '已审核' || normalizedStatus === '审核通过') {
    return normalizedStatus === '审核通过' ? '校园网审核通过' : '校园网已审核';
  }

  if (!normalizedStatus) {
    return '校园网未提交';
  }

  return `校园网${normalizedStatus}`;
}

function resolveStatusColor(status: LectureJournalReconciliationItem['status']) {
  if (status === 'FILLED') {
    return 'success';
  }

  if (status === 'MISSING') {
    return 'warning';
  }

  return 'default';
}

function resolveStatusLabel(status: LectureJournalReconciliationItem['status']) {
  if (status === 'FILLED') {
    return '校园网已填写';
  }

  if (status === 'MISSING') {
    return '校园网未填';
  }

  return '无法对账';
}

function resolveStatusTone(status: JournalEditableCardItem['status']) {
  if (status === 'FILLED') {
    return 'success';
  }

  if (status === 'MISSING') {
    return 'warning';
  }

  return 'default';
}

function buildTeacherOptionLabel(teacher: TeacherDirectoryEntry) {
  const normalizedCode = teacher.code.trim();

  return normalizedCode ? `${teacher.name} (${normalizedCode})` : teacher.name;
}

function buildDepartmentOptionLabel(department: LectureJournalDepartmentOption) {
  return `${department.departmentName}${department.shortName ? ` (${department.shortName})` : ''}`;
}

function buildItemKey(item: {
  lecturePlanDetailId: string | null;
  lecturePlanId: string | null;
  matchKey?: string | null;
  reason?: string | null;
}) {
  return [
    item.lecturePlanDetailId || 'detail',
    item.lecturePlanId || 'plan',
    item.matchKey || 'match',
    item.reason || 'reason',
  ].join('-');
}

function renderFieldLabel(label: string, config: FieldTipConfig) {
  return (
    <span className="lecture-journal-field-label">
      {config.required === false ? null : (
        <span aria-hidden="true" className="lecture-journal-field-required">
          *
        </span>
      )}
      <span className="lecture-journal-field-label-text">{label}</span>
    </span>
  );
}

async function requestTeacherDirectoryWithSession(session: StoredUpstreamSession) {
  return fetchTeacherDirectory({
    sessionToken: session.upstreamSessionToken,
  });
}

function resolveSectionLabel(sectionName: string | null, sectionId: string | null) {
  return sectionName || sectionId || '节次待识别';
}

function resolveWeekLabel(weekNumber: number | null) {
  return weekNumber ? `第 ${weekNumber} 周` : '周次待识别';
}

function resolveDayOfWeekLabel(dayOfWeek: number | null) {
  return dayOfWeek ? DAY_OF_WEEK_LABELS[dayOfWeek - 1] || `周${dayOfWeek}` : '星期待识别';
}

function resolveLessonHoursLabel(lessonHours: number | null) {
  return lessonHours ? String(lessonHours) : '待识别';
}

function resolveShiftDisplayLabel(shift: string | null) {
  const normalizedShift = shift?.trim() || '';
  const shiftName = resolveShiftName(normalizedShift);

  if (shiftName) {
    return shiftName;
  }

  return normalizedShift ? `未知班次（${normalizedShift}）` : '班次待识别';
}

function resolveOccurrenceSectionLabel(occurrence: LectureJournalExpectedOccurrence) {
  if (occurrence.periodStart === occurrence.periodEnd) {
    return `第 ${occurrence.periodStart} 节`;
  }

  return `第 ${occurrence.periodStart}-${occurrence.periodEnd} 节`;
}

function hasCrossDayExpectedOccurrences(expectedOccurrences: LectureJournalExpectedOccurrence[]) {
  return new Set(expectedOccurrences.map((occurrence) => occurrence.date)).size > 1;
}

function hasCrossWeekExpectedOccurrences(expectedOccurrences: LectureJournalExpectedOccurrence[]) {
  return new Set(expectedOccurrences.map((occurrence) => occurrence.weekNumber)).size > 1;
}

function resolveTopicRecordControlValue(topicRecord: string) {
  const normalizedValue = topicRecord.trim();

  if (!normalizedValue) {
    return TOPIC_RECORD_VISUAL_DEFAULT;
  }

  return TOPIC_RECORD_OPTIONS.includes(normalizedValue) ? normalizedValue : undefined;
}

function resolveCourseCategoryMeta(courseCategory: string | null) {
  if (!courseCategory) {
    return null;
  }

  return COURSE_CATEGORY_META[courseCategory as keyof typeof COURSE_CATEGORY_META] ?? null;
}

function buildCourseCategoryFilterOptions(items: JournalEditableCardItem[]) {
  const nonEmptyOptions = COURSE_CATEGORY_TAB_ORDER.map((courseCategory) => {
    const courseCategoryMeta = resolveCourseCategoryMeta(courseCategory);

    return {
      count: items.filter((item) => item.courseCategory === courseCategory).length,
      key: courseCategory as CourseCategoryFilter,
      label: courseCategoryMeta?.label || courseCategory,
    };
  }).filter((option) => option.count > 0);

  if (nonEmptyOptions.length <= 1) {
    return nonEmptyOptions;
  }

  return [
    {
      count: items.length,
      key: 'ALL' as const,
      label: '所有类型',
    },
    ...nonEmptyOptions,
  ];
}

function resolveCourseCategoryFilter(
  options: Array<{ key: CourseCategoryFilter }>,
  activeCourseCategory: CourseCategoryFilter,
) {
  if (options.length <= 1) {
    return 'ALL';
  }

  if (options.some((option) => option.key === activeCourseCategory)) {
    return activeCourseCategory;
  }

  return 'ALL';
}

function filterItemsByCourseCategory(
  items: JournalEditableCardItem[],
  courseCategory: CourseCategoryFilter,
) {
  if (courseCategory === 'ALL') {
    return items;
  }

  return items.filter((item) => item.courseCategory === courseCategory);
}

function resolveResultViewScopeLabel(scope: ResultViewScope) {
  if (scope === 'missing') {
    return '待补日志';
  }

  if (scope === 'unmatched') {
    return '需核对';
  }

  return '全部';
}

function resolveResultViewScopeTitle(scope: ResultViewScope) {
  if (scope === 'missing') {
    return '待补日志的课次';
  }

  if (scope === 'unmatched') {
    return '需要人工核对的课次';
  }

  return '全部课次';
}

function buildResultViewScopeOptions(counts: {
  complete: number;
  missing: number;
  unmatched: number;
}): ResultViewScopeOption[] {
  return [
    {
      count: counts.complete,
      label: resolveResultViewScopeLabel('complete'),
      value: 'complete' as const,
    },
    {
      count: counts.missing,
      label: resolveResultViewScopeLabel('missing'),
      value: 'missing' as const,
    },
    {
      count: counts.unmatched,
      label: resolveResultViewScopeLabel('unmatched'),
      value: 'unmatched' as const,
    },
  ].filter((option) => option.count > 0);
}

function resolveResultViewScope(options: ResultViewScopeOption[], activeScope: ResultViewScope) {
  if (options.some((option) => option.value === activeScope)) {
    return activeScope;
  }

  if (options.some((option) => option.value === 'missing')) {
    return 'missing';
  }

  return 'complete';
}

function pickJournalItemsByResultViewScope(params: {
  editableItems: JournalEditableCardItem[];
  presentedMissingEditableItems: JournalEditableCardItem[];
  resultViewScope: ResultViewScope;
  unmatchedEditableItems: JournalEditableCardItem[];
}) {
  if (params.resultViewScope === 'missing') {
    return params.presentedMissingEditableItems;
  }

  if (params.resultViewScope === 'unmatched') {
    return params.unmatchedEditableItems;
  }

  return params.editableItems;
}

function resolveOptionalCountLabel(value: number | null | undefined, fallback: string) {
  return value === null || value === undefined ? fallback : String(value);
}

function normalizeOptionalNumber(value: number | null | undefined) {
  return value === null || value === undefined ? null : value;
}

function resolveIntegratedLearningSessionText(item: JournalEditableCardItem) {
  return [item.learningSessionNo, item.learningSessionContent].filter(Boolean).join(' ');
}

function resolveIntegratedLearningTaskText(item: JournalEditableCardItem) {
  return (
    item.learningTaskText || [item.learningTaskNo, item.learningTaskName].filter(Boolean).join(' ')
  );
}

function resolveIntegratedTeachingUnitText(item: JournalEditableCardItem) {
  return (
    item.teachingUnitText || [item.teachingUnitNo, item.teachingUnitName].filter(Boolean).join(' ')
  );
}

function buildPracticePlanFields(item: {
  courseCategory: string | null;
  courseContent: string | null;
  demonstrationHours?: number | null;
  lectureHours?: number | null;
  practiceHours?: number | null;
  teachingChapterContent?: string | null;
  topicName?: string | null;
}) {
  if (!isPracticeCourseCategory(item.courseCategory)) {
    return {
      practiceDemonstrationHours: null,
      practiceLectureHours: null,
      practicePracticeHours: null,
      practiceTeachingChapterContent: null,
      practiceTopicName: null,
    };
  }

  return {
    practiceDemonstrationHours: item.demonstrationHours ?? null,
    practiceLectureHours: item.lectureHours ?? null,
    practicePracticeHours: item.practiceHours ?? null,
    practiceTeachingChapterContent: item.teachingChapterContent ?? null,
    practiceTopicName: item.topicName ?? null,
  };
}

function buildEditableCardItemFromReconciliation(
  item: LectureJournalReconciliationItem,
): JournalEditableCardItem {
  const cachedItem = reconciliationEditableItemCache.get(item);

  if (cachedItem) {
    return cachedItem;
  }

  const practicePlanFields = buildPracticePlanFields(item);

  const editableItem = {
    blockingIssue: item.blockingIssue,
    canFill: item.canFill,
    completeAndSummary: null,
    courseCategory: item.courseCategory,
    courseContent: item.courseContent,
    courseId: item.courseId,
    courseName: item.courseName,
    dayOfWeek: item.dayOfWeek,
    disciplineSituation: null,
    expectedOccurrences: item.expectedOccurrences,
    homework: item.homework,
    journal: item.journal,
    key: buildItemKey(item),
    learningSessionContent: null,
    learningSessionNo: null,
    learningSessionTarget: null,
    learningTaskName: null,
    learningTaskNo: null,
    learningTaskText: null,
    lecturePlanDetailId: item.lecturePlanDetailId,
    lecturePlanId: item.lecturePlanId,
    lessonHours: item.lessonHours,
    matchedLectureJournalDetailId: item.journal?.lectureJournalDetailId ?? null,
    problemAndSolve: null,
    schoolYear: item.schoolYear,
    sectionId: item.sectionId,
    sectionName: item.sectionName,
    securityAndMaintain: null,
    semester: item.semester,
    shift: null,
    shiftName: null,
    status: item.status,
    teacherId: item.teacherId,
    teacherName: item.teacherName,
    teachingClassId: item.teachingClassId,
    teachingClassName: item.teachingClassName,
    teachingDate: item.teachingDate,
    teachingUnitAchievement: null,
    teachingUnitContent: null,
    teachingUnitName: null,
    teachingUnitNo: null,
    teachingUnitTarget: null,
    teachingUnitText: null,
    warnings: item.warnings,
    weekNumber: item.weekNumber,
    ...practicePlanFields,
  };

  reconciliationEditableItemCache.set(item, editableItem);

  return editableItem;
}

function buildEditableCardItemFromIntegratedPreview(
  item: AcademicIntegratedTeachingLogPrefillPreview,
): JournalEditableCardItem {
  const cachedItem = integratedPreviewEditableItemCache.get(item);

  if (cachedItem) {
    return cachedItem;
  }

  const resolvedShift = item.shift || DEFAULT_INTEGRATED_SHIFT;

  const editableItem = {
    blockingIssue: item.blockingIssue,
    canFill: item.canFill,
    completeAndSummary: item.completeAndSummary,
    courseCategory: '3',
    courseContent: null,
    courseId: null,
    courseName: item.courseName,
    dayOfWeek: item.dayOfWeek,
    disciplineSituation: item.disciplineSituation,
    expectedOccurrences: item.expectedOccurrences,
    homework: null,
    journal: null,
    key: buildItemKey({
      lecturePlanDetailId: item.lecturePlanDetailId,
      lecturePlanId: item.lecturePlanId,
      matchKey: `integrated-preview-${item.status}`,
      reason: item.blockingIssue,
    }),
    learningSessionContent: item.learningSessionContent,
    learningSessionNo: item.learningSessionNo,
    learningSessionTarget: item.learningSessionTarget,
    learningTaskName: item.learningTaskName,
    learningTaskNo: item.learningTaskNo,
    learningTaskText: item.learningTaskText,
    lecturePlanDetailId: item.lecturePlanDetailId,
    lecturePlanId: item.lecturePlanId,
    lessonHours: item.lessonHours,
    matchedLectureJournalDetailId: item.matchedLectureJournalDetailId,
    practiceDemonstrationHours: null,
    practiceLectureHours: null,
    practicePracticeHours: null,
    practiceTeachingChapterContent: null,
    practiceTopicName: null,
    problemAndSolve: item.problemAndSolve,
    schoolYear: null,
    sectionId: null,
    sectionName: null,
    securityAndMaintain: item.securityAndMaintain,
    semester: null,
    shift: item.shift,
    shiftName: resolveShiftName(resolvedShift) || DEFAULT_INTEGRATED_SHIFT_NAME,
    status: item.status,
    teacherId: null,
    teacherName: null,
    teachingClassId: item.teachingClassId,
    teachingClassName: item.teachingClassName,
    teachingDate: item.teachingDate,
    teachingUnitAchievement: item.teachingUnitAchievement,
    teachingUnitContent: item.teachingUnitContent,
    teachingUnitName: item.teachingUnitName,
    teachingUnitNo: item.teachingUnitNo,
    teachingUnitTarget: item.teachingUnitTarget,
    teachingUnitText: item.teachingUnitText,
    warnings: item.warnings,
    weekNumber: item.weekNumber,
  };

  integratedPreviewEditableItemCache.set(item, editableItem);

  return editableItem;
}

function renderIntegratedExpectedOccurrences(
  expectedOccurrences: LectureJournalExpectedOccurrence[],
) {
  if (expectedOccurrences.length === 0) {
    return (
      <span className="lecture-journal-integrated-empty">
        <Typography.Text type="secondary">暂无预计覆盖课次片段</Typography.Text>
      </span>
    );
  }

  return (
    <div className="lecture-journal-integrated-occurrences">
      <div className="lecture-journal-integrated-occurrence-tags">
        {hasCrossDayExpectedOccurrences(expectedOccurrences) ? (
          <Tag color="warning">跨天</Tag>
        ) : null}
        {hasCrossWeekExpectedOccurrences(expectedOccurrences) ? (
          <Tag color="warning">跨周</Tag>
        ) : null}
      </div>
      <div className="lecture-journal-integrated-occurrence-list">
        {expectedOccurrences.map((occurrence) => (
          <div
            className="lecture-journal-integrated-occurrence"
            key={[
              occurrence.date,
              occurrence.weekNumber,
              occurrence.dayOfWeek,
              occurrence.periodStart,
              occurrence.periodEnd,
            ].join('-')}
          >
            <span>{formatTeachingDate(occurrence.date)}</span>
            <span>{resolveWeekLabel(occurrence.weekNumber)}</span>
            <span>{resolveDayOfWeekLabel(occurrence.dayOfWeek)}</span>
            <span>{resolveOccurrenceSectionLabel(occurrence)}</span>
            <span>{occurrence.lessonHours} 课时</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderIntegratedCoverage(expectedOccurrences: LectureJournalExpectedOccurrence[]) {
  const count = expectedOccurrences.length;

  return (
    <div className="lecture-journal-integrated-coverage">
      <Collapse
        defaultActiveKey={['expected-occurrences']}
        ghost
        items={[
          {
            children: renderIntegratedExpectedOccurrences(expectedOccurrences),
            key: 'expected-occurrences',
            label: (
              <span className="lecture-journal-integrated-coverage-title">
                <Typography.Text strong>预计覆盖课次片段</Typography.Text>
                <Typography.Text type="secondary">{count} 个片段</Typography.Text>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

type JournalDraftCardProps = {
  initialDraft: JournalDraft;
  isCollapsing?: boolean;
  item: JournalEditableCardItem;
  isSaving: boolean;
  onSave: (item: JournalEditableCardItem, draft: JournalDraft) => void;
  onUpdateDraft: (key: string, patch: JournalDraftPatch) => void;
  draft: JournalDraft;
  saveFeedback?: SaveFeedback;
};

const JournalDraftCard = memo(function JournalDraftCard({
  initialDraft,
  isCollapsing = false,
  isSaving,
  item,
  onSave,
  onUpdateDraft,
  draft,
  saveFeedback,
}: JournalDraftCardProps) {
  const statusTone = resolveStatusTone(item.status);
  const sectionLabel = resolveSectionLabel(item.sectionName, item.sectionId);
  const weekLabel = resolveWeekLabel(item.weekNumber);
  const dayOfWeekLabel = resolveDayOfWeekLabel(item.dayOfWeek);
  const teachingDateLabel = formatTeachingDate(item.teachingDate);
  const lessonHoursLabel = resolveLessonHoursLabel(item.lessonHours);
  const topicRecordControlValue = resolveTopicRecordControlValue(draft.topicRecord);
  const courseCategoryMeta = resolveCourseCategoryMeta(item.courseCategory);
  const courseCategoryAccentClassName = courseCategoryMeta?.accentClassName || '';
  const isPracticeCard = isPracticeCourseCategory(item.courseCategory);
  const isIntegratedCard = isIntegratedCourseCategory(item.courseCategory);
  const isFilled = item.status === 'FILLED';
  const isFutureCourse = isFutureTeachingDate(item.teachingDate);
  const isIntegratedSaveCandidate =
    isIntegratedCard &&
    item.status === 'MISSING' &&
    item.canFill &&
    !item.blockingIssue &&
    Boolean(normalizeOptionalString(item.lecturePlanDetailId || ''));
  const isIntegratedEditable = !isFutureCourse && isIntegratedSaveCandidate;
  const hasCompleteAndSummaryEdited =
    normalizeOptionalString(draft.completeAndSummary) !==
    normalizeOptionalString(initialDraft.completeAndSummary);
  const hasCourseContentEdited =
    normalizeOptionalString(draft.courseContent) !==
    normalizeOptionalString(initialDraft.courseContent);
  const hasDemonstrationHoursEdited =
    normalizeOptionalNumber(draft.demonstrationHours) !==
    normalizeOptionalNumber(initialDraft.demonstrationHours);
  const hasDisciplineSituationEdited =
    normalizeOptionalString(draft.disciplineSituation) !==
    normalizeOptionalString(initialDraft.disciplineSituation);
  const hasHomeworkEdited =
    normalizeOptionalString(draft.homeworkAssignment) !==
    normalizeOptionalString(initialDraft.homeworkAssignment);
  const hasLectureHoursEdited =
    normalizeOptionalNumber(draft.lectureHours) !==
    normalizeOptionalNumber(initialDraft.lectureHours);
  const hasPracticeHoursEdited =
    normalizeOptionalNumber(draft.practiceHours) !==
    normalizeOptionalNumber(initialDraft.practiceHours);
  const hasProductionProjectTitleEdited =
    normalizeOptionalString(draft.productionProjectTitle) !==
    normalizeOptionalString(initialDraft.productionProjectTitle);
  const hasLearningObjectiveEdited =
    normalizeOptionalString(draft.learningObjective) !==
    normalizeOptionalString(initialDraft.learningObjective);
  const hasProblemAndSolveEdited =
    normalizeOptionalString(draft.problemAndSolve) !==
    normalizeOptionalString(initialDraft.problemAndSolve);
  const hasSecurityAndMaintainEdited =
    normalizeOptionalString(draft.securityAndMaintain) !==
    normalizeOptionalString(initialDraft.securityAndMaintain);
  const defaultCourseContentReference = isPracticeCard
    ? item.practiceTopicName?.trim() || ''
    : item.courseContent?.trim() || '';
  const hasCourseContentPlanMismatch =
    normalizeOptionalString(draft.courseContent) !== defaultCourseContentReference;
  const hasIntegratedPlanMismatch =
    hasCompleteAndSummaryEdited ||
    hasDisciplineSituationEdited ||
    hasProblemAndSolveEdited ||
    hasSecurityAndMaintainEdited;
  const hasPlanMismatch =
    hasCourseContentPlanMismatch ||
    normalizeOptionalString(draft.homeworkAssignment) !== (item.homework?.trim() || '');
  const hasPracticePlanMismatch =
    normalizeOptionalString(draft.productionProjectTitle) !==
    (item.practiceTeachingChapterContent?.trim() || '');
  const hasPracticeExtraFieldMismatch =
    normalizeOptionalString(draft.disciplineSituation) !== DEFAULT_DISCIPLINE_SITUATION ||
    normalizeOptionalString(draft.securityAndMaintain) !== DEFAULT_SECURITY_AND_MAINTAIN;
  const hasPracticeHoursPlanMismatch =
    normalizeOptionalNumber(draft.lectureHours) !==
      normalizeOptionalNumber(item.practiceLectureHours) ||
    normalizeOptionalNumber(draft.practiceHours) !==
      normalizeOptionalNumber(item.practicePracticeHours) ||
    normalizeOptionalNumber(draft.demonstrationHours) !==
      normalizeOptionalNumber(item.practiceDemonstrationHours);
  const practiceHoursTotal =
    (draft.lectureHours || 0) + (draft.practiceHours || 0) + (draft.demonstrationHours || 0);
  const hasPracticeHoursTotalMismatch =
    isPracticeCard && item.lessonHours !== null && practiceHoursTotal !== item.lessonHours;
  const saveValidationError = resolveSaveValidationError(item, draft);
  const showRestoreButton =
    !isFutureCourse &&
    (!isFilled || isIntegratedEditable) &&
    (isIntegratedCard
      ? hasIntegratedPlanMismatch
      : isPracticeCard
        ? hasPlanMismatch ||
          hasPracticePlanMismatch ||
          hasPracticeHoursPlanMismatch ||
          hasPracticeExtraFieldMismatch
        : hasPlanMismatch) &&
    (hasCourseContentEdited ||
      hasCompleteAndSummaryEdited ||
      hasDemonstrationHoursEdited ||
      hasDisciplineSituationEdited ||
      hasHomeworkEdited ||
      hasLectureHoursEdited ||
      hasPracticeHoursEdited ||
      hasLearningObjectiveEdited ||
      hasProblemAndSolveEdited ||
      hasProductionProjectTitleEdited ||
      hasSecurityAndMaintainEdited);
  const isSaveDisabled = Boolean(saveValidationError) || isSaving;
  const saveButtonTooltip = saveValidationError
    ? `不可保存：${saveValidationError}`
    : item.warnings.length > 0
      ? `可保存；提示：${item.warnings.join('；')}`
      : '保存至校园网。';
  const shouldRenderSaveAction = isIntegratedCard
    ? !isFutureCourse && isIntegratedSaveCandidate
    : !isFutureCourse && item.status === 'MISSING';

  return (
    <article
      className={[
        'lecture-journal-record',
        `lecture-journal-record-${statusTone}`,
        isCollapsing ? 'lecture-journal-record-collapsing' : '',
        isFutureCourse ? 'lecture-journal-record-future' : '',
        shouldRenderSaveAction ? 'lecture-journal-record-has-save-action' : '',
        isIntegratedCard ? 'lecture-journal-record-integrated' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {shouldRenderSaveAction ? (
        <Popover
          content={
            saveFeedback ? (
              <div className="lecture-journal-save-popover-content">
                <Typography.Text type={saveFeedback.tone === 'error' ? 'danger' : 'success'}>
                  {saveFeedback.text}
                </Typography.Text>
              </div>
            ) : null
          }
          open={Boolean(saveFeedback)}
          placement="bottomRight"
          trigger={[]}
        >
          <span className="lecture-journal-record-save-anchor">
            <Tooltip placement="top" title={saveButtonTooltip}>
              <span className="lecture-journal-save-action">
                <Button
                  disabled={isSaveDisabled}
                  loading={isSaving}
                  onClick={() => {
                    onSave(item, draft);
                  }}
                >
                  保存
                </Button>
              </span>
            </Tooltip>
          </span>
        </Popover>
      ) : null}

      <div className="lecture-journal-record-header">
        <div className="lecture-journal-record-overview">
          <div className="lecture-journal-record-overview-block lecture-journal-record-overview-block-left">
            <Tooltip placement="top" title={resolveStatusLabel(item.status)}>
              <span
                aria-label={resolveStatusLabel(item.status)}
                className={`lecture-journal-record-status-dot lecture-journal-record-status-dot-${resolveStatusColor(item.status)}`}
              />
            </Tooltip>
            {isFilled ? (
              <Tooltip
                placement="top"
                title={resolveCampusSubmitStatusTagLabel(draft.submitStatusText)}
              >
                <span
                  aria-label={resolveCampusSubmitStatusTagLabel(draft.submitStatusText)}
                  className={[
                    'lecture-journal-record-status-dot',
                    'lecture-journal-record-status-dot-campus',
                    `lecture-journal-record-status-dot-campus-${resolveCampusSubmitStatusDotTone(
                      draft.submitStatusText,
                    )}`,
                  ].join(' ')}
                />
              </Tooltip>
            ) : null}
            <span className="lecture-journal-record-overview-text">{weekLabel}</span>
            {!isIntegratedCard ? (
              <span className="lecture-journal-record-overview-text">{dayOfWeekLabel}</span>
            ) : null}
            <span className="lecture-journal-record-overview-section-wrap">
              {!isIntegratedCard && !isPracticeCard ? (
                <span className="lecture-journal-record-overview-text">{sectionLabel}</span>
              ) : null}
              {courseCategoryMeta ? (
                <span
                  className={['lecture-journal-course-category-tag', courseCategoryAccentClassName]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <Tag bordered={false}>{courseCategoryMeta.label}</Tag>
                </span>
              ) : null}
            </span>
          </div>

          <div className="lecture-journal-record-overview-block lecture-journal-record-overview-block-center">
            <span
              className={['lecture-journal-record-title-block', courseCategoryAccentClassName]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="lecture-journal-record-title-line lecture-journal-record-title-line-class">
                {item.teachingClassName || '教学班待识别'}
              </span>
              <span className="lecture-journal-record-title-line lecture-journal-record-title-line-course">
                {item.courseName || '未命名课程'}
              </span>
            </span>
          </div>

          <div className="lecture-journal-record-overview-block lecture-journal-record-overview-block-right">
            {!isIntegratedCard ? (
              <span className="lecture-journal-record-meta-item">
                <span className="lecture-journal-record-meta-label">上课日期：</span>
                <span className="lecture-journal-record-meta-value">{teachingDateLabel}</span>
              </span>
            ) : null}
            <span className="lecture-journal-record-meta-item">
              <span className="lecture-journal-record-meta-label">
                {isIntegratedCard ? '总课时数：' : '课时数：'}
              </span>
              <span className="lecture-journal-record-meta-value lecture-journal-record-meta-value-accent">
                {lessonHoursLabel}
              </span>
            </span>
          </div>
        </div>
      </div>

      {isIntegratedCard &&
      (item.blockingIssue || item.warnings.length > 0 || item.expectedOccurrences.length > 0) ? (
        <div className="lecture-journal-integrated-state">
          {item.blockingIssue ? (
            <Alert message={`阻塞原因：${item.blockingIssue}`} showIcon type="error" />
          ) : null}
          {item.warnings.length > 0 ? (
            <Alert
              message={
                <span className="lecture-journal-integrated-warning-text">
                  {item.warnings.map((warning) => (
                    <Tag color="warning" key={warning}>
                      {warning}
                    </Tag>
                  ))}
                </span>
              }
              showIcon
              type="warning"
            />
          ) : null}
          {renderIntegratedCoverage(item.expectedOccurrences)}
        </div>
      ) : null}

      {isFutureCourse && !isFilled ? (
        <div className="lecture-journal-integrated-state">
          <Alert message="课程尚未开始，暂不开放填写。" showIcon type="info" />
        </div>
      ) : null}

      {isFutureCourse && !isFilled ? null : (
        <div className="lecture-journal-editor">
          <div
            className={[
              'lecture-journal-editor-grid',
              isPracticeCard ? 'lecture-journal-editor-grid-practice' : '',
              isIntegratedCard ? 'lecture-journal-editor-grid-integrated' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {isPracticeCard ? (
              <>
                <label className="lecture-journal-card-field lecture-journal-card-field-content">
                  {renderFieldLabel('课程内容', {
                    fields: ['course_content', 'topicName', 'TOPIC_NAME'],
                    note: '计划侧 topicName 对应上游 TOPIC_NAME，并映射到日志侧 course_content',
                  })}
                  {isFilled ? (
                    <span className="lecture-journal-readonly-input">
                      <Input
                        placeholder="未填写"
                        readOnly
                        size="large"
                        value={draft.courseContent}
                      />
                    </span>
                  ) : (
                    <Input
                      placeholder="请输入课程内容"
                      size="large"
                      value={draft.courseContent}
                      onChange={(event) => {
                        onUpdateDraft(item.key, { courseContent: event.target.value });
                      }}
                    />
                  )}
                </label>

                <label className="lecture-journal-card-field lecture-journal-card-field-production-title">
                  {renderFieldLabel('生产实习课题名称及加工内容', {
                    fields: [
                      'production_project_title',
                      'teachingChapterContent',
                      'TEACHING_CHAPTER_CONTENT',
                    ],
                    note: '计划侧 teachingChapterContent 对应上游 TEACHING_CHAPTER_CONTENT，并映射到日志侧 production_project_title',
                    required: false,
                  })}
                  {isFilled ? (
                    <span className="lecture-journal-readonly-input">
                      <Input
                        placeholder="未填写"
                        readOnly
                        size="large"
                        value={draft.productionProjectTitle}
                      />
                    </span>
                  ) : (
                    <Input
                      placeholder="请输入生产实习课题名称及加工内容"
                      size="large"
                      value={draft.productionProjectTitle}
                      onChange={(event) => {
                        onUpdateDraft(item.key, {
                          productionProjectTitle: event.target.value,
                        });
                      }}
                    />
                  )}
                </label>

                <label className="lecture-journal-card-field lecture-journal-card-field-homework lecture-journal-card-field-practice-homework">
                  {renderFieldLabel('作业布置情况', {
                    fields: ['homework_assignment', 'HOMEWORK', 'homework'],
                    note: '日志保存字段名为 homework_assignment；计划侧 HOMEWORK 空值按空字符串处理',
                  })}
                  {isFilled ? (
                    <span className="lecture-journal-readonly-input">
                      <Input
                        placeholder="未填写"
                        readOnly
                        size="large"
                        value={draft.homeworkAssignment}
                      />
                    </span>
                  ) : (
                    <Input
                      placeholder="请输入作业布置情况"
                      size="large"
                      value={draft.homeworkAssignment}
                      onChange={(event) => {
                        onUpdateDraft(item.key, { homeworkAssignment: event.target.value });
                      }}
                    />
                  )}
                </label>

                <div className="lecture-journal-practice-secondary-row">
                  <div className="lecture-journal-practice-notes-inline">
                    <label className="lecture-journal-card-field lecture-journal-card-field-practice-note">
                      {renderFieldLabel('遵章守纪情况', {
                        fields: ['disciplineSituation', 'discipline_situation'],
                        note: '该字段属于日志侧补充信息，不来自计划侧',
                        required: false,
                      })}
                      {isFilled ? (
                        <span className="lecture-journal-readonly-input">
                          <Input
                            placeholder="未填写"
                            readOnly
                            size="large"
                            value={draft.disciplineSituation}
                          />
                        </span>
                      ) : (
                        <Input
                          placeholder="请输入遵章守纪情况"
                          size="large"
                          value={draft.disciplineSituation}
                          onChange={(event) => {
                            onUpdateDraft(item.key, {
                              disciplineSituation: event.target.value,
                            });
                          }}
                        />
                      )}
                    </label>

                    <label className="lecture-journal-card-field lecture-journal-card-field-practice-note">
                      {renderFieldLabel('文明安全及设备保养记载', {
                        fields: ['securityAndMaintain', 'security_and_maintain'],
                        note: '该字段属于日志侧补充信息，不来自计划侧',
                        required: false,
                      })}
                      {isFilled ? (
                        <span className="lecture-journal-readonly-input">
                          <Input
                            placeholder="未填写"
                            readOnly
                            size="large"
                            value={draft.securityAndMaintain}
                          />
                        </span>
                      ) : (
                        <Input
                          placeholder="请输入文明安全及设备保养记载"
                          size="large"
                          value={draft.securityAndMaintain}
                          onChange={(event) => {
                            onUpdateDraft(item.key, {
                              securityAndMaintain: event.target.value,
                            });
                          }}
                        />
                      )}
                    </label>
                  </div>

                  <div className="lecture-journal-practice-hours-inline">
                    <label className="lecture-journal-card-field lecture-journal-card-field-practice-hour">
                      {renderFieldLabel('讲课时数', {
                        fields: ['lecture_lessons', 'lectureHours', 'LECTURE_HOURS'],
                        note: '计划侧 lectureHours 对应上游 LECTURE_HOURS',
                        required: false,
                      })}
                      {isFilled ? (
                        <span className="lecture-journal-readonly-input">
                          <Input
                            placeholder="未填写"
                            readOnly
                            size="large"
                            value={resolveOptionalCountLabel(draft.lectureHours, '未填写')}
                          />
                        </span>
                      ) : (
                        <InputNumber
                          min={0}
                          placeholder="讲课时数"
                          precision={0}
                          size="large"
                          step={1}
                          value={draft.lectureHours ?? undefined}
                          onChange={(value) => {
                            onUpdateDraft(item.key, {
                              lectureHours: typeof value === 'number' ? value : null,
                            });
                          }}
                        />
                      )}
                    </label>

                    <label className="lecture-journal-card-field lecture-journal-card-field-practice-hour">
                      {renderFieldLabel('实作时数', {
                        fields: ['training_lessons', 'practiceHours', 'PRACTICE_HOURS'],
                        note: '计划侧 practiceHours 对应上游 PRACTICE_HOURS',
                        required: false,
                      })}
                      {isFilled ? (
                        <span className="lecture-journal-readonly-input">
                          <Input
                            placeholder="未填写"
                            readOnly
                            size="large"
                            value={resolveOptionalCountLabel(draft.practiceHours, '未填写')}
                          />
                        </span>
                      ) : (
                        <InputNumber
                          min={0}
                          placeholder="实作时数"
                          precision={0}
                          size="large"
                          step={1}
                          value={draft.practiceHours ?? undefined}
                          onChange={(value) => {
                            onUpdateDraft(item.key, {
                              practiceHours: typeof value === 'number' ? value : null,
                            });
                          }}
                        />
                      )}
                    </label>

                    <label className="lecture-journal-card-field lecture-journal-card-field-practice-hour">
                      {renderFieldLabel('示范时数', {
                        fields: ['example_lessons', 'demonstrationHours', 'DEMONSTRATION_HOURS'],
                        note: '计划侧 demonstrationHours 对应上游 DEMONSTRATION_HOURS',
                        required: false,
                      })}
                      {isFilled ? (
                        <span className="lecture-journal-readonly-input">
                          <Input
                            placeholder="未填写"
                            readOnly
                            size="large"
                            value={resolveOptionalCountLabel(draft.demonstrationHours, '未填写')}
                          />
                        </span>
                      ) : (
                        <InputNumber
                          min={0}
                          placeholder="示范时数"
                          precision={0}
                          size="large"
                          step={1}
                          value={draft.demonstrationHours ?? undefined}
                          onChange={(value) => {
                            onUpdateDraft(item.key, {
                              demonstrationHours: typeof value === 'number' ? value : null,
                            });
                          }}
                        />
                      )}
                    </label>
                  </div>
                </div>

                {hasPracticeHoursTotalMismatch ? (
                  <div className="lecture-journal-practice-hours-warning">
                    <Typography.Text type="warning">
                      讲课时数、实作时数、示范时数之和为 {practiceHoursTotal}，与标题中的课时数{' '}
                      {lessonHoursLabel} 不一致。
                    </Typography.Text>
                  </div>
                ) : null}
              </>
            ) : isIntegratedCard ? (
              <>
                <label className="lecture-journal-card-field lecture-journal-integrated-field-shift">
                  {renderFieldLabel('班次', {
                    fields: ['shift'],
                    note: '前端按 shift 映射展示：1=早班、2=中班、3=常日班',
                    required: false,
                  })}
                  <span className="lecture-journal-readonly-input">
                    <Input readOnly size="large" value={resolveShiftDisplayLabel(draft.shift)} />
                  </span>
                </label>

                <label className="lecture-journal-card-field lecture-journal-integrated-field-task">
                  {renderFieldLabel('教学任务序号及名称', {
                    fields: ['learningTaskText', 'learningTaskNo', 'learningTaskName'],
                    note: '优先来自 integratedPreviews.learningTaskText',
                    required: false,
                  })}
                  <span className="lecture-journal-readonly-input">
                    <Input.TextArea
                      autoSize={{ minRows: 1, maxRows: 3 }}
                      placeholder="未填写"
                      readOnly
                      size="large"
                      value={resolveIntegratedLearningTaskText(item)}
                    />
                  </span>
                </label>

                <label className="lecture-journal-card-field lecture-journal-integrated-field-session">
                  {renderFieldLabel('学习环节序号及名称', {
                    fields: ['learningSessionNo', 'learningSessionContent'],
                    required: false,
                  })}
                  <span className="lecture-journal-readonly-input">
                    <Input
                      placeholder="未填写"
                      readOnly
                      size="large"
                      value={resolveIntegratedLearningSessionText(item)}
                    />
                  </span>
                </label>

                <label className="lecture-journal-card-field lecture-journal-integrated-field-unit">
                  {renderFieldLabel('教学单元序号及名称', {
                    fields: [
                      'teachingUnitText',
                      'teachingUnitNo',
                      'teachingUnitName',
                      'SSS002NAME',
                    ],
                    note: '优先来自 integratedPreviews.teachingUnitText',
                    required: false,
                  })}
                  <span className="lecture-journal-readonly-input">
                    <Input
                      placeholder="未填写"
                      readOnly
                      size="large"
                      value={resolveIntegratedTeachingUnitText(item)}
                    />
                  </span>
                </label>

                <label className="lecture-journal-card-field lecture-journal-integrated-field-summary">
                  {renderFieldLabel('完成情况及教学小结', {
                    fields: ['completeAndSummary'],
                    required: false,
                  })}
                  {isIntegratedEditable ? (
                    <Input.TextArea
                      placeholder="请输入完成情况及教学小结"
                      size="large"
                      value={draft.completeAndSummary}
                      onChange={(event) => {
                        onUpdateDraft(item.key, { completeAndSummary: event.target.value });
                      }}
                    />
                  ) : (
                    <span className="lecture-journal-readonly-input">
                      <Input.TextArea readOnly size="large" value={draft.completeAndSummary} />
                    </span>
                  )}
                </label>

                <label className="lecture-journal-card-field lecture-journal-integrated-field-problem">
                  {renderFieldLabel('发现问题及解决方法', {
                    fields: ['problemAndSolve'],
                    required: false,
                  })}
                  {isIntegratedEditable ? (
                    <Input
                      placeholder="请输入发现问题及解决方法"
                      size="large"
                      value={draft.problemAndSolve}
                      onChange={(event) => {
                        onUpdateDraft(item.key, { problemAndSolve: event.target.value });
                      }}
                    />
                  ) : (
                    <span className="lecture-journal-readonly-input">
                      <Input readOnly size="large" value={draft.problemAndSolve} />
                    </span>
                  )}
                </label>

                <label className="lecture-journal-card-field lecture-journal-integrated-field-discipline">
                  {renderFieldLabel('遵章守纪情况', {
                    fields: ['disciplineSituation'],
                    required: false,
                  })}
                  {isIntegratedEditable ? (
                    <Input
                      placeholder="请输入遵章守纪情况"
                      size="large"
                      value={draft.disciplineSituation}
                      onChange={(event) => {
                        onUpdateDraft(item.key, { disciplineSituation: event.target.value });
                      }}
                    />
                  ) : (
                    <span className="lecture-journal-readonly-input">
                      <Input readOnly size="large" value={draft.disciplineSituation} />
                    </span>
                  )}
                </label>

                <label className="lecture-journal-card-field lecture-journal-integrated-field-security">
                  {renderFieldLabel('文明安全及设备保养记录', {
                    fields: ['securityAndMaintain'],
                    required: false,
                  })}
                  {isIntegratedEditable ? (
                    <Input.TextArea
                      autoSize={{ minRows: 1, maxRows: 3 }}
                      placeholder="请输入文明安全及设备保养记录"
                      size="large"
                      value={draft.securityAndMaintain}
                      onChange={(event) => {
                        onUpdateDraft(item.key, { securityAndMaintain: event.target.value });
                      }}
                    />
                  ) : (
                    <span className="lecture-journal-readonly-input">
                      <Input.TextArea
                        autoSize={{ minRows: 1, maxRows: 3 }}
                        readOnly
                        size="large"
                        value={draft.securityAndMaintain}
                      />
                    </span>
                  )}
                </label>
              </>
            ) : (
              <>
                <label className="lecture-journal-card-field lecture-journal-card-field-content">
                  {renderFieldLabel('课程内容', {
                    fields: ['journal.courseContent', 'courseContent'],
                    note: '前者为日志侧，后者为计划侧参考',
                  })}
                  {isFilled ? (
                    <span className="lecture-journal-readonly-input">
                      <Input
                        placeholder="未填写"
                        readOnly
                        size="large"
                        value={draft.courseContent}
                      />
                    </span>
                  ) : (
                    <Input
                      placeholder="请输入课程内容"
                      size="large"
                      value={draft.courseContent}
                      onChange={(event) => {
                        onUpdateDraft(item.key, { courseContent: event.target.value });
                      }}
                    />
                  )}
                </label>

                <label className="lecture-journal-card-field lecture-journal-card-field-homework">
                  {renderFieldLabel('作业布置情况', {
                    fields: ['journal.homeworkAssignment', 'homework'],
                    note: '前者为日志侧，后者为计划侧参考',
                  })}
                  {isFilled ? (
                    <span className="lecture-journal-readonly-input">
                      <Input
                        placeholder="未填写"
                        readOnly
                        size="large"
                        value={draft.homeworkAssignment}
                      />
                    </span>
                  ) : (
                    <Input
                      placeholder="请输入作业布置情况"
                      size="large"
                      value={draft.homeworkAssignment}
                      onChange={(event) => {
                        onUpdateDraft(item.key, { homeworkAssignment: event.target.value });
                      }}
                    />
                  )}
                </label>

                <div className="lecture-journal-card-field lecture-journal-card-field-topic">
                  {renderFieldLabel('课堂情况记录', {
                    fields: ['journal.topicRecord'],
                  })}
                  {isFilled ? (
                    <span className="lecture-journal-readonly-input">
                      <Input placeholder="未填写" readOnly size="large" value={draft.topicRecord} />
                    </span>
                  ) : (
                    <div className="lecture-journal-topic-record-control">
                      <div className="lecture-journal-topic-record-segmented">
                        <Segmented
                          onChange={(value) => {
                            onUpdateDraft(item.key, { topicRecord: String(value) });
                          }}
                          options={TOPIC_RECORD_OPTIONS.map((value) => ({ label: value, value }))}
                          size="large"
                          value={topicRecordControlValue}
                        />
                      </div>
                      <span className="lecture-journal-topic-record-reset-slot">
                        {showRestoreButton ? (
                          <span className="lecture-journal-topic-record-reset">
                            <Button
                              onClick={() => {
                                onUpdateDraft(item.key, {
                                  courseContent: item.courseContent || '',
                                  homeworkAssignment: item.homework || '',
                                });
                              }}
                              size="small"
                              type="text"
                            >
                              恢复
                            </Button>
                          </span>
                        ) : null}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {showRestoreButton ? (
              <div className="lecture-journal-editor-actions">
                <Button
                  onClick={() => {
                    onUpdateDraft(item.key, {
                      courseContent: isIntegratedCard
                        ? ''
                        : isPracticeCard
                          ? item.practiceTopicName || ''
                          : item.courseContent || '',
                      demonstrationHours: isPracticeCard ? item.practiceDemonstrationHours : null,
                      disciplineSituation: isIntegratedCard
                        ? item.disciplineSituation || ''
                        : isPracticeCard
                          ? DEFAULT_DISCIPLINE_SITUATION
                          : '',
                      homeworkAssignment: isIntegratedCard ? '' : item.homework || '',
                      lectureHours: isPracticeCard ? item.practiceLectureHours : null,
                      learningObjective: '',
                      completeAndSummary: isIntegratedCard ? item.completeAndSummary || '' : '',
                      problemAndSolve: isIntegratedCard ? item.problemAndSolve || '' : '',
                      practiceHours: isPracticeCard ? item.practicePracticeHours : null,
                      productionProjectTitle: isIntegratedCard
                        ? ''
                        : isPracticeCard
                          ? item.practiceTeachingChapterContent || ''
                          : draft.productionProjectTitle,
                      securityAndMaintain: isIntegratedCard
                        ? item.securityAndMaintain || ''
                        : isPracticeCard
                          ? DEFAULT_SECURITY_AND_MAINTAIN
                          : '',
                      shift: isIntegratedCard ? item.shift || DEFAULT_INTEGRATED_SHIFT : '',
                      shiftName: isIntegratedCard
                        ? resolveShiftName(item.shift || DEFAULT_INTEGRATED_SHIFT) ||
                          DEFAULT_INTEGRATED_SHIFT_NAME
                        : '',
                    });
                  }}
                  size="small"
                  type="text"
                >
                  恢复
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </article>
  );
});

JournalDraftCard.displayName = 'JournalDraftCard';

export function LectureJournalReconciliationLabPage() {
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const loaderData = useLoaderData() as LectureJournalReconciliationLabLoaderData;
  const {
    clear,
    login: loginUpstream,
    persistRollingSession,
    session: storedSession,
  } = useUpstreamSession({
    account: loaderData?.upstreamAccount ?? null,
  });
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState(DEFAULT_DEPARTMENT_ID);
  const [staffId, setStaffId] = useState(loaderData?.defaultStaffId ?? '');
  const [directoryResult, setDirectoryResult] = useState<TeacherDirectoryResult | null>(null);
  const [queryState, dispatchQueryState] = useReducer(
    lectureJournalQueryReducer,
    initialLectureJournalQueryState,
  );
  const {
    isLoadingPrefill,
    isLoadingReconciliation,
    prefillError,
    prefillResult,
    queryError,
    reconciliationResult,
  } = queryState;
  const [resultViewScope, setResultViewScope] = useState<ResultViewScope>('missing');
  const [courseCategoryFilter, setCourseCategoryFilter] = useState<CourseCategoryFilter>('ALL');
  const [futureCourseVisibility, setFutureCourseVisibility] =
    useState<FutureCourseVisibility>('hide');
  const [isLoadingSemesters, setIsLoadingSemesters] = useState(true);
  const [isLoadingDepartmentOptions, setIsLoadingDepartmentOptions] = useState(true);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [departmentOptionsError, setDepartmentOptionsError] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [journalDrafts, setJournalDrafts] = useState<JournalDraftMap>({});
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [savingItemKey, setSavingItemKey] = useState<string | null>(null);
  const [saveFeedbackByKey, setSaveFeedbackByKey] = useState<SaveFeedbackMap>({});
  const [settlingSavedItemKeys, setSettlingSavedItemKeys] = useState<string[]>([]);
  const [collapsingSavedItemKeys, setCollapsingSavedItemKeys] = useState<string[]>([]);
  const [collapsingSavedItemHeights, setCollapsingSavedItemHeights] = useState<
    Record<string, number>
  >({});
  const activeQueryRequestIdRef = useRef(0);
  const initialJournalDraftsRef = useRef<JournalDraftMap>({});
  const isQueryInFlightRef = useRef(false);
  const cardItemElementsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const savedCardCollapseAnimationFramesRef = useRef<Record<string, number>>({});
  const savedCardCollapseTimeoutsRef = useRef<Record<string, number>>({});

  const clearCurrentSession = useCallback(() => {
    clear();
    setDirectoryResult(null);
  }, [clear]);

  const openLoginModal = useCallback(() => {
    setLoginError(null);
    loginForm.setFieldsValue({
      password: '',
      userId: storedSession?.upstreamLoginId ?? '',
    });
    setIsLoginModalOpen(true);
  }, [loginForm, storedSession?.upstreamLoginId]);

  useEffect(() => {
    const savedCardCollapseAnimationFrames = savedCardCollapseAnimationFramesRef.current;
    const savedCardCollapseTimeouts = savedCardCollapseTimeoutsRef.current;

    return () => {
      Object.values(savedCardCollapseAnimationFrames).forEach((frameId) => {
        window.cancelAnimationFrame(frameId);
      });
      Object.values(savedCardCollapseTimeouts).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

  const startSavedCardCollapse = useCallback((itemKey: string) => {
    const cardItemElement = cardItemElementsRef.current[itemKey];
    const measuredHeight = cardItemElement?.offsetHeight ?? 0;
    const existingFrameId = savedCardCollapseAnimationFramesRef.current[itemKey];
    const existingTimeoutId = savedCardCollapseTimeoutsRef.current[itemKey];

    if (existingFrameId) {
      window.cancelAnimationFrame(existingFrameId);
    }

    if (existingTimeoutId) {
      window.clearTimeout(existingTimeoutId);
    }

    setCollapsingSavedItemHeights((current) => ({
      ...current,
      [itemKey]: measuredHeight,
    }));
    setSettlingSavedItemKeys((current) =>
      current.includes(itemKey) ? current : [...current, itemKey],
    );

    savedCardCollapseAnimationFramesRef.current[itemKey] = window.requestAnimationFrame(() => {
      savedCardCollapseAnimationFramesRef.current[itemKey] = window.requestAnimationFrame(() => {
        setSettlingSavedItemKeys((current) => current.filter((key) => key !== itemKey));
        setCollapsingSavedItemKeys((current) =>
          current.includes(itemKey) ? current : [...current, itemKey],
        );

        savedCardCollapseTimeoutsRef.current[itemKey] = window.setTimeout(() => {
          setSettlingSavedItemKeys((current) => current.filter((key) => key !== itemKey));
          setCollapsingSavedItemKeys((current) => current.filter((key) => key !== itemKey));
          setCollapsingSavedItemHeights((current) => {
            const next = { ...current };

            delete next[itemKey];
            return next;
          });
          delete savedCardCollapseAnimationFramesRef.current[itemKey];
          delete savedCardCollapseTimeoutsRef.current[itemKey];
        }, SAVED_CARD_COLLAPSE_DURATION_MS);
      });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setIsLoadingSemesters(true);
      setIsLoadingDepartmentOptions(true);
      setSemesterError(null);
      setDepartmentOptionsError(null);

      try {
        const [semesterResult, departmentResult] = await Promise.allSettled([
          requestAcademicSemesters({ limit: 500 }),
          fetchLectureJournalDepartmentOptions(),
        ]);

        if (cancelled) {
          return;
        }

        const nextSemesters =
          semesterResult.status === 'fulfilled' ? sortSemesters(semesterResult.value) : [];
        const nextDepartmentOptions =
          departmentResult.status === 'fulfilled'
            ? departmentResult.value
                .filter((department) => department.id !== '')
                .map((department) => ({
                  id: department.id,
                  label: buildDepartmentOptionLabel(department),
                }))
            : [];

        setSemesters(nextSemesters);
        setDepartmentOptions(nextDepartmentOptions);
        setSelectedSemesterId((currentSelection) =>
          pickNextSemesterId(nextSemesters, currentSelection),
        );
        setSemesterError(
          semesterResult.status === 'rejected'
            ? semesterResult.reason instanceof Error
              ? semesterResult.reason.message
              : '暂时无法加载学期列表。'
            : null,
        );
        setDepartmentOptionsError(
          departmentResult.status === 'rejected'
            ? departmentResult.reason instanceof Error
              ? departmentResult.reason.message
              : '暂时无法加载院系列表。'
            : null,
        );
      } catch (error) {
        if (!cancelled) {
          setSemesterError(error instanceof Error ? error.message : '暂时无法加载学期列表。');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSemesters(false);
          setIsLoadingDepartmentOptions(false);
        }
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!departmentId) {
      setDepartmentId(DEFAULT_DEPARTMENT_ID);
    }
  }, [departmentId]);

  useEffect(() => {
    if (!staffId && loaderData?.defaultStaffId) {
      setStaffId(loaderData.defaultStaffId);
    }
  }, [loaderData?.defaultStaffId, staffId]);

  const selectedSemester = semesters.find((record) => record.id === selectedSemesterId) ?? null;
  const normalizedDepartmentId = normalizeOptionalString(departmentId);
  const normalizedStaffId = normalizeOptionalString(staffId);
  const hasFilterPairMismatch = Boolean(normalizedDepartmentId) !== Boolean(normalizedStaffId);
  const hasNoDepartmentOptions =
    !isLoadingDepartmentOptions && !departmentOptionsError && departmentOptions.length === 0;
  const teacherOptions = (directoryResult?.teachers ?? []).map((teacher) => ({
    label: buildTeacherOptionLabel(teacher),
    value: teacher.value,
  }));
  const prefillIntegratedItems = useMemo(
    () =>
      (prefillResult?.integratedPreviews ?? []).map((item) =>
        buildEditableCardItemFromIntegratedPreview(item),
      ),
    [prefillResult?.integratedPreviews],
  );
  const editableItems = useMemo(() => {
    const reconciliationItems = (reconciliationResult?.items ?? []).map((item) =>
      buildEditableCardItemFromReconciliation(item),
    );

    if (prefillIntegratedItems.length === 0) {
      return reconciliationItems;
    }

    return [
      ...prefillIntegratedItems,
      ...reconciliationItems.filter((item) => !isIntegratedCourseCategory(item.courseCategory)),
    ];
  }, [prefillIntegratedItems, reconciliationResult?.items]);
  const missingEditableItems = useMemo(
    () => editableItems.filter((item) => item.status === 'MISSING'),
    [editableItems],
  );
  const presentedMissingEditableItems = useMemo(() => {
    const transitionSavedItemKeys = [...settlingSavedItemKeys, ...collapsingSavedItemKeys];

    if (transitionSavedItemKeys.length === 0) {
      return missingEditableItems;
    }

    const transitionSavedItemKeySet = new Set(transitionSavedItemKeys);

    return editableItems.filter(
      (item) => item.status === 'MISSING' || transitionSavedItemKeySet.has(item.key),
    );
  }, [collapsingSavedItemKeys, editableItems, missingEditableItems, settlingSavedItemKeys]);
  const unmatchedEditableItems = useMemo(
    () => editableItems.filter((item) => item.status === 'UNMATCHED'),
    [editableItems],
  );
  const dateVisibleEditableItems = useMemo(() => {
    if (futureCourseVisibility === 'show') {
      return editableItems;
    }

    return editableItems.filter((item) => !isFutureTeachingDate(item.teachingDate));
  }, [editableItems, futureCourseVisibility]);
  const dateVisiblePresentedMissingEditableItems = useMemo(() => {
    if (futureCourseVisibility === 'show') {
      return presentedMissingEditableItems;
    }

    return presentedMissingEditableItems.filter((item) => !isFutureTeachingDate(item.teachingDate));
  }, [futureCourseVisibility, presentedMissingEditableItems]);
  const dateVisibleUnmatchedEditableItems = useMemo(() => {
    if (futureCourseVisibility === 'show') {
      return unmatchedEditableItems;
    }

    return unmatchedEditableItems.filter((item) => !isFutureTeachingDate(item.teachingDate));
  }, [futureCourseVisibility, unmatchedEditableItems]);
  const resultViewOptions = useMemo(
    () =>
      buildResultViewScopeOptions({
        complete: dateVisibleEditableItems.length,
        missing: dateVisiblePresentedMissingEditableItems.length,
        unmatched: dateVisibleUnmatchedEditableItems.length,
      }),
    [
      dateVisibleEditableItems.length,
      dateVisiblePresentedMissingEditableItems.length,
      dateVisibleUnmatchedEditableItems.length,
    ],
  );
  const shouldRenderResultViewFilter = resultViewOptions.length > 1;
  const activeResultViewScope = resolveResultViewScope(resultViewOptions, resultViewScope);
  const rawScopedJournalItems = useMemo(
    () =>
      pickJournalItemsByResultViewScope({
        editableItems,
        presentedMissingEditableItems,
        resultViewScope: activeResultViewScope,
        unmatchedEditableItems,
      }),
    [activeResultViewScope, editableItems, presentedMissingEditableItems, unmatchedEditableItems],
  );
  const futureScopedJournalItems = useMemo(
    () => rawScopedJournalItems.filter((item) => isFutureTeachingDate(item.teachingDate)),
    [rawScopedJournalItems],
  );
  const shouldRenderFutureCourseSwitch = futureScopedJournalItems.length > 0;
  const scopedJournalItems = useMemo(() => {
    if (futureCourseVisibility === 'show') {
      return rawScopedJournalItems;
    }

    return rawScopedJournalItems.filter((item) => !isFutureTeachingDate(item.teachingDate));
  }, [futureCourseVisibility, rawScopedJournalItems]);
  const courseCategoryOptions = useMemo(
    () => buildCourseCategoryFilterOptions(scopedJournalItems),
    [scopedJournalItems],
  );
  const shouldRenderCourseCategoryFilter = courseCategoryOptions.length > 1;
  const shouldRenderViewFilters =
    shouldRenderResultViewFilter ||
    shouldRenderFutureCourseSwitch ||
    shouldRenderCourseCategoryFilter;
  const activeCourseCategoryFilter = resolveCourseCategoryFilter(
    courseCategoryOptions,
    courseCategoryFilter,
  );
  const visibleJournalItems = useMemo(
    () => filterItemsByCourseCategory(scopedJournalItems, activeCourseCategoryFilter),
    [activeCourseCategoryFilter, scopedJournalItems],
  );
  const currentResultCount = visibleJournalItems.length;
  const currentCourseCategoryLabel =
    activeCourseCategoryFilter === 'ALL'
      ? '全部课程'
      : resolveCourseCategoryMeta(activeCourseCategoryFilter)?.label || activeCourseCategoryFilter;
  const initialJournalDrafts = useMemo(() => {
    const nextDrafts = buildJournalDrafts(editableItems);
    const reusedDrafts = reuseJournalDraftMapReferences(
      initialJournalDraftsRef.current,
      nextDrafts,
    );

    initialJournalDraftsRef.current = reusedDrafts;

    return reusedDrafts;
  }, [editableItems]);

  const updateJournalDraft = useCallback((key: string, patch: JournalDraftPatch) => {
    setJournalDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? initialJournalDraftsRef.current[key] ?? EMPTY_JOURNAL_DRAFT),
        ...patch,
      },
    }));
    setSaveFeedbackByKey((current) => ({
      ...current,
      [key]: undefined,
    }));
  }, []);

  const applyLocalSaveSuccess = useCallback(
    (item: JournalEditableCardItem, draft: JournalDraft, result: AcademicTeachingLogSaveResult) => {
      if (isIntegratedCourseCategory(item.courseCategory)) {
        dispatchQueryState({
          completeAndSummary: draft.completeAndSummary,
          disciplineSituation: draft.disciplineSituation,
          lectureJournalDetailId: result.lectureJournalDetailId,
          lecturePlanDetailId: item.lecturePlanDetailId,
          lecturePlanId: item.lecturePlanId,
          problemAndSolve: draft.problemAndSolve,
          securityAndMaintain: draft.securityAndMaintain,
          shift: draft.shift || item.shift || DEFAULT_INTEGRATED_SHIFT,
          type: 'integratedSaveApplied',
        });

        return;
      }

      dispatchQueryState({
        courseContent: draft.courseContent,
        homeworkAssignment: draft.homeworkAssignment,
        itemKey: item.key,
        lectureJournalDetailId: result.lectureJournalDetailId,
        topicRecord: draft.topicRecord,
        type: 'reconciliationSaveApplied',
      });
    },
    [],
  );

  const handleSaveToCampus = useCallback(
    async (item: JournalEditableCardItem, draft: JournalDraft) => {
      const session = storedSession;

      if (!session) {
        setSaveFeedbackByKey((current) => ({
          ...current,
          [item.key]: {
            text: '请先登录 upstream 后再保存。',
            tone: 'error',
          },
        }));
        setPendingAction(null);
        setLoginError(null);
        openLoginModal();
        return;
      }

      const validationError = resolveSaveValidationError(item, draft);

      if (validationError) {
        setSaveFeedbackByKey((current) => ({
          ...current,
          [item.key]: {
            text: validationError,
            tone: 'error',
          },
        }));
        return;
      }

      setSavingItemKey(item.key);
      setSaveFeedbackByKey((current) => ({
        ...current,
        [item.key]: undefined,
      }));

      try {
        const { result } = await runLectureJournalSaveWorkflow({
          draft,
          item,
          persistRollingSession,
          session,
        });

        applyLocalSaveSuccess(item, draft, result);

        if (item.status === 'MISSING' && activeResultViewScope === 'missing') {
          startSavedCardCollapse(item.key);
        }

        setSaveFeedbackByKey((current) => ({
          ...current,
          [item.key]: {
            text: result.msg || '教学日志已保存。',
            tone: 'success',
          },
        }));
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          clearCurrentSession();
          setSaveFeedbackByKey((current) => ({
            ...current,
            [item.key]: {
              text: 'upstream 会话已失效，请重新登录后重新保存。',
              tone: 'error',
            },
          }));
          setPendingAction(null);
          setLoginError('upstream 会话已失效，请重新登录后重新保存。');
          openLoginModal();
          return;
        }

        setSaveFeedbackByKey((current) => ({
          ...current,
          [item.key]: {
            text: resolveUpstreamErrorMessage(error, '暂时无法保存教学日志。'),
            tone: 'error',
          },
        }));
      } finally {
        setSavingItemKey(null);
      }
    },
    [
      applyLocalSaveSuccess,
      clearCurrentSession,
      openLoginModal,
      persistRollingSession,
      activeResultViewScope,
      startSavedCardCollapse,
      storedSession,
    ],
  );

  async function runDirectoryAction(sessionOverride?: StoredUpstreamSession) {
    const session = sessionOverride ?? storedSession;

    if (!session) {
      setPendingAction('directory');
      setLoginError(null);
      setIsLoginModalOpen(true);
      return;
    }

    setIsLoadingDirectory(true);
    setDirectoryError(null);

    try {
      const result = await requestTeacherDirectoryWithSession(session);

      persistRollingSession(session, {
        expiresAt: result.expiresAt,
        upstreamSessionToken: result.upstreamSessionToken,
      });
      setDirectoryResult(result);
    } catch (error) {
      if (isExpiredUpstreamSessionError(error)) {
        clearCurrentSession();
        setPendingAction('directory');
        setLoginError('upstream 会话已失效，请重新登录后继续。');
        openLoginModal();
        return;
      }

      setDirectoryError(resolveUpstreamErrorMessage(error, '暂时无法加载教师字典。'));
    } finally {
      setIsLoadingDirectory(false);
    }
  }

  async function runQueryAction(sessionOverride?: StoredUpstreamSession) {
    const session = sessionOverride ?? storedSession;

    if (!session) {
      setPendingAction('query');
      setLoginError(null);
      setIsLoginModalOpen(true);
      return;
    }

    if (!selectedSemester) {
      return;
    }

    if (isQueryInFlightRef.current) {
      return;
    }

    const requestId = activeQueryRequestIdRef.current + 1;

    activeQueryRequestIdRef.current = requestId;
    isQueryInFlightRef.current = true;
    dispatchQueryState({ type: 'started' });
    setJournalDrafts({});
    setSaveFeedbackByKey({});
    setSettlingSavedItemKeys([]);
    setCollapsingSavedItemKeys([]);
    setCollapsingSavedItemHeights({});

    try {
      const result = await runLectureJournalReconciliationQueryWorkflow({
        departmentId: normalizedDepartmentId || undefined,
        isCurrent: () => activeQueryRequestIdRef.current === requestId,
        onReconciliationResult: (nextReconciliationResult) => {
          dispatchQueryState({ result: nextReconciliationResult, type: 'reconciliationLoaded' });
        },
        onPrefillStart: () => {
          dispatchQueryState({ type: 'prefillStarted' });
        },
        persistRollingSession,
        schoolYear: String(selectedSemester.schoolYear),
        semester: String(selectedSemester.termNumber),
        semesterId: selectedSemester.id,
        session,
        staffId: normalizedStaffId || undefined,
      });

      if (activeQueryRequestIdRef.current !== requestId) {
        return;
      }

      dispatchQueryState({
        prefillError: result.prefillError,
        prefillResult: result.prefillResult,
        reconciliationResult: result.reconciliationResult,
        type: 'succeeded',
      });
    } catch (error) {
      if (activeQueryRequestIdRef.current !== requestId) {
        return;
      }

      if (isExpiredUpstreamSessionError(error)) {
        dispatchQueryState({ type: 'settled' });
        clearCurrentSession();
        setPendingAction('query');
        setLoginError('upstream 会话已失效，请重新登录后继续。');
        openLoginModal();
        return;
      }

      dispatchQueryState({
        message: resolveUpstreamErrorMessage(error, '暂时无法加载教学日志对账结果。'),
        type: 'failed',
      });
    } finally {
      if (activeQueryRequestIdRef.current === requestId) {
        isQueryInFlightRef.current = false;
        dispatchQueryState({ type: 'settled' });
      }
    }
  }

  async function handleLogin(values: UpstreamLoginFormValues) {
    if (!loaderData?.upstreamAccount) {
      setLoginError('当前登录账号尚未就绪，请稍后再试。');
      return;
    }

    setIsSubmittingLogin(true);
    setLoginError(null);

    try {
      const nextSession = await loginUpstream(values);

      setIsLoginModalOpen(false);
      const nextPendingAction = pendingAction;

      setPendingAction(null);
      loginForm.resetFields();

      if (nextPendingAction === 'directory') {
        await runDirectoryAction(nextSession);
      }

      if (nextPendingAction === 'query') {
        await runQueryAction(nextSession);
      }
    } catch (error) {
      setLoginError(resolveUpstreamErrorMessage(error, '暂时无法建立 upstream 会话。'));
    } finally {
      setIsSubmittingLogin(false);
    }
  }

  function renderJournalCardList(items: JournalEditableCardItem[]) {
    return (
      <div className="lecture-journal-card-list">
        {items.map((item) => {
          const isMeasured =
            settlingSavedItemKeys.includes(item.key) || collapsingSavedItemKeys.includes(item.key);
          const isCollapsing =
            activeResultViewScope === 'missing' && collapsingSavedItemKeys.includes(item.key);
          const collapseHeight = collapsingSavedItemHeights[item.key];
          const collapseStyle =
            isMeasured && collapseHeight
              ? ({
                  '--lecture-journal-card-collapse-height': `${collapseHeight}px`,
                } as CSSProperties)
              : undefined;

          return (
            <div
              className={[
                'lecture-journal-card-item',
                isMeasured ? 'lecture-journal-card-item-measured' : '',
                isCollapsing ? 'lecture-journal-card-item-collapsing' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={item.key}
              ref={(node) => {
                cardItemElementsRef.current[item.key] = node;
              }}
              style={collapseStyle}
            >
              <JournalDraftCard
                draft={
                  journalDrafts[item.key] ?? initialJournalDrafts[item.key] ?? EMPTY_JOURNAL_DRAFT
                }
                initialDraft={initialJournalDrafts[item.key] ?? EMPTY_JOURNAL_DRAFT}
                isCollapsing={isCollapsing}
                isSaving={savingItemKey === item.key}
                item={item}
                onSave={handleSaveToCampus}
                onUpdateDraft={updateJournalDraft}
                saveFeedback={saveFeedbackByKey[item.key]}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="lecture-journal-page flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Typography.Title level={3} style={{ margin: 0 }}>
          教学日志填写对账
        </Typography.Title>
        <Typography.Paragraph style={{ margin: 0 }} type="secondary">
          基于上游教学计划详情和教学日志，统计指定学年学期内每个课次的填写状态。优先用于查看某位教师在某学期的已填、疑似未填和无法对账课次。
        </Typography.Paragraph>
      </div>

      <Alert
        description="查询时只要求学期。若要按教师过滤，departmentId 和 staffId 必须同时传入；两者都留空则按整学期全量对账。"
        message="接口口径"
        showIcon
        type="info"
      />

      <div className="lecture-journal-control-card">
        <Card>
          <div className="flex flex-col gap-4">
            {!storedSession ? (
              <Alert
                action={
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                      setPendingAction(null);
                      openLoginModal();
                    }}
                  >
                    登录上游
                  </Button>
                }
                description="当前页面依赖上游 sessionToken。可以直接在此登录，或复用同账号已有的上游会话。"
                message="尚未建立 upstream 会话"
                showIcon
                type="warning"
              />
            ) : (
              <Descriptions column={3} size="small">
                <Descriptions.Item label="上游登录 ID">
                  {storedSession.upstreamLoginId || '未记录'}
                </Descriptions.Item>
                <Descriptions.Item label="会话过期时间">
                  {formatDateTime(storedSession.expiresAt)}
                </Descriptions.Item>
                <Descriptions.Item label="当前视图身份">
                  {loaderData?.viewerKind ?? 'unknown'}
                </Descriptions.Item>
              </Descriptions>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-2">
                <Typography.Text strong>学期</Typography.Text>
                {isLoadingSemesters ? (
                  <Skeleton.Button active block />
                ) : (
                  <Select
                    options={semesters.map((semester) => ({
                      label: `${semester.name}${semester.isCurrent ? ' · 当前' : ''}`,
                      value: semester.id,
                    }))}
                    placeholder="请选择学期"
                    value={selectedSemesterId ?? undefined}
                    onChange={(value) => setSelectedSemesterId(value)}
                  />
                )}
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>departmentId</Typography.Text>
                <Select
                  loading={isLoadingDepartmentOptions}
                  disabled={isLoadingDepartmentOptions || departmentOptions.length === 0}
                  notFoundContent={hasNoDepartmentOptions ? '当前未返回可选院系' : undefined}
                  optionFilterProp="label"
                  options={departmentOptions.map((option) => ({
                    label: option.label,
                    value: option.id,
                  }))}
                  placeholder="请选择院系"
                  showSearch
                  value={departmentId}
                  onChange={(value) => setDepartmentId(value)}
                />
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>教师 staffId</Typography.Text>
                <AutoComplete
                  options={teacherOptions}
                  placeholder={loaderData?.defaultStaffId || '先加载教师字典，或直接输入 staffId'}
                  value={staffId}
                  onChange={setStaffId}
                  filterOption={(inputValue, option) =>
                    String(option?.label || '')
                      .toLowerCase()
                      .includes(inputValue.trim().toLowerCase()) ||
                    String(option?.value || '')
                      .toLowerCase()
                      .includes(inputValue.trim().toLowerCase())
                  }
                />
              </label>
            </div>

            {semesterError ? <Alert message={semesterError} showIcon type="error" /> : null}
            {departmentOptionsError ? (
              <Alert message={departmentOptionsError} showIcon type="error" />
            ) : null}
            {directoryError ? <Alert message={directoryError} showIcon type="error" /> : null}
            {hasFilterPairMismatch ? (
              <Alert
                message="按教师过滤时，departmentId 和 staffId 需要同时填写。"
                showIcon
                type="warning"
              />
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button
                loading={isLoadingDirectory}
                onClick={() => {
                  void runDirectoryAction();
                }}
              >
                加载教师字典
              </Button>
              <Button
                type="primary"
                disabled={
                  !selectedSemester ||
                  hasFilterPairMismatch ||
                  isLoadingReconciliation ||
                  isLoadingPrefill
                }
                loading={isLoadingReconciliation || isLoadingPrefill}
                onClick={() => {
                  void runQueryAction();
                }}
              >
                {isLoadingPrefill ? '补充预填中' : '查询对账'}
              </Button>
              <Button
                disabled={!normalizedDepartmentId && !normalizedStaffId}
                onClick={() => {
                  setDepartmentId(DEFAULT_DEPARTMENT_ID);
                  setStaffId(loaderData?.defaultStaffId ?? '');
                }}
              >
                恢复默认筛选
              </Button>
              <Button
                disabled={!storedSession}
                onClick={() => {
                  clearCurrentSession();
                }}
              >
                清除 upstream 会话
              </Button>
              <Button
                disabled={!storedSession}
                onClick={() => {
                  setPendingAction(null);
                  openLoginModal();
                }}
              >
                重新登录 upstream
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {queryError ? <Alert message={queryError} showIcon type="error" /> : null}
      {prefillError ? (
        <Alert
          description="主对账结果已经返回；当前只缺少一体化教学日志的补充预填信息。"
          message={prefillError}
          showIcon
          type="warning"
        />
      ) : null}

      {isLoadingReconciliation ? <Skeleton active paragraph={{ rows: 8 }} /> : null}

      {!isLoadingReconciliation && reconciliationResult ? (
        <div className="lecture-journal-view-shell">
          <section className="lecture-journal-toolbar" aria-label="课次筛选">
            <header className="lecture-journal-toolbar-head">
              <div className="lecture-journal-toolbar-heading">
                <h3 className="lecture-journal-toolbar-title">
                  {resolveResultViewScopeTitle(activeResultViewScope)}
                </h3>
                <p className="lecture-journal-toolbar-summary">
                  当前显示
                  <strong className="lecture-journal-toolbar-summary-count">
                    {currentResultCount}
                  </strong>
                  个课次
                  {activeCourseCategoryFilter === 'ALL'
                    ? null
                    : `，仅 ${currentCourseCategoryLabel}`}
                  {shouldRenderFutureCourseSwitch && futureCourseVisibility === 'hide'
                    ? '，已隐藏未开课'
                    : null}
                </p>
              </div>

              {shouldRenderFutureCourseSwitch ? (
                <div
                  className="lecture-journal-toolbar-future"
                  onClick={() => {
                    setFutureCourseVisibility(futureCourseVisibility === 'show' ? 'hide' : 'show');
                  }}
                >
                  <span className="lecture-journal-toolbar-future-copy">
                    <span className="lecture-journal-toolbar-future-label">包含未开课</span>
                    <span className="lecture-journal-toolbar-future-hint">
                      共 {futureScopedJournalItems.length} 节尚未开始
                    </span>
                  </span>
                  <Switch
                    checked={futureCourseVisibility === 'show'}
                    size="small"
                    onChange={(checked) => {
                      setFutureCourseVisibility(checked ? 'show' : 'hide');
                    }}
                    onClick={(_, event) => {
                      event.stopPropagation();
                    }}
                  />
                </div>
              ) : null}
            </header>

            {shouldRenderViewFilters ? (
              <div className="lecture-journal-toolbar-filters">
                {shouldRenderResultViewFilter ? (
                  <div className="lecture-journal-toolbar-scope">
                    <Segmented
                      block
                      options={resultViewOptions.map((option) => ({
                        label: (
                          <span
                            className={`lecture-journal-toolbar-pill lecture-journal-toolbar-pill-${option.value}`}
                          >
                            <span className="lecture-journal-toolbar-pill-text">
                              {option.label}
                            </span>
                            <span
                              className={`lecture-journal-toolbar-pill-count lecture-journal-toolbar-pill-count-${option.value}`}
                            >
                              {option.count}
                            </span>
                          </span>
                        ),
                        value: option.value,
                      }))}
                      size="large"
                      value={activeResultViewScope}
                      onChange={(value) => {
                        setResultViewScope(value as ResultViewScope);
                      }}
                    />
                  </div>
                ) : null}

                {shouldRenderCourseCategoryFilter ? (
                  <div
                    className="lecture-journal-toolbar-categories"
                    role="group"
                    aria-label="课程类别"
                  >
                    {courseCategoryOptions.map((option) => {
                      const isActive = activeCourseCategoryFilter === option.key;
                      const accentClassName =
                        option.key === 'ALL'
                          ? 'lecture-journal-toolbar-chip-all'
                          : resolveCourseCategoryMeta(option.key)?.accentClassName || '';

                      return (
                        <button
                          key={option.key}
                          type="button"
                          aria-pressed={isActive}
                          className={`lecture-journal-toolbar-chip ${accentClassName} ${
                            isActive ? 'lecture-journal-toolbar-chip-active' : ''
                          }`.trim()}
                          onClick={() => {
                            setCourseCategoryFilter(option.key);
                          }}
                        >
                          <span className="lecture-journal-toolbar-chip-dot" aria-hidden />
                          <span className="lecture-journal-toolbar-chip-label">{option.label}</span>
                          <span className="lecture-journal-toolbar-chip-count">{option.count}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          {visibleJournalItems.length === 0 ? (
            <div className="lecture-journal-view-empty">
              <Empty
                description={
                  activeResultViewScope === 'missing'
                    ? '当前筛选下没有需要补填的课次。'
                    : activeResultViewScope === 'unmatched'
                      ? '当前筛选下没有需要核对的课次。'
                      : '当前筛选下没有课次。'
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          ) : (
            renderJournalCardList(visibleJournalItems)
          )}
        </div>
      ) : null}

      {!isLoadingReconciliation && !reconciliationResult && selectedSemester ? (
        <Alert
          description="完成学期和教师筛选后点击“查询对账”，页面会返回完整课次列表、疑似未填列表和无法对账计划项。"
          message="准备完成"
          showIcon
          type="success"
        />
      ) : null}

      <section className="lecture-journal-lab-meta">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Lab meta">
            {lectureJournalReconciliationLabMeta.purpose}
          </Descriptions.Item>
          <Descriptions.Item label="访问范围">
            {lectureJournalReconciliationLabAccess.allowedAccessLevels.join(' / ')}
          </Descriptions.Item>
        </Descriptions>
      </section>

      <Modal
        destroyOnHidden
        footer={null}
        open={isLoginModalOpen}
        title="登录 upstream"
        onCancel={() => {
          setIsLoginModalOpen(false);
          setPendingAction(null);
          setLoginError(null);
        }}
      >
        <div className="flex flex-col gap-4">
          {loginError ? <Alert message={loginError} showIcon type="error" /> : null}
          <Form<UpstreamLoginFormValues>
            form={loginForm}
            layout="vertical"
            onFinish={(values) => {
              void handleLogin(values);
            }}
          >
            <Form.Item
              label="上游账号"
              name="userId"
              rules={[{ required: true, message: '请输入上游账号' }]}
            >
              <Input autoComplete="username" placeholder="请输入上游账号" />
            </Form.Item>
            <Form.Item
              label="上游密码"
              name="password"
              rules={[{ required: true, message: '请输入上游密码' }]}
            >
              <Input.Password autoComplete="current-password" placeholder="请输入上游密码" />
            </Form.Item>

            <div className="flex justify-end gap-3">
              <Button
                onClick={() => {
                  setIsLoginModalOpen(false);
                }}
              >
                取消
              </Button>
              <Button htmlType="submit" loading={isSubmittingLogin} type="primary">
                登录并继续
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
    </div>
  );
}
