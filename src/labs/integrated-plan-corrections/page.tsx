import { useEffect, useMemo, useState } from 'react';
import {
  ApiOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  LoginOutlined,
  SearchOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  Select,
  Skeleton,
  Switch,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useLoaderData } from 'react-router';

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

import { normalizeOptionalTextValue } from '@/shared/form-normalization';
import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import { integratedPlanCorrectionsLabAccess } from './access';
import {
  type IntegratedPlanCorrectionAlignmentStatus,
  type IntegratedPlanCorrectionItem,
  type IntegratedPlanCorrectionOccurrence,
  type IntegratedPlanCorrectionRepairGroup,
  type IntegratedPlanCorrectionSuggestion,
  type IntegratedPlanCorrectionSuggestionsResult,
  type IntegratedPlanCorrectionTeachingClassGroup,
  listIntegratedPlanCorrectionSuggestions,
} from './api';
import { integratedPlanCorrectionsLabMeta } from './meta';

import './page.css';

type IntegratedPlanCorrectionsLabLoaderData = {
  upstreamAccount?: {
    accountId: number;
    displayName: string;
  } | null;
} | null;

type QueryFilters = {
  lecturePlanId: string;
  staffId: string;
  teachingClassId: string;
};

const EMPTY_TEXT = '—';
const DAY_OF_WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

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

function normalizeString(value: string) {
  return normalizeOptionalTextValue(value, 'to_undefined') ?? '';
}

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

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return EMPTY_TEXT;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
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
    return '计划多排一条明细。';
  }

  if (item.alignmentStatus === 'EXPECTED_ONLY' && item.diffs.includes('PLAN_DETAIL_MISSING')) {
    return '计划少排一条明细。';
  }

  if (item.alignmentStatus === 'CURRENT_ONLY') {
    return '计划侧多出一行，建议删除或调整。';
  }

  if (item.alignmentStatus === 'EXPECTED_ONLY') {
    return '真实应有计划缺少对应计划行，建议补充。';
  }

  if (item.diffs.length > 0) {
    return '当前行已匹配真实应有行，但字段需要按建议值修正。';
  }

  return '当前计划行与真实应有行一致。';
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

