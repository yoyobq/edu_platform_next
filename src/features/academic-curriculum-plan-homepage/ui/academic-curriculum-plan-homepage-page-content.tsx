// src/features/academic-curriculum-plan-homepage/ui/academic-curriculum-plan-homepage-page-content.tsx

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOutlined,
  CalendarOutlined,
  FlagOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  theme,
  Tooltip,
  Typography,
} from 'antd';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';
import {
  buildDepartmentSelectOptions,
  DepartmentFormItem,
  type DepartmentSelectOption,
  ensureDepartmentSelectOption,
  resolveDepartmentDefaultId,
} from '@/entities/department';
import {
  buildUpstreamLoginCredentialsInitialValues,
  canUseRememberedUpstreamLoginCredentials,
  type StoredUpstreamSession,
  type UpstreamLoginFormValues,
  UpstreamLoginModal,
  useUpstreamSession,
} from '@/entities/upstream-session';

import { hasAcademicCurriculumPlanHomepageManagerAccess } from '@/shared/auth-access';
import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import {
  buildInitialReferenceLessonDistributionDraftUpdate,
  buildPrefillDraftUpdate,
  buildReferenceCandidateDraftUpdate,
  buildTeachingEndChapterDraftUpdate,
  type CurriculumPlanHomepageDraftChange,
  validateCurriculumPlanHomepageBeforeSave,
} from '../application/draft-policy';
import {
  type CurrentCurriculumPlanHomepageAccount,
  type CurriculumPlanHomepageDetailResult,
  type CurriculumPlanHomepageListItem,
  type CurriculumPlanHomepageListResult,
  type CurriculumPlanHomepagePrefillFieldWriteRule,
  type CurriculumPlanHomepagePrefillMode,
  type CurriculumPlanHomepagePrefillPhase,
  type CurriculumPlanHomepagePrefillResult,
  type CurriculumPlanHomepageReferenceCandidateItem,
  type CurriculumPlanHomepageReferenceCandidatesResult,
  type CurriculumPlanHomepageTeachingEndChapterCandidatesResult,
} from '../domain/curriculum-plan-homepage-types';
import {
  fetchCurriculumPlanHomepageDepartmentOptions,
  fetchCurriculumPlanHomepageDetail,
  fetchCurriculumPlanHomepageList,
  isCurriculumPlanHomepagePrefillTimeWindowClosedError,
  isExpiredUpstreamSessionError,
  listCurriculumPlanHomepageReferenceCandidates,
  listCurriculumPlanHomepageTeachingEndChapterCandidates,
  previewCurriculumPlanHomepagePrefill,
  resolveCurriculumPlanHomepagePrefillErrorMessage,
  resolveUpstreamErrorMessage,
  saveCurriculumPlanHomepage,
} from '../infrastructure/academic-curriculum-plan-homepage-api';

type SearchFormValues = {
  departmentId?: string | null;
  schoolYear: string;
  semester: string;
};

type PendingAction =
  | {
      type: 'detail';
      item: CurriculumPlanHomepageListItem;
    }
  | {
      type: 'list';
      values: SearchFormValues;
    }
  | {
      homepage: Record<string, unknown>;
      planId: string;
      type: 'save';
    }
  | {
      item: CurriculumPlanHomepageListItem;
      phase: CurriculumPlanHomepagePrefillPhase;
      type: 'prefillCandidates';
    }
  | {
      item: CurriculumPlanHomepageListItem;
      phase: CurriculumPlanHomepagePrefillPhase;
      type: 'referenceCandidates';
    }
  | {
      item: CurriculumPlanHomepageListItem;
      phase: CurriculumPlanHomepagePrefillPhase;
      type: 'teachingEndChapterCandidates';
    };

type ActionError = {
  message: string;
  target: 'candidate' | 'detail' | 'list' | 'prefill' | 'save' | 'session';
};

type PrefillPreviewUpdate = {
  changes: CurriculumPlanHomepageDraftChange[];
  fieldWriteRules: readonly CurriculumPlanHomepagePrefillFieldWriteRule[];
  homepagePatch: Record<string, unknown>;
  nextDraft: Record<string, unknown>;
  warnings: string[];
};

type PrefillModalState = {
  item: CurriculumPlanHomepageListItem;
  phase: CurriculumPlanHomepagePrefillPhase;
};

type SuggestionSource = 'calculated' | 'history' | 'schedule';

type SuggestedFieldState = {
  before: unknown;
  label: string;
  source: SuggestionSource;
};

type SuggestedFieldsByPlan = Record<string, Record<string, SuggestedFieldState>>;

type PrefillActionState = {
  disabled: boolean;
  tooltip?: string;
};

const SEMESTER_OPTIONS = [
  {
    label: '第一学期',
    value: '1',
  },
  {
    label: '第二学期',
    value: '2',
  },
];
const DEFAULT_DEPARTMENT_ID = 'ORG0302';
const COMPACT_VIEWPORT_QUERY = '(max-width: 1120px)';
const DAY_MS = 24 * 60 * 60 * 1000;
const CALCULATED_SUGGESTION_FIELDS = new Set([
  'compensated_lessons',
  'completed_lessons',
  'extra_lessons',
  'reduced_lessons',
  'total_lessons',
  'training_lessons',
]);
const SCHEDULE_SUGGESTION_FIELDS = new Set(['planned_lessons', 'teaching_weeks', 'weekly_lessons']);

function useCompactViewport() {
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(COMPACT_VIEWPORT_QUERY).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(COMPACT_VIEWPORT_QUERY);
    const handleChange = () => {
      setIsCompactViewport(mediaQuery.matches);
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return isCompactViewport;
}

function getDefaultAcademicTerm(): SearchFormValues {
  const now = new Date();
  const month = now.getMonth() + 1;
  const schoolYear = month >= 8 ? now.getFullYear() : now.getFullYear() - 1;

  return {
    departmentId: DEFAULT_DEPARTMENT_ID,
    schoolYear: String(schoolYear),
    semester: month >= 8 ? '1' : '2',
  };
}

function resolvePrefillMode(account: CurrentCurriculumPlanHomepageAccount | null) {
  if (!account) {
    return 'my' satisfies CurriculumPlanHomepagePrefillMode;
  }

  if (
    hasAcademicCurriculumPlanHomepageManagerAccess({
      accessGroup: account.accessGroup,
      slotGroup: account.slotGroup,
    })
  ) {
    return 'managed' satisfies CurriculumPlanHomepagePrefillMode;
  }

  return 'my' satisfies CurriculumPlanHomepagePrefillMode;
}

function buildPhaseKey(planId: string, phase: CurriculumPlanHomepagePrefillPhase) {
  return `${planId}:${phase}`;
}

function confirmPrefillTimeWindowOverride() {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      cancelText: '取消',
      content: '当前不在建议预填时间范围内，是否继续预填？',
      okText: '继续预填',
      onCancel: () => {
        resolve(false);
      },
      onOk: () => {
        resolve(true);
      },
      title: '确认继续预填',
    });
  });
}

function parseDateToDayIndex(value: string | null | undefined) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/u);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function formatDayIndex(dayIndex: number) {
  return new Date(dayIndex * DAY_MS).toISOString().slice(0, 10);
}

function getTodayDayIndex() {
  const now = new Date();

  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

function findAcademicSemester(
  item: CurriculumPlanHomepageListItem,
  semesters: readonly AcademicSemesterRecord[],
) {
  const schoolYear = Number.parseInt(String(item.schoolYear ?? ''), 10);
  const termNumber = Number.parseInt(String(item.semester ?? ''), 10);

  if (!Number.isFinite(schoolYear) || !Number.isFinite(termNumber)) {
    return null;
  }

  return (
    semesters.find(
      (semester) => semester.schoolYear === schoolYear && semester.termNumber === termNumber,
    ) ?? null
  );
}

function resolvePrefillActionState(input: {
  ignoreTimeWindow: boolean;
  isLoadingAcademicSemesters: boolean;
  item: CurriculumPlanHomepageListItem;
  phase: CurriculumPlanHomepagePrefillPhase;
  semesters: readonly AcademicSemesterRecord[];
}): PrefillActionState {
  if (input.ignoreTimeWindow) {
    return {
      disabled: false,
    };
  }

  if (input.isLoadingAcademicSemesters) {
    return {
      disabled: true,
      tooltip: '正在确认预填时间范围。',
    };
  }

  const semester = findAcademicSemester(input.item, input.semesters);

  if (!semester) {
    return {
      disabled: false,
    };
  }

  const baseDayIndex = parseDateToDayIndex(
    input.phase === 'INITIAL' ? semester.firstTeachingDate : semester.examStartDate,
  );

  if (baseDayIndex === null) {
    return {
      disabled: false,
    };
  }

  const allowedFrom = baseDayIndex - 7;
  const allowedTo = baseDayIndex + (input.phase === 'INITIAL' ? 20 : 13);
  const today = getTodayDayIndex();

  if (today >= allowedFrom && today <= allowedTo) {
    return {
      disabled: false,
    };
  }

  return {
    disabled: true,
    tooltip: `当前不在建议预填时间范围内，允许 ${formatDayIndex(allowedFrom)} 至 ${formatDayIndex(
      allowedTo,
    )}。`,
  };
}

function buildPrefillActionStates(input: {
  ignoreTimeWindow: boolean;
  isLoadingAcademicSemesters: boolean;
  item: CurriculumPlanHomepageListItem;
  semesters: readonly AcademicSemesterRecord[];
}): Record<CurriculumPlanHomepagePrefillPhase, PrefillActionState> {
  return {
    FINAL: resolvePrefillActionState({
      ignoreTimeWindow: input.ignoreTimeWindow,
      isLoadingAcademicSemesters: input.isLoadingAcademicSemesters,
      item: input.item,
      phase: 'FINAL',
      semesters: input.semesters,
    }),
    INITIAL: resolvePrefillActionState({
      ignoreTimeWindow: input.ignoreTimeWindow,
      isLoadingAcademicSemesters: input.isLoadingAcademicSemesters,
      item: input.item,
      phase: 'INITIAL',
      semesters: input.semesters,
    }),
  };
}

function requireListItemValue(value: string | null | undefined, label: string) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    throw new Error(`当前计划缺少${label}，无法使用预填能力。`);
  }

  return normalized;
}

