// src/features/academic-integrated-plan-corrections/ui/academic-integrated-plan-corrections-page-content.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  ExclamationCircleOutlined,
  FileSearchOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Empty,
  Form,
  Select,
  Skeleton,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';
import {
  buildUpstreamLoginCredentialsInitialValues,
  canUseRememberedUpstreamLoginCredentials,
  isExpiredUpstreamSessionError,
  type StoredUpstreamSession,
  type UpstreamLoginFormValues,
  UpstreamLoginModal,
  useUpstreamSession,
} from '@/entities/upstream-session';

import type { AcademicViewerRole } from '@/shared/auth-access';
import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import {
  resolveStaffDirectoryCache,
  resolveStaffDirectoryTeacherStaffId,
  type StaffDirectoryResult,
  StaffDirectoryTeacherAutoComplete,
} from '@/shared/upstream';

import { canViewIntegratedPlanCorrectionRepairGroups } from '../application/correction-view-policy';
import {
  type IntegratedPlanCorrectionAlignmentStatus,
  type IntegratedPlanCorrectionItem,
  type IntegratedPlanCorrectionOccurrence,
  type IntegratedPlanCorrectionRepairGroup,
  type IntegratedPlanCorrectionSuggestion,
  type IntegratedPlanCorrectionSuggestionsResult,
  type IntegratedPlanCorrectionTeachingClassGroup,
  listIntegratedPlanCorrectionSuggestions,
  listMyIntegratedPlanCorrectionSuggestions,
} from '../infrastructure/academic-integrated-plan-corrections-api';

import './academic-integrated-plan-corrections-page-content.css';

export type AcademicIntegratedPlanCorrectionsPageLoaderData = {
  defaultStaffId?: string | null;
  upstreamAccount?: {
    accountId: number;
    displayName: string;
  } | null;
  viewerRole?: AcademicViewerRole;
} | null;

export type AcademicIntegratedPlanCorrectionsPageContentProps =
  NonNullable<AcademicIntegratedPlanCorrectionsPageLoaderData>;

type QueryFilters = {
  staffId: string;
};

const EMPTY_TEXT = '—';
const DAY_OF_WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const PLAN_DETAIL_EXTRA_WARNING_TEXT =
  '该计划周次没有对应校历可排课次，优先建议删除该计划明细或调整周次。';

const DIFF_LABELS: Record<string, string> = {
  ACADEMIC_SEMESTER_TARGET_NOT_FOUND: '学期坐标缺失',
  CASCADE_FROM_BLOCKING_DETAIL: '前序阻塞连带',
  CROSS_DAY: '跨天',
  CROSS_WEEK: '跨周',
  LECTURE_PLAN_DETAIL_ID_MISSING: '明细 ID 缺失',
  LESSON_HOURS_MISMATCH: '课时不一致',
  OCCURRENCE_HOURS_INSUFFICIENT: '课表课时不足',
  PLANNED_OCCURRENCE_PROJECTION_INVALID: '课表投影无效',
  PLAN_DETAIL_EXTRA: '计划明细多填',
  PLAN_DETAIL_MISSING: '计划明细缺失',
  PLAN_LESSON_HOURS_EXTRA: '计划课时多排',
  PLAN_LESSON_HOURS_MISSING: '计划课时少排',
  WEEK_NUMBER_MISMATCH: '周次不一致',
};

const BLOCKING_DIFFS = new Set([
  'ACADEMIC_SEMESTER_TARGET_NOT_FOUND',
  'LECTURE_PLAN_DETAIL_ID_MISSING',
  'OCCURRENCE_HOURS_INSUFFICIENT',
  'PLANNED_OCCURRENCE_PROJECTION_INVALID',
]);
const PRIMARY_DIFF_PRIORITY = [
  'ACADEMIC_SEMESTER_TARGET_NOT_FOUND',
  'LECTURE_PLAN_DETAIL_ID_MISSING',
  'OCCURRENCE_HOURS_INSUFFICIENT',
  'PLANNED_OCCURRENCE_PROJECTION_INVALID',
  'PLAN_DETAIL_EXTRA',
  'PLAN_DETAIL_MISSING',
  'PLAN_LESSON_HOURS_EXTRA',
  'PLAN_LESSON_HOURS_MISSING',
  'WEEK_NUMBER_MISMATCH',
  'LESSON_HOURS_MISMATCH',
  'CROSS_WEEK',
  'CROSS_DAY',
  'CASCADE_FROM_BLOCKING_DETAIL',
] as const;

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

