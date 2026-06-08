// src/labs/zquiz-exam-activities/page.tsx

import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileDoneOutlined,
  HourglassOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Empty,
  Input,
  List,
  Modal,
  Radio,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useOutletContext } from 'react-router';

import { HexAvatar } from '@/shared/hex-avatar';

import {
  autosaveZquizExam,
  buildZquizExamAnswers,
  buildZquizExamDraftAnswersFromServer,
  getMyZquizExamActivity,
  getMyZquizExamAttempt,
  listMyZquizExamActivities,
  resolveZquizExamErrorMessage,
  startZquizExam,
  submitZquizExam,
  type ZquizExamActivity,
  type ZquizExamAttempt,
  type ZquizExamAttemptGradingStatus,
  type ZquizExamAttemptItem,
  type ZquizExamAttemptItemGradingStatus,
  type ZquizExamAttemptStatus,
  type ZquizExamAvailability,
  type ZquizExamDraftAnswers,
  type ZquizExamPaper,
  type ZquizExamPaperAsset,
  type ZquizExamPaperItem,
  type ZquizExamSubmitResult,
} from './api';

type ExamView = 'list' | 'paper' | 'result';
type DraftAnswer = unknown;
type DraftAnswers = ZquizExamDraftAnswers;

type ExamLayoutSnapshot = {
  accountId: number;
  identity: {
    currentClassCode?: string | null;
    name: string | null;
  } | null;
  userInfo: {
    avatarUrl: string | null;
  };
};

type ExamSidebarOverride = {
  content: ReactNode;
  width?: number;
};

type ExamOutletContext = {
  activeSnapshot: ExamLayoutSnapshot | null;
  setSidebarOverride: (override: ExamSidebarOverride | null) => void;
};

type ActivityViewState = {
  activities: ZquizExamActivity[];
  error: string | null;
  loading: boolean;
};

type PaperViewState = {
  error: string | null;
  loading: boolean;
  paper: ZquizExamPaper | null;
};

type SubmitViewState = {
  attempt: ZquizExamAttempt | null;
  error: string | null;
  loading: boolean;
  result: ZquizExamSubmitResult | null;
};

type AutosaveState = {
  error: string | null;
  lastSavedAt: string | null;
  status: 'dirty' | 'error' | 'idle' | 'saved' | 'saving';
};

type QuestionStatusGroup = {
  items: {
    answered: boolean;
    item: ZquizExamPaperItem;
  }[];
  label: string;
  type: ZquizExamPaperItem['type'];
};

const AUTOSAVE_DEBOUNCE_MS = 1200;
const AUTOSAVE_FALLBACK_INTERVAL_MS = 30_000;
const AUTOSAVE_MIN_QUESTION_THRESHOLD = 2;
const AUTOSAVE_QUESTION_THRESHOLD = 3;
const QUESTION_GROUP_ORDINALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

const AVAILABILITY_LABELS: Record<ZquizExamAvailability, string> = {
  CLOSED: '已关闭',
  ENDED: '已结束',
  NOT_STARTED: '未开始',
  OPEN: '开放中',
};

const AVAILABILITY_TAG_COLORS: Record<ZquizExamAvailability, string> = {
  CLOSED: 'default',
  ENDED: 'red',
  NOT_STARTED: 'gold',
  OPEN: 'green',
};

const QUESTION_TYPE_LABELS: Record<ZquizExamPaperItem['type'], string> = {
  ESSAY: '问答题',
  FILL_BLANK: '填空题',
  MULTIPLE_CHOICE: '多选题',
  SINGLE_CHOICE: '单选题',
  TRUE_FALSE: '判断题',
};

const ATTEMPT_STATUS_LABELS: Record<ZquizExamAttemptStatus, string> = {
  ABANDONED: '已放弃',
  GRADED: '已评分',
  IN_PROGRESS: '作答中',
  SUBMITTED: '已提交',
};

const ATTEMPT_GRADING_STATUS_LABELS: Record<ZquizExamAttemptGradingStatus, string> = {
  AUTO_GRADED: '自动评分',
  MANUAL_GRADED: '人工已评',
  MANUAL_PENDING: '待人工批改',
  NOT_GRADED: '未评分',
};

const ITEM_GRADING_STATUS_LABELS: Record<ZquizExamAttemptItemGradingStatus, string> = {
  AUTO_GRADED: '自动评分',
  MANUAL_GRADED: '人工已评',
  MANUAL_PENDING: '待人工批改',
  UNANSWERED: '未作答',
};

const ITEM_GRADING_STATUS_TAG_COLORS: Record<ZquizExamAttemptItemGradingStatus, string> = {
  AUTO_GRADED: 'green',
  MANUAL_GRADED: 'blue',
  MANUAL_PENDING: 'gold',
  UNANSWERED: 'default',
};

