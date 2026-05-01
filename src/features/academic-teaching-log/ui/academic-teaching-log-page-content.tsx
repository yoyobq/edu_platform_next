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
  CheckOutlined,
  FormOutlined,
  SearchOutlined,
  SwapOutlined,
  UserOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import {
  Alert,
  AutoComplete,
  Button,
  Collapse,
  Empty,
  Form,
  Input,
  InputNumber,
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
import {
  type StoredUpstreamSession,
  type UpstreamLoginFormValues,
  UpstreamLoginModal,
  useUpstreamSession,
} from '@/entities/upstream-session';

import {
  readVerifiedStaffIdentity,
  type StaffDirectoryEntry,
  type StaffDirectoryResult,
  type VerifiedStaffIdentityResult,
} from '@/shared/upstream';

import {
  isIntegratedCourseCategory,
  isPracticeCourseCategory,
} from '../application/course-category';
import {
  buildEditableCardItemFromIntegratedPreview,
  buildEditableCardItemFromReconciliation,
  type JournalEditableCardItem,
} from '../application/editable-item-mapper';
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
} from '../application/journal-draft-policy';
import {
  initialLectureJournalQueryState,
  lectureJournalQueryReducer,
} from '../application/query-state';
import { runLectureJournalReconciliationQueryWorkflow } from '../application/query-workflow';
import {
  resolveSaveValidationError,
  runLectureJournalSaveWorkflow,
} from '../application/save-workflow';
import { resolveLectureJournalStaffDirectory } from '../application/staff-directory-cache-workflow';
import { isFutureTeachingDate } from '../application/teaching-date';
import {
  type AcademicTeachingLogPrefillResult,
  type AcademicTeachingLogSaveResult,
  type LectureJournalExpectedOccurrence,
  type LectureJournalReconciliationItem,
} from '../application/types';
import {
  buildCourseCategoryFilterOptions,
  buildResultViewScopeOptions,
  type CourseCategoryFilter,
  filterItemsByCourseCategory,
  filterItemsByFutureCourseVisibility,
  type FutureCourseVisibility,
  pickJournalItemsByResultViewScope,
  resolveCourseCategoryFilter,
  resolveResultViewScope,
  resolveResultViewScopeTitle,
  type ResultViewScope,
} from '../application/view-filter-policy';
import {
  fetchAcademicTeachingLogPrefillItems,
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
  saveAcademicIntegratedTeachingLog,
  saveAcademicPracticeTeachingLog,
  saveAcademicTheoryTeachingLog,
} from '../infrastructure/academic-teaching-log-api';

import './academic-teaching-log-page-content.css';

export type AcademicTeachingLogPageLoaderData = {
  defaultStaffId?: string | null;
  upstreamAccount?: {
    accountId: number;
    displayName: string;
  } | null;
  viewerRole?: 'admin' | 'authenticated' | 'staff';
} | null;

type PendingAction = 'query' | null;

const DAY_OF_WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const TOPIC_RECORD_OPTIONS = ['优', '良', '正常', '一般'];
const TOPIC_RECORD_VISUAL_DEFAULT = TOPIC_RECORD_OPTIONS[0];
const SAVED_CARD_COLLAPSE_DURATION_MS = 240;
const INTEGRATED_JOURNAL_OCCURRENCE_MISMATCH = 'INTEGRATED_JOURNAL_OCCURRENCE_MISMATCH';
const UPSTREAM_STAFF_SCOPE_MISMATCH = 'UPSTREAM_STAFF_SCOPE_MISMATCH';
const UPSTREAM_SESSION_STAFF_MISMATCH = 'UPSTREAM_SESSION_STAFF_MISMATCH';
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

function pickNextSemesterId(
  records: AcademicSemesterRecord[],
  currentSelection: number | null,
  options: { canKeepCurrentSelection: boolean },
) {
  if (
    options.canKeepCurrentSelection &&
    currentSelection !== null &&
    records.some((record) => record.id === currentSelection)
  ) {
    return currentSelection;
  }

  return records.find((record) => record.isCurrent)?.id ?? records[0]?.id ?? null;
}

function normalizeOptionalString(value: string) {
  const normalizedValue = value.trim();

  return normalizedValue ? normalizedValue : '';
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

function waitForNextPaint() {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 0);
    });
  });
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

function buildTeacherOptionLabel(teacher: StaffDirectoryEntry) {
  return `${teacher.staffId} ${teacher.name}`;
}

function isIntegratedOccurrenceMismatchText(value: string | null | undefined) {
  return Boolean(value?.includes(INTEGRATED_JOURNAL_OCCURRENCE_MISMATCH));
}