function formatNullable(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : EMPTY_TEXT;
  }

  const normalizedValue = value?.trim();

  return normalizedValue || EMPTY_TEXT;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00+08:00`);

  if (Number.isNaN(date.getTime())) {
    return value || EMPTY_TEXT;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

function resolveDiffColor(diff: string) {
  if (BLOCKING_DIFFS.has(diff)) {
    return 'red';
  }

  if (diff === 'PLAN_DETAIL_EXTRA' || diff === 'PLAN_DETAIL_MISSING') {
    return 'volcano';
  }

  if (diff === 'PLAN_LESSON_HOURS_EXTRA' || diff === 'PLAN_LESSON_HOURS_MISSING') {
    return 'gold';
  }

  if (diff === 'CROSS_DAY' || diff === 'CROSS_WEEK' || diff === 'CASCADE_FROM_BLOCKING_DETAIL') {
    return 'orange';
  }

  return 'blue';
}

function hasPlanDetailExtra(diffs: readonly string[]) {
  return diffs.includes('PLAN_DETAIL_EXTRA');
}

function resolveAlignmentMeta(status: IntegratedPlanCorrectionAlignmentStatus) {
  if (status === 'CURRENT_ONLY') {
    return {
      className: 'integrated-plan-corrections-alignment-current-only',
      label: '计划多排',
      tagColor: 'volcano',
    };
  }

  if (status === 'EXPECTED_ONLY') {
    return {
      className: 'integrated-plan-corrections-alignment-expected-only',
      label: '计划少排',
      tagColor: 'orange',
    };
  }

  return {
    className: 'integrated-plan-corrections-alignment-matched',
    label: '已对齐',
    tagColor: 'green',
  };
}

function resolvePrimaryAlignmentDiff(item: IntegratedPlanCorrectionItem) {
  for (const diff of PRIMARY_DIFF_PRIORITY) {
    if (item.diffs.includes(diff)) {
      return diff;
    }
  }

  return item.diffs[0] ?? null;
}

function resolveAlignmentBadge(item: IntegratedPlanCorrectionItem) {
  const primaryDiff = resolvePrimaryAlignmentDiff(item);

  if (primaryDiff) {
    return {
      label: DIFF_LABELS[primaryDiff] ?? primaryDiff,
      tagColor: resolveDiffColor(primaryDiff),
    };
  }

  return resolveAlignmentMeta(item.alignmentStatus);
}

function resolveAlignmentActionText(item: IntegratedPlanCorrectionItem) {
  if (item.blockingIssue) {
    return '存在阻塞，先处理阻塞原因。';
  }

  if (item.alignmentStatus === 'MATCHED' && item.diffs.includes('WEEK_NUMBER_MISMATCH')) {
    return '周次需修正。';
  }

  const hoursDiffText = resolvePlanLessonHoursDiffText(item);

  if (hoursDiffText) {
    return hoursDiffText;
  }

  if (item.alignmentStatus === 'CURRENT_ONLY' && item.diffs.includes('PLAN_DETAIL_EXTRA')) {
    return PLAN_DETAIL_EXTRA_WARNING_TEXT;
  }

  if (item.alignmentStatus === 'EXPECTED_ONLY' && item.diffs.includes('PLAN_DETAIL_MISSING')) {
    return '计划少排一条明细。';
  }

  if (item.alignmentStatus === 'CURRENT_ONLY') {
    return '计划侧多出一行，建议删除或调整。';
  }

  if (item.alignmentStatus === 'EXPECTED_ONLY') {
    return '按校历排课课次缺少对应计划行，建议补充。';
  }

  if (item.diffs.length > 0) {
    return '授课计划行已匹配校历课次，但字段需要按建议值修正。';
  }

  return '授课计划行与校历课次一致。';
}

function resolvePlanLessonHoursDiffText(input: {
  currentPlan: { lessonHours: number | null; weekNumber: number | null };
  diffs: readonly string[];
  suggested: { firstWeekNumber: number | null; lessonHours: number | null };
}) {
  const currentLessonHours = input.currentPlan.lessonHours;
  const suggestedLessonHours = input.suggested.lessonHours;

  if (
    input.diffs.includes('PLAN_LESSON_HOURS_EXTRA') &&
    typeof currentLessonHours === 'number' &&
    typeof suggestedLessonHours === 'number'
  ) {
    const delta = currentLessonHours - suggestedLessonHours;

    return `计划多排 ${Math.max(delta, 0)} 课时。`;
  }

  if (
    input.diffs.includes('PLAN_LESSON_HOURS_MISSING') &&
    typeof currentLessonHours === 'number' &&
    typeof suggestedLessonHours === 'number'
  ) {
    const delta = suggestedLessonHours - currentLessonHours;

    return `计划少排 ${Math.max(delta, 0)} 课时。`;
  }

  return null;
}

function getAlignmentRowKey(item: IntegratedPlanCorrectionItem) {
  return [
    item.alignmentStatus,
    item.lecturePlanDetailId || 'detail',
    item.lecturePlanId || 'plan',
    item.currentOriginalIndex ?? 'current',
    item.expectedIndex ?? 'expected',
    item.repairGroupId || 'group',
  ].join('-');
}

function isConsistentAlignmentItem(item: IntegratedPlanCorrectionItem) {
  return item.alignmentStatus === 'MATCHED' && item.diffs.length === 0;
}

function buildFallbackTeachingClassGroups(
  items: readonly IntegratedPlanCorrectionItem[],
): IntegratedPlanCorrectionTeachingClassGroup[] {
  if (items.length === 0) {
    return [];
  }

  return [
    {
      courseName: null,
      endOriginalIndex: items.length,
      id: 'all-items',
      itemOriginalIndexes: items.map((_, index) => index + 1),
      lecturePlanId: null,
      repairGroupIds: [],
      startOriginalIndex: 1,
      teachingClassId: null,
      teachingClassName: '全部对齐结果',
    },
  ];
}

function renderDiffTags(diffs: readonly string[]) {
  if (diffs.length === 0) {
    return <Typography.Text type="secondary">无 diff</Typography.Text>;
  }

  return (
    <span className="integrated-plan-corrections-tags">
      {diffs.map((diff) => (
        <Tag color={resolveDiffColor(diff)} key={diff}>
          {DIFF_LABELS[diff] ?? diff}
        </Tag>
      ))}
    </span>
  );
}

function formatIndexRangeValue(startOriginalIndex: number | null, endOriginalIndex: number | null) {
  if (startOriginalIndex === null && endOriginalIndex === null) {
    return EMPTY_TEXT;
  }

  if (startOriginalIndex === endOriginalIndex || endOriginalIndex === null) {
    return formatNullable(startOriginalIndex);
  }

  return `${formatNullable(startOriginalIndex)} - ${formatNullable(endOriginalIndex)}`;
}

function buildRepairGroupLocatorText(group: IntegratedPlanCorrectionRepairGroup) {
  return [
    `需要修复组 ID: ${formatNullable(group.id)}`,
    `教学班 ID: ${formatNullable(group.teachingClassId)}`,
    `计划 ID: ${formatNullable(group.lecturePlanId)}`,
    `index: ${formatIndexRangeValue(group.startOriginalIndex, group.endOriginalIndex)}`,
    `root 明细 ID: ${formatNullable(group.rootLecturePlanDetailId)}`,
  ].join('\n');
}

function buildSuggestionLocatorText(suggestion: IntegratedPlanCorrectionSuggestion) {
  return [`明细 ID: ${formatNullable(suggestion.lecturePlanDetailId)}`].join('\n');
}

function buildAlignmentItemLocatorText(item: IntegratedPlanCorrectionItem) {
  return [
    `明细 ID: ${formatNullable(item.lecturePlanDetailId)}`,
    `教学班 ID: ${formatNullable(item.teachingClassId)}`,
    `计划 ID: ${formatNullable(item.lecturePlanId)}`,
    `当前序号: ${formatNullable(item.currentOriginalIndex)}`,
    `应有序号: ${formatNullable(item.expectedIndex)}`,
    `需要修复组 ID: ${formatNullable(item.repairGroupId)}`,
  ].join('\n');
}

async function copyLocatorText(text: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return;
  }

  await navigator.clipboard.writeText(text);
}

function LocatorCopyText({ text }: { text: string }) {
  return (
    <span className="integrated-plan-corrections-locator-copy">
      <Tooltip
        overlayClassName="integrated-plan-corrections-locator-tooltip"
        title={<pre>{text}</pre>}
      >
        <Button
          aria-label="复制定位信息"
          icon={<QuestionCircleOutlined />}
          shape="circle"
          size="small"
          type="text"
          onClick={() => void copyLocatorText(text)}
        />
      </Tooltip>
    </span>
  );
}

function formatOccurrence(occurrence: IntegratedPlanCorrectionOccurrence) {
  const dayOfWeekLabel =
    DAY_OF_WEEK_LABELS[occurrence.dayOfWeek - 1] ?? `周${occurrence.dayOfWeek}`;

  return `${formatDate(occurrence.date)} ${dayOfWeekLabel} 第 ${occurrence.weekNumber} 周 ${occurrence.periodStart}-${occurrence.periodEnd} 节 / ${occurrence.lessonHours} 课时`;
}

function formatCompactOccurrence(occurrence: IntegratedPlanCorrectionOccurrence) {
  const dayOfWeekLabel =
    DAY_OF_WEEK_LABELS[occurrence.dayOfWeek - 1] ?? `周${occurrence.dayOfWeek}`;

  return `${dayOfWeekLabel} ${occurrence.periodStart}-${occurrence.periodEnd}节 · ${occurrence.lessonHours}课时`;
}

function resolveSuggestedWeekSummary(suggested: {
  firstWeekNumber: number | null;
  suggestedOccurrences: IntegratedPlanCorrectionOccurrence[];
}) {
  const weekNumbers = Array.from(
    new Set(
      suggested.suggestedOccurrences
        .map((occurrence) => occurrence.weekNumber)
        .filter((weekNumber) => Number.isFinite(weekNumber)),
    ),
  );
  const isCrossWeek = weekNumbers.length > 1;

  return {
    isCrossWeek,
    label: isCrossWeek ? '首周' : '周次',
    value: isCrossWeek
      ? (suggested.firstWeekNumber ?? weekNumbers[0] ?? null)
      : (weekNumbers[0] ?? suggested.firstWeekNumber),
  };
}

function SummaryMetric({
  label,
  tone = 'default',
  value,
}: {
  label: string;
  tone?: 'default' | 'danger' | 'warning';
  value: number;
}) {
  return (
    <div
      className={`integrated-plan-corrections-metric integrated-plan-corrections-metric-${tone}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PlanField({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <div className="integrated-plan-corrections-field">
      <span>{label}</span>
      <strong>{formatNullable(value)}</strong>
    </div>
  );
}