function formatDateTime(value: string | null) {
  if (!value) {
    return '不限';
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

function formatDuration(value: number | null) {
  return value === null ? '未配置' : `${value} 分钟`;
}

function formatAttemptLimit(value: number | null) {
  return value === null ? '不限次' : `${value} 次`;
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatScorePair(scoreAwarded: number, scoreMax: number) {
  return `${formatScore(scoreAwarded)} / ${formatScore(scoreMax)}`;
}

function formatCountdown(deadlineAt: string, now: number) {
  const deadline = new Date(deadlineAt).getTime();

  if (Number.isNaN(deadline)) {
    return formatDateTime(deadlineAt);
  }

  const remaining = deadline - now;

  if (remaining <= 0) {
    return '已到截止时间';
  }

  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}小时 ${minutes}分 ${seconds}秒`;
  }

  return `${minutes}分 ${seconds}秒`;
}

function resolveAutosaveQuestionThreshold(paper: ZquizExamPaper | null) {
  const questionCount = paper?.items.length ?? AUTOSAVE_QUESTION_THRESHOLD;

  return Math.min(
    AUTOSAVE_QUESTION_THRESHOLD,
    Math.max(AUTOSAVE_MIN_QUESTION_THRESHOLD, questionCount),
  );
}

function buildQuestionStatusGroups(
  paper: ZquizExamPaper,
  answers: DraftAnswers,
): QuestionStatusGroup[] {
  const groups: QuestionStatusGroup[] = [];
  const groupByType = new Map<ZquizExamPaperItem['type'], QuestionStatusGroup>();

  for (const item of [...paper.items].sort((left, right) => left.paperItemNo - right.paperItemNo)) {
    const type = item.type;
    const existingGroup = groupByType.get(type);
    const group =
      existingGroup ??
      ({
        items: [],
        label: QUESTION_TYPE_LABELS[type],
        type,
      } satisfies QuestionStatusGroup);

    if (!existingGroup) {
      groupByType.set(type, group);
      groups.push(group);
    }

    group.items.push({
      answered: buildZquizExamAnswers([item], answers).length > 0,
      item,
    });
  }

  return groups;
}

function formatQuestionGroupOrdinal(index: number) {
  return QUESTION_GROUP_ORDINALS[index] ?? String(index + 1);
}

function formatQuestionGroupSummary(group: QuestionStatusGroup) {
  const scores = group.items.map(({ item }) => item.scoreMax);
  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  const firstScore = scores[0];

  if (hasUniformQuestionGroupScore(group) && typeof firstScore === 'number') {
    return `每题 ${formatScore(firstScore)} 分，共 ${group.items.length} 题，${formatScore(
      totalScore,
    )} 分`;
  }

  return `共 ${group.items.length} 题，${formatScore(totalScore)} 分`;
}

function hasUniformQuestionGroupScore(group: QuestionStatusGroup) {
  const firstScore = group.items[0]?.item.scoreMax;

  return group.items.every(({ item }) => item.scoreMax === firstScore);
}

function formatQuestionGroupTitle(group: QuestionStatusGroup, index: number) {
  return `${formatQuestionGroupOrdinal(index)}、${group.label}（${formatQuestionGroupSummary(
    group,
  )}）`;
}

function scrollToExamQuestion(paperItemNo: number) {
  document
    .getElementById(`exam-question-${paperItemNo}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resolveAutosaveIndicator(state: AutosaveState) {
  if (state.status === 'saving') {
    return {
      color: 'var(--ant-color-warning)',
      label: '正在保存',
      title: '正在保存答案。',
    };
  }

  if (state.status === 'saved') {
    return {
      color: 'var(--ant-color-success)',
      label: '已保存',
      title: state.lastSavedAt
        ? `答案已保存：${formatDateTime(state.lastSavedAt)}`
        : '答案已保存。',
    };
  }

  if (state.status === 'dirty') {
    return {
      color: 'var(--ant-color-warning)',
      label: '有未保存答案',
      title: '有未保存答案，系统会自动保存。',
    };
  }

  if (state.status === 'error') {
    return {
      color: 'var(--ant-color-error)',
      label: '保存失败',
      title: state.error || '保存失败，请稍后重试或继续交卷。',
    };
  }

  return {
    color: 'var(--ant-color-fill)',
    label: '暂无保存内容',
    title: '尚未作答，暂无需要保存的答案。',
  };
}

function AutosaveStatusDot({ state }: { state: AutosaveState }) {
  const indicator = resolveAutosaveIndicator(state);

  return (
    <Tooltip title={indicator.title}>
      <span
        aria-label={indicator.label}
        className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
        role="status"
        style={{ background: indicator.color }}
      />
    </Tooltip>
  );
}

function ExamAnswerStatusSidebar({
  answerCount,
  autosaveState,
  groups,
  isAfterDeadline,
  now,
  paper,
  snapshot,
}: {
  answerCount: number;
  autosaveState: AutosaveState;
  groups: QuestionStatusGroup[];
  isAfterDeadline: boolean;
  now: number;
  paper: ZquizExamPaper;
  snapshot: ExamLayoutSnapshot | null;
}) {
  const questionCount = paper.items.length;
  const progressPercent = questionCount > 0 ? Math.round((answerCount / questionCount) * 100) : 0;
  const realName = snapshot?.identity?.name?.trim() || '未同步真实姓名';
  const classCode = snapshot?.identity?.currentClassCode?.trim();

  return (
    <aside className="flex h-full flex-col">
      <div
        className="flex shrink-0 flex-col gap-2 px-4 py-4"
        style={{ borderBottom: '1px solid var(--ant-color-border-secondary)' }}
      >
        <span className="text-xs font-medium text-text-secondary">考试答题情况</span>
        <span className="line-clamp-2 text-base font-semibold">{paper.activity.title}</span>
        <div className="flex items-center justify-between gap-3 text-xs text-text-secondary">
          <span>
            已答 {answerCount} / {questionCount}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full"
          aria-label={`答题进度 ${progressPercent}%`}
          style={{ background: 'var(--ant-color-fill-quaternary)' }}
        >
          <div
            className="h-full rounded-full"
            style={{ background: 'var(--ant-color-primary)', width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <AutosaveStatusDot state={autosaveState} />
          <span style={isAfterDeadline ? { color: 'var(--ant-color-error)' } : undefined}>
            剩余：{formatCountdown(paper.deadlineAt, now)}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.type} className="flex flex-col gap-2">
              <div className="px-1 text-xs font-medium text-text-secondary">{group.label}</div>
              <div className="grid grid-cols-4 gap-2">
                {group.items.map(({ answered, item }) => (
                  <button
                    aria-label={`第 ${item.paperItemNo} 题，${answered ? '已作答' : '未作答'}`}
                    className={
                      answered
                        ? 'flex h-10 items-center justify-center rounded-md border text-sm font-medium transition-colors hover:bg-fill-hover'
                        : 'flex h-10 items-center justify-center rounded-md border border-border-secondary bg-bg-container text-sm font-medium text-text-secondary transition-colors hover:bg-fill-hover hover:text-text'
                    }
                    key={`${item.paperItemNo}-${item.questionId}`}
                    style={
                      answered
                        ? {
                            background: 'var(--ant-color-primary-bg)',
                            borderColor: 'var(--ant-color-primary-border)',
                            color: 'var(--ant-color-primary)',
                          }
                        : undefined
                    }
                    type="button"
                    onClick={() => scrollToExamQuestion(item.paperItemNo)}
                  >
                    {item.paperItemNo}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div
        className="shrink-0 px-3 pb-3 pt-3"
        style={{ borderTop: '1px solid var(--ant-color-border-secondary)' }}
      >
        <div className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2">
          <HexAvatar
            accountId={snapshot?.accountId ?? paper.attemptId}
            avatarUrl={snapshot?.userInfo.avatarUrl ?? null}
            size={32}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{realName}</div>
            <div className="truncate text-xs text-text-secondary">
              {classCode ? `班级 ${classCode}` : '学生账号'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function resolveDisabledReason(activity: ZquizExamActivity) {
  if (activity.availability === 'OPEN' && !activity.canStart) {
    return '次数已用完';
  }

  if (activity.availability === 'NOT_STARTED') {
    return `开考时间：${formatDateTime(activity.startsAt)}`;
  }

  if (activity.availability === 'ENDED') {
    return '已结束';
  }

  if (activity.availability === 'CLOSED') {
    return '已关闭';
  }

  return null;
}

function canStartActivity(activity: ZquizExamActivity) {
  return activity.availability === 'OPEN' && activity.canStart;
}

function ActivityMeta({ activity }: { activity: ZquizExamActivity }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      <span className="text-xs text-text-secondary">开始：{formatDateTime(activity.startsAt)}</span>
      <span className="text-xs text-text-secondary">结束：{formatDateTime(activity.endsAt)}</span>
      <span className="text-xs text-text-secondary">
        时长：{formatDuration(activity.durationMinutes)}
      </span>
      <span className="text-xs text-text-secondary">
        次数：{formatAttemptLimit(activity.attemptLimit)}
      </span>
    </div>
  );
}

function ActivityStatusTag({ activity }: { activity: ZquizExamActivity }) {
  return (
    <Tag color={AVAILABILITY_TAG_COLORS[activity.availability]}>
      {AVAILABILITY_LABELS[activity.availability]}
    </Tag>
  );
}

const AssetList = memo(function AssetList({ assets }: { assets: ZquizExamPaperAsset[] }) {
  if (assets.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {assets.map((asset) => (
        <div
          className="rounded-card border border-border-secondary p-3 text-sm text-text-secondary"
          key={`${asset.storageKey}-${asset.sortOrder}`}
        >
          <div>{asset.originalName || asset.storageKey}</div>
          <div>
            {asset.kind} · {asset.mimeType || '未知类型'}
          </div>
        </div>
      ))}
    </div>
  );
});

function SingleChoiceAnswer({
  disabled,
  item,
  onChange,
  value,
}: {
  disabled: boolean;
  item: ZquizExamPaperItem;
  onChange: (value: DraftAnswer) => void;
  value: DraftAnswer;
}) {
  return (
    <Radio.Group
      disabled={disabled}
      value={typeof value === 'string' ? value : undefined}
      onChange={(event) => onChange(event.target.value)}
    >
      <Space direction="vertical">
        {item.options.map((option) => (
          <Radio key={option.label} value={option.label}>
            {option.label}. {option.content}
          </Radio>
        ))}
      </Space>
    </Radio.Group>
  );
}

function MultipleChoiceAnswer({
  disabled,
  item,
  onChange,
  value,
}: {
  disabled: boolean;
  item: ZquizExamPaperItem;
  onChange: (value: DraftAnswer) => void;
  value: DraftAnswer;
}) {
  return (
    <Checkbox.Group
      disabled={disabled}
      value={Array.isArray(value) ? value : []}
      onChange={(selectedValues) => onChange(selectedValues.map(String))}
    >
      <Space direction="vertical">
        {item.options.map((option) => (
          <Checkbox key={option.label} value={option.label}>
            {option.label}. {option.content}
          </Checkbox>
        ))}
      </Space>
    </Checkbox.Group>
  );
}

function FillBlankAnswer({
  disabled,
  item,
  onChange,
  value,
}: {
  disabled: boolean;
  item: ZquizExamPaperItem;
  onChange: (value: DraftAnswer) => void;
  value: DraftAnswer;
}) {
  const values =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return (
    <div className="flex flex-col gap-3">
      {item.blanks.map((blank) => (
        <Input
          disabled={disabled}
          key={blank.blankNo}
          placeholder={`第 ${blank.blankNo} 空`}
          value={
            typeof values[String(blank.blankNo)] === 'string'
              ? String(values[String(blank.blankNo)])
              : ''
          }
          onChange={(event) =>
            onChange({
              ...values,
              [String(blank.blankNo)]: event.target.value,
            })
          }
        />
      ))}
    </div>
  );
}

function EssayAnswer({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: DraftAnswer) => void;
  value: DraftAnswer;
}) {
  return (
    <Input.TextArea
      autoSize={{ minRows: 4, maxRows: 10 }}
      disabled={disabled}
      placeholder="输入答案"
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ExamQuestionCard({
  disabled,
  item,
  onAnswerChange,
  showScore,
  value,
}: {
  disabled: boolean;
  item: ZquizExamPaperItem;
  onAnswerChange: (paperItemNo: number, value: DraftAnswer) => void;
  showScore: boolean;
  value: DraftAnswer;
}) {
  function renderAnswer() {
    if (item.type === 'MULTIPLE_CHOICE') {
      return (
        <MultipleChoiceAnswer
          disabled={disabled}
          item={item}
          value={value}
          onChange={(nextValue) => onAnswerChange(item.paperItemNo, nextValue)}
        />
      );
    }

    if (item.type === 'SINGLE_CHOICE' || item.type === 'TRUE_FALSE') {
      return (
        <SingleChoiceAnswer
          disabled={disabled}
          item={item}
          value={value}
          onChange={(nextValue) => onAnswerChange(item.paperItemNo, nextValue)}
        />
      );
    }

    if (item.type === 'FILL_BLANK') {
      return (
        <FillBlankAnswer
          disabled={disabled}
          item={item}
          value={value}
          onChange={(nextValue) => onAnswerChange(item.paperItemNo, nextValue)}
        />
      );
    }

    return (
      <EssayAnswer
        disabled={disabled}
        value={value}
        onChange={(nextValue) => onAnswerChange(item.paperItemNo, nextValue)}
      />
    );
  }

  return (
    <Card
      title={
        <div className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1">
          <span className="shrink-0">第 {item.paperItemNo} 题</span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap text-sm font-normal text-text">
            {item.stem}
          </span>
          {showScore ? (
            <Tag color="blue" style={{ flexShrink: 0 }}>
              {formatScore(item.scoreMax)} 分
            </Tag>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <AssetList assets={item.assets} />
        {renderAnswer()}
      </div>
    </Card>
  );
}

function CorrectnessTag({ item }: { item: ZquizExamAttemptItem }) {
  if (item.gradingStatus === 'UNANSWERED') {
    return <Tag>未作答</Tag>;
  }

  if (item.gradingStatus === 'MANUAL_PENDING') {
    return (
      <Tag color="gold" icon={<HourglassOutlined />}>
        待批改
      </Tag>
    );
  }

  if (item.isCorrect === true) {
    return (
      <Tag color="green" icon={<CheckCircleOutlined />}>
        正确
      </Tag>
    );
  }

  if (item.isCorrect === false) {
    return (
      <Tag color="red" icon={<CloseCircleOutlined />}>
        错误
      </Tag>
    );
  }

  return <Tag>{ITEM_GRADING_STATUS_LABELS[item.gradingStatus]}</Tag>;
}

const AttemptAnswerView = memo(function AttemptAnswerView({
  item,
}: {
  item: ZquizExamAttemptItem;
}) {
  if (
    item.type === 'SINGLE_CHOICE' ||
    item.type === 'MULTIPLE_CHOICE' ||
    item.type === 'TRUE_FALSE'
  ) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs text-text-secondary">提交答案</span>
        {item.answer.selectedLabels.length > 0 ? (
          <Space wrap>
            {item.answer.selectedLabels.map((label) => (
              <Tag key={label}>{label}</Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">未作答</Typography.Text>
        )}
      </div>
    );
  }

  if (item.type === 'FILL_BLANK') {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs text-text-secondary">提交答案</span>
        {item.answer.blankAnswers.length > 0 ? (
          <div className="flex flex-col gap-2">
            {item.answer.blankAnswers.map((blankAnswer) => (
              <div key={blankAnswer.blankNo} className="flex flex-wrap gap-2">
                <Tag>空 {blankAnswer.blankNo}</Tag>
                <span>{blankAnswer.answerText}</span>
              </div>
            ))}
          </div>
        ) : (
          <Typography.Text type="secondary">未作答</Typography.Text>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-text-secondary">提交答案</span>
      {item.answer.answerText ? (
        <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
          {item.answer.answerText}
        </Typography.Paragraph>
      ) : (
        <Typography.Text type="secondary">未作答</Typography.Text>
      )}
    </div>
  );
});

const AttemptQuestionCard = memo(function AttemptQuestionCard({
  item,
}: {
  item: ZquizExamAttemptItem;
}) {
  return (
    <Card
      title={
        <Space wrap>
          <span>第 {item.paperItemNo} 题</span>
          <Tag>{QUESTION_TYPE_LABELS[item.type]}</Tag>
          <Tag color="blue">{formatScorePair(item.scoreAwarded, item.scoreMax)} 分</Tag>
          <Tag color={ITEM_GRADING_STATUS_TAG_COLORS[item.gradingStatus]}>
            {ITEM_GRADING_STATUS_LABELS[item.gradingStatus]}
          </Tag>
          <CorrectnessTag item={item} />
        </Space>
      }
    >
      <div className="flex flex-col gap-4">
        <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
          {item.stem}
        </Typography.Paragraph>
        <AssetList assets={item.assets} />
        {item.options.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-text-secondary">卷面选项</span>
            <div className="flex flex-col gap-2">
              {item.options.map((option) => (
                <span key={option.label}>
                  {option.label}. {option.content}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <AttemptAnswerView item={item} />
      </div>
    </Card>
  );
});

export function ZquizExamActivitiesLabPage() {
  const outletContext = useOutletContext<ExamOutletContext | undefined>();
  const activeLayoutSnapshot = outletContext?.activeSnapshot ?? null;
  const setSidebarOverride = outletContext?.setSidebarOverride;
  const [view, setView] = useState<ExamView>('list');
  const [listState, setListState] = useState<ActivityViewState>({
    activities: [],
    error: null,
    loading: true,
  });
  const [paperState, setPaperState] = useState<PaperViewState>({
    error: null,
    loading: false,
    paper: null,
  });
  const [submitState, setSubmitState] = useState<SubmitViewState>({
    attempt: null,
    error: null,
    loading: false,
    result: null,
  });
  const [answers, setAnswers] = useState<DraftAnswers>({});
  const [autosaveState, setAutosaveState] = useState<AutosaveState>({
    error: null,
    lastSavedAt: null,
    status: 'idle',
  });
  const [startingActivityId, setStartingActivityId] = useState<number | null>(null);
  const [loadingResultActivityId, setLoadingResultActivityId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const autosaveTimerRef = useRef<number | null>(null);
  const autosavingRef = useRef(false);
  const dirtyRef = useRef(false);
  const latestAnswersRef = useRef<DraftAnswers>({});
  const paperRef = useRef<ZquizExamPaper | null>(null);
  const pendingAutosaveQuestionNosRef = useRef<Set<number>>(new Set());
  const resultRequestSeqRef = useRef(0);
  const runAutosaveRef = useRef<(() => Promise<void>) | null>(null);
  const submittingRef = useRef(false);

  const activityCountText = useMemo(() => {
    if (listState.loading) {
      return '读取中';
    }

    return `${listState.activities.length} 个考试`;
  }, [listState.activities.length, listState.loading]);

  const currentPaper = paperState.paper;
  const answerCount = useMemo(() => {
    return currentPaper ? buildZquizExamAnswers(currentPaper.items, answers).length : 0;
  }, [answers, currentPaper]);
  const questionStatusGroups = useMemo(() => {
    return currentPaper ? buildQuestionStatusGroups(currentPaper, answers) : [];
  }, [answers, currentPaper]);

  const isAfterDeadline = useMemo(() => {
    if (!currentPaper) {
      return false;
    }

    const deadline = new Date(currentPaper.deadlineAt).getTime();

    return Number.isNaN(deadline) ? false : now > deadline;
  }, [currentPaper, now]);

  const loadActivities = useCallback(async () => {
    setListState((current) => ({
      ...current,
      error: null,
      loading: true,
    }));

    try {
      const activities = await listMyZquizExamActivities();

      setListState({
        activities,
        error: null,
        loading: false,
      });
    } catch (error) {
      setListState({
        activities: [],
        error: resolveZquizExamErrorMessage(error, '暂时无法读取可选考试列表。'),
        loading: false,
      });
    }
  }, []);

  const queueAutosave = useCallback(() => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void runAutosaveRef.current?.();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  const runAutosave = useCallback(async () => {
    const paper = paperRef.current;

    if (!paper || autosavingRef.current || submittingRef.current) {
      return;
    }

    autosavingRef.current = true;
    dirtyRef.current = false;
    pendingAutosaveQuestionNosRef.current.clear();
    setAutosaveState((current) => ({
      ...current,
      error: null,
      status: 'saving',
    }));

    try {
      const result = await autosaveZquizExam({
        answers: buildZquizExamAnswers(paper.items, latestAnswersRef.current),
        attemptId: paper.attemptId,
      });
      const hasPendingChanges = dirtyRef.current;

      setAutosaveState({
        error: null,
        lastSavedAt: result.lastSavedAt,
        status: hasPendingChanges ? 'dirty' : 'saved',
      });

      if (
        hasPendingChanges &&
        pendingAutosaveQuestionNosRef.current.size >= resolveAutosaveQuestionThreshold(paper)
      ) {
        queueAutosave();
      }
    } catch (error) {
      dirtyRef.current = true;
      setAutosaveState((current) => ({
        ...current,
        error: resolveZquizExamErrorMessage(error, '暂时无法保存考试答案。'),
        status: 'error',
      }));
    } finally {
      autosavingRef.current = false;
    }
  }, [queueAutosave]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  useEffect(() => {
    runAutosaveRef.current = runAutosave;
  }, [runAutosave]);

  useEffect(() => {
    paperRef.current = currentPaper;
  }, [currentPaper]);

  useEffect(() => {
    if (!setSidebarOverride) {
      return;
    }

    if (view !== 'paper' || !currentPaper) {
      setSidebarOverride(null);
      return;
    }

    setSidebarOverride({
      content: (
        <ExamAnswerStatusSidebar
          answerCount={answerCount}
          autosaveState={autosaveState}
          groups={questionStatusGroups}
          isAfterDeadline={isAfterDeadline}
          now={now}
          paper={currentPaper}
          snapshot={activeLayoutSnapshot}
        />
      ),
    });
  }, [
    activeLayoutSnapshot,
    answerCount,
    autosaveState,
    currentPaper,
    isAfterDeadline,
    now,
    questionStatusGroups,
    setSidebarOverride,
    view,
  ]);

  useEffect(() => {
    return () => {
      setSidebarOverride?.(null);
    };
  }, [setSidebarOverride]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (dirtyRef.current) {
        void runAutosave();
      }
    }, AUTOSAVE_FALLBACK_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [runAutosave]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, []);

  const handleStartExam = useCallback(async (activityId: number) => {
    setStartingActivityId(activityId);
    setPaperState({
      error: null,
      loading: true,
      paper: null,
    });
    setSubmitState({
      attempt: null,
      error: null,
      loading: false,
      result: null,
    });
    setAutosaveState({
      error: null,
      lastSavedAt: null,
      status: 'idle',
    });

    try {
      const detail = await getMyZquizExamActivity({
        activityId,
      });

      if (!detail) {
        throw new Error('考试不存在或不可见。');
      }

      if (!canStartActivity(detail)) {
        throw new Error(resolveDisabledReason(detail) || '考试当前不可进入。');
      }

      const paper = await startZquizExam({
        activityId,
      });
      const draftAnswers = buildZquizExamDraftAnswersFromServer(paper.items, paper.draftAnswers);

      paperRef.current = paper;
      latestAnswersRef.current = draftAnswers;
      dirtyRef.current = false;
      pendingAutosaveQuestionNosRef.current.clear();
      setAnswers(draftAnswers);
      setPaperState({
        error: null,
        loading: false,
        paper,
      });
      setView('paper');
    } catch (error) {
      setPaperState({
        error: resolveZquizExamErrorMessage(error, '暂时无法开始考试。'),
        loading: false,
        paper: null,
      });
    } finally {
      setStartingActivityId(null);
    }
  }, []);

  const handleLoadExamResult = useCallback(
    async (input: {
      activityId: number;
      attemptId?: string | null;
      summary?: ZquizExamSubmitResult | null;
    }) => {
      const requestSeq = resultRequestSeqRef.current + 1;
      resultRequestSeqRef.current = requestSeq;
      setLoadingResultActivityId(input.activityId);
      setPaperState({
        error: null,
        loading: false,
        paper: null,
      });
      setSubmitState({
        attempt: null,
        error: null,
        loading: true,
        result: input.summary ?? null,
      });
      setView('result');

      try {
        const attempt = await getMyZquizExamAttempt({
          activityId: input.activityId,
          attemptId: input.attemptId,
        });

        if (resultRequestSeqRef.current !== requestSeq) {
          return;
        }

        setSubmitState({
          attempt,
          error: attempt ? null : '暂无已提交的考试结果。',
          loading: false,
          result: input.summary ?? null,
        });
      } catch (error) {
        if (resultRequestSeqRef.current !== requestSeq) {
          return;
        }

        setSubmitState({
          attempt: null,
          error: resolveZquizExamErrorMessage(error, '暂时无法读取考试结果。'),
          loading: false,
          result: input.summary ?? null,
        });
      } finally {
        if (resultRequestSeqRef.current === requestSeq) {
          setLoadingResultActivityId(null);
        }
      }
    },
    [],
  );

  const handleAnswerChange = useCallback(
    (paperItemNo: number, value: DraftAnswer) => {
      const nextAnswers = {
        ...latestAnswersRef.current,
        [String(paperItemNo)]: value,
      };

      latestAnswersRef.current = nextAnswers;
      dirtyRef.current = true;
      pendingAutosaveQuestionNosRef.current.add(paperItemNo);
      setAnswers(nextAnswers);
      setAutosaveState((current) => ({
        ...current,
        error: null,
        status: 'dirty',
      }));

      if (
        pendingAutosaveQuestionNosRef.current.size >=
        resolveAutosaveQuestionThreshold(paperRef.current)
      ) {
        queueAutosave();
      }
    },
    [queueAutosave],
  );

  function resetToList() {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setView('list');
    resultRequestSeqRef.current += 1;
    setLoadingResultActivityId(null);
    setPaperState({
      error: null,
      loading: false,
      paper: null,
    });
    setSubmitState({
      attempt: null,
      error: null,
      loading: false,
      result: null,
    });
    setAutosaveState({
      error: null,
      lastSavedAt: null,
      status: 'idle',
    });
    latestAnswersRef.current = {};
    dirtyRef.current = false;
    pendingAutosaveQuestionNosRef.current.clear();
    paperRef.current = null;
    setAnswers({});
    void loadActivities();
  }

  async function doSubmitExam(paper: ZquizExamPaper) {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitState({
      attempt: null,
      error: null,
      loading: true,
      result: null,
    });

    try {
      const result = await submitZquizExam({
        answers: buildZquizExamAnswers(paper.items, latestAnswersRef.current),
        attemptId: paper.attemptId,
      });

      dirtyRef.current = false;
      setPaperState({
        error: null,
        loading: false,
        paper: null,
      });
      setAutosaveState({
        error: null,
        lastSavedAt: null,
        status: 'idle',
      });
      latestAnswersRef.current = {};
      pendingAutosaveQuestionNosRef.current.clear();
      paperRef.current = null;
      setAnswers({});
      void loadActivities();
      await handleLoadExamResult({
        activityId: paper.activity.id,
        attemptId: result.attemptId,
        summary: result,
      });
    } catch (error) {
      setSubmitState({
        attempt: null,
        error: resolveZquizExamErrorMessage(error, '暂时无法提交考试。'),
        loading: false,
        result: null,
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);

      if (paperRef.current && dirtyRef.current) {
        queueAutosave();
      }
    }
  }

  function handleSubmitExam() {
    const paper = paperRef.current;

    if (!paper || submitting) {
      return;
    }

    Modal.confirm({
      cancelText: '取消',
      content: `确定提交考试？已作答 ${answerCount} 题。提交后不能继续修改答案。`,
      okText: '交卷',
      onOk: () => doSubmitExam(paper),
      title: '确认交卷',
    });
  }

  function renderHeader() {
    return (
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <Typography.Title level={3} style={{ marginBottom: 0 }}>
                可选考试
              </Typography.Title>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                按开放状态查看考试，开放中的考试可直接开考。
              </Typography.Paragraph>
            </div>
            <Space wrap>
              <Tag color="blue">{activityCountText}</Tag>
              <Button
                icon={<ReloadOutlined />}
                loading={listState.loading}
                onClick={loadActivities}
              >
                刷新列表
              </Button>
            </Space>
          </div>
        </div>
      </Card>
    );
  }

  function renderList() {
    return (
      <>
        {listState.error ? <Alert showIcon message={listState.error} type="error" /> : null}
        {paperState.error ? <Alert showIcon message={paperState.error} type="error" /> : null}

        <Card>
          {listState.error ? null : (
            <List<ZquizExamActivity>
              dataSource={listState.activities}
              loading={listState.loading}
              locale={{ emptyText: <Empty description="暂无可选考试" /> }}
              renderItem={(activity) => {
                const disabledReason = resolveDisabledReason(activity);
                const canStart = canStartActivity(activity);

                return (
                  <List.Item
                    actions={[
                      <Button
                        icon={<FileDoneOutlined />}
                        key="result"
                        loading={loadingResultActivityId === activity.id}
                        onClick={() => void handleLoadExamResult({ activityId: activity.id })}
                      >
                        查看结果
                      </Button>,
                      <Button
                        disabled={!canStart}
                        icon={<PlayCircleOutlined />}
                        key="start"
                        loading={startingActivityId === activity.id}
                        onClick={() => void handleStartExam(activity.id)}
                        type={canStart ? 'primary' : 'default'}
                      >
                        {canStart ? '开始考试' : disabledReason || '不可进入'}
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space wrap>
                          <span>{activity.title}</span>
                          <ActivityStatusTag activity={activity} />
                        </Space>
                      }
                      description={<ActivityMeta activity={activity} />}
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </Card>
      </>
    );
  }

  function renderAutosaveStatus() {
    if (autosaveState.status === 'saving') {
      return (
        <Tag icon={<SaveOutlined />} color="processing">
          保存中
        </Tag>
      );
    }

    if (autosaveState.status === 'saved') {
      return (
        <Tag icon={<CheckCircleOutlined />} color="green">
          已保存：{formatDateTime(autosaveState.lastSavedAt)}
        </Tag>
      );
    }

    if (autosaveState.status === 'dirty') {
      return (
        <Tag icon={<HourglassOutlined />} color="gold">
          有未保存答案
        </Tag>
      );
    }

    if (autosaveState.status === 'error') {
      return <Tag color="red">保存失败</Tag>;
    }

    return <Tag>等待作答</Tag>;
  }

  function renderPaper() {
    const paper = currentPaper;

    if (paperState.loading) {
      return (
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      );
    }

    if (!paper) {
      return (
        <Card>
          {paperState.error ? (
            <Alert showIcon message={paperState.error} type="error" />
          ) : (
            <Empty description="暂无考试卷面" />
          )}
        </Card>
      );
    }

    return (
      <div className="flex flex-col gap-5">
        <Card
          title={paper.activity.title}
          extra={
            <Space wrap>
              <Button icon={<ArrowLeftOutlined />} onClick={resetToList}>
                返回列表
              </Button>
              <Button
                icon={<SendOutlined />}
                loading={submitting}
                onClick={handleSubmitExam}
                type="primary"
              >
                交卷
              </Button>
            </Space>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Tag color="blue">Attempt #{paper.attemptNo}</Tag>
              <Tag icon={<ClockCircleOutlined />} color={isAfterDeadline ? 'red' : 'green'}>
                剩余：{formatCountdown(paper.deadlineAt, now)}
              </Tag>
              {renderAutosaveStatus()}
              <Tag color="purple">已作答 {answerCount} 题</Tag>
            </div>

            {autosaveState.error ? (
              <Alert showIcon message={autosaveState.error} type="warning" />
            ) : null}

            {submitState.error ? <Alert showIcon message={submitState.error} type="error" /> : null}

            {isAfterDeadline ? (
              <Alert
                showIcon
                message="考试已超过提交时间，保存或交卷可能会被拒绝。"
                type="warning"
              />
            ) : null}

            <Descriptions
              bordered
              column={2}
              items={[
                {
                  key: 'startedAt',
                  label: '开始时间',
                  children: formatDateTime(paper.startedAt),
                },
                {
                  key: 'deadlineAt',
                  label: '截止时间',
                  children: formatDateTime(paper.deadlineAt),
                },
                {
                  key: 'duration',
                  label: '考试时长',
                  children: formatDuration(paper.activity.durationMinutes),
                },
                {
                  key: 'attemptId',
                  label: 'Attempt ID',
                  children: paper.attemptId,
                },
              ]}
            />
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          {questionStatusGroups.map((group, groupIndex) => {
            const shouldShowItemScore = !hasUniformQuestionGroupScore(group);

            return (
              <section className="flex flex-col gap-4" key={group.type}>
                <h2 className="text-base font-semibold text-text">
                  {formatQuestionGroupTitle(group, groupIndex)}
                </h2>
                <div className="flex flex-col gap-4">
                  {group.items.map(({ item }) => (
                    <div
                      id={`exam-question-${item.paperItemNo}`}
                      key={`${item.paperItemNo}-${item.questionId}`}
                      style={{ scrollMarginTop: 24 }}
                    >
                      <ExamQuestionCard
                        disabled={submitting}
                        item={item}
                        showScore={shouldShowItemScore}
                        value={answers[String(item.paperItemNo)]}
                        onAnswerChange={handleAnswerChange}
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  function renderResult() {
    const attempt = submitState.attempt;
    const result = submitState.result;

    if (submitState.loading) {
      return (
        <Card title="考试结果">
          <Skeleton active paragraph={{ rows: 5 }} />
        </Card>
      );
    }

    const extra = (
      <Button icon={<ArrowLeftOutlined />} onClick={resetToList}>
        返回列表
      </Button>
    );

    if (!attempt) {
      return (
        <Card
          title={
            <Space>
              <FileDoneOutlined />
              <span>考试结果</span>
            </Space>
          }
          extra={extra}
        >
          <div className="flex flex-col gap-4">
            {submitState.error ? <Alert showIcon message={submitState.error} type="error" /> : null}
            {result ? (
              <Descriptions
                bordered
                column={2}
                items={[
                  {
                    key: 'attemptId',
                    label: 'Attempt ID',
                    children: result.attemptId,
                  },
                  {
                    key: 'attemptNo',
                    label: '提交次数',
                    children: `第 ${result.attemptNo} 次`,
                  },
                  {
                    key: 'status',
                    label: '状态',
                    children: ATTEMPT_STATUS_LABELS[result.status],
                  },
                  {
                    key: 'gradingStatus',
                    label: '评分状态',
                    children: ATTEMPT_GRADING_STATUS_LABELS[result.gradingStatus],
                  },
                  {
                    key: 'score',
                    label: '分数',
                    children: formatScorePair(result.scoreAwarded, result.scoreMax),
                  },
                  {
                    key: 'submittedAt',
                    label: '提交时间',
                    children: formatDateTime(result.submittedAt),
                  },
                ]}
              />
            ) : (
              <Empty description="暂无考试结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        </Card>
      );
    }

    return (
      <div className="flex flex-col gap-5">
        <Card
          title={
            <Space>
              <FileDoneOutlined />
              <span>{attempt.activity.title}</span>
            </Space>
          }
          extra={extra}
        >
          <div className="flex flex-col gap-4">
            {attempt.gradingStatus === 'MANUAL_PENDING' ? (
              <Alert
                showIcon
                message="本次考试包含待人工批改题，当前总分只包含已自动评分的部分。"
                type="warning"
              />
            ) : null}

            {submitState.error ? (
              <Alert showIcon message={submitState.error} type="warning" />
            ) : null}

            <Descriptions
              bordered
              column={2}
              items={[
                {
                  key: 'score',
                  label: '总分',
                  children: formatScorePair(attempt.scoreAwarded, attempt.scoreMax),
                },
                {
                  key: 'attemptNo',
                  label: '提交次数',
                  children: `第 ${attempt.attemptNo} 次`,
                },
                {
                  key: 'status',
                  label: '状态',
                  children: ATTEMPT_STATUS_LABELS[attempt.status],
                },
                {
                  key: 'gradingStatus',
                  label: '评分状态',
                  children: ATTEMPT_GRADING_STATUS_LABELS[attempt.gradingStatus],
                },
                {
                  key: 'startedAt',
                  label: '开始时间',
                  children: formatDateTime(attempt.startedAt),
                },
                {
                  key: 'submittedAt',
                  label: '提交时间',
                  children: formatDateTime(attempt.submittedAt),
                },
                {
                  key: 'attemptId',
                  label: 'Attempt ID',
                  children: (
                    <Typography.Text copyable ellipsis>
                      {attempt.id}
                    </Typography.Text>
                  ),
                },
              ]}
            />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          {attempt.items.map((item) => (
            <AttemptQuestionCard key={`${item.paperItemNo}-${item.questionId}`} item={item} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {renderHeader()}
      {view === 'list' ? renderList() : null}
      {view === 'paper' ? renderPaper() : null}
      {view === 'result' ? renderResult() : null}
    </div>
  );
}