function resolveLectureJournalIssueMessage(value: string | null) {
  if (value === UPSTREAM_STAFF_SCOPE_MISMATCH) {
    return '当前上游会话无法获取该教师的教学计划，或上游返回的计划负责人不匹配。';
  }

  if (value === UPSTREAM_SESSION_STAFF_MISMATCH) {
    return '当前校园网登录用户与查询教师不一致，本次按所选教师展示对账结果。';
  }

  return value;
}

function hasIntegratedOccurrenceMismatchIssue(item: JournalEditableCardItem) {
  return (
    isIntegratedCourseCategory(item.courseCategory) &&
    (isIntegratedOccurrenceMismatchText(item.blockingIssue) ||
      item.warnings.some((warning) => isIntegratedOccurrenceMismatchText(warning)))
  );
}

function resolveVisibleWarnings(item: JournalEditableCardItem, resultViewScope: ResultViewScope) {
  if (resultViewScope === 'unmatched') {
    return item.warnings;
  }

  return item.warnings.filter((warning) => !isIntegratedOccurrenceMismatchText(warning));
}

function resolveVisibleBlockingIssue(
  item: JournalEditableCardItem,
  resultViewScope: ResultViewScope,
) {
  if (resultViewScope === 'unmatched') {
    return resolveLectureJournalIssueMessage(item.blockingIssue);
  }

  return isIntegratedOccurrenceMismatchText(item.blockingIssue)
    ? null
    : resolveLectureJournalIssueMessage(item.blockingIssue);
}

function resolvePageLevelPrefillWarnings(warnings: string[]) {
  return warnings
    .filter((warning) => !isIntegratedOccurrenceMismatchText(warning))
    .map((warning) => resolveLectureJournalIssueMessage(warning) ?? warning);
}

function resolvePageLevelPrefillBlockingIssue(blockingIssue: string | null) {
  return isIntegratedOccurrenceMismatchText(blockingIssue)
    ? null
    : resolveLectureJournalIssueMessage(blockingIssue);
}

function resolveFillAvailabilityIssue(
  prefillResult: AcademicTeachingLogPrefillResult | null,
  pageLevelBlockingIssue: string | null,
  pageLevelWarnings: string[],
) {
  if (!prefillResult) {
    return null;
  }

  if (pageLevelBlockingIssue) {
    return pageLevelBlockingIssue;
  }

  const hasOnlyOccurrenceMismatchWarnings =
    prefillResult.warnings.length > 0 && pageLevelWarnings.length === 0;
  const hasOnlyOccurrenceMismatchBlockingIssue =
    Boolean(prefillResult.blockingIssue) && !pageLevelBlockingIssue;

  if (
    !prefillResult.canFill &&
    !hasOnlyOccurrenceMismatchWarnings &&
    !hasOnlyOccurrenceMismatchBlockingIssue &&
    (pageLevelWarnings.length > 0 || prefillResult.warnings.length === 0)
  ) {
    return '当前填写前检查未通过。';
  }

  return null;
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
  fillAvailabilityIssue?: string | null;
  initialDraft: JournalDraft;
  isCollapsing?: boolean;
  item: JournalEditableCardItem;
  isSaving: boolean;
  onSave: (item: JournalEditableCardItem, draft: JournalDraft) => void;
  onUpdateDraft: (key: string, patch: JournalDraftPatch) => void;
  draft: JournalDraft;
  saveFeedback?: SaveFeedback;
  visibleBlockingIssue?: string | null;
  visibleWarnings?: string[];
};