function PlanMetric({
  label,
  tone = 'default',
  value,
}: {
  label: string;
  tone?: 'default' | 'warning';
  value: number | string | null | undefined;
}) {
  return (
    <div
      className={`integrated-plan-corrections-plan-metric integrated-plan-corrections-plan-metric-${tone}`}
    >
      <span>{label}</span>
      <strong>{formatNullable(value)}</strong>
    </div>
  );
}

function CurrentPlanDetails({
  currentPlan,
}: {
  currentPlan: IntegratedPlanCorrectionSuggestion['currentPlan'];
}) {
  return (
    <details className="integrated-plan-corrections-plan-details">
      <summary>计划侧其他字段</summary>
      <div className="integrated-plan-corrections-field-grid">
        <PlanField label="任务" value={currentPlan.learningTaskName} />
        <PlanField label="任务号" value={currentPlan.learningTaskNo} />
        <PlanField label="环节" value={currentPlan.learningSessionContent} />
        <PlanField label="环节号" value={currentPlan.learningSessionNo} />
        <PlanField label="单元" value={currentPlan.teachingUnitName} />
        <PlanField label="单元号" value={currentPlan.teachingUnitNo} />
      </div>
    </details>
  );
}

function PlanComparison({
  currentPlan,
  suggested,
}: {
  currentPlan: IntegratedPlanCorrectionSuggestion['currentPlan'];
  suggested: IntegratedPlanCorrectionSuggestion['suggested'];
}) {
  const suggestedWeek = resolveSuggestedWeekSummary(suggested);

  return (
    <div className="integrated-plan-corrections-compare">
      <section className="integrated-plan-corrections-compare-pane integrated-plan-corrections-compare-pane-current">
        <div className="integrated-plan-corrections-compare-pane-head">
          <h4>授课计划中计划课时</h4>
          <Tag color="gold">需修正</Tag>
        </div>
        <div className="integrated-plan-corrections-plan-metrics">
          <PlanMetric label="周次" value={currentPlan.weekNumber} />
          <PlanMetric label="课时" value={currentPlan.lessonHours} />
        </div>
        <CurrentPlanDetails currentPlan={currentPlan} />
      </section>
      <div className="integrated-plan-corrections-compare-vs" aria-hidden="true">
        VS
      </div>
      <section className="integrated-plan-corrections-compare-pane integrated-plan-corrections-compare-pane-suggested">
        <h4>
          按校历计算所得剩余可排课课次
          {suggestedWeek.isCrossWeek ? <Tag color="orange">跨周</Tag> : null}
        </h4>
        <div className="integrated-plan-corrections-plan-metrics">
          <PlanMetric
            label={suggestedWeek.label}
            tone={suggestedWeek.isCrossWeek ? 'warning' : 'default'}
            value={suggestedWeek.value}
          />
          <PlanMetric label="课时" value={suggested.lessonHours} />
        </div>
        <div className="integrated-plan-corrections-occurrences">
          {suggested.suggestedOccurrences.length ? (
            suggested.suggestedOccurrences.map((occurrence) => (
              <span
                className="integrated-plan-corrections-occurrence"
                key={`${occurrence.date}-${occurrence.periodStart}-${occurrence.periodEnd}`}
                title={formatOccurrence(occurrence)}
              >
                <span>{formatCompactOccurrence(occurrence)}</span>
                <small>{formatDate(occurrence.date)}</small>
              </span>
            ))
          ) : (
            <Typography.Text type="secondary">无课表真值片段</Typography.Text>
          )}
        </div>
      </section>
    </div>
  );
}