function buildPrefillContext(
  item: CurriculumPlanHomepageListItem,
  mode: CurriculumPlanHomepagePrefillMode,
) {
  const context = {
    courseName: item.courseName,
    schoolYear: requireListItemValue(item.schoolYear, '学年'),
    semester: requireListItemValue(item.semester, '学期'),
    sstsCourseId: requireListItemValue(item.sstsCourseId, 'SSTS 课程 ID'),
    sstsTeachingClassId: requireListItemValue(item.sstsTeachingClassId, 'SSTS 教学班 ID'),
    weekCount: item.weekCount,
    weeklyHours: item.weeklyHours,
  };

  if (mode === 'managed') {
    return {
      ...context,
      staffId: requireListItemValue(item.staffId, '教师 ID'),
    };
  }

  return context;
}

function buildReferenceContext(
  item: CurriculumPlanHomepageListItem,
  mode: CurriculumPlanHomepagePrefillMode,
) {
  const context = {
    courseName: item.courseName,
    schoolYear: requireListItemValue(item.schoolYear, '学年'),
    semester: requireListItemValue(item.semester, '学期'),
    weekCount: item.weekCount,
    weeklyHours: item.weeklyHours,
  };

  if (mode === 'managed') {
    return {
      ...context,
      staffId: requireListItemValue(item.staffId, '教师 ID'),
    };
  }

  return context;
}

function buildTeachingEndChapterContext(item: CurriculumPlanHomepageListItem) {
  return {
    schoolYear: requireListItemValue(item.schoolYear, '学年'),
    semester: requireListItemValue(item.semester, '学期'),
  };
}

