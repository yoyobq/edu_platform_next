import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { InfoCircleOutlined } from '@ant-design/icons';
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
  type AcademicTeachingLogPrefillResult,
  fetchAcademicTeachingLogPrefillItems,
  fetchLectureJournalDepartmentOptions,
  fetchLectureJournalReconciliation,
  fetchTeacherDirectory,
  isExpiredUpstreamSessionError,
  type LectureJournalDepartmentOption,
  type LectureJournalExpectedOccurrence,
  type LectureJournalReconciliationItem,
  type LectureJournalReconciliationResult,
  resolveUpstreamErrorMessage,
  saveAcademicIntegratedTeachingLog,
  saveAcademicPracticeTeachingLog,
  saveAcademicTheoryTeachingLog,
  type TeacherDirectoryEntry,
  type TeacherDirectoryResult,
  type UnmatchedLectureJournalPlanItem,
} from './api';
import { lectureJournalReconciliationLabMeta } from './meta';

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

const DEFAULT_DEPARTMENT_ID = 'ORG0302';
const DAY_OF_WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DEFAULT_DISCIPLINE_SITUATION = '遵章守纪';
const DEFAULT_INTEGRATED_SHIFT = '3';
const SHIFT_NAME_BY_VALUE = {
  '1': '早班',
  '2': '中班',
  '3': '常日班',
} as const;
const DEFAULT_INTEGRATED_SHIFT_NAME = SHIFT_NAME_BY_VALUE[DEFAULT_INTEGRATED_SHIFT];
const DEFAULT_SECURITY_AND_MAINTAIN = '注意安全，已保养';
const TOPIC_RECORD_OPTIONS = ['优', '良', '正常', '一般'];
const TOPIC_RECORD_VISUAL_DEFAULT = TOPIC_RECORD_OPTIONS[0];
const COURSE_CATEGORY_TAB_ORDER = ['3', '1', '2'];
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

type MetricTone = 'default' | 'success' | 'warning';

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

type JournalDraft = {
  completeAndSummary: string;
  courseContent: string;
  demonstrationHours: number | null;
  disciplineSituation: string;
  homeworkAssignment: string;
  lectureHours: number | null;
  problemAndSolve: string;
  practiceHours: number | null;
  productionProjectTitle: string;
  learningObjective: string;
  securityAndMaintain: string;
  shift: string;
  shiftName: string;
  submitStatusText: string;
  topicRecord: string;
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

type JournalDraftMap = Record<string, JournalDraft>;
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

const EMPTY_JOURNAL_DRAFT: JournalDraft = {
  completeAndSummary: '',
  courseContent: '',
  demonstrationHours: null,
  disciplineSituation: '',
  homeworkAssignment: '',
  lectureHours: null,
  problemAndSolve: '',
  practiceHours: null,
  productionProjectTitle: '',
  learningObjective: '',
  securityAndMaintain: '',
  shift: '',
  shiftName: '',
  submitStatusText: '',
  topicRecord: '',
};

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

function buildFieldTipTitle(config: FieldTipConfig) {
  const parts = [`接口字段：${config.fields.join(' / ')}`];

  if (config.note) {
    parts.push(config.note);
  }

  return parts.join('；');
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
      <Tooltip placement="topLeft" title={buildFieldTipTitle(config)}>
        <button
          aria-label={`${label} 字段提示`}
          className="lecture-journal-field-tip-trigger"
          type="button"
        >
          <InfoCircleOutlined />
        </button>
      </Tooltip>
    </span>
  );
}

function renderMetricTile({
  detail,
  label,
  tone = 'default',
  value,
}: {
  detail?: string;
  label: string;
  tone?: MetricTone;
  value: number | string;
}) {
  return (
    <div className={`lecture-journal-metric lecture-journal-metric-${tone}`}>
      <div className="lecture-journal-metric-label">
        <Typography.Text type="secondary">{label}</Typography.Text>
      </div>
      <div className="lecture-journal-metric-value">
        <Typography.Title level={3}>{value}</Typography.Title>
      </div>
      {detail ? (
        <div className="lecture-journal-metric-detail">
          <Typography.Text type="secondary">{detail}</Typography.Text>
        </div>
      ) : null}
    </div>
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

function resolveShiftName(shift: string | null) {
  const normalizedShift = shift?.trim() || '';

  if (!normalizedShift) {
    return '';
  }

  return SHIFT_NAME_BY_VALUE[normalizedShift as keyof typeof SHIFT_NAME_BY_VALUE] || '';
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
  return [
    {
      count: items.length,
      key: 'ALL' as const,
      label: '全部',
    },
    ...COURSE_CATEGORY_TAB_ORDER.map((courseCategory) => {
      const courseCategoryMeta = resolveCourseCategoryMeta(courseCategory);

      return {
        count: items.filter((item) => item.courseCategory === courseCategory).length,
        key: courseCategory as CourseCategoryFilter,
        label: courseCategoryMeta?.label || courseCategory,
      };
    }),
  ];
}

function resolveCourseCategoryFilter(
  options: Array<{ key: CourseCategoryFilter }>,
  activeCourseCategory: CourseCategoryFilter,
) {
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
    return '疑似未填';
  }

  if (scope === 'unmatched') {
    return '无法对账';
  }

  return '完整对账';
}

function isPracticeCourseCategory(courseCategory: string | null) {
  return courseCategory === '2';
}

function isIntegratedCourseCategory(courseCategory: string | null) {
  return courseCategory === '3';
}

function resolveOptionalCountLabel(value: number | null | undefined, fallback: string) {
  return value === null || value === undefined ? fallback : String(value);
}

function normalizeOptionalNumber(value: number | null | undefined) {
  return value === null || value === undefined ? null : value;
}

function stringifyRawValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function pickRawObjectString(rawValue: unknown, keys: string[]) {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return '';
  }

  const record = rawValue as Record<string, unknown>;
  const lowerKeyMap = new Map(Object.keys(record).map((key) => [key.toLowerCase(), key]));

  for (const key of keys) {
    const exactValue = stringifyRawValue(record[key]);

    if (exactValue) {
      return exactValue;
    }

    const matchedKey = lowerKeyMap.get(key.toLowerCase());
    const matchedValue = matchedKey ? stringifyRawValue(record[matchedKey]) : '';

    if (matchedValue) {
      return matchedValue;
    }
  }

  return '';
}