function SuggestionPanel({
  rootLecturePlanDetailId,
  suggestion,
}: {
  rootLecturePlanDetailId: string | null;
  suggestion: IntegratedPlanCorrectionSuggestion;
}) {
  const isGroupRoot =
    Boolean(rootLecturePlanDetailId) && suggestion.lecturePlanDetailId === rootLecturePlanDetailId;

  return (
    <div className="integrated-plan-corrections-suggestion">
      <div className="integrated-plan-corrections-suggestion-head">
        <div>
          <Typography.Text strong>计划明细</Typography.Text>
          <LocatorCopyText text={buildSuggestionLocatorText(suggestion)} />
          {isGroupRoot ? (
            <Tag color="blue">分组 root</Tag>
          ) : suggestion.cascadeFromGroupRoot && suggestion.blockingIssue ? (
            <Tag color="orange">阻塞连带项</Tag>
          ) : (
            <Tag>组内项</Tag>
          )}
        </div>
        <div>{renderDiffTags(suggestion.diffs)}</div>
      </div>

      {suggestion.blockingIssue ? (
        <Alert title={`阻塞：${suggestion.blockingIssue}`} showIcon type="warning" />
      ) : null}
      {hasPlanDetailExtra(suggestion.diffs) ? (
        <Alert
          description={PLAN_DETAIL_EXTRA_WARNING_TEXT}
          title="计划明细多填"
          showIcon
          type="warning"
        />
      ) : null}

      <PlanComparison currentPlan={suggestion.currentPlan} suggested={suggestion.suggested} />
    </div>
  );
}