const JournalDraftCard = memo(function JournalDraftCard({
  fillAvailabilityIssue,
  initialDraft,
  isCollapsing = false,
  isSaving,
  item,
  onSave,
  onUpdateDraft,
  draft,
  saveFeedback,
  visibleBlockingIssue = item.blockingIssue,
  visibleWarnings = item.warnings,
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
    !hasIntegratedOccurrenceMismatchIssue(item) &&
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
  const saveValidationError = fillAvailabilityIssue ?? resolveSaveValidationError(item, draft);
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
    ? saveValidationError.startsWith('不可保存')
      ? saveValidationError
      : `不可保存：${saveValidationError}`
    : visibleWarnings.length > 0
      ? `可保存；提示：${visibleWarnings.join('；')}`
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
                  icon={<FormOutlined />}
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
            <span className="lecture-journal-record-meta-item lecture-journal-record-meta-item-hours">
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
      (visibleBlockingIssue ||
        visibleWarnings.length > 0 ||
        item.expectedOccurrences.length > 0) ? (
        <div className="lecture-journal-integrated-state">
          {visibleBlockingIssue ? (
            <Alert message={`阻塞原因：${visibleBlockingIssue}`} showIcon type="error" />
          ) : null}
          {visibleWarnings.length > 0 ? (
            <Alert
              message={
                <span className="lecture-journal-integrated-warning-text">
                  {visibleWarnings.map((warning) => (
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
                      <Input.TextArea
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        placeholder="未填写"
                        readOnly
                        size="large"
                        value={draft.courseContent}
                      />
                    </span>
                  ) : (
                    <Input.TextArea
                      autoSize={{ minRows: 1, maxRows: 4 }}
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
                      <Input.TextArea
                        autoSize={{ minRows: 1, maxRows: 4 }}
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
                    <Input.TextArea
                      autoSize={{ minRows: 1, maxRows: 4 }}
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

export function AcademicTeachingLogPageContent() {
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const loaderData = useLoaderData() as AcademicTeachingLogPageLoaderData;
  const liveUpstreamAccount = loaderData?.upstreamAccount ?? null;
  const liveDefaultStaffId = loaderData?.defaultStaffId ?? null;
  const viewerRole = loaderData?.viewerRole ?? 'authenticated';
  const isAdminViewer = viewerRole === 'admin';
  const isStaffViewer = viewerRole === 'staff';
  const {
    clear,
    keepAliveFailure,
    login: loginUpstream,
    persistSessionFromResult,
    session: storedSession,
  } = useUpstreamSession({
    account: liveUpstreamAccount,
    keepAlive: true,
  });
  const storedSessionRef = useRef<StoredUpstreamSession | null>(storedSession);
  const storedSessionDirectoryKey = storedSession
    ? [
        storedSession.accountId,
        storedSession.expiresAt,
        storedSession.upstreamLoginId,
        storedSession.upstreamSessionToken,
      ].join(':')
    : 'none';
  const storedSessionIdentityKey = storedSession
    ? [storedSession.accountId, storedSession.upstreamLoginId || 'unknown'].join(':')
    : 'none';
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState(liveDefaultStaffId ?? '');
  const [staffDirectoryResult, setStaffDirectoryResult] = useState<StaffDirectoryResult | null>(
    null,
  );
  const [queryState, dispatchQueryState] = useReducer(
    lectureJournalQueryReducer,
    initialLectureJournalQueryState,
  );
  const { isLoadingReconciliation, prefillResult, queryError } = queryState;
  const reconciliationResult = prefillResult?.reconciliation ?? null;
  const [resultViewScope, setResultViewScope] = useState<ResultViewScope>('missing');
  const [courseCategoryFilter, setCourseCategoryFilter] = useState<CourseCategoryFilter>('ALL');
  const [futureCourseVisibility, setFutureCourseVisibility] =
    useState<FutureCourseVisibility>('hide');
  const [isLoadingSemesters, setIsLoadingSemesters] = useState(true);
  const [isLoadingStaffDirectory, setIsLoadingStaffDirectory] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRestoringDefaultStaffId, setIsRestoringDefaultStaffId] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [staffDirectoryError, setStaffDirectoryError] = useState<string | null>(null);
  const [upstreamIdentity, setUpstreamIdentity] = useState<VerifiedStaffIdentityResult | null>(
    null,
  );
  const [upstreamIdentityWarning, setUpstreamIdentityWarning] = useState<string | null>(null);
  const [
    hasAcknowledgedSessionStaffMismatchWarning,
    setHasAcknowledgedSessionStaffMismatchWarning,
  ] = useState(false);
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
  const activeStaffDirectoryRequestIdRef = useRef(0);
  const initialJournalDraftsRef = useRef<JournalDraftMap>({});
  const isQueryInFlightRef = useRef(false);
  const cardItemElementsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const savedCardCollapseAnimationFramesRef = useRef<Record<string, number>>({});
  const savedCardCollapseTimeoutsRef = useRef<Record<string, number>>({});

  const clearCurrentSession = useCallback(() => {
    clear();
  }, [clear]);

  const openLoginModal = useCallback(() => {
    if (!liveUpstreamAccount) {
      return;
    }

    setLoginError(null);
    loginForm.setFieldsValue({
      password: '',
      userId: storedSession?.upstreamLoginId ?? '',
    });
    setIsLoginModalOpen(true);
  }, [liveUpstreamAccount, loginForm, storedSession?.upstreamLoginId]);

  useEffect(() => {
    storedSessionRef.current = storedSession;
  }, [storedSession]);

  const persistSessionFromVerifiedIdentity = useCallback(
    (session: StoredUpstreamSession, identity: VerifiedStaffIdentityResult) => {
      if (identity.upstreamSessionToken === session.upstreamSessionToken) {
        return session;
      }

      return persistSessionFromResult(session, identity);
    },
    [persistSessionFromResult],
  );

  useEffect(() => {
    let cancelled = false;

    setUpstreamIdentity(null);

    const session = storedSessionRef.current;

    if (!session) {
      return () => {
        cancelled = true;
      };
    }

    const activeSession = session;

    async function loadUpstreamIdentity() {
      try {
        const identity = await readVerifiedStaffIdentity({
          sessionToken: activeSession.upstreamSessionToken,
        });

        if (cancelled) {
          return;
        }

        setUpstreamIdentity(identity);
        persistSessionFromVerifiedIdentity(activeSession, identity);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setUpstreamIdentity(null);

        if (isExpiredUpstreamSessionError(error)) {
          clearCurrentSession();
        }
      }
    }

    void loadUpstreamIdentity();

    return () => {
      cancelled = true;
    };
  }, [clearCurrentSession, persistSessionFromVerifiedIdentity, storedSessionIdentityKey]);

  useEffect(() => {
    if (!keepAliveFailure) {
      return;
    }

    clearCurrentSession();
    setPendingAction(null);
    setLoginError(keepAliveFailure.message);
    loginForm.setFieldsValue({
      password: '',
      userId: keepAliveFailure.upstreamLoginId ?? '',
    });
    setIsLoginModalOpen(true);
  }, [clearCurrentSession, keepAliveFailure, loginForm]);

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
      setSemesterError(null);

      try {
        const nextSemesters = sortSemesters(await requestAcademicSemesters({ limit: 500 }));

        if (cancelled) {
          return;
        }

        setSemesters(nextSemesters);
        setSelectedSemesterId((currentSelection) =>
          pickNextSemesterId(nextSemesters, currentSelection, {
            canKeepCurrentSelection: isAdminViewer,
          }),
        );
      } catch (error) {
        if (!cancelled) {
          setSemesterError(error instanceof Error ? error.message : '暂时无法加载学期列表。');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSemesters(false);
        }
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [isAdminViewer]);

  useEffect(() => {
    if (isStaffViewer) {
      const fixedStaffId = liveDefaultStaffId ?? '';

      if (staffId !== fixedStaffId) {
        setStaffId(fixedStaffId);
      }

      return;
    }

    if (!staffId && liveDefaultStaffId) {
      setStaffId(liveDefaultStaffId);
    }
  }, [isStaffViewer, liveDefaultStaffId, staffId]);

  useEffect(() => {
    setUpstreamIdentityWarning(null);
    setHasAcknowledgedSessionStaffMismatchWarning(false);
  }, [staffId, storedSessionDirectoryKey]);

  const loadStaffDirectoryForAdmin = useCallback(
    async (session: StoredUpstreamSession | null) => {
      if (!isAdminViewer) {
        return null;
      }

      const requestId = activeStaffDirectoryRequestIdRef.current + 1;

      activeStaffDirectoryRequestIdRef.current = requestId;
      setIsLoadingStaffDirectory(true);
      setStaffDirectoryError(null);

      try {
        const outcome = await resolveLectureJournalStaffDirectory({
          currentDirectory: staffDirectoryResult,
          persistSessionFromResult,
          session,
          viewerRole,
        });

        if (activeStaffDirectoryRequestIdRef.current !== requestId) {
          return outcome;
        }

        setStaffDirectoryResult(outcome.directory);
        return outcome;
      } catch (error) {
        if (activeStaffDirectoryRequestIdRef.current === requestId) {
          setStaffDirectoryError(resolveUpstreamErrorMessage(error, '暂时无法加载教师目录。'));
        }

        return null;
      } finally {
        if (activeStaffDirectoryRequestIdRef.current === requestId) {
          setIsLoadingStaffDirectory(false);
        }
      }
    },
    [isAdminViewer, persistSessionFromResult, staffDirectoryResult, viewerRole],
  );

  const ensureStaffDirectoryForAdmin = useCallback(
    async (session: StoredUpstreamSession) => {
      if (!isAdminViewer) {
        return session;
      }

      const outcome = await loadStaffDirectoryForAdmin(session);

      return outcome?.session ?? session;
    },
    [isAdminViewer, loadStaffDirectoryForAdmin],
  );

  const ensureSelectedStaffUpstreamSession = useCallback(
    async (
      session: StoredUpstreamSession,
      selectedStaffId: string,
      options: { action: 'query' | 'save' },
    ) => {
      const identity = await readVerifiedStaffIdentity({
        sessionToken: session.upstreamSessionToken,
      });
      setUpstreamIdentity(identity);
      const nextSession = persistSessionFromVerifiedIdentity(session, identity);
      const upstreamStaffId = identity.personId.trim();

      if (upstreamStaffId && upstreamStaffId !== selectedStaffId) {
        const selectedTeacher = staffDirectoryResult?.teachers.find(
          (teacher) => teacher.staffId === selectedStaffId,
        );
        const selectedTeacherLabel = selectedTeacher
          ? `${selectedTeacher.staffId} ${selectedTeacher.name}`
          : selectedStaffId;
        const message = `当前校园网登录用户是 ${identity.personId} ${identity.personName}，与选择的教师 ${selectedTeacherLabel} 不一致。`;

        if (isStaffViewer) {
          setPendingAction(options.action === 'query' ? 'query' : null);
          setLoginError(`${message}请重新连接本人校园网账号后继续。`);
          openLoginModal();
          return null;
        }

        setUpstreamIdentityWarning(`${message}管理员可继续查询和保存，请确认这是预期操作。`);
        return {
          isMismatch: true,
          session: nextSession,
        };
      }

      setUpstreamIdentityWarning(null);
      return {
        isMismatch: false,
        session: nextSession,
      };
    },
    [
      isStaffViewer,
      openLoginModal,
      persistSessionFromVerifiedIdentity,
      staffDirectoryResult?.teachers,
    ],
  );

  const restoreDefaultStaffId = useCallback(async () => {
    if (!isAdminViewer) {
      return;
    }

    if (isRestoringDefaultStaffId) {
      return;
    }

    const profileStaffId = liveDefaultStaffId ?? '';
    const session = storedSessionRef.current;

    if (!session) {
      setStaffId(profileStaffId);
      return;
    }

    setIsRestoringDefaultStaffId(true);
    setStaffDirectoryError(null);

    try {
      const identity = await readVerifiedStaffIdentity({
        sessionToken: session.upstreamSessionToken,
      });
      setUpstreamIdentity(identity);
      persistSessionFromVerifiedIdentity(session, identity);

      const upstreamStaffId = normalizeOptionalString(identity.personId);

      if (upstreamStaffId) {
        setStaffId(upstreamStaffId);
        return;
      }

      setStaffId(profileStaffId);
    } catch (error) {
      if (isExpiredUpstreamSessionError(error)) {
        clearCurrentSession();
        setStaffId(profileStaffId);
        setUpstreamIdentityWarning('教务系统连接已失效，已恢复为当前登录账号资料中的教师 ID。');
        return;
      }

      setStaffDirectoryError(
        resolveUpstreamErrorMessage(error, '暂时无法读取校园网登录用户身份。'),
      );
    } finally {
      setIsRestoringDefaultStaffId(false);
    }
  }, [
    clearCurrentSession,
    isAdminViewer,
    isRestoringDefaultStaffId,
    liveDefaultStaffId,
    persistSessionFromVerifiedIdentity,
  ]);

  useEffect(() => {
    if (!isAdminViewer) {
      setStaffDirectoryResult(null);
      setStaffDirectoryError(null);
      setIsLoadingStaffDirectory(false);
      return;
    }

    void loadStaffDirectoryForAdmin(storedSessionRef.current);
  }, [isAdminViewer, loadStaffDirectoryForAdmin, storedSessionDirectoryKey]);

  const selectedSemester = semesters.find((record) => record.id === selectedSemesterId) ?? null;
  const normalizedStaffId = normalizeOptionalString(staffId);
  const hasMissingStaffFilter = !normalizedStaffId;
  const isLocalAccountReady = Boolean(liveUpstreamAccount);
  const canRestoreDefaultStaffId = Boolean(storedSession || liveDefaultStaffId);
  const upstreamIdentityLabel = upstreamIdentity
    ? upstreamIdentity.personName || '未命名'
    : storedSession
      ? '正在确认校园网身份'
      : '未连接校园网';
  const teacherOptions = (staffDirectoryResult?.teachers ?? []).map((teacher) => ({
    label: buildTeacherOptionLabel(teacher),
    value: teacher.staffId,
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
    () =>
      editableItems.filter(
        (item) => item.status === 'MISSING' && !hasIntegratedOccurrenceMismatchIssue(item),
      ),
    [editableItems],
  );
  const presentedMissingEditableItems = useMemo(() => {
    const transitionSavedItemKeys = [...settlingSavedItemKeys, ...collapsingSavedItemKeys];

    if (transitionSavedItemKeys.length === 0) {
      return missingEditableItems;
    }

    const transitionSavedItemKeySet = new Set(transitionSavedItemKeys);

    return editableItems.filter(
      (item) =>
        (item.status === 'MISSING' && !hasIntegratedOccurrenceMismatchIssue(item)) ||
        transitionSavedItemKeySet.has(item.key),
    );
  }, [collapsingSavedItemKeys, editableItems, missingEditableItems, settlingSavedItemKeys]);
  const unmatchedEditableItems = useMemo(
    () =>
      editableItems.filter(
        (item) => item.status === 'UNMATCHED' || hasIntegratedOccurrenceMismatchIssue(item),
      ),
    [editableItems],
  );
  const dateVisibleEditableItems = useMemo(() => {
    return filterItemsByFutureCourseVisibility(editableItems, futureCourseVisibility);
  }, [editableItems, futureCourseVisibility]);
  const dateVisiblePresentedMissingEditableItems = useMemo(() => {
    return filterItemsByFutureCourseVisibility(
      presentedMissingEditableItems,
      futureCourseVisibility,
    );
  }, [futureCourseVisibility, presentedMissingEditableItems]);
  const dateVisibleUnmatchedEditableItems = useMemo(() => {
    return filterItemsByFutureCourseVisibility(unmatchedEditableItems, futureCourseVisibility);
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
    return filterItemsByFutureCourseVisibility(rawScopedJournalItems, futureCourseVisibility);
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
  const pageLevelPrefillWarnings = prefillResult
    ? resolvePageLevelPrefillWarnings(prefillResult.warnings)
    : [];
  const visiblePageLevelPrefillWarnings = prefillResult
    ? resolvePageLevelPrefillWarnings(
        prefillResult.warnings.filter((warning) => warning !== UPSTREAM_SESSION_STAFF_MISMATCH),
      )
    : [];
  const hasSessionStaffMismatchWarning = Boolean(
    prefillResult?.warnings.includes(UPSTREAM_SESSION_STAFF_MISMATCH),
  );
  const sessionStaffMismatchWarningMessage =
    upstreamIdentityWarning ||
    (hasSessionStaffMismatchWarning
      ? resolveLectureJournalIssueMessage(UPSTREAM_SESSION_STAFF_MISMATCH)
      : null);
  const pageLevelPrefillBlockingIssue = prefillResult
    ? resolvePageLevelPrefillBlockingIssue(prefillResult.blockingIssue)
    : null;
  const fillAvailabilityIssue = resolveFillAvailabilityIssue(
    prefillResult,
    pageLevelPrefillBlockingIssue,
    pageLevelPrefillWarnings,
  );
  const sessionStaffMismatchAcknowledgementIssue =
    hasSessionStaffMismatchWarning && !hasAcknowledgedSessionStaffMismatchWarning
      ? '不可保存，点击上方警告信息中的我已知晓按钮解锁'
      : null;
  const cardFillAvailabilityIssue =
    fillAvailabilityIssue ?? sessionStaffMismatchAcknowledgementIssue;
  const hasControlAlerts = Boolean(semesterError || staffDirectoryError || hasMissingStaffFilter);

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
            text: '请先登录校园网后再保存。',
            tone: 'error',
          },
        }));
        setPendingAction(null);
        setLoginError(null);
        openLoginModal();
        return;
      }

      if (cardFillAvailabilityIssue) {
        setSaveFeedbackByKey((current) => ({
          ...current,
          [item.key]: {
            text: cardFillAvailabilityIssue,
            tone: 'error',
          },
        }));
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
        const scopedSessionResult = await ensureSelectedStaffUpstreamSession(
          session,
          normalizeOptionalString(item.teacherId || normalizedStaffId),
          { action: 'save' },
        );

        if (!scopedSessionResult) {
          setSaveFeedbackByKey((current) => ({
            ...current,
            [item.key]: {
              text: '校园网登录用户与当前教师不一致，请重新连接后再保存。',
              tone: 'error',
            },
          }));
          return;
        }

        const { result } = await runLectureJournalSaveWorkflow({
          draft,
          item,
          persistSessionFromResult,
          saveAcademicIntegratedTeachingLog,
          saveAcademicPracticeTeachingLog,
          saveAcademicTheoryTeachingLog,
          session: scopedSessionResult.session,
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
              text: '教务系统连接已失效，请重新连接后重新保存。',
              tone: 'error',
            },
          }));
          setPendingAction(null);
          setLoginError('教务系统连接已失效，请重新连接后重新保存。');
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
      persistSessionFromResult,
      activeResultViewScope,
      cardFillAvailabilityIssue,
      startSavedCardCollapse,
      storedSession,
      ensureSelectedStaffUpstreamSession,
      normalizedStaffId,
    ],
  );

  async function runQueryAction(sessionOverride?: StoredUpstreamSession) {
    const session = sessionOverride ?? storedSession;

    if (!session) {
      setPendingAction('query');
      setLoginError(null);
      openLoginModal();
      return;
    }

    if (!selectedSemester || !normalizedStaffId) {
      return;
    }

    if (isQueryInFlightRef.current) {
      return;
    }

    const requestId = activeQueryRequestIdRef.current + 1;

    activeQueryRequestIdRef.current = requestId;
    isQueryInFlightRef.current = true;
    dispatchQueryState({ type: 'started' });
    setHasAcknowledgedSessionStaffMismatchWarning(false);
    setJournalDrafts({});
    setSaveFeedbackByKey({});
    setSettlingSavedItemKeys([]);
    setCollapsingSavedItemKeys([]);
    setCollapsingSavedItemHeights({});

    try {
      await waitForNextPaint();

      if (activeQueryRequestIdRef.current !== requestId) {
        return;
      }

      const directorySession = await ensureStaffDirectoryForAdmin(session);

      if (activeQueryRequestIdRef.current !== requestId) {
        return;
      }

      const scopedSessionResult = await ensureSelectedStaffUpstreamSession(
        directorySession,
        normalizedStaffId,
        { action: 'query' },
      );

      if (!scopedSessionResult || activeQueryRequestIdRef.current !== requestId) {
        return;
      }

      const result = await runLectureJournalReconciliationQueryWorkflow({
        fetchAcademicTeachingLogPrefillItems,
        isCurrent: () => activeQueryRequestIdRef.current === requestId,
        isExpiredUpstreamSessionError,
        persistSessionFromResult,
        resolveUpstreamErrorMessage,
        semesterId: selectedSemester.id,
        session: scopedSessionResult.session,
        staffId: normalizedStaffId,
      });

      if (activeQueryRequestIdRef.current !== requestId) {
        return;
      }

      dispatchQueryState({
        prefillResult: result.prefillResult,
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
        setLoginError('教务系统连接已失效，请重新连接后继续。');
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
    if (!liveUpstreamAccount) {
      setIsLoginModalOpen(false);
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

      if (nextPendingAction === 'query') {
        await runQueryAction(nextSession);
      }
    } catch (error) {
      setLoginError(resolveUpstreamErrorMessage(error, '暂时无法登录校园网。'));
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
                fillAvailabilityIssue={cardFillAvailabilityIssue}
                initialDraft={initialJournalDrafts[item.key] ?? EMPTY_JOURNAL_DRAFT}
                isCollapsing={isCollapsing}
                isSaving={savingItemKey === item.key}
                item={item}
                onSave={handleSaveToCampus}
                onUpdateDraft={updateJournalDraft}
                saveFeedback={saveFeedbackByKey[item.key]}
                visibleBlockingIssue={resolveVisibleBlockingIssue(item, activeResultViewScope)}
                visibleWarnings={resolveVisibleWarnings(item, activeResultViewScope)}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="lecture-journal-page flex flex-col gap-6">
      <div className="lecture-journal-page-header">
        <div className="lecture-journal-header-main">
          <div className="lecture-journal-header-title-row">
            <Typography.Title level={3} style={{ margin: 0 }}>
              My 教学日志
            </Typography.Title>
          </div>
          <div className="lecture-journal-header-subtitle">
            <Typography.Text type="secondary">对照教学计划，补齐待填日志</Typography.Text>
          </div>
        </div>

        <div className="lecture-journal-query-area">
          {storedSession ? (
            <div className="lecture-journal-current-identity">
              <UserOutlined />
              <span>校园网当前身份：{upstreamIdentityLabel}</span>
              {isAdminViewer ? (
                <>
                  <span className="lecture-journal-inline-separator" aria-hidden />
                  <div className="lecture-journal-current-identity-actions">
                    <Button
                      icon={<SwapOutlined />}
                      size="small"
                      type="link"
                      disabled={!isLocalAccountReady}
                      style={{ padding: 0 }}
                      onClick={() => {
                        setPendingAction(null);
                        openLoginModal();
                      }}
                    >
                      切换账号
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="lecture-journal-filter-bar">
            <div className="lecture-journal-filter-item">
              <span className="lecture-journal-filter-label">学期:</span>
              {isLoadingSemesters ? (
                <span className="lecture-journal-filter-skeleton">
                  <Skeleton.Button active size="small" />
                </span>
              ) : !isAdminViewer ? (
                <span className="lecture-journal-filter-value">
                  {selectedSemester?.name ?? '待加载'}
                </span>
              ) : (
                <span className="lecture-journal-filter-control lecture-journal-filter-control-semester">
                  <Select
                    variant="borderless"
                    options={semesters.map((semester) => ({
                      label: `${semester.name}${semester.isCurrent ? ' · 当前' : ''}`,
                      value: semester.id,
                    }))}
                    value={selectedSemesterId ?? undefined}
                    onChange={(value) => setSelectedSemesterId(value)}
                  />
                </span>
              )}
            </div>

            <span className="lecture-journal-filter-separator" aria-hidden />

            <div className="lecture-journal-filter-item">
              <span className="lecture-journal-filter-label">教师:</span>
              {isAdminViewer ? (
                <div className="lecture-journal-filter-teacher-control">
                  <span className="lecture-journal-filter-control lecture-journal-filter-control-teacher">
                    <AutoComplete
                      variant="borderless"
                      notFoundContent={isLoadingStaffDirectory ? '读取中' : undefined}
                      options={teacherOptions}
                      popupClassName="lecture-journal-teacher-autocomplete-popup"
                      popupMatchSelectWidth={220}
                      placeholder={liveDefaultStaffId || '输入 ID 或姓名'}
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
                  </span>
                  <Button
                    disabled={!canRestoreDefaultStaffId || isRestoringDefaultStaffId}
                    icon={<UserSwitchOutlined />}
                    loading={isRestoringDefaultStaffId}
                    size="small"
                    type="text"
                    title="恢复默认教师"
                    onClick={() => void restoreDefaultStaffId()}
                  />
                </div>
              ) : (
                <span
                  className="lecture-journal-filter-value lecture-journal-filter-value-truncated"
                  title={staffId || '未绑定 ID'}
                >
                  {staffId || '未绑定教师 ID'}
                </span>
              )}
            </div>

            <span className="lecture-journal-primary-action">
              <Button
                type="primary"
                icon={<SearchOutlined />}
                disabled={
                  !selectedSemester ||
                  hasMissingStaffFilter ||
                  isLoadingReconciliation ||
                  (!storedSession && !isLocalAccountReady)
                }
                loading={isLoadingReconciliation}
                onClick={() => void runQueryAction()}
              >
                查阅
              </Button>
            </span>
          </div>
        </div>
      </div>

      {hasControlAlerts ? (
        <div className="lecture-journal-control-alerts">
          {semesterError ? <Alert message={semesterError} showIcon type="error" /> : null}
          {staffDirectoryError ? (
            <Alert message={staffDirectoryError} showIcon type="warning" />
          ) : null}
          {hasMissingStaffFilter ? (
            <Alert
              message={
                isStaffViewer
                  ? '当前账号没有可用的教师 ID，无法查询教学日志对账。'
                  : '请选择或输入教师后再查询对账。'
              }
              showIcon
              type="warning"
            />
          ) : null}
        </div>
      ) : null}

      {queryError ? <Alert message={queryError} showIcon type="error" /> : null}
      {pageLevelPrefillBlockingIssue ? (
        <Alert message={pageLevelPrefillBlockingIssue} showIcon type="error" />
      ) : null}
      {prefillResult && !pageLevelPrefillBlockingIssue && fillAvailabilityIssue ? (
        <Alert message="当前填写前检查未通过。" showIcon type="error" />
      ) : null}
      {visiblePageLevelPrefillWarnings.length ? (
        <Alert
          description={visiblePageLevelPrefillWarnings.join('；')}
          message="填写前检查提示"
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

          {sessionStaffMismatchWarningMessage ? (
            <div className="lecture-journal-session-mismatch-alert">
              <Alert
                action={
                  hasSessionStaffMismatchWarning ? (
                    <span className="lecture-journal-warning-action">
                      <Button
                        disabled={hasAcknowledgedSessionStaffMismatchWarning}
                        icon={<CheckOutlined />}
                        type="default"
                        onClick={() => {
                          setHasAcknowledgedSessionStaffMismatchWarning(true);
                        }}
                      >
                        {hasAcknowledgedSessionStaffMismatchWarning ? '已知晓' : '我已知晓'}
                      </Button>
                    </span>
                  ) : undefined
                }
                message={sessionStaffMismatchWarningMessage}
                showIcon
                type="warning"
              />
            </div>
          ) : null}

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
        <section className="lecture-journal-prequery-state">
          <div className="lecture-journal-prequery-state-copy">
            <Typography.Text strong>等待查询</Typography.Text>
            <Typography.Text type="secondary">
              查询后会按课次展示已填写、待补填和需要人工核对的教学日志。
            </Typography.Text>
          </div>
          <div className="lecture-journal-prequery-state-steps" aria-label="查询结果内容">
            <span>
              <i aria-hidden />
              课次状态
            </span>
            <span>
              <i aria-hidden />
              补填草稿
            </span>
            <span>
              <i aria-hidden />
              异常核对
            </span>
          </div>
        </section>
      ) : null}

      <UpstreamLoginModal
        form={loginForm}
        isSubmitting={isSubmittingLogin}
        loginError={loginError}
        open={isLoginModalOpen}
        title="登录校园网"
        onCancel={() => {
          setIsLoginModalOpen(false);
          setPendingAction(null);
          setLoginError(null);
        }}
        onFinish={handleLogin}
      />
    </div>
  );
}