function resolveIntegratedTeachingUnitName(
  item: JournalEditableCardItem,
  journal?: LectureJournalReconciliationItem['journal'],
) {
  return (
    pickRawObjectString(journal?.rawJournal, [
      'SSS002NAME',
      'TEACHING_UNIT_NAME',
      'teachingUnitName',
      'TOPIC_NAME',
      'topicName',
    ]) ||
    item.teachingUnitText ||
    item.teachingUnitName ||
    (item.teachingUnitNo === null || item.teachingUnitNo === undefined
      ? ''
      : String(item.teachingUnitNo)) ||
    item.practiceTopicName ||
    item.practiceTeachingChapterContent ||
    item.courseContent ||
    ''
  );
}

function resolveIntegratedLearningObjective(
  item: JournalEditableCardItem,
  journal?: LectureJournalReconciliationItem['journal'],
) {
  return (
    pickRawObjectString(journal?.rawJournal, [
      'LEARNING_OBJECTIVE',
      'LEARNING_TARGET',
      'learningObjective',
      'learningTarget',
      'STUDY_GOAL',
      'studyGoal',
      'TEACHING_CHAPTER_CONTENT',
      'teachingChapterContent',
    ]) ||
    item.teachingUnitTarget ||
    item.learningSessionTarget ||
    item.practiceTeachingChapterContent ||
    ''
  );
}

function resolveIntegratedLearningContent(
  item: JournalEditableCardItem,
  journal?: LectureJournalReconciliationItem['journal'],
) {
  return (
    journal?.courseContent ||
    pickRawObjectString(journal?.rawJournal, [
      'COURSE_CONTENT',
      'courseContent',
      'LEARNING_CONTENT',
      'learningContent',
      'STUDY_CONTENT',
      'studyContent',
    ]) ||
    item.teachingUnitContent ||
    item.learningSessionContent ||
    item.learningTaskText ||
    item.courseContent ||
    ''
  );
}