function AlignmentItemCard({ item }: { item: IntegratedPlanCorrectionItem }) {
  const alignmentMeta = resolveAlignmentMeta(item.alignmentStatus);
  const alignmentBadge = resolveAlignmentBadge(item);
  const primaryDiff = resolvePrimaryAlignmentDiff(item);
  const secondaryDiffs = primaryDiff
    ? item.diffs.filter((diff) => diff !== primaryDiff)
    : item.diffs;

  return (
    <article className={`integrated-plan-corrections-alignment-row ${alignmentMeta.className}`}>
      <header className="integrated-plan-corrections-alignment-head">
        <div>
          <div className="integrated-plan-corrections-alignment-title-row">
            <Tag color={alignmentBadge.tagColor}>{alignmentBadge.label}</Tag>
            <Typography.Text strong>
              {formatNullable(item.courseName)} / {formatNullable(item.teachingClassName)}
            </Typography.Text>
            <LocatorCopyText text={buildAlignmentItemLocatorText(item)} />
          </div>
        </div>
        {secondaryDiffs.length > 0 ? <div>{renderDiffTags(secondaryDiffs)}</div> : null}
      </header>

      <Alert
        title={resolveAlignmentActionText(item)}
        showIcon
        type={item.alignmentStatus === 'MATCHED' && item.diffs.length === 0 ? 'success' : 'warning'}
      />

      {item.blockingIssue ? (
        <Alert title={`阻塞：${item.blockingIssue}`} showIcon type="error" />
      ) : null}

      <PlanComparison currentPlan={item.currentPlan} suggested={item.suggested} />
    </article>
  );
}

function RepairGroupCard({
  group,
  index,
}: {
  group: IntegratedPlanCorrectionRepairGroup;
  index: number;
}) {
  const hasBlockingIssue = Boolean(group.blockingIssue);

  return (
    <article
      className={`integrated-plan-corrections-group ${
        hasBlockingIssue ? 'integrated-plan-corrections-group-blocked' : ''
      }`}
    >
      <header className="integrated-plan-corrections-group-head">
        <div>
          <Typography.Text type="secondary">需要修复组 {index + 1}</Typography.Text>
          <h3>{hasBlockingIssue ? '存在阻塞的连续异常' : '连续异常'}</h3>
        </div>
        <div className="integrated-plan-corrections-group-summary">
          <span>{group.affectedDetailIds.length} 条受影响明细</span>
          <LocatorCopyText text={buildRepairGroupLocatorText(group)} />
        </div>
      </header>

      <div className="integrated-plan-corrections-group-tags">{renderDiffTags(group.diffs)}</div>

      {group.blockingIssue ? (
        <Alert
          description="该组不能作为普通修正建议自动处理，需要管理人员先确认阻塞原因。"
          title={`阻塞：${group.blockingIssue}`}
          showIcon
          type="error"
        />
      ) : null}
      {hasPlanDetailExtra(group.diffs) ? (
        <Alert
          description="这通常是后续错位的根因：计划里多填了一个真实课表/校历下不存在的周次。请优先删除该计划明细或调整周次。"
          title="优先处理计划明细多填项"
          showIcon
          type="warning"
        />
      ) : null}

      <details className="integrated-plan-corrections-details" open={index === 0}>
        <summary>组内建议 {group.suggestions.length} 条</summary>
        <div className="integrated-plan-corrections-suggestion-list">
          {group.suggestions.map((suggestion) => (
            <SuggestionPanel
              key={`${group.id}-${suggestion.lecturePlanDetailId ?? 'detail'}`}
              rootLecturePlanDetailId={group.rootLecturePlanDetailId}
              suggestion={suggestion}
            />
          ))}
        </div>
      </details>
    </article>
  );
}

function SecondaryRepairGroups({
  repairGroups,
}: {
  repairGroups: IntegratedPlanCorrectionRepairGroup[];
}) {
  if (repairGroups.length === 0) {
    return null;
  }

  return (
    <details className="integrated-plan-corrections-debug">
      <summary>连续异常分组 repairGroups（{repairGroups.length}）</summary>
      <div className="integrated-plan-corrections-debug-hint">
        管理员调试信息，普通用户无需关注。
      </div>
      <div className="integrated-plan-corrections-groups integrated-plan-corrections-groups-secondary">
        {repairGroups.map((group, index) => (
          <RepairGroupCard group={group} index={index} key={group.id} />
        ))}
      </div>
    </details>
  );
}