function formatIndexRange(group: IntegratedPlanCorrectionRepairGroup) {
  if (group.startOriginalIndex === null && group.endOriginalIndex === null) {
    return EMPTY_TEXT;
  }

  if (group.startOriginalIndex === group.endOriginalIndex || group.endOriginalIndex === null) {
    return formatNullable(group.startOriginalIndex);
  }

  return `${formatNullable(group.startOriginalIndex)} - ${formatNullable(group.endOriginalIndex)}`;
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
  tone?: 'default' | 'danger';
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
      <section>
        <h4>当前计划</h4>
        <div className="integrated-plan-corrections-plan-metrics">
          <PlanMetric label="周次" value={currentPlan.weekNumber} />
          <PlanMetric label="课时" value={currentPlan.lessonHours} />
        </div>
        <CurrentPlanDetails currentPlan={currentPlan} />
      </section>
      <section>
        <h4>
          按计划应分配课次
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
          <Typography.Text strong>
            明细 {formatNullable(suggestion.lecturePlanDetailId)}
          </Typography.Text>
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
        <Alert message={`阻塞：${suggestion.blockingIssue}`} showIcon type="warning" />
      ) : null}
      {hasPlanDetailExtra(suggestion.diffs) ? (
        <Alert
          description="该计划周次没有对应真实课时，优先建议删除该计划明细或调整周次。不要先把后续已重新对齐的明细当作连带错误处理。"
          message="计划明细多填"
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

  return (
    <article className={`integrated-plan-corrections-alignment-row ${alignmentMeta.className}`}>
      <header className="integrated-plan-corrections-alignment-head">
        <div>
          <div className="integrated-plan-corrections-alignment-title-row">
            <Tag color={alignmentMeta.tagColor}>{alignmentMeta.label}</Tag>
            <Typography.Text strong>
              {formatNullable(item.courseName)} / {formatNullable(item.teachingClassName)}
            </Typography.Text>
          </div>
          <p>
            当前序号 {formatNullable(item.currentOriginalIndex)} · 应有序号{' '}
            {formatNullable(item.expectedIndex)} · 明细 {formatNullable(item.lecturePlanDetailId)}
          </p>
        </div>
        <div>{renderDiffTags(item.diffs)}</div>
      </header>

      <Alert
        message={resolveAlignmentActionText(item)}
        showIcon
        type={item.alignmentStatus === 'MATCHED' && item.diffs.length === 0 ? 'success' : 'warning'}
      />

      {item.blockingIssue ? (
        <Alert message={`阻塞：${item.blockingIssue}`} showIcon type="error" />
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
          <Typography.Text type="secondary">Repair Group {index + 1}</Typography.Text>
          <h3>{formatNullable(group.id)}</h3>
          <p>
            教学班 {formatNullable(group.teachingClassId)} · 计划{' '}
            {formatNullable(group.lecturePlanId)} · index {formatIndexRange(group)}
          </p>
        </div>
        <div className="integrated-plan-corrections-group-summary">
          <span>{group.affectedDetailIds.length} 条受影响明细</span>
          <span>root {formatNullable(group.rootLecturePlanDetailId)}</span>
        </div>
      </header>

      <div className="integrated-plan-corrections-group-tags">{renderDiffTags(group.diffs)}</div>

      {group.blockingIssue ? (
        <Alert
          description="该组不能作为普通修正建议自动处理，需要管理人员先确认阻塞原因。"
          message={`阻塞：${group.blockingIssue}`}
          showIcon
          type="error"
        />
      ) : null}
      {hasPlanDetailExtra(group.diffs) ? (
        <Alert
          description="这通常是后续错位的根因：计划里多填了一个真实课表/校历下不存在的周次。请优先删除该计划明细或调整周次。"
          message="优先处理计划明细多填项"
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
      <div className="integrated-plan-corrections-groups integrated-plan-corrections-groups-secondary">
        {repairGroups.map((group, index) => (
          <RepairGroupCard group={group} index={index} key={group.id} />
        ))}
      </div>
    </details>
  );
}

function TeachingClassAlignmentTable({
  group,
  items,
  repairGroups,
}: {
  group: IntegratedPlanCorrectionTeachingClassGroup;
  items: IntegratedPlanCorrectionItem[];
  repairGroups: IntegratedPlanCorrectionRepairGroup[];
}) {
  return (
    <section className="integrated-plan-corrections-table">
      <header className="integrated-plan-corrections-table-head">
        <div>
          <Typography.Text type="secondary">对齐表</Typography.Text>
          <h3>
            {formatNullable(group.courseName)} / {formatNullable(group.teachingClassName)}
          </h3>
          <p>
            教学班 {formatNullable(group.teachingClassId)} · 计划{' '}
            {formatNullable(group.lecturePlanId)} · index {formatNullable(group.startOriginalIndex)}{' '}
            - {formatNullable(group.endOriginalIndex)}
          </p>
        </div>
        <div className="integrated-plan-corrections-table-summary">
          <span>{items.length} 行</span>
          <span>{repairGroups.length} 个异常分组</span>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="integrated-plan-corrections-empty">
          <Empty description="当前对齐表没有可展示行" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <div className="integrated-plan-corrections-alignments">
          {items.map((item) => (
            <AlignmentItemCard item={item} key={getAlignmentRowKey(item)} />
          ))}
        </div>
      )}

      <SecondaryRepairGroups repairGroups={repairGroups} />
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
      <span>{title || input.group.id}</span>
      <Tag>{input.itemCount}</Tag>
    </span>
  );
}

function TeachingClassAlignmentTabs({
  tables,
}: {
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
        group={table.group}
        items={table.items}
        repairGroups={table.repairGroups}
      />
    );
  }

  return (
    <div className="integrated-plan-corrections-tabs">
      <Tabs
        items={tables.map((table) => ({
          children: (
            <TeachingClassAlignmentTable
              group={table.group}
              items={table.items}
              repairGroups={table.repairGroups}
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

export function IntegratedPlanCorrectionsLabPage() {
  const loaderData = useLoaderData() as IntegratedPlanCorrectionsLabLoaderData;
  const upstreamAccount = loaderData?.upstreamAccount ?? null;
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const {
    clear,
    clearRememberedCredentials,
    keepAliveFailure,
    login,
    persistSessionFromResult,
    rememberedCredentials,
    session: storedSession,
  } = useUpstreamSession({
    account: upstreamAccount,
    keepAlive: true,
  });
  const canUseRememberedCredentials = canUseRememberedUpstreamLoginCredentials({
    lockedUserId: null,
    rememberedCredentials,
  });
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [filters, setFilters] = useState<QueryFilters>({
    lecturePlanId: '',
    staffId: '',
    teachingClassId: '',
  });
  const [result, setResult] = useState<IntegratedPlanCorrectionSuggestionsResult | null>(null);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoadingSemesters, setIsLoadingSemesters] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [showConsistentRows, setShowConsistentRows] = useState(false);
  const [shouldRunQueryAfterLogin, setShouldRunQueryAfterLogin] = useState(false);

  const selectedSemester = semesters.find((semester) => semester.id === selectedSemesterId) ?? null;
  const normalizedStaffId = normalizeString(filters.staffId);
  const normalizedTeachingClassId = normalizeString(filters.teachingClassId);
  const normalizedLecturePlanId = normalizeString(filters.lecturePlanId);
  const semesterOptions = useMemo(
    () =>
      semesters.map((semester) => ({
        label: `${semester.name}${semester.isCurrent ? ' · 当前' : ''}`,
        value: semester.id,
      })),
    [semesters],
  );
  const canQuery = Boolean(upstreamAccount && selectedSemester && normalizedStaffId);
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
    if (!keepAliveFailure) {
      return;
    }

    clear();
    setLoginError(keepAliveFailure.message);
    loginForm.setFieldsValue(
      buildUpstreamLoginCredentialsInitialValues({
        fallbackUserId: keepAliveFailure.upstreamLoginId,
        lockedUserId: null,
        rememberedCredentials,
      }),
    );
    setIsLoginModalOpen(true);
  }, [clear, keepAliveFailure, loginForm, rememberedCredentials]);

  function updateFilter(key: keyof QueryFilters, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openLoginModal() {
    setLoginError(null);
    loginForm.setFieldsValue(
      buildUpstreamLoginCredentialsInitialValues({
        fallbackUserId: storedSession?.upstreamLoginId,
        lockedUserId: null,
        rememberedCredentials,
      }),
    );
    setIsLoginModalOpen(true);
  }

  async function runQuery(sessionOverride?: StoredUpstreamSession) {
    const session = sessionOverride ?? storedSession;

    if (!session) {
      setShouldRunQueryAfterLogin(true);
      openLoginModal();
      return;
    }

    if (!selectedSemester || !normalizedStaffId) {
      setQueryError('请选择学期并填写教师 ID 后再查询。');
      return;
    }

    setIsQuerying(true);
    setQueryError(null);

    try {
      const nextResult = await listIntegratedPlanCorrectionSuggestions({
        lecturePlanId: normalizedLecturePlanId || undefined,
        semesterId: selectedSemester.id,
        staffId: normalizedStaffId,
        teachingClassId: normalizedTeachingClassId || undefined,
        upstreamSessionToken: session.upstreamSessionToken,
      });

      persistSessionFromResult(session, nextResult);
      setResult(nextResult);
    } catch (error) {
      if (isExpiredUpstreamSessionError(error)) {
        clear();
        setShouldRunQueryAfterLogin(true);
        setLoginError('教务系统连接已失效，请重新连接后继续。');
        openLoginModal();
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
        badge={<Tag color="purple">Lab</Tag>}
        colorScheme="purple"
        description="按 upstream 原始顺序对齐当前计划与真实应有计划，逐行检查一体化教学计划周次与课时。"
        icon={<FileSearchOutlined />}
        title="一体化计划修正建议"
      />

      <section className="integrated-plan-corrections-toolbar">
        <div className="integrated-plan-corrections-session">
          <ApiOutlined />
          <span>
            校园网：
            {storedSession
              ? `${storedSession.upstreamLoginId || '已连接'} · ${formatDateTime(storedSession.expiresAt)}`
              : '未连接'}
          </span>
          <Button
            icon={storedSession ? <SwapOutlined /> : <LoginOutlined />}
            size="small"
            type="link"
            disabled={!upstreamAccount}
            onClick={openLoginModal}
          >
            {storedSession ? '切换账号' : '连接校园网'}
          </Button>
        </div>

        <div className="integrated-plan-corrections-filters">
          <label>
            <span>学期</span>
            <Select
              loading={isLoadingSemesters}
              options={semesterOptions}
              placeholder="选择学期"
              value={selectedSemesterId ?? undefined}
              onChange={setSelectedSemesterId}
            />
          </label>
          <label>
            <span>教师 ID</span>
            <Input
              allowClear
              placeholder="staffId"
              value={filters.staffId}
              onChange={(event) => updateFilter('staffId', event.target.value)}
            />
          </label>
          <label>
            <span>教学班 ID</span>
            <Input
              allowClear
              placeholder="可选"
              value={filters.teachingClassId}
              onChange={(event) => updateFilter('teachingClassId', event.target.value)}
            />
          </label>
          <label>
            <span>计划 ID</span>
            <Input
              allowClear
              placeholder="可选"
              value={filters.lecturePlanId}
              onChange={(event) => updateFilter('lecturePlanId', event.target.value)}
            />
          </label>
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

        <div className="integrated-plan-corrections-meta">
          <Tag color="gold">
            访问级别：{integratedPlanCorrectionsLabAccess.allowedAccessLevels.join(', ')}
          </Tag>
          <Tag color="default">隐藏路由</Tag>
          <Tag color="default">只读</Tag>
          <Typography.Text type="secondary">
            {integratedPlanCorrectionsLabMeta.purpose}
          </Typography.Text>
        </div>
      </section>

      {semesterError ? <Alert message={semesterError} showIcon type="error" /> : null}
      {!upstreamAccount ? (
        <Alert message="当前登录账号尚未就绪，无法建立校园网上游会话。" showIcon type="warning" />
      ) : null}
      {queryError ? <Alert message={queryError} showIcon type="error" /> : null}
      {isQuerying ? <Skeleton active paragraph={{ rows: 8 }} /> : null}

      {!isQuerying && result ? (
        <section className="integrated-plan-corrections-result">
          <div className="integrated-plan-corrections-summary">
            <SummaryMetric label="计划" value={result.summary.planCount} />
            <SummaryMetric label="明细" value={result.summary.detailCount} />
            <SummaryMetric label="修复组" value={result.summary.repairGroupCount} />
            <SummaryMetric label="影响明细" value={result.summary.affectedDetailCount} />
            <SummaryMetric
              label="阻塞"
              tone={result.summary.blockingIssueCount > 0 ? 'danger' : 'default'}
              value={result.summary.blockingIssueCount}
            />
          </div>
          <div className="integrated-plan-corrections-result-controls">
            <span>
              <Typography.Text strong>显示一致行</Typography.Text>
              <Typography.Text type="secondary">
                默认隐藏 `MATCHED` 且无 diff 的行，只保留需要处理的对齐结果。
              </Typography.Text>
            </span>
            <Switch checked={showConsistentRows} onChange={setShowConsistentRows} />
          </div>

          {teachingClassTables.length === 0 ? (
            <div className="integrated-plan-corrections-empty">
              <Empty
                description="未发现需要展示的一体化计划对齐结果"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          ) : (
            <div className="integrated-plan-corrections-tables">
              <TeachingClassAlignmentTabs tables={teachingClassTables} />
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
              查询后会按 items 展示“当前计划 vs 真实应有计划”的逐行对齐结果。
            </Typography.Paragraph>
          </div>
        </section>
      ) : null}

      <UpstreamLoginModal
        description="本页只读使用校园网会话查询建议，不会提交计划修正。"
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