function buildSchoolYearOptions(selectedYear: string) {
  const parsedYear = Number.parseInt(selectedYear, 10);
  const baseYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();

  return Array.from({ length: 6 }, (_, index) => baseYear + 1 - index).map((year) => ({
    label: `${year}-${year + 1}`,
    value: String(year),
  }));
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function resolveUpstreamRefreshFailureMessage(error: unknown) {
  if (isExpiredUpstreamSessionError(error)) {
    return 'upstream 会话已失效，请重新登录后继续。';
  }

  return resolveUpstreamErrorMessage(error, 'upstream 会话刷新失败，请重新登录后继续。');
}

function readHomepageValue(
  homepage: Record<string, unknown> | null,
  candidates: readonly string[],
) {
  if (!homepage) {
    return null;
  }

  for (const key of candidates) {
    const value = homepage[key];

    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }

  return null;
}

function readHomepageText(homepage: Record<string, unknown> | null, candidates: readonly string[]) {
  const value = readHomepageValue(homepage, candidates);

  if (value === null) {
    return '';
  }

  return String(value);
}

function readHomepageNumber(
  homepage: Record<string, unknown> | null,
  candidates: readonly string[],
) {
  const value = readHomepageValue(homepage, candidates);

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function buildHomepageDraftFromDetail(result: CurriculumPlanHomepageDetailResult) {
  const homepage =
    result.homepage && typeof result.homepage === 'object' && !Array.isArray(result.homepage)
      ? { ...result.homepage }
      : {};

  if (!homepage.lecture_plan_id) {
    homepage.lecture_plan_id = result.planId;
  }

  return homepage;
}

function renderDraftInput(value: string, onChange: (nextValue: string) => void) {
  return <Input size="small" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function renderDraftTextarea(value: string, onChange: (nextValue: string) => void, rows = 2) {
  return (
    <Input.TextArea
      rows={rows}
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function renderDraftNumber(value: number | null, onChange: (nextValue: number | null) => void) {
  return (
    <InputNumber
      controls
      size="small"
      style={{ width: '100%' }}
      value={value}
      onChange={(nextValue) => {
        onChange(typeof nextValue === 'number' && Number.isFinite(nextValue) ? nextValue : null);
      }}
    />
  );
}

function formatSuggestionOriginalValue(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    return trimmedValue ? trimmedValue : null;
  }

  if (typeof value === 'object') {
    return formatJson(value);
  }

  return String(value);
}

function resolveSuggestionSource(field: string): SuggestionSource {
  if (SCHEDULE_SUGGESTION_FIELDS.has(field)) {
    return 'schedule';
  }

  if (CALCULATED_SUGGESTION_FIELDS.has(field)) {
    return 'calculated';
  }

  return 'history';
}

function resolveSuggestionSourceView(
  source: SuggestionSource,
  token: ReturnType<typeof theme.useToken>['token'],
) {
  if (source === 'calculated') {
    return {
      background: token.colorWarningBg,
      border: token.colorWarningBorder,
      label: '计算获得',
    };
  }

  if (source === 'schedule') {
    return {
      background: token.colorInfoBg,
      border: token.colorInfoBorder,
      label: '来自课表',
    };
  }

  return {
    background: token.colorSuccessBg,
    border: token.colorSuccessBorder,
    label: '参考历史',
  };
}

function renderSuggestedControl(input: {
  children: ReactNode;
  field: string;
  onConfirm: (field: string) => void;
  onRevert: (field: string) => void;
  suggestion?: SuggestedFieldState;
  token: ReturnType<typeof theme.useToken>['token'];
}) {
  if (!input.suggestion) {
    return input.children;
  }

  const sourceView = resolveSuggestionSourceView(input.suggestion.source, input.token);
  const originalValue = formatSuggestionOriginalValue(input.suggestion.before);
  const control = (
    <div
      style={{
        background: sourceView.background,
        border: `1px solid ${sourceView.border}`,
        borderRadius: input.token.borderRadiusSM,
        padding: input.token.paddingXXS,
      }}
    >
      <Space orientation="vertical" size={input.token.marginXXS} style={{ width: '100%' }}>
        {input.children}
        <Flex align="center" justify="space-between" gap={input.token.marginXS} wrap="wrap">
          <Typography.Text type="secondary">{sourceView.label}</Typography.Text>
          <Space size={input.token.marginXXS}>
            <Button
              size="small"
              type="primary"
              onClick={() => {
                input.onConfirm(input.field);
              }}
            >
              确认
            </Button>
            <Button
              size="small"
              onClick={() => {
                input.onRevert(input.field);
              }}
            >
              撤回
            </Button>
          </Space>
        </Flex>
      </Space>
    </div>
  );

  if (!originalValue) {
    return control;
  }

  return (
    <Tooltip
      title={
        <span
          style={{
            display: 'block',
            maxWidth: 320,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          原始值：{originalValue}
        </span>
      }
    >
      {control}
    </Tooltip>
  );
}

function parseAcademicTermIndex(
  schoolYear: string | null | undefined,
  semester: string | null | undefined,
) {
  const parsedSchoolYear = Number.parseInt(String(schoolYear ?? ''), 10);
  const parsedSemester = Number.parseInt(String(semester ?? ''), 10);

  if (!Number.isFinite(parsedSchoolYear) || (parsedSemester !== 1 && parsedSemester !== 2)) {
    return null;
  }

  return parsedSchoolYear * 2 + parsedSemester - 1;
}

function formatReferenceCandidateTermLabel(
  item: CurriculumPlanHomepageReferenceCandidateItem,
  currentItem: CurriculumPlanHomepageListItem | null,
) {
  const currentTermIndex = parseAcademicTermIndex(currentItem?.schoolYear, currentItem?.semester);
  const candidateTermIndex = parseAcademicTermIndex(item.schoolYear, item.semester);
  const currentSchoolYear = Number.parseInt(String(currentItem?.schoolYear ?? ''), 10);
  const candidateSchoolYear = Number.parseInt(item.schoolYear, 10);

  if (currentTermIndex === null || candidateTermIndex === null) {
    return `${item.schoolYear}-${item.semester}`;
  }

  const termDiff = currentTermIndex - candidateTermIndex;

  if (termDiff === 1) {
    return '上学期';
  }

  if (Number.isFinite(currentSchoolYear) && candidateSchoolYear === currentSchoolYear - 1) {
    return '上学年';
  }

  if (termDiff > 1) {
    return '更早';
  }

  return '本学期';
}

function renderReferenceCandidateTitle(item: CurriculumPlanHomepageReferenceCandidateItem) {
  return `${item.courseName || '未返回课程'} · ${item.teachingClassName || '未返回班级'}`;
}

function formatPrefillModalCourseTitle(item: CurriculumPlanHomepageListItem) {
  const courseName = item.courseName || '未命名课程';

  if (
    item.weekCount === null ||
    item.weekCount === undefined ||
    item.weeklyHours === null ||
    item.weeklyHours === undefined
  ) {
    return courseName;
  }

  return `${courseName} — ${item.weekCount * item.weeklyHours}课时`;
}

function renderReferenceCandidateDescription(
  item: CurriculumPlanHomepageReferenceCandidateItem,
  token: ReturnType<typeof theme.useToken>['token'],
) {
  const weekText =
    item.weekCount === null || item.weekCount === undefined ? null : `${item.weekCount} 周`;
  const planText =
    item.plannedLessons === null || item.plannedLessons === undefined
      ? null
      : `计划 ${item.plannedLessons} 课时`;
  const diffText =
    item.plannedLessonsDiff === null || item.plannedLessonsDiff === undefined
      ? null
      : item.plannedLessonsDiff;

  return (
    <Space size="small" wrap>
      {weekText ? <Typography.Text type="secondary">{weekText}</Typography.Text> : null}
      {planText ? <Typography.Text type="secondary">{planText}</Typography.Text> : null}
      {diffText === null ? null : (
        <Typography.Text type="secondary">
          差{' '}
          <span
            style={{
              color: diffText === 0 ? token.colorSuccess : token.colorWarning,
              fontSize: '1.08em',
              fontWeight: token.fontWeightStrong,
            }}
          >
            {diffText}
          </span>{' '}
          课时
        </Typography.Text>
      )}
    </Space>
  );
}

function canRecommendReferenceCandidate(item: CurriculumPlanHomepageReferenceCandidateItem) {
  return item.recommended && item.plannedLessonsDiff !== null && item.plannedLessonsDiff <= 20;
}

function renderReferenceCandidateOption(input: {
  currentItem: CurriculumPlanHomepageListItem | null;
  isSelected: boolean;
  item: CurriculumPlanHomepageReferenceCandidateItem;
  optionKey: string;
  token: ReturnType<typeof theme.useToken>['token'];
}) {
  return (
    <Radio
      key={input.optionKey}
      style={{
        alignItems: 'flex-start',
        background: input.isSelected ? input.token.colorFillTertiary : undefined,
        borderTop: `1px solid ${input.token.colorBorderSecondary}`,
        marginInlineEnd: 0,
        padding: `${input.token.paddingXS}px ${input.token.paddingSM}px`,
        width: '100%',
      }}
      value={input.optionKey}
    >
      <Space orientation="vertical" size={input.token.marginXXS} style={{ minWidth: 0 }}>
        <Flex align="center" gap={input.token.marginXS} wrap="wrap">
          <Tag>{formatReferenceCandidateTermLabel(input.item, input.currentItem)}</Tag>
          <Typography.Text strong>{renderReferenceCandidateTitle(input.item)}</Typography.Text>
          {canRecommendReferenceCandidate(input.item) ? <Tag color="processing">推荐</Tag> : null}
        </Flex>
        {renderReferenceCandidateDescription(input.item, input.token)}
      </Space>
    </Radio>
  );
}

function flattenReferenceCandidates(
  result: CurriculumPlanHomepageReferenceCandidatesResult | null,
) {
  return (
    result?.candidateGroups.flatMap((group) =>
      group.items.map((item) => ({
        group,
        item,
        key: `${group.groupKey}:${item.sourcePlanId}`,
      })),
    ) ?? []
  );
}

function flattenEndChapterCandidates(
  result: CurriculumPlanHomepageTeachingEndChapterCandidatesResult | null,
) {
  return (
    result?.candidateGroups.flatMap((group) =>
      group.items.map((item, index) => ({
        group,
        item,
        key: `${group.groupKey}:${item.lecturePlanDetailId ?? index}:${item.value}`,
      })),
    ) ?? []
  );
}

function formatEndChapterWeekText(weekNumber: string | null) {
  const normalizedWeekNumber = String(weekNumber || '').trim();

  if (!normalizedWeekNumber) {
    return null;
  }

  return normalizedWeekNumber.includes('周')
    ? normalizedWeekNumber.replace(/\s+/gu, '')
    : `第${normalizedWeekNumber}周`;
}

function removeEndChapterTimingText(value: string, weekText: string | null) {
  const withoutWeek = weekText
    ? value
        .replace(new RegExp(`^${weekText.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\s*`, 'u'), '')
        .replace(/^第\s*\d+\s*周\s*/u, '')
    : value.replace(/^第\s*\d+\s*周\s*/u, '');

  return withoutWeek
    .replace(/(?:第\s*[一二三四五六七八九十\d]+\s*节\s*[,，、]?\s*)+/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function formatEndChapterCandidateTitle(
  item: CurriculumPlanHomepageTeachingEndChapterCandidatesResult['candidateGroups'][number]['items'][number],
) {
  const weekText = formatEndChapterWeekText(item.weekNumber);
  const rawTitle =
    item.value.trim() ||
    item.teachingChapterContent?.trim() ||
    item.topicName?.trim() ||
    item.displayText.trim();
  const contentText = removeEndChapterTimingText(rawTitle, weekText);

  if (weekText && contentText) {
    return `${weekText} ${contentText}`;
  }

  return contentText || weekText || item.displayText;
}

function CurriculumPlanHomepagePrefillModal({
  endChapterCandidates,
  isLoadingEndChapterCandidates,
  isApplying,
  isLoadingPrefill,
  isLoadingReferenceCandidates,
  modal,
  onApply,
  onClose,
  prefillUpdate,
  referenceCandidates,
  selectedEndChapterKey,
  selectedReferenceKey,
  setSelectedEndChapterKey,
  setSelectedReferenceKey,
}: {
  endChapterCandidates: CurriculumPlanHomepageTeachingEndChapterCandidatesResult | null;
  isLoadingEndChapterCandidates: boolean;
  isApplying: boolean;
  isLoadingPrefill: boolean;
  isLoadingReferenceCandidates: boolean;
  modal: PrefillModalState | null;
  onApply: () => Promise<void> | void;
  onClose: () => void;
  prefillUpdate: PrefillPreviewUpdate | null;
  referenceCandidates: CurriculumPlanHomepageReferenceCandidatesResult | null;
  selectedEndChapterKey: string | null;
  selectedReferenceKey: string;
  setSelectedEndChapterKey: (key: string | null) => void;
  setSelectedReferenceKey: (key: string) => void;
}) {
  const { token } = theme.useToken();
  const phase = modal?.phase ?? 'INITIAL';
  const modalTitle = modal ? formatPrefillModalCourseTitle(modal.item) : '预填';
  const referenceOptions = flattenReferenceCandidates(referenceCandidates);
  const endChapterOptions = flattenEndChapterCandidates(endChapterCandidates);
  const referenceListStyle = {
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    width: '100%',
  } as const;
  const isLoading =
    isApplying ||
    isLoadingPrefill ||
    isLoadingReferenceCandidates ||
    (phase === 'FINAL' && isLoadingEndChapterCandidates);

  return (
    <Modal
      destroyOnHidden
      cancelText="取消"
      confirmLoading={isApplying}
      okButtonProps={{ disabled: isLoading }}
      okText="填入表单"
      open={Boolean(modal)}
      title={modalTitle}
      width={560}
      onCancel={onClose}
      onOk={() => {
        void onApply();
      }}
    >
      <Space orientation="vertical" size="small" style={{ width: '100%' }}>
        {prefillUpdate?.warnings.length ? (
          <Alert showIcon message={prefillUpdate.warnings.join('、')} type="warning" />
        ) : null}
        {referenceCandidates?.warnings.length ? (
          <Alert showIcon message={referenceCandidates.warnings.join('、')} type="warning" />
        ) : null}
        {endChapterCandidates?.warnings.length ? (
          <Alert showIcon message={endChapterCandidates.warnings.join('、')} type="warning" />
        ) : null}

        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <Typography.Text strong>参考其他教学计划</Typography.Text>
          {isLoadingReferenceCandidates ? (
            <Flex align="center" justify="center" style={{ minHeight: 72 }}>
              <Spin />
            </Flex>
          ) : (
            <Radio.Group
              style={{ width: '100%' }}
              value={selectedReferenceKey}
              onChange={(event) => {
                setSelectedReferenceKey(String(event.target.value));
              }}
            >
              <div style={referenceListStyle}>
                <Radio
                  style={{
                    alignItems: 'center',
                    background:
                      selectedReferenceKey === '__none__' ? token.colorFillTertiary : undefined,
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    marginInlineEnd: 0,
                    padding: `${token.paddingXS}px ${token.paddingSM}px`,
                    width: '100%',
                  }}
                  value="__none__"
                >
                  不使用历史参考
                </Radio>
                {referenceOptions.map((option) =>
                  renderReferenceCandidateOption({
                    currentItem: modal?.item ?? null,
                    isSelected: selectedReferenceKey === option.key,
                    item: option.item,
                    optionKey: option.key,
                    token,
                  }),
                )}
              </div>
            </Radio.Group>
          )}
        </Space>

        {phase === 'FINAL' ? (
          <Space orientation="vertical" size="small" style={{ width: '100%' }}>
            <Typography.Text strong>最终章节</Typography.Text>
            {isLoadingEndChapterCandidates ? (
              <Flex align="center" justify="center" style={{ minHeight: 72 }}>
                <Spin />
              </Flex>
            ) : (
              <Radio.Group
                style={{ width: '100%' }}
                value={selectedEndChapterKey ?? '__none__'}
                onChange={(event) => {
                  const nextValue = String(event.target.value);
                  setSelectedEndChapterKey(nextValue === '__none__' ? null : nextValue);
                }}
              >
                <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                  <Radio value="__none__">不填最终章节</Radio>
                  {endChapterOptions.map((option) => (
                    <Radio key={option.key} value={option.key}>
                      <Typography.Text>
                        {formatEndChapterCandidateTitle(option.item)}
                      </Typography.Text>
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
            )}
          </Space>
        ) : null}

        {isLoadingPrefill ? (
          <Flex align="center" justify="center" style={{ minHeight: 48 }}>
            <Spin />
          </Flex>
        ) : (
          <Typography.Text type="secondary">
            课时预填会直接写入表单，并用浅色标记等待确认。
          </Typography.Text>
        )}
      </Space>
    </Modal>
  );
}

function CurriculumPlanHomepageFormPreview({
  homepage,
  isCompactViewport,
  isLoadingPrefill,
  isSaving,
  onConfirmAllSuggestions,
  onConfirmSuggestion,
  onPreviewPrefill,
  onRevertAllSuggestions,
  onRevertSuggestion,
  onSave,
  onUpdateField,
  prefillActionStates,
  statusMessage,
  suggestions,
  token,
  validationMessage,
}: {
  homepage: Record<string, unknown>;
  isCompactViewport: boolean;
  isLoadingPrefill: boolean;
  isSaving: boolean;
  onConfirmAllSuggestions: () => void;
  onConfirmSuggestion: (field: string) => void;
  onPreviewPrefill: (phase: CurriculumPlanHomepagePrefillPhase) => void;
  onRevertAllSuggestions: () => void;
  onRevertSuggestion: (field: string) => void;
  onSave: () => void;
  onUpdateField: (field: string, value: number | string | null) => void;
  prefillActionStates: Record<CurriculumPlanHomepagePrefillPhase, PrefillActionState>;
  statusMessage: string | null;
  suggestions: Record<string, SuggestedFieldState>;
  token: ReturnType<typeof theme.useToken>['token'];
  validationMessage: string | null;
}) {
  const suggestionCount = Object.keys(suggestions).length;
  const tableStyle = {
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    width: '100%',
  } as const;
  const cellStyle = {
    border: `1px solid ${token.colorBorder}`,
    padding: token.paddingXS,
    verticalAlign: 'middle',
  } as const;
  const labelCellStyle = {
    ...cellStyle,
    background: token.colorFillQuaternary,
    color: token.colorText,
    textAlign: 'center',
    width: isCompactViewport ? 128 : 160,
  } as const;
  const headerCellStyle = {
    ...labelCellStyle,
    width: undefined,
  } as const;
  const fieldsetStyle = {
    border: `1px solid ${token.colorBorder}`,
    margin: 0,
    padding: `${token.paddingSM}px ${token.padding}px ${token.padding}px`,
  } as const;
  const legendStyle = {
    color: token.colorText,
    fontWeight: token.fontWeightStrong,
    padding: `0 ${token.paddingXXS}px`,
  } as const;
  const formShellStyle = {
    marginInline: 'auto',
    maxWidth: isCompactViewport ? '100%' : 1020,
    width: '100%',
  } as const;
  const textareaRows = isCompactViewport ? 2 : 3;
  const renderField = (field: string, children: ReactNode) =>
    renderSuggestedControl({
      children,
      field,
      onConfirm: onConfirmSuggestion,
      onRevert: onRevertSuggestion,
      suggestion: suggestions[field],
      token,
    });
  const renderPrefillButton = (
    phase: CurriculumPlanHomepagePrefillPhase,
    label: string,
    icon: ReactNode,
  ) => {
    const actionState = prefillActionStates[phase];
    const button = (
      <Button
        disabled={actionState.disabled}
        icon={icon}
        loading={!actionState.disabled && isLoadingPrefill}
        size="small"
        onClick={() => {
          if (actionState.disabled) {
            return;
          }

          onPreviewPrefill(phase);
        }}
      >
        {label}
      </Button>
    );

    if (!actionState.tooltip) {
      return button;
    }

    return (
      <Tooltip title={actionState.tooltip}>
        <span style={{ display: 'inline-block' }}>{button}</span>
      </Tooltip>
    );
  };

  return (
    <Space orientation="vertical" size={token.marginSM} style={formShellStyle}>
      <Flex align="center" justify="space-between" gap={token.marginSM} wrap="wrap">
        <span style={{ width: isCompactViewport ? 0 : 64 }} />
        <Typography.Title level={4} style={{ margin: 0, textAlign: 'center' }}>
          授课计划首页信息
        </Typography.Title>
        <Space size={token.marginXS} wrap>
          {renderPrefillButton('INITIAL', '学期初预填', <CalendarOutlined />)}
          {renderPrefillButton('FINAL', '学期末预填', <FlagOutlined />)}
          <Button
            icon={<SaveOutlined />}
            loading={isSaving}
            size="small"
            type="primary"
            onClick={onSave}
          >
            保存
          </Button>
        </Space>
      </Flex>

      {statusMessage ? <Alert showIcon message={statusMessage} type="success" /> : null}
      {validationMessage ? <Alert showIcon message={validationMessage} type="warning" /> : null}

      {suggestionCount ? (
        <Alert
          showIcon
          message={
            <Flex align="center" justify="space-between" gap={token.marginSM} wrap="wrap">
              <span>已填入 {suggestionCount} 项建议。</span>
              <Space>
                <Button size="small" type="primary" onClick={onConfirmAllSuggestions}>
                  全部确认
                </Button>
                <Button size="small" onClick={onRevertAllSuggestions}>
                  全部撤回
                </Button>
              </Space>
            </Flex>
          }
          type="info"
        />
      ) : null}

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>基本信息</legend>
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={labelCellStyle}>教材名称及版本</td>
              <td style={cellStyle}>
                {renderField(
                  'textbook_name',
                  renderDraftInput(
                    readHomepageText(homepage, ['textbook_name', 'textbookName']),
                    (value) => onUpdateField('textbook_name', value),
                  ),
                )}
              </td>
            </tr>
            <tr>
              <td style={labelCellStyle}>教学目的要求</td>
              <td style={cellStyle}>
                {renderField(
                  'teaching_objectives',
                  renderDraftTextarea(
                    readHomepageText(homepage, ['teaching_objectives', 'teachingObjectives']),
                    (value) => onUpdateField('teaching_objectives', value),
                    textareaRows,
                  ),
                )}
              </td>
            </tr>
            <tr>
              <td style={labelCellStyle}>改进教学的具体措施</td>
              <td style={cellStyle}>
                {renderField(
                  'improvement_measures',
                  renderDraftTextarea(
                    readHomepageText(homepage, [
                      'teaching_improvement_measures',
                      'improve_teaching_measures',
                      'teaching_measures',
                      'improvement_measures',
                      'teachingMethods',
                    ]),
                    (value) => onUpdateField('improvement_measures', value),
                    textareaRows,
                  ),
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </fieldset>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>课时分配</legend>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th rowSpan={2} style={headerCellStyle}>
                授课周数
              </th>
              <th rowSpan={2} style={headerCellStyle}>
                周课时
              </th>
              <th rowSpan={2} style={headerCellStyle}>
                授课总课时
              </th>
              <th colSpan={4} style={headerCellStyle}>
                分配
              </th>
            </tr>
            <tr>
              <th style={headerCellStyle}>讲课</th>
              <th style={headerCellStyle}>实训</th>
              <th style={headerCellStyle}>复习考试</th>
              <th style={headerCellStyle}>机动</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={cellStyle}>
                {renderField(
                  'teaching_weeks',
                  renderDraftNumber(readHomepageNumber(homepage, ['teaching_weeks']), (value) =>
                    onUpdateField('teaching_weeks', value),
                  ),
                )}
              </td>
              <td style={cellStyle}>
                {renderField(
                  'weekly_lessons',
                  renderDraftNumber(readHomepageNumber(homepage, ['weekly_lessons']), (value) =>
                    onUpdateField('weekly_lessons', value),
                  ),
                )}
              </td>
              <td style={cellStyle}>
                {renderField(
                  'total_lessons',
                  renderDraftNumber(readHomepageNumber(homepage, ['total_lessons']), (value) =>
                    onUpdateField('total_lessons', value),
                  ),
                )}
              </td>
              <td style={cellStyle}>
                {renderField(
                  'lecture_lessons',
                  renderDraftNumber(readHomepageNumber(homepage, ['lecture_lessons']), (value) =>
                    onUpdateField('lecture_lessons', value),
                  ),
                )}
              </td>
              <td style={cellStyle}>
                {renderField(
                  'training_lessons',
                  renderDraftNumber(readHomepageNumber(homepage, ['training_lessons']), (value) =>
                    onUpdateField('training_lessons', value),
                  ),
                )}
              </td>
              <td style={cellStyle}>
                {renderField(
                  'review_exam_lessons',
                  renderDraftNumber(
                    readHomepageNumber(homepage, ['review_exam_lessons']),
                    (value) => onUpdateField('review_exam_lessons', value),
                  ),
                )}
              </td>
              <td style={cellStyle}>
                {renderField(
                  'flexible_lessons',
                  renderDraftNumber(readHomepageNumber(homepage, ['flexible_lessons']), (value) =>
                    onUpdateField('flexible_lessons', value),
                  ),
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </fieldset>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>期末完成情况</legend>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th rowSpan={2} style={headerCellStyle}>
                计划课时
              </th>
              <th rowSpan={2} style={headerCellStyle}>
                完成课时
              </th>
              <th colSpan={3} style={headerCellStyle}>
                超出或减少课时
              </th>
            </tr>
            <tr>
              <th style={headerCellStyle}>超出</th>
              <th style={headerCellStyle}>减少</th>
              <th style={headerCellStyle}>弥补</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={cellStyle}>
                {renderField(
                  'planned_lessons',
                  renderDraftNumber(
                    readHomepageNumber(homepage, ['planned_lessons', 'plan_lessons']),
                    (value) => onUpdateField('planned_lessons', value),
                  ),
                )}
              </td>
              <td style={cellStyle}>
                {renderField(
                  'completed_lessons',
                  renderDraftNumber(
                    readHomepageNumber(homepage, ['completed_lessons', 'finished_lessons']),
                    (value) => onUpdateField('completed_lessons', value),
                  ),
                )}
              </td>
              <td style={cellStyle}>
                {renderField(
                  'extra_lessons',
                  renderDraftNumber(
                    readHomepageNumber(homepage, [
                      'extra_lessons',
                      'exceeded_lessons',
                      'exceed_lessons',
                    ]),
                    (value) => onUpdateField('extra_lessons', value),
                  ),
                )}
              </td>
              <td style={cellStyle}>
                {renderField(
                  'reduced_lessons',
                  renderDraftNumber(
                    readHomepageNumber(homepage, ['reduced_lessons', 'reduce_lessons']),
                    (value) => onUpdateField('reduced_lessons', value),
                  ),
                )}
              </td>
              <td style={cellStyle}>
                {renderField(
                  'compensated_lessons',
                  renderDraftNumber(
                    readHomepageNumber(homepage, [
                      'compensated_lessons',
                      'makeup_lessons',
                      'make_up_lessons',
                    ]),
                    (value) => onUpdateField('compensated_lessons', value),
                  ),
                )}
              </td>
            </tr>
            <tr>
              <td style={labelCellStyle}>教学截止章节内容</td>
              <td colSpan={4} style={cellStyle}>
                {renderField(
                  'teaching_end_chapter_content',
                  renderDraftTextarea(
                    readHomepageText(homepage, [
                      'teaching_end_chapter_content',
                      'teachingEndChapterContent',
                    ]),
                    (value) => onUpdateField('teaching_end_chapter_content', value),
                    textareaRows,
                  ),
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </fieldset>
    </Space>
  );
}

export type AcademicCurriculumPlanHomepagePageLoaderData = {
  currentAccount: CurrentCurriculumPlanHomepageAccount;
};

type AcademicCurriculumPlanHomepagePageContentProps = AcademicCurriculumPlanHomepagePageLoaderData;

export function AcademicCurriculumPlanHomepagePageContent({
  currentAccount,
}: AcademicCurriculumPlanHomepagePageContentProps) {
  const { token } = theme.useToken();
  const isCompactViewport = useCompactViewport();
  const defaultSearchValues = useMemo(() => getDefaultAcademicTerm(), []);
  const schoolYearOptions = useMemo(
    () => buildSchoolYearOptions(defaultSearchValues.schoolYear),
    [defaultSearchValues.schoolYear],
  );
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const [searchForm] = Form.useForm<SearchFormValues>();
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSavingHomepage, setIsSavingHomepage] = useState(false);
  const [isApplyingPrefill, setIsApplyingPrefill] = useState(false);
  const [isPreviewingPrefill, setIsPreviewingPrefill] = useState(false);
  const [loadingReferenceKey, setLoadingReferenceKey] = useState<string | null>(null);
  const [loadingEndChapterKey, setLoadingEndChapterKey] = useState<string | null>(null);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [isLoadingAcademicSemesters, setIsLoadingAcademicSemesters] = useState(false);
  const [academicSemesters, setAcademicSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [academicSemestersError, setAcademicSemestersError] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentSelectOption[]>([]);
  const [departmentOptionsError, setDepartmentOptionsError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveValidationMessagesByPlan, setSaveValidationMessagesByPlan] = useState<
    Record<string, string>
  >({});
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [listResult, setListResult] = useState<CurriculumPlanHomepageListResult | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [detailResult, setDetailResult] = useState<CurriculumPlanHomepageDetailResult | null>(null);
  const [homepageDrafts, setHomepageDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [referenceCandidateResults, setReferenceCandidateResults] = useState<
    Record<string, CurriculumPlanHomepageReferenceCandidatesResult>
  >({});
  const [endChapterCandidateResults, setEndChapterCandidateResults] = useState<
    Record<string, CurriculumPlanHomepageTeachingEndChapterCandidatesResult>
  >({});
  const [prefillPreviewUpdates, setPrefillPreviewUpdates] = useState<
    Record<string, PrefillPreviewUpdate>
  >({});
  const [prefillModal, setPrefillModal] = useState<PrefillModalState | null>(null);
  const [selectedReferenceCandidateKey, setSelectedReferenceCandidateKey] =
    useState<string>('__none__');
  const [selectedEndChapterCandidateKey, setSelectedEndChapterCandidateKey] = useState<
    string | null
  >(null);
  const [suggestedFieldsByPlan, setSuggestedFieldsByPlan] = useState<SuggestedFieldsByPlan>({});
  const isAdminAccount = currentAccount?.accessGroup.includes('ADMIN') === true;
  const prefillMode = resolvePrefillMode(currentAccount);
  const canSelectDepartment = prefillMode === 'managed';
  const lockedUpstreamLoginUserId =
    !isAdminAccount && currentAccount?.staffId ? currentAccount.staffId : null;
  const {
    clear,
    clearRememberedCredentials,
    keepAliveFailure,
    login: loginUpstream,
    persistSessionFromResult,
    rememberedCredentials,
    refreshSession,
    session: storedSession,
  } = useUpstreamSession({
    account: currentAccount,
    keepAlive: true,
  });
  const canUseRememberedCredentials = canUseRememberedUpstreamLoginCredentials({
    lockedUserId: lockedUpstreamLoginUserId,
    rememberedCredentials,
  });
  const clearResults = useCallback(() => {
    setListResult(null);
    setSelectedPlanId(null);
    setDetailResult(null);
    setHomepageDrafts({});
    setReferenceCandidateResults({});
    setEndChapterCandidateResults({});
    setPrefillPreviewUpdates({});
    setPrefillModal(null);
    setSuggestedFieldsByPlan({});
    setSaveValidationMessagesByPlan({});
    setSaveSuccessMessage(null);
  }, []);

  const clearCurrentSession = useCallback(
    (error?: ActionError) => {
      clear();
      clearResults();
      setActionError(error ?? null);
    },
    [clear, clearResults],
  );

  const openLoginModal = useCallback(
    (input?: {
      action?: PendingAction;
      fallbackUserId?: string | null;
      message?: string | null;
    }) => {
      setPendingAction(input?.action ?? null);
      setLoginError(input?.message ?? null);
      loginForm.setFieldsValue(
        buildUpstreamLoginCredentialsInitialValues({
          fallbackUserId: input?.fallbackUserId ?? storedSession?.upstreamLoginId,
          lockedUserId: lockedUpstreamLoginUserId,
          rememberedCredentials,
        }),
      );
      setIsLoginModalOpen(true);
    },
    [lockedUpstreamLoginUserId, loginForm, rememberedCredentials, storedSession?.upstreamLoginId],
  );

  const promptUpstreamLogin = useCallback(
    (input: { action?: PendingAction; message: string; session: StoredUpstreamSession }) => {
      clearCurrentSession();
      openLoginModal({
        action: input.action,
        fallbackUserId: input.session.upstreamLoginId,
        message: input.message,
      });
    },
    [clearCurrentSession, openLoginModal],
  );

  const performAction = useCallback(
    async (session: StoredUpstreamSession, action: PendingAction) => {
      const runActionWithSession = async (currentSession: StoredUpstreamSession) => {
        if (action.type === 'list') {
          setIsLoadingList(true);
          setDetailResult(null);
          setSelectedPlanId(null);
          setHomepageDrafts({});
          setReferenceCandidateResults({});
          setEndChapterCandidateResults({});
          setPrefillPreviewUpdates({});
          setPrefillModal(null);
          setSuggestedFieldsByPlan({});
          setSaveSuccessMessage(null);

          const result = await fetchCurriculumPlanHomepageList({
            ...action.values,
            sessionToken: currentSession.upstreamSessionToken,
          });

          persistSessionFromResult(currentSession, result);
          setListResult(result);
          return;
        }

        if (action.type === 'save') {
          setIsSavingHomepage(true);
          setSaveSuccessMessage(null);

          const result = await saveCurriculumPlanHomepage({
            homepage: action.homepage,
            sessionToken: currentSession.upstreamSessionToken,
          });

          persistSessionFromResult(currentSession, result);

          if (!result.success) {
            throw new Error(result.msg?.trim() || result.code || '授课计划首页保存失败。');
          }

          setSaveSuccessMessage(result.msg?.trim() || '授课计划首页已保存。');
          return;
        }

        if (action.type === 'prefillCandidates') {
          const referenceKey = buildPhaseKey(action.item.planId, action.phase);
          const endChapterKey = buildPhaseKey(action.item.planId, 'FINAL');

          setLoadingReferenceKey(referenceKey);
          setSaveSuccessMessage(null);

          const referenceResult = await listCurriculumPlanHomepageReferenceCandidates({
            context: buildReferenceContext(action.item, prefillMode),
            mode: prefillMode,
            phase: action.phase,
            planId: action.item.planId,
            upstreamSessionToken: currentSession.upstreamSessionToken,
          });
          const nextSession = persistSessionFromResult(currentSession, referenceResult);

          setReferenceCandidateResults((current) => ({
            ...current,
            [referenceKey]: referenceResult,
          }));

          if (action.phase !== 'FINAL') {
            return;
          }

          setLoadingEndChapterKey(endChapterKey);

          const endChapterResult = await listCurriculumPlanHomepageTeachingEndChapterCandidates({
            context: buildTeachingEndChapterContext(action.item),
            mode: prefillMode,
            phase: 'FINAL',
            planId: action.item.planId,
            upstreamSessionToken: nextSession.upstreamSessionToken,
          });

          persistSessionFromResult(nextSession, endChapterResult);
          setEndChapterCandidateResults((current) => ({
            ...current,
            [endChapterKey]: endChapterResult,
          }));
          return;
        }

        if (action.type === 'referenceCandidates') {
          const key = buildPhaseKey(action.item.planId, action.phase);

          setLoadingReferenceKey(key);
          setSaveSuccessMessage(null);

          const result = await listCurriculumPlanHomepageReferenceCandidates({
            context: buildReferenceContext(action.item, prefillMode),
            mode: prefillMode,
            phase: action.phase,
            planId: action.item.planId,
            upstreamSessionToken: currentSession.upstreamSessionToken,
          });

          persistSessionFromResult(currentSession, result);
          setReferenceCandidateResults((current) => ({
            ...current,
            [key]: result,
          }));
          return;
        }

        if (action.type === 'teachingEndChapterCandidates') {
          const key = buildPhaseKey(action.item.planId, action.phase);

          setLoadingEndChapterKey(key);
          setSaveSuccessMessage(null);

          const result = await listCurriculumPlanHomepageTeachingEndChapterCandidates({
            context: buildTeachingEndChapterContext(action.item),
            mode: prefillMode,
            phase: action.phase,
            planId: action.item.planId,
            upstreamSessionToken: currentSession.upstreamSessionToken,
          });

          persistSessionFromResult(currentSession, result);
          setEndChapterCandidateResults((current) => ({
            ...current,
            [key]: result,
          }));
          return;
        }

        setIsLoadingDetail(true);
        setSaveSuccessMessage(null);
        setSelectedPlanId(action.item.planId);

        const result = await fetchCurriculumPlanHomepageDetail({
          planId: action.item.planId,
          sessionToken: currentSession.upstreamSessionToken,
        });

        persistSessionFromResult(currentSession, result);
        setDetailResult(result);
        setHomepageDrafts((current) => ({
          ...current,
          [result.planId]: buildHomepageDraftFromDetail(result),
        }));
        setSuggestedFieldsByPlan((current) => {
          const next = { ...current };
          delete next[result.planId];
          return next;
        });
      };

      const handleActionError = (error: unknown) => {
        if (action.type === 'list') {
          clearResults();
          setActionError({
            message: resolveUpstreamErrorMessage(error, '暂时无法读取授课计划首页列表。'),
            target: 'list',
          });
          return;
        }

        if (action.type === 'save') {
          setActionError({
            message: resolveUpstreamErrorMessage(error, '暂时无法保存授课计划首页。'),
            target: 'save',
          });
          return;
        }

        if (
          action.type === 'prefillCandidates' ||
          action.type === 'referenceCandidates' ||
          action.type === 'teachingEndChapterCandidates'
        ) {
          setActionError({
            message: resolveUpstreamErrorMessage(error, '暂时无法读取授课计划首页候选。'),
            target: 'candidate',
          });
          return;
        }

        setDetailResult(null);
        setSelectedPlanId(action.item.planId);
        setActionError({
          message: resolveUpstreamErrorMessage(error, '暂时无法读取授课计划首页详情。'),
          target: 'detail',
        });
      };

      setActionError(null);

      try {
        await runActionWithSession(session);
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          let refreshedSession: StoredUpstreamSession;

          try {
            refreshedSession = await refreshSession(session);
          } catch (refreshError) {
            promptUpstreamLogin({
              action,
              message: resolveUpstreamRefreshFailureMessage(refreshError),
              session,
            });
            return;
          }

          try {
            await runActionWithSession(refreshedSession);
            return;
          } catch (retryError) {
            if (isExpiredUpstreamSessionError(retryError)) {
              promptUpstreamLogin({
                action,
                message: 'upstream 会话已失效，请重新登录后继续。',
                session: refreshedSession,
              });
              return;
            }

            handleActionError(retryError);
            return;
          }
        }

        handleActionError(error);
      } finally {
        setIsLoadingList(false);
        setIsLoadingDetail(false);
        setIsSavingHomepage(false);
        setLoadingReferenceKey(null);
        setLoadingEndChapterKey(null);
      }
    },
    [clearResults, persistSessionFromResult, prefillMode, promptUpstreamLogin, refreshSession],
  );

  const ensureSessionAndRun = useCallback(
    async (action: PendingAction) => {
      setActionError(null);
      setLoginError(null);

      if (!storedSession) {
        openLoginModal({
          action,
        });
        return;
      }

      await performAction(storedSession, action);
    },
    [openLoginModal, performAction, storedSession],
  );

  const handleSelectPlan = useCallback(
    async (item: CurriculumPlanHomepageListItem) => {
      if (!item.planId.trim()) {
        setActionError({
          message: '当前记录缺少教学计划 ID，无法读取首页详情。',
          target: 'detail',
        });
        return;
      }

      await ensureSessionAndRun({
        item,
        type: 'detail',
      });
    },
    [ensureSessionAndRun],
  );

  const updateHomepageDraftField = useCallback(
    (planId: string, field: string, value: number | string | null) => {
      setHomepageDrafts((current) => ({
        ...current,
        [planId]: {
          ...(current[planId] ?? {}),
          [field]: value,
        },
      }));
      setSaveValidationMessagesByPlan((current) => {
        if (!current[planId]) {
          return current;
        }

        const next = { ...current };
        delete next[planId];
        return next;
      });
      setSaveSuccessMessage(null);
    },
    [],
  );

  const handleSaveHomepage = useCallback(
    async (planId: string) => {
      const draft = homepageDrafts[planId];

      if (!draft) {
        setActionError({
          message: '当前首页详情尚未加载完成，暂时无法保存。',
          target: 'save',
        });
        return;
      }

      const validation = validateCurriculumPlanHomepageBeforeSave(draft);

      if (!validation.valid) {
        setSaveSuccessMessage(null);
        setSaveValidationMessagesByPlan((current) => ({
          ...current,
          [planId]: validation.errors.join('；'),
        }));
        return;
      }

      setSaveValidationMessagesByPlan((current) => {
        if (!current[planId]) {
          return current;
        }

        const next = { ...current };
        delete next[planId];
        return next;
      });

      await ensureSessionAndRun({
        homepage: draft,
        planId,
        type: 'save',
      });
    },
    [ensureSessionAndRun, homepageDrafts],
  );

  const applyDraftUpdate = useCallback((planId: string, nextDraft: Record<string, unknown>) => {
    setHomepageDrafts((current) => ({
      ...current,
      [planId]: nextDraft,
    }));
    setSaveSuccessMessage(null);
  }, []);

  const applyDraftUpdateWithSuggestions = useCallback(
    (
      planId: string,
      beforeDraft: Record<string, unknown>,
      nextDraft: Record<string, unknown>,
      changes: readonly CurriculumPlanHomepageDraftChange[],
      sourceOverrides: Partial<Record<string, SuggestionSource>> = {},
    ) => {
      applyDraftUpdate(planId, nextDraft);
      setSaveValidationMessagesByPlan((current) => {
        if (!current[planId]) {
          return current;
        }

        const next = { ...current };
        delete next[planId];
        return next;
      });
      setSuggestedFieldsByPlan((current) => {
        const nextPlanSuggestions = {
          ...(current[planId] ?? {}),
        };

        for (const change of changes) {
          if (Object.is(beforeDraft[change.field], nextDraft[change.field])) {
            delete nextPlanSuggestions[change.field];
            continue;
          }

          nextPlanSuggestions[change.field] = {
            before: current[planId]?.[change.field]?.before ?? beforeDraft[change.field],
            label: change.label,
            source: sourceOverrides[change.field] ?? resolveSuggestionSource(change.field),
          };
        }

        return {
          ...current,
          [planId]: nextPlanSuggestions,
        };
      });
    },
    [applyDraftUpdate],
  );

  const confirmSuggestedField = useCallback((planId: string, field: string) => {
    setSuggestedFieldsByPlan((current) => {
      const nextPlanSuggestions = { ...(current[planId] ?? {}) };
      delete nextPlanSuggestions[field];

      return {
        ...current,
        [planId]: nextPlanSuggestions,
      };
    });
  }, []);

  const revertSuggestedField = useCallback(
    (planId: string, field: string) => {
      const suggestion = suggestedFieldsByPlan[planId]?.[field];

      if (!suggestion) {
        return;
      }

      setHomepageDrafts((current) => ({
        ...current,
        [planId]: {
          ...(current[planId] ?? {}),
          [field]: suggestion.before,
        },
      }));
      confirmSuggestedField(planId, field);
      setSaveSuccessMessage(null);
    },
    [confirmSuggestedField, suggestedFieldsByPlan],
  );

  const confirmAllSuggestedFields = useCallback((planId: string) => {
    setSuggestedFieldsByPlan((current) => ({
      ...current,
      [planId]: {},
    }));
  }, []);

  const revertAllSuggestedFields = useCallback(
    (planId: string) => {
      const suggestions = suggestedFieldsByPlan[planId] ?? {};

      if (!Object.keys(suggestions).length) {
        return;
      }

      setHomepageDrafts((current) => {
        const nextDraft = { ...(current[planId] ?? {}) };

        for (const [field, suggestion] of Object.entries(suggestions)) {
          nextDraft[field] = suggestion.before;
        }

        return {
          ...current,
          [planId]: nextDraft,
        };
      });
      confirmAllSuggestedFields(planId);
      setSaveSuccessMessage(null);
    },
    [confirmAllSuggestedFields, suggestedFieldsByPlan],
  );

  const handlePreviewPrefill = useCallback(
    async (item: CurriculumPlanHomepageListItem, phase: CurriculumPlanHomepagePrefillPhase) => {
      const draft = homepageDrafts[item.planId];
      const key = buildPhaseKey(item.planId, phase);

      if (!draft) {
        setActionError({
          message: '当前首页详情尚未加载完成，暂时无法预填。',
          target: 'prefill',
        });
        return false;
      }

      const loadPreviewResult = (overrideTimeWindow?: boolean) =>
        previewCurriculumPlanHomepagePrefill({
          context: buildPrefillContext(item, prefillMode),
          mode: prefillMode,
          overrideTimeWindow,
          phase,
          planId: item.planId,
        });

      setIsPreviewingPrefill(true);
      setActionError(null);
      setPrefillPreviewUpdates((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });

      try {
        let result: CurriculumPlanHomepagePrefillResult;

        try {
          result = await loadPreviewResult();
        } catch (error) {
          if (!isCurriculumPlanHomepagePrefillTimeWindowClosedError(error)) {
            throw error;
          }

          if (isAdminAccount) {
            result = await loadPreviewResult(true);
          } else {
            setIsPreviewingPrefill(false);

            const shouldOverrideTimeWindow = await confirmPrefillTimeWindowOverride();

            if (!shouldOverrideTimeWindow) {
              return false;
            }

            setIsPreviewingPrefill(true);
            result = await loadPreviewResult(true);
          }
        }

        const update = buildPrefillDraftUpdate({
          currentDraft: draft,
          fieldWriteRules: result.fieldWriteRules,
          homepagePatch: result.homepagePatch,
        });

        setPrefillPreviewUpdates((current) => ({
          ...current,
          [key]: {
            ...update,
            fieldWriteRules: result.fieldWriteRules,
            homepagePatch: result.homepagePatch,
            warnings: result.warnings,
          },
        }));

        return true;
      } catch (error) {
        setActionError({
          message: resolveCurriculumPlanHomepagePrefillErrorMessage(
            error,
            '暂时无法生成授课计划首页预填。',
          ),
          target: 'prefill',
        });

        return false;
      } finally {
        setIsPreviewingPrefill(false);
      }
    },
    [homepageDrafts, isAdminAccount, prefillMode],
  );

  const handleOpenPrefillModal = useCallback(
    async (item: CurriculumPlanHomepageListItem, phase: CurriculumPlanHomepagePrefillPhase) => {
      if (!homepageDrafts[item.planId]) {
        setActionError({
          message: '当前首页详情尚未加载完成，暂时无法预填。',
          target: 'prefill',
        });
        return;
      }

      setSelectedReferenceCandidateKey('__none__');
      setSelectedEndChapterCandidateKey(null);
      setPrefillModal({
        item,
        phase,
      });

      const isPreviewReady = await handlePreviewPrefill(item, phase);

      if (!isPreviewReady) {
        setPrefillModal(null);
        return;
      }

      await ensureSessionAndRun({
        item,
        phase,
        type: 'prefillCandidates',
      });
    },
    [ensureSessionAndRun, handlePreviewPrefill, homepageDrafts],
  );

  const fetchReferenceHomepageDetail = useCallback(
    async (sourcePlanId: string) => {
      if (!storedSession) {
        openLoginModal();
        throw new Error('请先登录智慧校园后再读取参考教学计划。');
      }

      const runWithSession = async (currentSession: StoredUpstreamSession) => {
        const result = await fetchCurriculumPlanHomepageDetail({
          planId: sourcePlanId,
          sessionToken: currentSession.upstreamSessionToken,
        });

        persistSessionFromResult(currentSession, result);
        return result.homepage;
      };

      try {
        return await runWithSession(storedSession);
      } catch (error) {
        if (!isExpiredUpstreamSessionError(error)) {
          throw error;
        }

        let refreshedSession: StoredUpstreamSession;

        try {
          refreshedSession = await refreshSession(storedSession);
        } catch (refreshError) {
          openLoginModal({
            fallbackUserId: storedSession.upstreamLoginId,
            message: resolveUpstreamRefreshFailureMessage(refreshError),
          });
          throw refreshError;
        }

        try {
          return await runWithSession(refreshedSession);
        } catch (retryError) {
          if (isExpiredUpstreamSessionError(retryError)) {
            openLoginModal({
              fallbackUserId: refreshedSession.upstreamLoginId,
              message: 'upstream 会话已失效，请重新登录后继续。',
            });
          }

          throw retryError;
        }
      }
    },
    [openLoginModal, persistSessionFromResult, refreshSession, storedSession],
  );

  const handleApplyPrefillModal = useCallback(async () => {
    if (!prefillModal) {
      return;
    }

    if (isApplyingPrefill) {
      return;
    }

    const key = buildPhaseKey(prefillModal.item.planId, prefillModal.phase);
    const update = prefillPreviewUpdates[key];
    const draft = homepageDrafts[prefillModal.item.planId];

    if (!update) {
      setActionError({
        message: '预填结果尚未加载完成，暂时无法应用。',
        target: 'prefill',
      });
      return;
    }

    if (!draft) {
      setActionError({
        message: '当前首页详情尚未加载完成，暂时无法应用预填。',
        target: 'prefill',
      });
      return;
    }

    setIsApplyingPrefill(true);
    setActionError(null);

    try {
      let nextDraft = draft;
      const changes: CurriculumPlanHomepageDraftChange[] = [];
      const sourceOverrides: Partial<Record<string, SuggestionSource>> = {};
      const prefillUpdate = buildPrefillDraftUpdate({
        currentDraft: nextDraft,
        fieldWriteRules: update.fieldWriteRules,
        homepagePatch: update.homepagePatch,
      });

      nextDraft = prefillUpdate.nextDraft;
      changes.push(...prefillUpdate.changes);

      if (prefillModal.phase === 'INITIAL') {
        sourceOverrides.teaching_end_chapter_content = 'calculated';
      }

      const selectedReference = flattenReferenceCandidates(
        referenceCandidateResults[key] ?? null,
      ).find((option) => option.key === selectedReferenceCandidateKey);

      if (selectedReference) {
        const referenceUpdate = buildReferenceCandidateDraftUpdate({
          currentDraft: nextDraft,
          group: selectedReference.group,
          item: selectedReference.item,
        });

        nextDraft = referenceUpdate.nextDraft;
        changes.push(...referenceUpdate.changes);

        if (
          prefillModal.phase === 'INITIAL' &&
          selectedReference.item.plannedLessonsDiff !== null &&
          selectedReference.item.plannedLessonsDiff <= 20
        ) {
          const referenceHomepage = await fetchReferenceHomepageDetail(
            selectedReference.item.sourcePlanId,
          );

          if (referenceHomepage) {
            const lessonDistributionUpdate = buildInitialReferenceLessonDistributionDraftUpdate({
              currentDraft: nextDraft,
              plannedLessonsDiff: selectedReference.item.plannedLessonsDiff,
              referenceHomepage,
            });

            nextDraft = lessonDistributionUpdate.nextDraft;
            changes.push(...lessonDistributionUpdate.changes);
          }
        }
      }

      if (prefillModal.phase === 'FINAL' && selectedEndChapterCandidateKey) {
        const endChapterKey = buildPhaseKey(prefillModal.item.planId, 'FINAL');
        const selectedEndChapter = flattenEndChapterCandidates(
          endChapterCandidateResults[endChapterKey] ?? null,
        ).find((option) => option.key === selectedEndChapterCandidateKey);

        if (selectedEndChapter) {
          const endChapterUpdate = buildTeachingEndChapterDraftUpdate({
            currentDraft: nextDraft,
            group: selectedEndChapter.group,
            item: selectedEndChapter.item,
          });

          nextDraft = endChapterUpdate.nextDraft;
          changes.push(...endChapterUpdate.changes);
        }
      }

      if (!changes.length) {
        setSaveSuccessMessage('当前草稿与预填结果一致，无需应用。');
        setPrefillModal(null);
        return;
      }

      applyDraftUpdateWithSuggestions(
        prefillModal.item.planId,
        draft,
        nextDraft,
        changes,
        sourceOverrides,
      );
      setPrefillModal(null);
    } catch (error) {
      setActionError({
        message: resolveUpstreamErrorMessage(error, '暂时无法读取参考教学计划课时分配。'),
        target: 'candidate',
      });
    } finally {
      setIsApplyingPrefill(false);
    }
  }, [
    applyDraftUpdateWithSuggestions,
    endChapterCandidateResults,
    fetchReferenceHomepageDetail,
    homepageDrafts,
    isApplyingPrefill,
    prefillModal,
    prefillPreviewUpdates,
    referenceCandidateResults,
    selectedEndChapterCandidateKey,
    selectedReferenceCandidateKey,
  ]);

  const planTabItems = useMemo(
    () =>
      (listResult?.items ?? []).map((item) => {
        const isActiveItem = selectedPlanId === item.planId;
        const matchedDetail = detailResult?.planId === item.planId ? detailResult : null;
        const draft = homepageDrafts[item.planId];
        const suggestions = suggestedFieldsByPlan[item.planId] ?? {};
        const prefillActionStates = buildPrefillActionStates({
          ignoreTimeWindow: isAdminAccount,
          isLoadingAcademicSemesters,
          item,
          semesters: academicSemesters,
        });

        return {
          children: (
            <div
              style={{
                minHeight: isCompactViewport ? 320 : 400,
                paddingLeft: isCompactViewport ? 0 : token.paddingSM,
              }}
            >
              {isLoadingDetail && isActiveItem ? (
                <Flex
                  align="center"
                  justify="center"
                  style={{ minHeight: isCompactViewport ? 200 : 240 }}
                >
                  <Spin />
                </Flex>
              ) : (
                <Space orientation="vertical" size={token.marginSM} style={{ width: '100%' }}>
                  {matchedDetail && draft ? (
                    <CurriculumPlanHomepageFormPreview
                      key={matchedDetail.planId}
                      homepage={draft}
                      isCompactViewport={isCompactViewport}
                      isLoadingPrefill={isPreviewingPrefill && isActiveItem}
                      isSaving={isSavingHomepage && isActiveItem}
                      prefillActionStates={prefillActionStates}
                      statusMessage={isActiveItem ? saveSuccessMessage : null}
                      suggestions={suggestions}
                      validationMessage={
                        isActiveItem ? (saveValidationMessagesByPlan[item.planId] ?? null) : null
                      }
                      onConfirmAllSuggestions={() => {
                        confirmAllSuggestedFields(item.planId);
                      }}
                      onConfirmSuggestion={(field) => {
                        confirmSuggestedField(item.planId, field);
                      }}
                      onPreviewPrefill={(phase) => {
                        void handleOpenPrefillModal(item, phase);
                      }}
                      onRevertAllSuggestions={() => {
                        revertAllSuggestedFields(item.planId);
                      }}
                      onRevertSuggestion={(field) => {
                        revertSuggestedField(item.planId, field);
                      }}
                      onSave={() => {
                        void handleSaveHomepage(item.planId);
                      }}
                      onUpdateField={(field, value) => {
                        updateHomepageDraftField(item.planId, field, value);
                      }}
                      token={token}
                    />
                  ) : (
                    <Empty description="暂未读取详情" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </Space>
              )}
            </div>
          ),
          key: item.planId,
          label: (
            <div style={{ maxWidth: isCompactViewport ? 180 : 200 }}>
              <div
                style={{
                  fontWeight: isActiveItem ? token.fontWeightStrong : undefined,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.courseName || '未命名课程'}
              </div>
              <Typography.Text
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                type="secondary"
              >
                {item.className || '未返回班级'}
              </Typography.Text>
            </div>
          ),
        };
      }),
    [
      detailResult,
      confirmAllSuggestedFields,
      confirmSuggestedField,
      academicSemesters,
      handleOpenPrefillModal,
      handleSaveHomepage,
      homepageDrafts,
      isLoadingAcademicSemesters,
      isAdminAccount,
      isCompactViewport,
      isLoadingDetail,
      isPreviewingPrefill,
      isSavingHomepage,
      listResult?.items,
      revertAllSuggestedFields,
      revertSuggestedField,
      saveSuccessMessage,
      saveValidationMessagesByPlan,
      selectedPlanId,
      suggestedFieldsByPlan,
      token,
      updateHomepageDraftField,
    ],
  );

  const prefillModalKey = prefillModal
    ? buildPhaseKey(prefillModal.item.planId, prefillModal.phase)
    : null;
  const prefillModalEndChapterKey = prefillModal
    ? buildPhaseKey(prefillModal.item.planId, 'FINAL')
    : null;
  const currentPrefillUpdate = prefillModalKey
    ? (prefillPreviewUpdates[prefillModalKey] ?? null)
    : null;
  const currentReferenceCandidates = prefillModalKey
    ? (referenceCandidateResults[prefillModalKey] ?? null)
    : null;
  const currentEndChapterCandidates = prefillModalEndChapterKey
    ? (endChapterCandidateResults[prefillModalEndChapterKey] ?? null)
    : null;

  useEffect(() => {
    if (!prefillModalKey) {
      return;
    }

    const referenceOptions = flattenReferenceCandidates(
      referenceCandidateResults[prefillModalKey] ?? null,
    );
    const recommendedReference = referenceOptions.find((option) =>
      canRecommendReferenceCandidate(option.item),
    );

    setSelectedReferenceCandidateKey(
      recommendedReference?.key ?? referenceOptions[0]?.key ?? '__none__',
    );
  }, [prefillModalKey, referenceCandidateResults]);

  useEffect(() => {
    if (!prefillModal || prefillModal.phase !== 'FINAL') {
      setSelectedEndChapterCandidateKey(null);
      return;
    }

    const endChapterKey = buildPhaseKey(prefillModal.item.planId, 'FINAL');
    const endChapterOptions = flattenEndChapterCandidates(
      endChapterCandidateResults[endChapterKey] ?? null,
    );

    setSelectedEndChapterCandidateKey(endChapterOptions[0]?.key ?? null);
  }, [endChapterCandidateResults, prefillModal]);

  useEffect(() => {
    let isCancelled = false;

    async function loadAcademicSemesters() {
      setIsLoadingAcademicSemesters(true);
      setAcademicSemestersError(null);

      try {
        const nextSemesters = await requestAcademicSemesters({ limit: 500 });

        if (isCancelled) {
          return;
        }

        setAcademicSemesters(nextSemesters);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setAcademicSemesters([]);
        setAcademicSemestersError(
          resolveUpstreamErrorMessage(error, '暂时无法加载学期日期，预填时间窗口状态不可用。'),
        );
      } finally {
        if (!isCancelled) {
          setIsLoadingAcademicSemesters(false);
        }
      }
    }

    void loadAcademicSemesters();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadDepartmentOptions() {
      if (!canSelectDepartment) {
        setIsLoadingDepartments(false);
        setDepartmentOptions([]);
        setDepartmentOptionsError(null);
        searchForm.setFieldsValue({
          departmentId: null,
        });
        return;
      }

      setIsLoadingDepartments(true);
      setDepartmentOptionsError(null);

      try {
        const departments = await fetchCurriculumPlanHomepageDepartmentOptions();
        const nextOptions = ensureDepartmentSelectOption(
          buildDepartmentSelectOptions(departments),
          {
            id: DEFAULT_DEPARTMENT_ID,
          },
        );

        if (isCancelled) {
          return;
        }

        setDepartmentOptions(nextOptions);
        searchForm.setFieldsValue({
          departmentId: resolveDepartmentDefaultId({
            currentDepartmentId: searchForm.getFieldValue('departmentId') as string | undefined,
            defaultDepartmentId: DEFAULT_DEPARTMENT_ID,
            options: nextOptions,
          }),
        });
      } catch (error) {
        const fallbackOptions = ensureDepartmentSelectOption([], {
          id: DEFAULT_DEPARTMENT_ID,
        });

        if (isCancelled) {
          return;
        }

        setDepartmentOptions(fallbackOptions);
        setDepartmentOptionsError(
          error instanceof Error ? error.message : '暂时无法加载可选系部。',
        );
        searchForm.setFieldsValue({
          departmentId: resolveDepartmentDefaultId({
            currentDepartmentId: searchForm.getFieldValue('departmentId') as string | undefined,
            defaultDepartmentId: DEFAULT_DEPARTMENT_ID,
            options: fallbackOptions,
          }),
        });
      } finally {
        if (!isCancelled) {
          setIsLoadingDepartments(false);
        }
      }
    }

    void loadDepartmentOptions();

    return () => {
      isCancelled = true;
    };
  }, [canSelectDepartment, searchForm]);

  useEffect(() => {
    if (!keepAliveFailure) {
      return;
    }

    clearCurrentSession({
      message: keepAliveFailure.message,
      target: 'session',
    });
    openLoginModal({
      fallbackUserId: keepAliveFailure.upstreamLoginId,
      message: keepAliveFailure.message,
    });
  }, [clearCurrentSession, keepAliveFailure, openLoginModal]);

  useEffect(() => {
    if (
      !listResult?.items.length ||
      !storedSession ||
      isLoadingList ||
      isLoadingDetail ||
      isLoginModalOpen
    ) {
      return;
    }

    const activeItem =
      listResult.items.find((item) => item.planId === selectedPlanId) ?? listResult.items[0];

    if (!activeItem) {
      return;
    }

    if (detailResult?.planId === activeItem.planId && selectedPlanId === activeItem.planId) {
      return;
    }

    if (selectedPlanId !== activeItem.planId) {
      setSelectedPlanId(activeItem.planId);
    }

    void handleSelectPlan(activeItem);
  }, [
    detailResult?.planId,
    handleSelectPlan,
    isLoadingDetail,
    isLoadingList,
    isLoginModalOpen,
    listResult?.items,
    selectedPlanId,
    storedSession,
  ]);

  async function handleFetchList(values: SearchFormValues) {
    await ensureSessionAndRun({
      type: 'list',
      values: canSelectDepartment ? values : { ...values, departmentId: null },
    });
  }

  async function handleLogin(values: UpstreamLoginFormValues) {
    setIsSubmittingLogin(true);
    setLoginError(null);

    try {
      const nextSession = await loginUpstream(values);
      const action = pendingAction;

      setPendingAction(null);
      setIsLoginModalOpen(false);

      if (action) {
        await performAction(nextSession, action);
      }
    } catch (error) {
      setLoginError(resolveUpstreamErrorMessage(error, 'upstream 登录失败，请检查账号或密码。'));
    } finally {
      setIsSubmittingLogin(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: token.marginSM }}>
      <DecoratedPageHeader
        aside={
          <span
            style={{
              alignSelf: 'flex-start',
              paddingTop: token.marginXS,
            }}
          >
            <Tag
              style={{
                background: token.colorErrorBg,
                borderColor: token.colorErrorBorder,
                color: token.colorErrorText,
                fontSize: token.fontSizeSM,
                fontWeight: token.fontWeightStrong,
                lineHeight: 1.2,
                marginInlineEnd: 0,
                paddingInline: token.paddingXXS,
              }}
            >
              试运行
            </Tag>
          </span>
        }
        colorScheme="purple"
        description="对照历史计划，补齐首页信息"
        icon={<BookOutlined />}
        title="My 计划首页"
      />

      {actionError ? <Alert showIcon message={actionError.message} type="warning" /> : null}
      {academicSemestersError ? (
        <Alert showIcon message={academicSemestersError} type="warning" />
      ) : null}

      <Card size="small">
        <Form<SearchFormValues>
          form={searchForm}
          initialValues={defaultSearchValues}
          layout="inline"
          requiredMark={false}
          size="small"
          style={{ rowGap: token.marginXS }}
          onFinish={(values) => {
            void handleFetchList(values);
          }}
        >
          <Form.Item
            label="学年"
            name="schoolYear"
            rules={[{ required: true, message: '请选择学年' }]}
          >
            <Select options={schoolYearOptions} style={{ width: 124 }} />
          </Form.Item>
          <Form.Item
            label="学期"
            name="semester"
            rules={[{ required: true, message: '请选择学期' }]}
          >
            <Select options={SEMESTER_OPTIONS} style={{ width: 108 }} />
          </Form.Item>
          {canSelectDepartment ? (
            <DepartmentFormItem
              label="系部"
              loading={isLoadingDepartments}
              options={departmentOptions}
              required
              selectProps={{
                size: 'small',
                style: { width: 200 },
              }}
              validateStatus={departmentOptionsError ? 'warning' : undefined}
            />
          ) : null}
          <Form.Item>
            <Button
              disabled={canSelectDepartment && isLoadingDepartments}
              htmlType="submit"
              icon={<SearchOutlined />}
              loading={isLoadingList}
              size="small"
              type="primary"
            >
              读取计划列表
            </Button>
          </Form.Item>
        </Form>
        {canSelectDepartment && departmentOptionsError ? (
          <Alert showIcon message={departmentOptionsError} type="warning" />
        ) : null}
      </Card>

      {listResult?.items?.length ? (
        <Tabs
          activeKey={selectedPlanId ?? listResult.items[0]?.planId}
          items={planTabItems}
          size="small"
          tabBarGutter={token.marginXS}
          tabPosition={isCompactViewport ? 'top' : 'left'}
          onChange={(nextPlanId) => {
            const nextItem = listResult.items.find((item) => item.planId === nextPlanId);

            if (!nextItem) {
              return;
            }

            void handleSelectPlan(nextItem);
          }}
        />
      ) : (
        <Flex
          align="center"
          justify="center"
          style={{
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
            minHeight: isCompactViewport ? 200 : 240,
          }}
        >
          <Empty description={isLoadingList ? '正在读取' : '暂无授课计划'} />
        </Flex>
      )}

      <UpstreamLoginModal
        form={loginForm}
        hasRememberedCredentials={canUseRememberedCredentials}
        isSubmitting={isSubmittingLogin}
        lockedUserId={lockedUpstreamLoginUserId}
        loginError={loginError}
        open={isLoginModalOpen}
        title="登录智慧校园"
        onCancel={() => {
          setIsLoginModalOpen(false);
          setPendingAction(null);
          setLoginError(null);
        }}
        onClearRememberedCredentials={clearRememberedCredentials}
        onFinish={(values) => {
          void handleLogin(values);
        }}
      />

      <CurriculumPlanHomepagePrefillModal
        modal={prefillModal}
        endChapterCandidates={currentEndChapterCandidates}
        isApplying={isApplyingPrefill}
        isLoadingEndChapterCandidates={
          Boolean(prefillModalEndChapterKey) && loadingEndChapterKey === prefillModalEndChapterKey
        }
        isLoadingPrefill={isPreviewingPrefill}
        isLoadingReferenceCandidates={
          Boolean(prefillModalKey) && loadingReferenceKey === prefillModalKey
        }
        prefillUpdate={currentPrefillUpdate}
        referenceCandidates={currentReferenceCandidates}
        selectedEndChapterKey={selectedEndChapterCandidateKey}
        selectedReferenceKey={selectedReferenceCandidateKey}
        setSelectedEndChapterKey={setSelectedEndChapterCandidateKey}
        setSelectedReferenceKey={setSelectedReferenceCandidateKey}
        onApply={handleApplyPrefillModal}
        onClose={() => {
          setPrefillModal(null);
        }}
      />
    </div>
  );
}