function TeachingClassAlignmentTable({
  items,
  repairGroups,
  showRepairGroups,
}: {
  items: IntegratedPlanCorrectionItem[];
  repairGroups: IntegratedPlanCorrectionRepairGroup[];
  showRepairGroups: boolean;
}) {
  return (
    <section className="integrated-plan-corrections-table">
      <header className="integrated-plan-corrections-table-head">
        <div className="integrated-plan-corrections-table-title-row">
          <span className="integrated-plan-corrections-table-title">勘误对齐表</span>
          <span className="integrated-plan-corrections-table-subtitle">
            该功能仅供参考，不保证修改后完全合规
          </span>
        </div>
        <div className="integrated-plan-corrections-table-summary">
          <span>{items.length} 行</span>
          {showRepairGroups ? <span>{repairGroups.length} 个异常分组</span> : null}
        </div>
      </header>

      {items.length === 0 ? (
        <div className="integrated-plan-corrections-empty">
          <Empty description="当前勘误对齐表没有可展示行" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <div className="integrated-plan-corrections-alignments">
          {items.map((item) => (
            <AlignmentItemCard item={item} key={getAlignmentRowKey(item)} />
          ))}
        </div>
      )}

      {showRepairGroups ? <SecondaryRepairGroups repairGroups={repairGroups} /> : null}
    </section>
  );
}

function buildTeachingClassTabLabel(input: {
  group: IntegratedPlanCorrectionTeachingClassGroup;
  itemCount: number;
}) {
  const title = [input.group.courseName, input.group.teachingClassName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' / ');

  return (
    <span className="integrated-plan-corrections-tab-label">
      <span title={title || input.group.id}>{title || input.group.id}</span>
      <Tag>{input.itemCount}</Tag>
    </span>
  );
}

function TeachingClassAlignmentTabs({
  showRepairGroups,
  tables,
}: {
  showRepairGroups: boolean;
  tables: {
    group: IntegratedPlanCorrectionTeachingClassGroup;
    items: IntegratedPlanCorrectionItem[];
    repairGroups: IntegratedPlanCorrectionRepairGroup[];
  }[];
}) {
  if (tables.length === 1) {
    const [table] = tables;

    return (
      <TeachingClassAlignmentTable
        items={table.items}
        repairGroups={table.repairGroups}
        showRepairGroups={showRepairGroups}
      />
    );
  }

  return (
    <div className="integrated-plan-corrections-tabs">
      <Tabs
        items={tables.map((table) => ({
          children: (
            <TeachingClassAlignmentTable
              items={table.items}
              repairGroups={table.repairGroups}
              showRepairGroups={showRepairGroups}
            />
          ),
          key: table.group.id,
          label: buildTeachingClassTabLabel({
            group: table.group,
            itemCount: table.items.length,
          }),
        }))}
      />
    </div>
  );
}