function resolveIntegratedLearningOutcome(
  item: JournalEditableCardItem,
  journal?: LectureJournalReconciliationItem['journal'],
) {
  return (
    journal?.homeworkAssignment ||
    pickRawObjectString(journal?.rawJournal, [
      'LEARNING_OUTCOME',
      'learningOutcome',
      'STUDY_RESULT',
      'studyResult',
      'HOMEWORK',
      'homeworkAssignment',
    ]) ||
    item.homework ||
    ''
  );
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

function resolveTeachingDateTimestamp(value: string | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(`${value}T00:00:00Z`).getTime();

  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function resolveJournalDetailId(item: JournalEditableCardItem) {
  return item.matchedLectureJournalDetailId || item.journal?.lectureJournalDetailId || undefined;
}

function resolveMinSectionId(sectionId: string | null) {
  const normalizedSectionId = normalizeOptionalString(sectionId || '');

  if (!normalizedSectionId) {
    return undefined;
  }

  const matchedValue = normalizedSectionId.match(/\d+/)?.[0];

  return matchedValue || normalizedSectionId;
}

function resolveMissingSaveFieldLabels(item: JournalEditableCardItem, draft: JournalDraft) {
  const requiredLabels = [
    ['teachingClassId', item.teachingClassId],
    ['teachingDate', item.teachingDate],
    ['weekNumber', item.weekNumber === null ? null : String(item.weekNumber)],
    ['dayOfWeek', item.dayOfWeek === null ? null : String(item.dayOfWeek)],
    ['lessonHours', item.lessonHours === null ? null : String(item.lessonHours)],
  ] satisfies Array<[string, string | null]>;

  const missingLabels = requiredLabels
    .filter(([, value]) => !normalizeOptionalString(value || ''))
    .map(([label]) => label);

  if (isIntegratedCourseCategory(item.courseCategory)) {
    if (!normalizeOptionalString(item.lecturePlanDetailId || '')) {
      missingLabels.push('lecturePlanDetailId');
    }

    return missingLabels;
  }

  if (!normalizeOptionalString(draft.courseContent)) {
    missingLabels.push('courseContent');
  }

  if (!normalizeOptionalString(draft.homeworkAssignment)) {
    missingLabels.push('homeworkAssignment');
  }

  if (isPracticeCourseCategory(item.courseCategory)) {
    return missingLabels;
  }

  if (!normalizeOptionalString(draft.topicRecord)) {
    missingLabels.push('topicRecord');
  }

  if (!normalizeOptionalString(item.sectionId || '')) {
    missingLabels.push('sectionId');
  }

  return missingLabels;
}

function resolveSaveValidationError(item: JournalEditableCardItem, draft: JournalDraft) {
  if (item.blockingIssue) {
    return item.blockingIssue;
  }

  if (isIntegratedCourseCategory(item.courseCategory) && item.status === 'UNMATCHED') {
    return '当前一体化计划项无法可靠匹配。';
  }

  if (!item.canFill) {
    return isIntegratedCourseCategory(item.courseCategory)
      ? '当前一体化计划项尚不能稳定映射。'
      : '当前课次不可保存。';
  }

  const missingLabels = resolveMissingSaveFieldLabels(item, draft);

  if (missingLabels.length > 0) {
    return `缺少必填字段：${missingLabels.join('、')}`;
  }

  if (isPracticeCourseCategory(item.courseCategory)) {
    const practiceHoursTotal =
      (draft.lectureHours || 0) + (draft.practiceHours || 0) + (draft.demonstrationHours || 0);

    if (item.lessonHours !== null && practiceHoursTotal !== item.lessonHours) {
      return `lectureLessons + trainingLessons + exampleLessons 必须等于 lessonHours，当前为 ${practiceHoursTotal} / ${item.lessonHours}`;
    }
  }

  return null;
}

function buildEditableCardItemFromReconciliation(
  item: LectureJournalReconciliationItem,
): JournalEditableCardItem {
  const practicePlanFields = buildPracticePlanFields(item);

  return {
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
}

function buildEditableCardItemFromIntegratedPreview(
  item: AcademicIntegratedTeachingLogPrefillPreview,
): JournalEditableCardItem {
  const resolvedShift = item.shift || DEFAULT_INTEGRATED_SHIFT;

  return {
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
}

function pickNearestFilledJournalTemplate(
  target: JournalEditableCardItem,
  filledItems: JournalEditableCardItem[],
) {
  const candidateGroups = [
    filledItems.filter(
      (item) =>
        Boolean(target.teachingClassId) &&
        item.teachingClassId === target.teachingClassId &&
        item.journal,
    ),
    filledItems.filter(
      (item) => Boolean(target.courseId) && item.courseId === target.courseId && item.journal,
    ),
    filledItems.filter(
      (item) =>
        Boolean(target.courseName) &&
        item.courseName === target.courseName &&
        Boolean(item.journal),
    ),
  ];

  const candidates = candidateGroups.find((group) => group.length > 0) ?? [];

  if (candidates.length === 0) {
    return null;
  }

  const targetTimestamp = resolveTeachingDateTimestamp(target.teachingDate);

  return [...candidates].sort((left, right) => {
    const leftDistance = Math.abs(
      resolveTeachingDateTimestamp(left.teachingDate) - targetTimestamp,
    );
    const rightDistance = Math.abs(
      resolveTeachingDateTimestamp(right.teachingDate) - targetTimestamp,
    );

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return (
      resolveTeachingDateTimestamp(left.teachingDate) -
      resolveTeachingDateTimestamp(right.teachingDate)
    );
  })[0];
}

function buildJournalDrafts(items: JournalEditableCardItem[]): JournalDraftMap {
  const filledItems = items.filter((item) => item.status === 'FILLED' && item.journal);

  return items.reduce<JournalDraftMap>((result, item) => {
    if (item.status === 'FILLED' && item.journal) {
      const isIntegratedCard = isIntegratedCourseCategory(item.courseCategory);

      result[item.key] = {
        completeAndSummary: isIntegratedCard ? item.completeAndSummary || '' : '',
        courseContent: isIntegratedCard
          ? resolveIntegratedLearningContent(item, item.journal)
          : item.journal.courseContent || '',
        demonstrationHours: item.practiceDemonstrationHours,
        disciplineSituation: isIntegratedCard ? item.disciplineSituation || '' : '',
        homeworkAssignment: isIntegratedCard
          ? resolveIntegratedLearningOutcome(item, item.journal)
          : item.journal.homeworkAssignment || '',
        lectureHours: item.practiceLectureHours,
        learningObjective: isIntegratedCard
          ? resolveIntegratedLearningObjective(item, item.journal)
          : '',
        problemAndSolve: isIntegratedCard ? item.problemAndSolve || '' : '',
        practiceHours: item.practicePracticeHours,
        productionProjectTitle: isIntegratedCard
          ? resolveIntegratedTeachingUnitName(item, item.journal)
          : item.practiceTeachingChapterContent || '',
        securityAndMaintain: isIntegratedCard ? item.securityAndMaintain || '' : '',
        shift: isIntegratedCard ? item.shift || DEFAULT_INTEGRATED_SHIFT : '',
        shiftName: isIntegratedCard
          ? resolveShiftName(item.shift || DEFAULT_INTEGRATED_SHIFT) ||
            DEFAULT_INTEGRATED_SHIFT_NAME
          : '',
        submitStatusText: item.journal.statusName || item.journal.statusCode || '',
        topicRecord: item.journal.topicRecord || '',
      };

      return result;
    }

    const template = pickNearestFilledJournalTemplate(item, filledItems);
    const isIntegratedCard = isIntegratedCourseCategory(item.courseCategory);
    const planCourseContent = isPracticeCourseCategory(item.courseCategory)
      ? item.practiceTopicName || ''
      : item.courseContent || '';

    result[item.key] = {
      completeAndSummary: isIntegratedCard ? item.completeAndSummary || '' : '',
      courseContent: isIntegratedCard
        ? ''
        : planCourseContent || template?.journal?.courseContent || '',
      demonstrationHours: item.practiceDemonstrationHours,
      disciplineSituation:
        isPracticeCourseCategory(item.courseCategory) || isIntegratedCard
          ? item.disciplineSituation || ''
          : '',
      homeworkAssignment: isIntegratedCard
        ? ''
        : item.homework || template?.journal?.homeworkAssignment || '',
      lectureHours: item.practiceLectureHours,
      learningObjective: '',
      problemAndSolve: isIntegratedCard ? item.problemAndSolve || '' : '',
      practiceHours: item.practicePracticeHours,
      productionProjectTitle: isIntegratedCard ? '' : item.practiceTeachingChapterContent || '',
      securityAndMaintain: isIntegratedCard
        ? item.securityAndMaintain || ''
        : isPracticeCourseCategory(item.courseCategory)
          ? DEFAULT_SECURITY_AND_MAINTAIN
          : '',
      shift: isIntegratedCard ? item.shift || DEFAULT_INTEGRATED_SHIFT : '',
      shiftName: isIntegratedCard
        ? resolveShiftName(item.shift || DEFAULT_INTEGRATED_SHIFT) || DEFAULT_INTEGRATED_SHIFT_NAME
        : '',
      submitStatusText: isIntegratedCard && item.status === 'FILLED' ? '已填写' : '',
      topicRecord: isIntegratedCard ? '' : template?.journal?.topicRecord || '',
    };

    return result;
  }, {});
}

function buildPlanSnapshot(item: JournalEditableCardItem) {
  return JSON.stringify(
    {
      lecturePlanId: item.lecturePlanId,
      lecturePlanDetailId: item.lecturePlanDetailId,
      status: item.status,
      canFill: item.canFill,
      warnings: item.warnings,
      blockingIssue: item.blockingIssue,
      schoolYear: item.schoolYear,
      semester: item.semester,
      courseCategory: item.courseCategory,
      courseId: item.courseId,
      courseName: item.courseName,
      teachingClassId: item.teachingClassId,
      teachingClassName: item.teachingClassName,
      teacherId: item.teacherId,
      teacherName: item.teacherName,
      teachingDate: item.teachingDate,
      weekNumber: item.weekNumber,
      dayOfWeek: item.dayOfWeek,
      sectionId: item.sectionId,
      sectionName: item.sectionName,
      lessonHours: item.lessonHours,
      expectedOccurrences: item.expectedOccurrences,
      courseContent: item.courseContent,
      homework: item.homework,
      practiceDemonstrationHours: item.practiceDemonstrationHours,
      practiceLectureHours: item.practiceLectureHours,
      practicePracticeHours: item.practicePracticeHours,
      practiceTeachingChapterContent: item.practiceTeachingChapterContent,
      practiceTopicName: item.practiceTopicName,
      learningTaskText: item.learningTaskText,
      learningSessionNo: item.learningSessionNo,
      learningSessionContent: item.learningSessionContent,
      learningSessionTarget: item.learningSessionTarget,
      learningTaskNo: item.learningTaskNo,
      learningTaskName: item.learningTaskName,
      integratedTeachingUnitName: resolveIntegratedTeachingUnitName(item),
      integratedLearningObjective: resolveIntegratedLearningObjective(item),
      integratedLearningContent: resolveIntegratedLearningContent(item),
      integratedLearningOutcome: resolveIntegratedLearningOutcome(item),
      teachingUnitText: item.teachingUnitText,
      teachingUnitNo: item.teachingUnitNo,
      teachingUnitName: item.teachingUnitName,
      teachingUnitTarget: item.teachingUnitTarget,
      teachingUnitContent: item.teachingUnitContent,
      teachingUnitAchievement: item.teachingUnitAchievement,
      shift: item.shift,
      shiftName: item.shiftName,
      problemAndSolve: item.problemAndSolve,
      completeAndSummary: item.completeAndSummary,
      disciplineSituation: item.disciplineSituation,
      securityAndMaintain: item.securityAndMaintain,
    },
    null,
    2,
  );
}

function buildJournalRawSnapshot(rawJournal: unknown) {
  try {
    return JSON.stringify(rawJournal, null, 2);
  } catch {
    return String(rawJournal);
  }
}

function renderMissingPlanSnapshotTrigger(item: JournalEditableCardItem) {
  return (
    <Tooltip
      placement="bottomRight"
      title={
        <div className="lecture-journal-plan-tooltip">
          <div className="lecture-journal-plan-tooltip-title">计划侧返回字段</div>
          <div className="lecture-journal-plan-tooltip-note">
            当前接口未返回 rawPlan /
            rawPlanDetail，这里展示对账结果里的计划侧字段，方便核对未提交项。
          </div>
          <pre>{buildPlanSnapshot(item)}</pre>
        </div>
      }
    >
      <button
        aria-label="查看计划侧原始数据"
        className="lecture-journal-plan-tooltip-trigger"
        type="button"
      >
        !
      </button>
    </Tooltip>
  );
}

function renderJournalRawSnapshotTrigger(item: JournalEditableCardItem) {
  if (!item.journal) {
    return null;
  }

  return (
    <Tooltip
      placement="bottomRight"
      title={
        <div className="lecture-journal-plan-tooltip">
          <div className="lecture-journal-plan-tooltip-title">日志 rawJournal</div>
          <div className="lecture-journal-plan-tooltip-note">
            已匹配日志的上游原始行。一体化的 JOURNAL_TYPE、LECTURE_JOURNAL_DETAIL_ID、 SSS002NAME
            等字段都在这里。
          </div>
          <pre>{buildJournalRawSnapshot(item.journal.rawJournal)}</pre>
        </div>
      }
    >
      <button
        aria-label="查看日志原始数据"
        className="lecture-journal-plan-tooltip-trigger lecture-journal-raw-tooltip-trigger"
        type="button"
      >
        J
      </button>
    </Tooltip>
  );
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
  item: JournalEditableCardItem;
  isSaving: boolean;
  onSave: (item: JournalEditableCardItem, draft: JournalDraft) => void;
  onUpdateDraft: (key: string, patch: JournalDraftPatch) => void;
  draft: JournalDraft;
  saveFeedback?: SaveFeedback;
};

const JournalDraftCard = memo(function JournalDraftCard({
  initialDraft,
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
  const isIntegratedSaveCandidate =
    isIntegratedCard &&
    item.canFill &&
    !item.blockingIssue &&
    item.status !== 'UNMATCHED' &&
    Boolean(normalizeOptionalString(item.lecturePlanDetailId || ''));
  const isIntegratedEditable = isIntegratedSaveCandidate;
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
    ? isIntegratedSaveCandidate
    : item.status === 'MISSING';

  return (
    <article
      className={[
        'lecture-journal-record',
        `lecture-journal-record-${statusTone}`,
        isIntegratedCard ? 'lecture-journal-record-integrated' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
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
            <Tooltip placement="top" title="接口字段：weekNumber">
              <span className="lecture-journal-record-overview-text">{weekLabel}</span>
            </Tooltip>
            {!isIntegratedCard ? (
              <Tooltip placement="top" title="接口字段：dayOfWeek">
                <span className="lecture-journal-record-overview-text">{dayOfWeekLabel}</span>
              </Tooltip>
            ) : null}
            <span className="lecture-journal-record-overview-section-wrap">
              {!isIntegratedCard && !isPracticeCard ? (
                <Tooltip placement="top" title="接口字段：sectionName / sectionId">
                  <span className="lecture-journal-record-overview-text">{sectionLabel}</span>
                </Tooltip>
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
            <Tooltip
              placement="topLeft"
              title={`${item.teachingClassName || '教学班待识别'} / ${item.courseName || '未命名课程'}`}
            >
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
            </Tooltip>
          </div>

          <div className="lecture-journal-record-overview-block lecture-journal-record-overview-block-right">
            {!isIntegratedCard ? (
              <Tooltip placement="top" title="接口字段：teachingDate">
                <span className="lecture-journal-record-meta-item">
                  <span className="lecture-journal-record-meta-label">上课日期：</span>
                  <span className="lecture-journal-record-meta-value">{teachingDateLabel}</span>
                </span>
              </Tooltip>
            ) : null}
            <Tooltip placement="top" title="接口字段：lessonHours">
              <span className="lecture-journal-record-meta-item">
                <span className="lecture-journal-record-meta-label">
                  {isIntegratedCard ? '总课时数：' : '课时数：'}
                </span>
                <span className="lecture-journal-record-meta-value lecture-journal-record-meta-value-accent">
                  {lessonHoursLabel}
                </span>
              </span>
            </Tooltip>
          </div>
        </div>

        <div className="lecture-journal-record-status">
          {isFilled ? renderJournalRawSnapshotTrigger(item) : null}
          {shouldRenderSaveAction ? (
            <>
              {!isIntegratedCard ? renderMissingPlanSnapshotTrigger(item) : null}
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
                <Tooltip placement="top" title={saveButtonTooltip}>
                  <span className="lecture-journal-save-action">
                    <Button
                      disabled={isSaveDisabled}
                      loading={isSaving}
                      onClick={() => {
                        onSave(item, draft);
                      }}
                    >
                      {isIntegratedCard && item.status === 'FILLED'
                        ? '更新至校园网'
                        : '保存至校园网'}
                    </Button>
                  </span>
                </Tooltip>
              </Popover>
            </>
          ) : null}
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
                    <Input placeholder="未填写" readOnly size="large" value={draft.courseContent} />
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
                  fields: ['teachingUnitText', 'teachingUnitNo', 'teachingUnitName', 'SSS002NAME'],
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
                    <Input placeholder="未填写" readOnly size="large" value={draft.courseContent} />
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
  const [reconciliationResult, setReconciliationResult] =
    useState<LectureJournalReconciliationResult | null>(null);
  const [prefillResult, setPrefillResult] = useState<AcademicTeachingLogPrefillResult | null>(null);
  const [resultViewScope, setResultViewScope] = useState<ResultViewScope>('complete');
  const [courseCategoryFilter, setCourseCategoryFilter] = useState<CourseCategoryFilter>('ALL');
  const [isLoadingSemesters, setIsLoadingSemesters] = useState(true);
  const [isLoadingDepartmentOptions, setIsLoadingDepartmentOptions] = useState(true);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [isLoadingReconciliation, setIsLoadingReconciliation] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [departmentOptionsError, setDepartmentOptionsError] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [journalDrafts, setJournalDrafts] = useState<JournalDraftMap>({});
  const [queryError, setQueryError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [savingItemKey, setSavingItemKey] = useState<string | null>(null);
  const [saveFeedbackByKey, setSaveFeedbackByKey] = useState<SaveFeedbackMap>({});

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
  const selectedDepartmentOption = departmentOptions.find(
    (department) => department.id === normalizedDepartmentId,
  );
  const selectedTeacherOption = (directoryResult?.teachers ?? []).find(
    (teacher) => teacher.value === normalizedStaffId,
  );
  const selectedDepartmentLabel =
    selectedDepartmentOption?.label || normalizedDepartmentId || '未指定系部';
  const selectedTeacherLabel = selectedTeacherOption?.name || normalizedStaffId || '全体教师';
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
  const scopedJournalItems = useMemo(() => {
    if (resultViewScope === 'missing') {
      return missingEditableItems;
    }

    if (resultViewScope === 'unmatched') {
      return [];
    }

    return editableItems;
  }, [editableItems, missingEditableItems, resultViewScope]);
  const courseCategoryOptions = useMemo(
    () => buildCourseCategoryFilterOptions(scopedJournalItems),
    [scopedJournalItems],
  );
  const activeCourseCategoryFilter = resolveCourseCategoryFilter(
    courseCategoryOptions,
    courseCategoryFilter,
  );
  const visibleJournalItems = useMemo(
    () => filterItemsByCourseCategory(scopedJournalItems, activeCourseCategoryFilter),
    [activeCourseCategoryFilter, scopedJournalItems],
  );
  const currentResultCount =
    resultViewScope === 'unmatched'
      ? (reconciliationResult?.unmatchedPlanItems.length ?? 0)
      : visibleJournalItems.length;
  const currentCourseCategoryLabel =
    activeCourseCategoryFilter === 'ALL'
      ? '全部课程'
      : resolveCourseCategoryMeta(activeCourseCategoryFilter)?.label || activeCourseCategoryFilter;
  const visibleFilledCount = editableItems.filter((item) => item.status === 'FILLED').length;
  const visibleMissingCount = missingEditableItems.length;
  const reconciliationBaseCount = visibleFilledCount + visibleMissingCount;
  const fillRate =
    reconciliationBaseCount > 0
      ? `${Math.round((visibleFilledCount / reconciliationBaseCount) * 100)}%`
      : '无可对账课次';
  const initialJournalDrafts = useMemo(() => buildJournalDrafts(editableItems), [editableItems]);

  useEffect(() => {
    setJournalDrafts(initialJournalDrafts);
  }, [initialJournalDrafts]);

  const updateJournalDraft = useCallback((key: string, patch: JournalDraftPatch) => {
    setJournalDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? EMPTY_JOURNAL_DRAFT),
        ...patch,
      },
    }));
    setSaveFeedbackByKey((current) => ({
      ...current,
      [key]: undefined,
    }));
  }, []);

  async function handleSaveToCampus(item: JournalEditableCardItem, draft: JournalDraft) {
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
      const commonInput = {
        dayOfWeek: String(item.dayOfWeek),
        lessonHours: item.lessonHours as number,
        teachingClassId: item.teachingClassId as string,
        teachingDate: item.teachingDate as string,
        upstreamSessionToken: session.upstreamSessionToken,
        weekNumber: String(item.weekNumber),
      };

      const result = isIntegratedCourseCategory(item.courseCategory)
        ? await saveAcademicIntegratedTeachingLog({
            ...commonInput,
            completeAndSummary: draft.completeAndSummary,
            disciplineSituation: draft.disciplineSituation,
            lectureJournalDetailId: item.matchedLectureJournalDetailId || undefined,
            lecturePlanDetailId: item.lecturePlanDetailId as string,
            problemAndSolve: draft.problemAndSolve,
            securityAndMaintain: draft.securityAndMaintain,
            shift: draft.shift || item.shift || DEFAULT_INTEGRATED_SHIFT,
          })
        : isPracticeCourseCategory(item.courseCategory)
          ? await saveAcademicPracticeTeachingLog({
              ...commonInput,
              courseContent: draft.courseContent,
              disciplineSituation: draft.disciplineSituation,
              exampleLessons: draft.demonstrationHours ?? 0,
              homeworkAssignment: draft.homeworkAssignment,
              lectureJournalDetailId: resolveJournalDetailId(item),
              lectureLessons: draft.lectureHours ?? 0,
              lecturePlanDetailId: item.lecturePlanDetailId || undefined,
              problemAndSolve: draft.problemAndSolve,
              productionProjectTitle: draft.productionProjectTitle,
              securityAndMaintain: draft.securityAndMaintain,
              shift: draft.shift || item.shift || undefined,
              topicRecord: draft.topicRecord || undefined,
              trainingLessons: draft.practiceHours ?? 0,
            })
          : await saveAcademicTheoryTeachingLog({
              ...commonInput,
              courseContent: draft.courseContent,
              homeworkAssignment: draft.homeworkAssignment,
              lectureJournalDetailId: resolveJournalDetailId(item),
              lecturePlanDetailId: item.lecturePlanDetailId || undefined,
              minSectionId: resolveMinSectionId(item.sectionId),
              sectionId: item.sectionId as string,
              topicRecord: draft.topicRecord,
            });

      if (!result.success) {
        throw new Error(result.msg || '上游未保存成功。');
      }

      const nextSession = persistRollingSession(session, {
        expiresAt: result.expiresAt,
        upstreamSessionToken: result.upstreamSessionToken,
      });

      setSaveFeedbackByKey((current) => ({
        ...current,
        [item.key]: {
          text: result.msg || '教学日志已保存。',
          tone: 'success',
        },
      }));
      await runQueryAction(nextSession);
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
  }

  function renderUnmatchedCard(item: UnmatchedLectureJournalPlanItem) {
    return (
      <article className="lecture-journal-unmatched" key={buildItemKey(item)}>
        <div className="lecture-journal-unmatched-heading">
          <Tag color="default">无法对账</Tag>
          <Typography.Text strong>{item.reason}</Typography.Text>
        </div>
        <div className="lecture-journal-unmatched-grid">
          <Typography.Text type="secondary">计划：{item.lecturePlanId || '缺失'}</Typography.Text>
          <Typography.Text type="secondary">
            详情：{item.lecturePlanDetailId || '缺失'}
          </Typography.Text>
          <Typography.Text type="secondary">
            教学班：{item.teachingClassId || '缺失'}
          </Typography.Text>
        </div>
      </article>
    );
  }

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

    setIsLoadingReconciliation(true);
    setQueryError(null);
    setPrefillResult(null);

    try {
      const result = await fetchLectureJournalReconciliation({
        departmentId: normalizedDepartmentId || undefined,
        schoolYear: String(selectedSemester.schoolYear),
        semester: String(selectedSemester.termNumber),
        sessionToken: session.upstreamSessionToken,
        staffId: normalizedStaffId || undefined,
      });
      const nextPrefillResult = normalizedStaffId
        ? await fetchAcademicTeachingLogPrefillItems({
            departmentId: normalizedDepartmentId || undefined,
            semesterId: selectedSemester.id,
            staffId: normalizedStaffId,
            upstreamSessionToken: result.upstreamSessionToken,
          })
        : null;

      if (nextPrefillResult?.upstreamSessionToken && nextPrefillResult.expiresAt) {
        persistRollingSession(session, {
          expiresAt: nextPrefillResult.expiresAt,
          upstreamSessionToken: nextPrefillResult.upstreamSessionToken,
        });
      } else {
        persistRollingSession(session, {
          expiresAt: result.expiresAt,
          upstreamSessionToken: result.upstreamSessionToken,
        });
      }

      setReconciliationResult(result);
      setPrefillResult(nextPrefillResult);
    } catch (error) {
      if (isExpiredUpstreamSessionError(error)) {
        clearCurrentSession();
        setPendingAction('query');
        setLoginError('upstream 会话已失效，请重新登录后继续。');
        openLoginModal();
        return;
      }

      setQueryError(resolveUpstreamErrorMessage(error, '暂时无法加载教学日志对账结果。'));
    } finally {
      setIsLoadingReconciliation(false);
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
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <JournalDraftCard
              draft={journalDrafts[item.key] ?? EMPTY_JOURNAL_DRAFT}
              initialDraft={initialJournalDrafts[item.key] ?? EMPTY_JOURNAL_DRAFT}
              isSaving={savingItemKey === item.key}
              item={item}
              key={item.key}
              onSave={handleSaveToCampus}
              onUpdateDraft={updateJournalDraft}
              saveFeedback={saveFeedbackByKey[item.key]}
            />
          ))}
        </div>
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

              <div className="flex flex-col gap-2">
                <Typography.Text strong>当前筛选</Typography.Text>
                <div className="lecture-journal-filter-summary">
                  <Typography.Text strong>{selectedSemester?.name || '未选择学期'}</Typography.Text>
                  <Typography.Text type="secondary">{selectedTeacherLabel}</Typography.Text>
                  <Typography.Text type="secondary">{selectedDepartmentLabel}</Typography.Text>
                </div>
              </div>
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
                disabled={!selectedSemester || hasFilterPairMismatch}
                loading={isLoadingReconciliation}
                onClick={() => {
                  void runQueryAction();
                }}
              >
                查询对账
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

      {isLoadingReconciliation ? <Skeleton active paragraph={{ rows: 8 }} /> : null}

      {!isLoadingReconciliation && reconciliationResult ? (
        <div className="flex flex-col gap-6">
          <div className="lecture-journal-metric-grid">
            {renderMetricTile({
              label: '已填写',
              tone: 'success',
              value: visibleFilledCount,
            })}
            {renderMetricTile({
              label: '疑似未填',
              tone: 'warning',
              value: visibleMissingCount,
            })}
            {renderMetricTile({
              label: '无法对账',
              value: reconciliationResult.unmatchedPlanItemCount,
            })}
            {renderMetricTile({
              detail: `详情 ${reconciliationResult.planDetailCount}`,
              label: '计划',
              value: reconciliationResult.planCount,
            })}
            {renderMetricTile({
              label: '教学日志',
              value: reconciliationResult.journalCount,
            })}
            {renderMetricTile({
              detail: '不含无法对账项',
              label: '填写率',
              value: fillRate,
            })}
          </div>

          <section className="lecture-journal-result-summary">
            <Descriptions column={3} size="small">
              <Descriptions.Item label="学期">
                {selectedSemester?.name || '未选择'}
              </Descriptions.Item>
              <Descriptions.Item label="教师">{selectedTeacherLabel}</Descriptions.Item>
              <Descriptions.Item label="departmentId">{selectedDepartmentLabel}</Descriptions.Item>
              <Descriptions.Item label="返回条数">
                完整 {editableItems.length} / 未填 {missingEditableItems.length}
              </Descriptions.Item>
              <Descriptions.Item label="会话续期">
                {formatDateTime(reconciliationResult.expiresAt)}
              </Descriptions.Item>
              <Descriptions.Item label="对账顺序">按时间升序</Descriptions.Item>
            </Descriptions>
          </section>

          <div className="lecture-journal-view-shell">
            <section className="lecture-journal-view-controls">
              <div className="lecture-journal-view-controls-head">
                <div className="lecture-journal-view-controls-copy">
                  <Typography.Text strong>结果视图</Typography.Text>
                  <Typography.Text type="secondary">
                    状态与课程类型是两组平级筛选，下面始终只有一个结果列表。
                  </Typography.Text>
                </div>
                <div className="lecture-journal-view-current">
                  <Typography.Text type="secondary">当前展示</Typography.Text>
                  <Typography.Text strong>{currentResultCount}</Typography.Text>
                  <Typography.Text type="secondary">条</Typography.Text>
                </div>
              </div>

              <div className="lecture-journal-view-filter-grid">
                <div className="lecture-journal-view-filter-block">
                  <div className="lecture-journal-view-filter-label">
                    <Typography.Text strong>状态视图</Typography.Text>
                  </div>
                  <div className="lecture-journal-view-segmented">
                    <Segmented
                      block
                      options={[
                        {
                          label: (
                            <span className="lecture-journal-view-option">
                              <span>完整对账</span>
                              <strong>{editableItems.length}</strong>
                            </span>
                          ),
                          value: 'complete',
                        },
                        {
                          label: (
                            <span className="lecture-journal-view-option">
                              <span>疑似未填</span>
                              <strong>{missingEditableItems.length}</strong>
                            </span>
                          ),
                          value: 'missing',
                        },
                        {
                          label: (
                            <span className="lecture-journal-view-option">
                              <span>无法对账</span>
                              <strong>{reconciliationResult.unmatchedPlanItems.length}</strong>
                            </span>
                          ),
                          value: 'unmatched',
                        },
                      ]}
                      size="large"
                      value={resultViewScope}
                      onChange={(value) => {
                        setResultViewScope(value as ResultViewScope);
                      }}
                    />
                  </div>
                </div>

                <div className="lecture-journal-view-filter-block">
                  <div className="lecture-journal-view-filter-label">
                    <Typography.Text strong>课程类型</Typography.Text>
                  </div>
                  {resultViewScope === 'unmatched' ? (
                    <div className="lecture-journal-view-filter-disabled">
                      <Typography.Text type="secondary">
                        无法对账项暂不区分课程类型。
                      </Typography.Text>
                    </div>
                  ) : (
                    <div className="lecture-journal-view-segmented lecture-journal-view-segmented-category">
                      <Segmented
                        block
                        options={courseCategoryOptions.map((option) => ({
                          label: (
                            <span className="lecture-journal-view-option">
                              <span>{option.label}</span>
                              <strong>{option.count}</strong>
                            </span>
                          ),
                          value: option.key,
                        }))}
                        size="large"
                        value={activeCourseCategoryFilter}
                        onChange={(value) => {
                          setCourseCategoryFilter(value as CourseCategoryFilter);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="lecture-journal-view-stage">
              <div className="lecture-journal-view-stage-header">
                <div className="lecture-journal-view-stage-copy">
                  <Typography.Title level={5} style={{ margin: 0 }}>
                    {resolveResultViewScopeLabel(resultViewScope)}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {resultViewScope === 'unmatched'
                      ? '当前展示无法稳定建立计划与日志对应关系的计划项。'
                      : `当前按 ${currentCourseCategoryLabel} 查看该状态下的课次。`}
                  </Typography.Text>
                </div>
                <div className="lecture-journal-view-stage-tags">
                  <Tag bordered={false}>{resolveResultViewScopeLabel(resultViewScope)}</Tag>
                  {resultViewScope !== 'unmatched' ? (
                    <Tag bordered={false}>{currentCourseCategoryLabel}</Tag>
                  ) : null}
                </div>
              </div>

              {resultViewScope === 'unmatched' ? (
                reconciliationResult.unmatchedPlanItems.length === 0 ? (
                  <Empty
                    description="当前查询没有无法对账的计划项。"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    {reconciliationResult.unmatchedPlanItems.map((item) =>
                      renderUnmatchedCard(item),
                    )}
                  </div>
                )
              ) : visibleJournalItems.length === 0 ? (
                <Empty
                  description={
                    resultViewScope === 'missing'
                      ? '当前筛选下没有疑似未填课次。'
                      : '当前筛选下没有可展示课次。'
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                renderJournalCardList(visibleJournalItems)
              )}
            </section>
          </div>
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