export function AcademicIntegratedPlanCorrectionsPageContent({
  defaultStaffId: rawDefaultStaffId,
  upstreamAccount = null,
  viewerRole = 'authenticated',
}: AcademicIntegratedPlanCorrectionsPageContentProps) {
  const defaultStaffId = rawDefaultStaffId?.trim() ?? '';
  const isStaffViewer = viewerRole === 'staff';
  const showRepairGroups = canViewIntegratedPlanCorrectionRepairGroups(viewerRole);
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const {
    clear,
    clearRememberedCredentials,
    login,
    persistSessionFromResult,
    rememberedCredentials,
    session: storedSession,
  } = useUpstreamSession({
    account: upstreamAccount,
    keepAlive: true,
  });
  const canUseRememberedCredentials = canUseRememberedUpstreamLoginCredentials({
    lockedUserId: isStaffViewer && defaultStaffId ? defaultStaffId : null,
    rememberedCredentials,
  });
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [filters, setFilters] = useState<QueryFilters>({
    staffId: defaultStaffId,
  });
  const [result, setResult] = useState<IntegratedPlanCorrectionSuggestionsResult | null>(null);
  const [staffDirectoryResult, setStaffDirectoryResult] = useState<StaffDirectoryResult | null>(
    null,
  );
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [staffDirectoryError, setStaffDirectoryError] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoadingSemesters, setIsLoadingSemesters] = useState(false);
  const [isLoadingStaffDirectory, setIsLoadingStaffDirectory] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [showConsistentRows, setShowConsistentRows] = useState(false);
  const [shouldRunQueryAfterLogin, setShouldRunQueryAfterLogin] = useState(false);

  const selectedSemester = semesters.find((semester) => semester.id === selectedSemesterId) ?? null;
  const staffDirectoryTeachers = useMemo(
    () => staffDirectoryResult?.teachers ?? [],
    [staffDirectoryResult?.teachers],
  );
  const normalizedStaffId = resolveStaffDirectoryTeacherStaffId(
    filters.staffId,
    staffDirectoryTeachers,
  );
  const storedSessionDirectoryKey = storedSession
    ? [
        storedSession.accountId,
        storedSession.upstreamLoginId || 'unknown',
        storedSession.upstreamSessionToken,
      ].join(':')
    : 'none';
  const semesterOptions = useMemo(
    () =>
      semesters.map((semester) => ({
        label: `${semester.name}${semester.isCurrent ? ' · 当前' : ''}`,
        value: semester.id,
      })),
    [semesters],
  );
  const canQuery = Boolean(
    selectedSemester && (isStaffViewer ? defaultStaffId : normalizedStaffId),
  );
  const teachingClassTables = useMemo(() => {
    if (!result) {
      return [];
    }

    const sourceGroups =
      result.teachingClassGroups.length > 0
        ? result.teachingClassGroups
        : buildFallbackTeachingClassGroups(result.items);
    const itemsByOneBasedPosition = new Map<number, IntegratedPlanCorrectionItem>();
    const repairGroupsById = new Map<string, IntegratedPlanCorrectionRepairGroup>();

    result.items.forEach((item, index) => {
      itemsByOneBasedPosition.set(index + 1, item);
    });

    for (const repairGroup of result.repairGroups) {
      repairGroupsById.set(repairGroup.id, repairGroup);
    }

    return sourceGroups.map((group) => ({
      group,
      items: group.itemOriginalIndexes
        .map((itemOriginalIndex) => itemsByOneBasedPosition.get(itemOriginalIndex))
        .filter((item): item is IntegratedPlanCorrectionItem => Boolean(item))
        .filter((item) => showConsistentRows || !isConsistentAlignmentItem(item)),
      repairGroups: group.repairGroupIds
        .map((repairGroupId) => repairGroupsById.get(repairGroupId))
        .filter((repairGroup): repairGroup is IntegratedPlanCorrectionRepairGroup =>
          Boolean(repairGroup),
        ),
    }));
  }, [result, showConsistentRows]);

  useEffect(() => {
    let cancelled = false;

    async function loadSemesters() {
      setIsLoadingSemesters(true);
      setSemesterError(null);

      try {
        const nextSemesters = sortSemesters(await requestAcademicSemesters({ limit: 500 }));

        if (cancelled) {
          return;
        }

        setSemesters(nextSemesters);
        setSelectedSemesterId((currentSelection) =>
          pickNextSemesterId(nextSemesters, currentSelection),
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

    void loadSemesters();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isStaffViewer) {
      setFilters((current) =>
        current.staffId === defaultStaffId ? current : { ...current, staffId: defaultStaffId },
      );
      return;
    }

    if (defaultStaffId && !filters.staffId.trim()) {
      setFilters((current) => ({ ...current, staffId: defaultStaffId }));
    }
  }, [defaultStaffId, filters.staffId, isStaffViewer]);

  useEffect(() => {
    let cancelled = false;

    async function loadStaffDirectory() {
      setIsLoadingStaffDirectory(true);
      setStaffDirectoryError(null);

      try {
        const outcome = await resolveStaffDirectoryCache({
          canPopulate: true,
          persistSessionFromResult,
          session: storedSession,
        });

        if (!cancelled) {
          setStaffDirectoryResult(outcome.directory);
        }
      } catch (error) {
        if (!cancelled) {
          if (isExpiredUpstreamSessionError(error)) {
            clear();
          }

          setStaffDirectoryError(error instanceof Error ? error.message : '暂时无法加载教师目录。');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStaffDirectory(false);
        }
      }
    }

    void loadStaffDirectory();

    return () => {
      cancelled = true;
    };
  }, [clear, persistSessionFromResult, storedSession, storedSessionDirectoryKey]);

  function updateFilter(key: keyof QueryFilters, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openLoginModal(nextLoginError: string | null = null) {
    setLoginError(nextLoginError);
    loginForm.setFieldsValue(
      buildUpstreamLoginCredentialsInitialValues({
        fallbackUserId: storedSession?.upstreamLoginId,
        lockedUserId: isStaffViewer && defaultStaffId ? defaultStaffId : null,
        rememberedCredentials,
      }),
    );
    setIsLoginModalOpen(true);
  }

  async function runQuery(sessionOverride?: StoredUpstreamSession) {
    const session = sessionOverride ?? storedSession;

    setQueryError(null);

    if (!upstreamAccount) {
      setQueryError('当前登录账号尚未就绪，请稍后再试。');
      return;
    }

    if (!session) {
      setShouldRunQueryAfterLogin(true);
      openLoginModal();
      return;
    }

    if (!selectedSemester) {
      setQueryError('请选择学期后再查询。');
      return;
    }

    if (isStaffViewer ? !defaultStaffId : !normalizedStaffId) {
      setQueryError(isStaffViewer ? '当前账号没有可用的教师 ID。' : '请填写教师 ID 后再查询。');
      return;
    }

    setIsQuerying(true);

    try {
      const nextResult = isStaffViewer
        ? await listMyIntegratedPlanCorrectionSuggestions({
            semesterId: selectedSemester.id,
            upstreamSessionToken: session.upstreamSessionToken,
          })
        : await listIntegratedPlanCorrectionSuggestions({
            semesterId: selectedSemester.id,
            staffId: normalizedStaffId,
            upstreamSessionToken: session.upstreamSessionToken,
          });

      persistSessionFromResult(session, nextResult);
      setResult(nextResult);
    } catch (error) {
      if (isExpiredUpstreamSessionError(error)) {
        clear();
        setShouldRunQueryAfterLogin(true);
        openLoginModal('教务系统连接已失效，请重新连接后继续。');
        return;
      }

      setQueryError(error instanceof Error ? error.message : '暂时无法加载一体化计划修正建议。');
    } finally {
      setIsQuerying(false);
    }
  }

  async function handleLogin(values: UpstreamLoginFormValues) {
    setIsSubmittingLogin(true);
    setLoginError(null);

    try {
      const nextSession = await login(values);
      const shouldQuery = shouldRunQueryAfterLogin;

      setIsLoginModalOpen(false);
      setShouldRunQueryAfterLogin(false);
      loginForm.resetFields();

      if (shouldQuery) {
        await runQuery(nextSession);
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : '暂时无法登录校园网。');
    } finally {
      setIsSubmittingLogin(false);
    }
  }

  return (
    <div className="integrated-plan-corrections-page">
      <DecoratedPageHeader
        colorScheme="purple"
        description="按校园网已有授课计划和校历中的实际上课时间逐条比对，检查教学计划中漏排、多排或与校历冲突的课次。"
        icon={<FileSearchOutlined />}
        title="一体化对齐"
      />

      <div className="integrated-plan-corrections-workspace">
        <aside className="integrated-plan-corrections-side">
          <section className="integrated-plan-corrections-toolbar">
            <div
              className="integrated-plan-corrections-querybar"
              aria-label="一体化勘误查询条件"
              role="search"
            >
              <label className="integrated-plan-corrections-query-field integrated-plan-corrections-query-field-semester">
                <span>学期</span>
                <Select
                  loading={isLoadingSemesters}
                  options={semesterOptions}
                  placeholder="选择学期"
                  value={selectedSemesterId ?? undefined}
                  onChange={setSelectedSemesterId}
                />
              </label>
              <label className="integrated-plan-corrections-query-field integrated-plan-corrections-query-field-staff">
                <span>教师</span>
                <StaffDirectoryTeacherAutoComplete
                  disabled={isStaffViewer}
                  directoryUnavailableContent={
                    staffDirectoryError ? '目录不可用，可手动输入' : undefined
                  }
                  loading={isLoadingStaffDirectory}
                  popupClassName="integrated-plan-corrections-teacher-autocomplete-popup"
                  popupMatchSelectWidth={240}
                  placeholder={isStaffViewer ? '当前登录教师' : 'ID 或姓名'}
                  teachers={staffDirectoryTeachers}
                  value={filters.staffId}
                  onChange={(value) => updateFilter('staffId', value)}
                />
              </label>
              <div className="integrated-plan-corrections-query-preference">
                <Switch
                  size="small"
                  checked={showConsistentRows}
                  onChange={setShowConsistentRows}
                />
                <Tooltip title="默认隐藏 MATCHED 且无 diff 的行">
                  <span>显示已对齐行</span>
                </Tooltip>
              </div>
              <div className="integrated-plan-corrections-query-action">
                <Button
                  disabled={!canQuery || isQuerying}
                  icon={<SearchOutlined />}
                  loading={isQuerying}
                  type="primary"
                  onClick={() => void runQuery()}
                >
                  查询建议
                </Button>
              </div>
            </div>
          </section>

          {semesterError || queryError ? (
            <div className="integrated-plan-corrections-side-alerts">
              {semesterError ? <Alert title={semesterError} showIcon type="error" /> : null}
              {queryError ? <Alert title={queryError} showIcon type="error" /> : null}
            </div>
          ) : null}

          {result ? (
            <section className="integrated-plan-corrections-summary" aria-label="一体化勘误概览">
              <SummaryMetric
                label="影响明细"
                tone={result.summary.affectedDetailCount > 0 ? 'warning' : 'default'}
                value={result.summary.affectedDetailCount}
              />
              <SummaryMetric
                label="阻塞"
                tone={result.summary.blockingIssueCount > 0 ? 'danger' : 'default'}
                value={result.summary.blockingIssueCount}
              />
            </section>
          ) : null}
        </aside>

        <main className="integrated-plan-corrections-main">
          {isQuerying ? <Skeleton active paragraph={{ rows: 8 }} /> : null}

          {!isQuerying && result ? (
            <section className="integrated-plan-corrections-result">
              {teachingClassTables.length === 0 ? (
                <div className="integrated-plan-corrections-empty">
                  <Empty
                    description="未发现需要展示的一体化计划对齐结果"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                </div>
              ) : (
                <div className="integrated-plan-corrections-tables">
                  <TeachingClassAlignmentTabs
                    showRepairGroups={showRepairGroups}
                    tables={teachingClassTables}
                  />
                </div>
              )}
            </section>
          ) : null}

          {!isQuerying && !result ? (
            <section className="integrated-plan-corrections-prequery">
              <ExclamationCircleOutlined />
              <div>
                <Typography.Text strong>等待查询</Typography.Text>
                <Typography.Paragraph type="secondary">
                  查询后会展示授课计划课时与校历排课课次的逐行对比结果。
                </Typography.Paragraph>
              </div>
            </section>
          ) : null}
        </main>
      </div>

      <UpstreamLoginModal
        description="本页使用校园网会话查询建议，不会提交计划修正。"
        form={loginForm}
        hasRememberedCredentials={canUseRememberedCredentials}
        isSubmitting={isSubmittingLogin}
        loginError={loginError}
        open={isLoginModalOpen}
        title="连接校园网"
        onClearRememberedCredentials={clearRememberedCredentials}
        onCancel={() => {
          setIsLoginModalOpen(false);
          setShouldRunQueryAfterLogin(false);
          setLoginError(null);
        }}
        onFinish={handleLogin}
      />
    </div>
  );
}
