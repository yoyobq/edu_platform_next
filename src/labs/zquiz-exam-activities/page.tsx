// src/labs/zquiz-exam-activities/page.tsx

import {
  type CSSProperties,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileDoneOutlined,
  HourglassOutlined,
  MoonOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SendOutlined,
  SunOutlined,
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
import { useNavigate, useOutletContext, useParams } from 'react-router';

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
    id: string;
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
  isDark?: boolean;
  presentation?: 'app' | 'exam-standalone';
  setIsDark?: (value: boolean | ((prev: boolean) => boolean)) => void;
  setSidebarOverride?: (override: ExamSidebarOverride | null) => void;
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
    doubted: boolean;
    item: ZquizExamPaperItem;
  }[];
  label: string;
  type: ZquizExamPaperItem['type'];
};

type ExamPageMode = 'list' | 'paper-route';

let examFullscreenSessionActive = false;
let examFullscreenReleaseTimer: number | null = null;

const AUTOSAVE_DEBOUNCE_MS = 1200;
const AUTOSAVE_FALLBACK_INTERVAL_MS = 30_000;
const AUTOSAVE_MIN_QUESTION_THRESHOLD = 2;
const AUTOSAVE_QUESTION_THRESHOLD = 3;
const COUNTDOWN_PRECISE_THRESHOLD_SECONDS = 300;
const DOUBT_QUESTION_NOS_SESSION_STORAGE_PREFIX = 'zquiz-exam-activities:doubt-question-nos:v1';
const CURRENT_TIME_TOOLBAR_PILL_WIDTH = '5.75rem';
const COUNTDOWN_TOOLBAR_PILL_WIDTH = '8.75rem';
const EXAM_STANDALONE_SIDEBAR_WIDTH = 320;
const EXAM_SIDEBAR_IDENTITY_AVATAR_FRAME_SIZE = 44;
const EXAM_SIDEBAR_IDENTITY_AVATAR_SIZE = 38;
const CHOICE_HEADER_STEM_SINGLE_LINE_OFFSET_PX = 8;
const QUESTION_WHEEL_NAVIGATION_ANCHOR_OFFSET_PX = 96;
const QUESTION_WHEEL_NAVIGATION_DELTA_THRESHOLD = 32;
const QUESTION_WHEEL_NAVIGATION_RESET_MS = 180;
const CHOICE_OPTION_TEXT_STYLE = {
  fontSize: 'var(--ant-font-size-lg)',
  lineHeight: 'var(--ant-line-height-lg)',
} satisfies CSSProperties;
const CHOICE_OPTION_CONTENT_STYLE = {
  minWidth: 0,
  paddingTop: 1,
} satisfies CSSProperties;
const CHOICE_HEADER_STEM_TEXT_STYLE = {
  color: 'var(--ant-color-text)',
  display: 'block',
  fontSize: 'var(--ant-font-size-lg)',
  fontWeight: 500,
  lineHeight: 'var(--ant-line-height-lg)',
  paddingTop: CHOICE_HEADER_STEM_SINGLE_LINE_OFFSET_PX,
  whiteSpace: 'pre-wrap',
} satisfies CSSProperties;
const TOOLBAR_TIME_TEXT_STYLE = {
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
} satisfies CSSProperties;
const EXAM_TOOLBAR_STYLE = {
  background: 'var(--ant-color-bg-container)',
  borderBottom: '1px solid color-mix(in srgb, var(--ant-color-border) 82%, transparent)',
  boxShadow: 'var(--shadow-surface)',
} satisfies CSSProperties;
const QUESTION_CARD_STYLE = {
  borderColor: 'color-mix(in srgb, var(--ant-color-border-secondary) 72%, transparent)',
  boxShadow: 'none',
} satisfies CSSProperties;
const QUESTION_CARD_STYLES = {
  body: {
    padding: 24,
  },
  header: {
    borderBottom:
      '1px solid color-mix(in srgb, var(--ant-color-border-secondary) 72%, transparent)',
    minHeight: 64,
    padding: '16px 24px',
  },
} satisfies {
  body: CSSProperties;
  header: CSSProperties;
};
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

function formatTimestampDateTime(value: number) {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatClockMinute(value: number) {
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
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

function formatCountdownUnit(value: number) {
  return String(value).padStart(2, '0');
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

  if (totalSeconds <= COUNTDOWN_PRECISE_THRESHOLD_SECONDS) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${formatCountdownUnit(minutes)}:${formatCountdownUnit(seconds)}`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}小时 ${formatCountdownUnit(minutes)}分`;
  }

  return `${totalMinutes}分`;
}

function resolveStudentIdentityDisplay(snapshot: ExamLayoutSnapshot | null) {
  const realName = snapshot?.identity?.name?.trim() || '未同步真实姓名';
  const identityId = snapshot?.identity?.id.trim() || '未同步学号';

  return { identityId, realName };
}

function resolveDoubtQuestionNosSessionKey(paper: ZquizExamPaper) {
  return `${DOUBT_QUESTION_NOS_SESSION_STORAGE_PREFIX}:${paper.activity.id}:${paper.attemptId}`;
}

function buildValidPaperItemNoSet(paper: ZquizExamPaper) {
  return new Set(paper.items.map((item) => item.paperItemNo));
}

function readDoubtQuestionNosFromSession(key: string, validPaperItemNos: ReadonlySet<number>) {
  if (typeof window === 'undefined') {
    return new Set<number>();
  }

  try {
    const value = window.sessionStorage.getItem(key);

    if (!value) {
      return new Set<number>();
    }

    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return new Set<number>();
    }

    const questionNos = new Set<number>();

    for (const rawQuestionNo of parsed) {
      const questionNo = typeof rawQuestionNo === 'number' ? rawQuestionNo : Number(rawQuestionNo);

      if (Number.isInteger(questionNo) && validPaperItemNos.has(questionNo)) {
        questionNos.add(questionNo);
      }
    }

    return questionNos;
  } catch {
    return new Set<number>();
  }
}

function writeDoubtQuestionNosToSession(key: string, questionNos: ReadonlySet<number>) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (questionNos.size === 0) {
      window.sessionStorage.removeItem(key);
      return;
    }

    window.sessionStorage.setItem(
      key,
      JSON.stringify([...questionNos].sort((left, right) => left - right)),
    );
  } catch {
    // Session storage is best-effort UI state.
  }
}

function removeDoubtQuestionNosSession(key: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // noop
  }
}

function clearDoubtQuestionNosSession(paper: ZquizExamPaper | null) {
  if (!paper) {
    return;
  }

  removeDoubtQuestionNosSession(resolveDoubtQuestionNosSessionKey(paper));
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
  doubtQuestionNos: ReadonlySet<number>,
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
      doubted: doubtQuestionNos.has(item.paperItemNo),
      item,
    });
  }

  return groups;
}

function buildRenderedQuestionNos(paper: ZquizExamPaper) {
  const groups: { paperItemNos: number[]; type: ZquizExamPaperItem['type'] }[] = [];
  const groupByType = new Map<ZquizExamPaperItem['type'], number[]>();

  for (const item of [...paper.items].sort((left, right) => left.paperItemNo - right.paperItemNo)) {
    const existingGroup = groupByType.get(item.type);

    if (existingGroup) {
      existingGroup.push(item.paperItemNo);
      continue;
    }

    const paperItemNos = [item.paperItemNo];

    groupByType.set(item.type, paperItemNos);
    groups.push({
      paperItemNos,
      type: item.type,
    });
  }

  return groups.flatMap((group) => group.paperItemNos);
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

function resolveCurrentExamQuestionIndex(questionNos: readonly number[]) {
  const anchorY = window.scrollY + QUESTION_WHEEL_NAVIGATION_ANCHOR_OFFSET_PX;
  let currentIndex = -1;

  for (const [index, questionNo] of questionNos.entries()) {
    const questionElement = document.getElementById(`exam-question-${questionNo}`);

    if (!questionElement) {
      continue;
    }

    const questionTop = window.scrollY + questionElement.getBoundingClientRect().top;

    if (questionTop > anchorY) {
      break;
    }

    currentIndex = index;
  }

  return currentIndex;
}

function resolveWheelTargetQuestionIndex(
  questionNos: readonly number[],
  deltaY: number,
  currentIndex: number | null,
) {
  const direction = deltaY > 0 ? 1 : -1;
  const sourceIndex = currentIndex ?? resolveCurrentExamQuestionIndex(questionNos);
  const targetIndex =
    direction > 0 ? Math.min(sourceIndex + 1, questionNos.length - 1) : sourceIndex - 1;

  if (targetIndex < 0 || targetIndex === sourceIndex) {
    return null;
  }

  return targetIndex;
}

function shouldIgnoreQuestionWheelNavigation(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        'textarea',
        'input:not([type="radio"]):not([type="checkbox"])',
        'select',
        '[contenteditable="true"]',
        '.ant-input',
        '.ant-input-affix-wrapper',
        '.ant-input-number',
        '.ant-modal-root',
        '.ant-picker',
        '.ant-select',
      ].join(','),
    ),
  );
}

function requestExamFullscreen() {
  cancelScheduledExamFullscreenRelease();

  if (
    typeof document === 'undefined' ||
    !document.fullscreenEnabled ||
    document.fullscreenElement
  ) {
    return;
  }

  void document.documentElement
    .requestFullscreen({ navigationUI: 'hide' })
    .then(() => {
      examFullscreenSessionActive = true;
    })
    .catch(() => undefined);
}

function releaseExamFullscreen() {
  if (typeof document === 'undefined') {
    return;
  }

  if (!document.fullscreenElement) {
    examFullscreenSessionActive = false;
    return;
  }

  if (!examFullscreenSessionActive) {
    return;
  }

  void document
    .exitFullscreen()
    .catch(() => undefined)
    .finally(() => {
      examFullscreenSessionActive = false;
    });
}

function cancelScheduledExamFullscreenRelease() {
  if (typeof window === 'undefined' || examFullscreenReleaseTimer === null) {
    return;
  }

  window.clearTimeout(examFullscreenReleaseTimer);
  examFullscreenReleaseTimer = null;
}

function scheduleReleaseExamFullscreen() {
  if (typeof window === 'undefined') {
    releaseExamFullscreen();
    return;
  }

  cancelScheduledExamFullscreenRelease();
  examFullscreenReleaseTimer = window.setTimeout(() => {
    examFullscreenReleaseTimer = null;
    releaseExamFullscreen();
  }, 0);
}

function resolveToolbarTimePillStyle(isAfterDeadline: boolean) {
  if (isAfterDeadline) {
    return {
      justifyContent: 'center',
      background:
        'color-mix(in srgb, var(--ant-color-error-bg) 78%, var(--ant-color-bg-container))',
      border: '1px solid var(--ant-color-error-border)',
      borderRadius: 'var(--ant-border-radius)',
      color: 'var(--ant-color-error)',
      whiteSpace: 'nowrap',
      width: COUNTDOWN_TOOLBAR_PILL_WIDTH,
    } satisfies CSSProperties;
  }

  return {
    justifyContent: 'center',
    background:
      'color-mix(in srgb, var(--ant-color-success-bg) 72%, var(--ant-color-bg-container))',
    border: '1px solid var(--ant-color-success-border)',
    borderRadius: 'var(--ant-border-radius)',
    color: 'var(--ant-color-success)',
    whiteSpace: 'nowrap',
    width: COUNTDOWN_TOOLBAR_PILL_WIDTH,
  } satisfies CSSProperties;
}

function resolveToolbarCurrentTimePillStyle() {
  return {
    background: 'var(--ant-color-fill-quaternary)',
    border: '1px solid color-mix(in srgb, var(--ant-color-border-secondary) 78%, transparent)',
    borderRadius: 'var(--ant-border-radius)',
    color: 'var(--ant-color-text-secondary)',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    width: CURRENT_TIME_TOOLBAR_PILL_WIDTH,
  } satisfies CSSProperties;
}

function resolveToolbarStatusPillStyle() {
  return {
    background: 'color-mix(in srgb, var(--ant-color-bg-container) 76%, transparent)',
    border: '1px solid var(--ant-color-border-secondary)',
    borderRadius: 'var(--ant-border-radius)',
  } satisfies CSSProperties;
}

function resolveChoiceOptionStyle(selected: boolean, disabled: boolean) {
  if (selected) {
    return {
      alignItems: 'flex-start',
      background:
        'color-mix(in srgb, var(--ant-color-primary-bg) 54%, var(--ant-color-bg-container))',
      border: '1px solid var(--ant-color-primary-border)',
      borderRadius: 'var(--ant-border-radius)',
      display: 'flex',
      marginInlineEnd: 0,
      minHeight: 58,
      padding: '12px 14px',
      transition: 'background-color 160ms ease, border-color 160ms ease',
      width: '100%',
    } satisfies CSSProperties;
  }

  return {
    alignItems: 'flex-start',
    background: disabled ? 'var(--ant-color-fill-quaternary)' : 'var(--ant-color-bg-container)',
    border: '1px solid color-mix(in srgb, var(--ant-color-border-secondary) 78%, transparent)',
    borderRadius: 'var(--ant-border-radius)',
    display: 'flex',
    marginInlineEnd: 0,
    minHeight: 58,
    padding: '12px 14px',
    transition: 'background-color 160ms ease, border-color 160ms ease',
    width: '100%',
  } satisfies CSSProperties;
}

function resolveQuestionNumberStyle() {
  return {
    alignItems: 'center',
    background: 'var(--ant-color-fill-quaternary)',
    border: '1px solid color-mix(in srgb, var(--ant-color-border-secondary) 86%, transparent)',
    borderRadius: 'var(--ant-border-radius)',
    color: 'var(--ant-color-text-secondary)',
    display: 'inline-flex',
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
    height: 'var(--ant-control-height-lg)',
    justifyContent: 'center',
    width: 'var(--ant-control-height-lg)',
  } satisfies CSSProperties;
}

function resolveSidebarQuestionButtonStyle(answered: boolean) {
  if (answered) {
    return {
      background:
        'color-mix(in srgb, var(--ant-color-primary-bg) 58%, var(--ant-color-bg-container))',
      border:
        '1px solid color-mix(in srgb, var(--ant-color-primary-border) 72%, var(--ant-color-border-secondary))',
      borderRadius: 'var(--ant-border-radius)',
      color: 'color-mix(in srgb, var(--ant-color-primary) 86%, var(--ant-color-text-secondary))',
    } satisfies CSSProperties;
  }

  return {
    background:
      'color-mix(in srgb, var(--ant-color-fill-quaternary) 72%, var(--ant-color-bg-container))',
    border: '1px solid color-mix(in srgb, var(--ant-color-border-secondary) 84%, transparent)',
    borderRadius: 'var(--ant-border-radius)',
    color: 'var(--ant-color-text-secondary)',
  } satisfies CSSProperties;
}

function resolveSidebarDoubtMarkerStyle() {
  return {
    background: 'var(--ant-color-warning)',
    border: '1px solid var(--ant-color-bg-container)',
    borderRadius: 'var(--ant-border-radius-sm)',
    height: 8,
    position: 'absolute',
    right: 4,
    top: 4,
    width: 8,
  } satisfies CSSProperties;
}

function resolveSidebarIdentityAvatarFrameStyle() {
  return {
    alignItems: 'center',
    background: 'var(--ant-color-bg-container)',
    border: '1px solid color-mix(in srgb, var(--ant-color-border-secondary) 82%, transparent)',
    borderRadius: '50%',
    display: 'flex',
    height: EXAM_SIDEBAR_IDENTITY_AVATAR_FRAME_SIZE,
    justifyContent: 'center',
    width: EXAM_SIDEBAR_IDENTITY_AVATAR_FRAME_SIZE,
  } satisfies CSSProperties;
}

function resolveDoubtQuestionToggleStyle(isDoubted: boolean) {
  if (isDoubted) {
    return {
      background:
        'color-mix(in srgb, var(--ant-color-warning-bg) 64%, var(--ant-color-bg-container))',
      border:
        '1px solid color-mix(in srgb, var(--ant-color-warning-border) 72%, var(--ant-color-border-secondary))',
      color: 'var(--ant-color-warning)',
    } satisfies CSSProperties;
  }

  return {
    border: '1px solid transparent',
    color: 'var(--ant-color-text-tertiary)',
  } satisfies CSSProperties;
}

function resolveAutosaveIndicator(state: AutosaveState, isAfterDeadline = false) {
  if (isAfterDeadline) {
    return {
      color: 'var(--ant-color-text-quaternary)',
      label: '自动保存已停止',
      title: '考试已截止，自动保存已停止。',
    };
  }

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
    color: 'var(--ant-color-text-quaternary)',
    label: '暂无保存内容',
    title: '尚未作答，暂无需要保存的答案。',
  };
}

function ExamToolbarStatusTags({
  autosaveState,
  isAfterDeadline,
  now,
  paper,
  submitting,
}: {
  autosaveState: AutosaveState;
  isAfterDeadline: boolean;
  now: number;
  paper: ZquizExamPaper;
  submitting: boolean;
}) {
  const autosaveIndicator = resolveAutosaveIndicator(autosaveState, isAfterDeadline);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tooltip title={`当前时间：${formatTimestampDateTime(now)}`}>
        <span
          aria-label={`当前时间 ${formatClockMinute(now)}`}
          className="inline-flex h-8 items-center gap-1.5 px-3 text-sm font-medium"
          style={resolveToolbarCurrentTimePillStyle()}
        >
          <ClockCircleOutlined aria-hidden="true" style={{ fontSize: 'var(--ant-font-size)' }} />
          <span style={TOOLBAR_TIME_TEXT_STYLE}>{formatClockMinute(now)}</span>
        </span>
      </Tooltip>
      <Tooltip title={`截止时间：${formatDateTime(paper.deadlineAt)}`}>
        <span
          aria-label={
            isAfterDeadline ? '考试已截止' : `剩余时间 ${formatCountdown(paper.deadlineAt, now)}`
          }
          className="inline-flex h-8 items-center gap-1.5 px-3 text-sm font-medium"
          style={resolveToolbarTimePillStyle(isAfterDeadline)}
        >
          <HourglassOutlined aria-hidden="true" style={{ fontSize: 'var(--ant-font-size)' }} />
          <span style={TOOLBAR_TIME_TEXT_STYLE}>
            {isAfterDeadline ? '已截止' : formatCountdown(paper.deadlineAt, now)}
          </span>
        </span>
      </Tooltip>
      {submitting ? (
        <Tooltip title="正在提交考试。">
          <span
            aria-label="正在提交考试"
            className="inline-flex h-8 w-8 items-center justify-center"
            role="status"
            style={resolveToolbarStatusPillStyle()}
          >
            <span
              aria-hidden="true"
              className="inline-flex h-2.5 w-2.5 shrink-0"
              style={{
                background: 'var(--ant-color-info)',
                borderRadius: 'var(--ant-border-radius-sm)',
              }}
            />
          </span>
        </Tooltip>
      ) : (
        <Tooltip title={autosaveIndicator.title}>
          <span
            aria-label={autosaveIndicator.label}
            className="inline-flex h-8 w-8 items-center justify-center"
            role="status"
            style={resolveToolbarStatusPillStyle()}
          >
            <span
              aria-hidden="true"
              className="inline-flex h-2.5 w-2.5 shrink-0"
              style={{
                background: autosaveIndicator.color,
                borderRadius: 'var(--ant-border-radius-sm)',
              }}
            />
          </span>
        </Tooltip>
      )}
    </div>
  );
}

function ExamAnswerStatusSidebar({
  answerCount,
  groups,
  paper,
  snapshot,
}: {
  answerCount: number;
  groups: QuestionStatusGroup[];
  paper: ZquizExamPaper;
  snapshot: ExamLayoutSnapshot | null;
}) {
  const questionCount = paper.items.length;
  const progressPercent = questionCount > 0 ? Math.round((answerCount / questionCount) * 100) : 0;
  const doubtCount = groups.reduce(
    (count, group) => count + group.items.filter(({ doubted }) => doubted).length,
    0,
  );
  const studentIdentity = resolveStudentIdentityDisplay(snapshot);

  return (
    <aside className="flex h-full flex-col">
      <div
        className="flex shrink-0 flex-col gap-3 px-4 py-4"
        style={{
          background:
            'color-mix(in srgb, var(--ant-color-primary-bg) 34%, var(--ant-color-bg-container))',
          borderBottom:
            '1px solid color-mix(in srgb, var(--ant-color-primary-border) 42%, var(--ant-color-border-secondary))',
        }}
      >
        <span className="text-sm font-semibold text-text">答题卡</span>
        <div className="flex items-center justify-between gap-3 text-xs text-text-secondary">
          <span>
            已答 {answerCount} / {questionCount}
          </span>
          <span style={doubtCount > 0 ? { color: 'var(--ant-color-warning)' } : undefined}>
            {doubtCount > 0 ? `疑问 ${doubtCount}` : `${progressPercent}%`}
          </span>
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.type} className="flex flex-col gap-2">
              <div className="px-1 text-xs font-medium text-text-secondary">{group.label}</div>
              <div className="grid grid-cols-5 gap-2">
                {group.items.map(({ answered, doubted, item }) => (
                  <button
                    aria-label={`第 ${item.paperItemNo} 题，${answered ? '已作答' : '未作答'}${
                      doubted ? '，有疑问' : ''
                    }`}
                    className="relative flex h-9 items-center justify-center text-sm font-medium transition-colors hover:bg-fill-hover hover:text-text"
                    key={`${item.paperItemNo}-${item.questionId}`}
                    style={resolveSidebarQuestionButtonStyle(answered)}
                    type="button"
                    onClick={() => scrollToExamQuestion(item.paperItemNo)}
                  >
                    {item.paperItemNo}
                    {doubted ? (
                      <span aria-hidden="true" style={resolveSidebarDoubtMarkerStyle()} />
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div
        className="shrink-0 px-4 py-2"
        style={{ borderTop: '1px solid var(--ant-color-border-secondary)' }}
      >
        <div className="flex min-w-0 items-center gap-4">
          <span className="shrink-0" style={resolveSidebarIdentityAvatarFrameStyle()}>
            <HexAvatar
              accountId={snapshot?.accountId ?? paper.attemptId}
              avatarUrl={snapshot?.userInfo.avatarUrl ?? null}
              size={EXAM_SIDEBAR_IDENTITY_AVATAR_SIZE}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold leading-5">
              {studentIdentity.realName}
            </div>
            <Tooltip title={studentIdentity.identityId}>
              <div
                className="mt-0.5 truncate text-xs leading-4 text-text-secondary"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {studentIdentity.identityId}
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    </aside>
  );
}

function DoubtQuestionToggle({
  disabled,
  isDoubted,
  onToggle,
}: {
  disabled: boolean;
  isDoubted: boolean;
  onToggle: () => void;
}) {
  const title = isDoubted ? '取消疑问题标记' : '标记为疑问题';

  return (
    <Tooltip title={title}>
      <Button
        aria-label={title}
        aria-pressed={isDoubted}
        disabled={disabled}
        icon={<QuestionCircleOutlined />}
        shape="circle"
        size="small"
        style={resolveDoubtQuestionToggleStyle(isDoubted)}
        type="text"
        onClick={onToggle}
      />
    </Tooltip>
  );
}

function ThemeModeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  const title = isDark ? '切换浅色模式' : '切换深色模式';

  return (
    <Tooltip title={title}>
      <Button
        aria-label={title}
        icon={isDark ? <SunOutlined /> : <MoonOutlined />}
        shape="circle"
        type="text"
        onClick={onToggle}
      />
    </Tooltip>
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

function isChoiceQuestionType(type: ZquizExamPaperItem['type']) {
  return type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE';
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
    <section className="flex flex-col gap-2">
      <Typography.Text strong>附件</Typography.Text>
      <div className="flex flex-col gap-2">
        {assets.map((asset) => (
          <div
            className="p-3 text-sm text-text-secondary"
            key={`${asset.storageKey}-${asset.sortOrder}`}
            style={{
              border:
                '1px solid color-mix(in srgb, var(--ant-color-border-secondary) 78%, transparent)',
              borderRadius: 'var(--ant-border-radius)',
            }}
          >
            <div>{asset.originalName || asset.storageKey}</div>
            <div>
              {asset.kind} · {asset.mimeType || '未知类型'}
            </div>
          </div>
        ))}
      </div>
    </section>
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
      style={{ width: '100%' }}
      value={typeof value === 'string' ? value : undefined}
      onChange={(event) => onChange(event.target.value)}
    >
      <div className="flex w-full flex-col gap-3">
        {item.options.map((option) => (
          <Radio
            key={option.label}
            style={resolveChoiceOptionStyle(option.label === value, disabled)}
            value={option.label}
          >
            <span style={CHOICE_OPTION_CONTENT_STYLE}>
              <span className="block" style={CHOICE_OPTION_TEXT_STYLE}>
                {option.label}. {option.content}
              </span>
            </span>
          </Radio>
        ))}
      </div>
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
  const selectedValues = Array.isArray(value) ? value.map(String) : [];

  return (
    <Checkbox.Group
      disabled={disabled}
      style={{ width: '100%' }}
      value={selectedValues}
      onChange={(nextSelectedValues) => onChange(nextSelectedValues.map(String))}
    >
      <div className="flex w-full flex-col gap-3">
        {item.options.map((option) => (
          <Checkbox
            key={option.label}
            style={resolveChoiceOptionStyle(selectedValues.includes(option.label), disabled)}
            value={option.label}
          >
            <span style={CHOICE_OPTION_CONTENT_STYLE}>
              <span className="block" style={CHOICE_OPTION_TEXT_STYLE}>
                {option.label}. {option.content}
              </span>
            </span>
          </Checkbox>
        ))}
      </div>
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
  isDoubted,
  item,
  onAnswerChange,
  onDoubtToggle,
  showScore,
  value,
}: {
  disabled: boolean;
  isDoubted: boolean;
  item: ZquizExamPaperItem;
  onAnswerChange: (paperItemNo: number, value: DraftAnswer) => void;
  onDoubtToggle: (paperItemNo: number) => void;
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

  const isChoiceQuestion = isChoiceQuestionType(item.type);

  return (
    <Card
      style={QUESTION_CARD_STYLE}
      styles={QUESTION_CARD_STYLES}
      title={
        isChoiceQuestion ? (
          <div
            className="flex min-w-0 items-start gap-3"
            style={{ overflow: 'visible', whiteSpace: 'normal' }}
          >
            <span className="text-sm font-semibold" style={resolveQuestionNumberStyle()}>
              {item.paperItemNo}
            </span>
            <div className="min-w-0 flex-1">
              <span style={CHOICE_HEADER_STEM_TEXT_STYLE}>{item.stem}</span>
              {showScore ? (
                <span className="mt-1 block text-xs font-medium text-text-secondary">
                  {formatScore(item.scoreMax)} 分
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-sm font-semibold" style={resolveQuestionNumberStyle()}>
              {item.paperItemNo}
            </span>
            {showScore ? (
              <span className="min-w-0 truncate text-xs font-medium text-text-secondary">
                {formatScore(item.scoreMax)} 分
              </span>
            ) : null}
          </div>
        )
      }
      extra={
        <DoubtQuestionToggle
          disabled={disabled}
          isDoubted={isDoubted}
          onToggle={() => onDoubtToggle(item.paperItemNo)}
        />
      }
    >
      {isChoiceQuestion ? (
        <div className="flex flex-col gap-5">
          <AssetList assets={item.assets} />
          {renderAnswer()}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <Typography.Text strong>题干</Typography.Text>
            <div
              className="p-4"
              style={{
                background: 'var(--ant-color-fill-quaternary)',
                border:
                  '1px solid color-mix(in srgb, var(--ant-color-border-secondary) 78%, transparent)',
                borderRadius: 'var(--ant-border-radius)',
              }}
            >
              <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {item.stem}
              </Typography.Paragraph>
            </div>
          </section>

          <AssetList assets={item.assets} />

          <section className="flex flex-col gap-2">
            <Typography.Text strong>作答</Typography.Text>
            <div
              className="p-4"
              style={{
                border:
                  '1px solid color-mix(in srgb, var(--ant-color-border-secondary) 78%, transparent)',
                borderRadius: 'var(--ant-border-radius)',
              }}
            >
              {renderAnswer()}
            </div>
          </section>
        </div>
      )}
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

function ZquizExamActivitiesLabPageContent({
  activityId,
  mode,
}: {
  activityId?: number;
  mode: ExamPageMode;
}) {
  const outletContext = useOutletContext<ExamOutletContext | undefined>();
  const navigate = useNavigate();
  const activeLayoutSnapshot = outletContext?.activeSnapshot ?? null;
  const isDark = outletContext?.isDark ?? false;
  const isStandaloneExamShell = outletContext?.presentation === 'exam-standalone';
  const setIsDark = outletContext?.setIsDark;
  const setSidebarOverride = outletContext?.setSidebarOverride;
  const [view, setView] = useState<ExamView>(mode === 'paper-route' ? 'paper' : 'list');
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
  const [doubtQuestionNos, setDoubtQuestionNos] = useState<ReadonlySet<number>>(() => new Set());
  const [hydratedDoubtQuestionNosSessionKey, setHydratedDoubtQuestionNosSessionKey] = useState<
    string | null
  >(null);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>({
    error: null,
    lastSavedAt: null,
    status: 'idle',
  });
  const [loadingResultActivityId, setLoadingResultActivityId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const autosaveTimerRef = useRef<number | null>(null);
  const autosavingRef = useRef(false);
  const dirtyRef = useRef(false);
  const isAfterDeadlineRef = useRef(false);
  const latestAnswersRef = useRef<DraftAnswers>({});
  const paperRef = useRef<ZquizExamPaper | null>(null);
  const pendingAutosaveQuestionNosRef = useRef<Set<number>>(new Set());
  const paperWheelScopeRef = useRef<HTMLDivElement | null>(null);
  const questionWheelNavigationIndexRef = useRef<number | null>(null);
  const questionWheelNavigationResetTimerRef = useRef<number | null>(null);
  const resultRequestSeqRef = useRef(0);
  const runAutosaveRef = useRef<(() => Promise<void>) | null>(null);
  const startedRouteActivityIdRef = useRef<number | null>(null);
  const submittingRef = useRef(false);

  const activityCountText = useMemo(() => {
    if (listState.loading) {
      return '读取中';
    }

    return `${listState.activities.length} 个考试`;
  }, [listState.activities.length, listState.loading]);

  const currentPaper = paperState.paper;
  const currentDoubtQuestionNosSessionKey = useMemo(() => {
    return currentPaper ? resolveDoubtQuestionNosSessionKey(currentPaper) : null;
  }, [currentPaper]);
  const answerCount = useMemo(() => {
    return currentPaper ? buildZquizExamAnswers(currentPaper.items, answers).length : 0;
  }, [answers, currentPaper]);
  const questionStatusGroups = useMemo(() => {
    return currentPaper ? buildQuestionStatusGroups(currentPaper, answers, doubtQuestionNos) : [];
  }, [answers, currentPaper, doubtQuestionNos]);
  const renderedQuestionNos = useMemo(() => {
    return currentPaper ? buildRenderedQuestionNos(currentPaper) : [];
  }, [currentPaper]);

  const isAfterDeadline = useMemo(() => {
    if (!currentPaper) {
      return false;
    }

    const deadline = new Date(currentPaper.deadlineAt).getTime();

    return Number.isNaN(deadline) ? false : now >= deadline;
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
    if (isAfterDeadlineRef.current) {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      return;
    }

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

    if (isAfterDeadlineRef.current) {
      dirtyRef.current = false;
      pendingAutosaveQuestionNosRef.current.clear();
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
      if (isAfterDeadlineRef.current) {
        dirtyRef.current = false;
        pendingAutosaveQuestionNosRef.current.clear();
        setAutosaveState((current) => ({
          ...current,
          error: null,
          status: current.lastSavedAt ? 'saved' : 'idle',
        }));
        return;
      }

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
    if (mode === 'list') {
      void loadActivities();
    }
  }, [loadActivities, mode]);

  useEffect(() => {
    if (!currentPaper || !currentDoubtQuestionNosSessionKey) {
      setHydratedDoubtQuestionNosSessionKey(null);
      return;
    }

    const validPaperItemNos = buildValidPaperItemNoSet(currentPaper);

    setDoubtQuestionNos(
      readDoubtQuestionNosFromSession(currentDoubtQuestionNosSessionKey, validPaperItemNos),
    );
    setHydratedDoubtQuestionNosSessionKey(currentDoubtQuestionNosSessionKey);
  }, [currentDoubtQuestionNosSessionKey, currentPaper]);

  useEffect(() => {
    if (
      !currentDoubtQuestionNosSessionKey ||
      hydratedDoubtQuestionNosSessionKey !== currentDoubtQuestionNosSessionKey
    ) {
      return;
    }

    writeDoubtQuestionNosToSession(currentDoubtQuestionNosSessionKey, doubtQuestionNos);
  }, [currentDoubtQuestionNosSessionKey, doubtQuestionNos, hydratedDoubtQuestionNosSessionKey]);

  useEffect(() => {
    runAutosaveRef.current = runAutosave;
  }, [runAutosave]);

  useEffect(() => {
    isAfterDeadlineRef.current = isAfterDeadline;

    if (!isAfterDeadline) {
      return;
    }

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    dirtyRef.current = false;
    pendingAutosaveQuestionNosRef.current.clear();
    setAutosaveState((current) => ({
      ...current,
      error: null,
      status: current.lastSavedAt ? 'saved' : 'idle',
    }));
  }, [currentPaper?.attemptId, isAfterDeadline]);

  useEffect(() => {
    paperRef.current = currentPaper;
  }, [currentPaper]);

  useEffect(() => {
    if (isStandaloneExamShell) {
      return;
    }

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
          groups={questionStatusGroups}
          paper={currentPaper}
          snapshot={activeLayoutSnapshot}
        />
      ),
    });
  }, [
    activeLayoutSnapshot,
    answerCount,
    currentPaper,
    isStandaloneExamShell,
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
      if (dirtyRef.current && !isAfterDeadlineRef.current) {
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

  useEffect(() => {
    if (view !== 'paper') {
      return;
    }

    function blockFullscreenShortcut(event: KeyboardEvent) {
      if (event.key !== 'F11' && event.code !== 'F11') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    window.addEventListener('keydown', blockFullscreenShortcut, true);

    return () => {
      window.removeEventListener('keydown', blockFullscreenShortcut, true);
    };
  }, [view]);

  useEffect(() => {
    if (mode !== 'paper-route') {
      return;
    }

    cancelScheduledExamFullscreenRelease();

    return () => {
      scheduleReleaseExamFullscreen();
    };
  }, [mode]);

  useEffect(() => {
    if (view === 'paper' && currentPaper) {
      requestExamFullscreen();
    }
  }, [currentPaper, view]);

  useEffect(() => {
    if (view !== 'paper' || renderedQuestionNos.length === 0) {
      return;
    }

    function resetQuestionWheelNavigationIndex() {
      questionWheelNavigationIndexRef.current = null;

      if (questionWheelNavigationResetTimerRef.current !== null) {
        window.clearTimeout(questionWheelNavigationResetTimerRef.current);
        questionWheelNavigationResetTimerRef.current = null;
      }
    }

    function scheduleQuestionWheelNavigationIndexReset() {
      if (questionWheelNavigationResetTimerRef.current !== null) {
        window.clearTimeout(questionWheelNavigationResetTimerRef.current);
      }

      questionWheelNavigationResetTimerRef.current = window.setTimeout(() => {
        questionWheelNavigationIndexRef.current = null;
        questionWheelNavigationResetTimerRef.current = null;
      }, QUESTION_WHEEL_NAVIGATION_RESET_MS);
    }

    function handleQuestionWheelNavigation(event: WheelEvent) {
      const paperWheelScope = paperWheelScopeRef.current;

      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        Math.abs(event.deltaY) < QUESTION_WHEEL_NAVIGATION_DELTA_THRESHOLD ||
        shouldIgnoreQuestionWheelNavigation(event.target) ||
        !paperWheelScope ||
        !(event.target instanceof Node) ||
        !paperWheelScope.contains(event.target)
      ) {
        return;
      }

      const targetQuestionIndex = resolveWheelTargetQuestionIndex(
        renderedQuestionNos,
        event.deltaY,
        questionWheelNavigationIndexRef.current,
      );

      if (targetQuestionIndex === null) {
        return;
      }

      const targetQuestionNo = renderedQuestionNos[targetQuestionIndex];

      if (!targetQuestionNo) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      questionWheelNavigationIndexRef.current = targetQuestionIndex;
      scrollToExamQuestion(targetQuestionNo);
      scheduleQuestionWheelNavigationIndexReset();
    }

    window.addEventListener('wheel', handleQuestionWheelNavigation, {
      capture: true,
      passive: false,
    });

    return () => {
      window.removeEventListener('wheel', handleQuestionWheelNavigation, true);
      resetQuestionWheelNavigationIndex();
    };
  }, [renderedQuestionNos, view]);

  const handleStartExam = useCallback(async (activityId: number) => {
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
    setDoubtQuestionNos(new Set());

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
      setDoubtQuestionNos(new Set());
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
    }
  }, []);

  useEffect(() => {
    if (mode !== 'paper-route') {
      return;
    }

    if (!activityId || !Number.isInteger(activityId) || activityId <= 0) {
      setPaperState({
        error: '考试地址无效。',
        loading: false,
        paper: null,
      });
      setView('paper');
      return;
    }

    if (startedRouteActivityIdRef.current === activityId) {
      return;
    }

    startedRouteActivityIdRef.current = activityId;
    void handleStartExam(activityId);
  }, [activityId, handleStartExam, mode]);

  const handleLoadExamResult = useCallback(
    async (input: {
      activityId: number;
      attemptId?: string | null;
      summary?: ZquizExamSubmitResult | null;
    }) => {
      const requestSeq = resultRequestSeqRef.current + 1;
      resultRequestSeqRef.current = requestSeq;
      clearDoubtQuestionNosSession(paperRef.current);
      setLoadingResultActivityId(input.activityId);
      setPaperState({
        error: null,
        loading: false,
        paper: null,
      });
      setDoubtQuestionNos(new Set());
      setHydratedDoubtQuestionNosSessionKey(null);
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
      if (isAfterDeadlineRef.current) {
        return;
      }

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

  const handleToggleDoubtQuestion = useCallback((paperItemNo: number) => {
    setDoubtQuestionNos((current) => {
      const nextQuestionNos = new Set(current);

      if (nextQuestionNos.has(paperItemNo)) {
        nextQuestionNos.delete(paperItemNo);
      } else {
        nextQuestionNos.add(paperItemNo);
      }

      return nextQuestionNos;
    });
  }, []);

  function resetToList() {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    clearDoubtQuestionNosSession(paperRef.current);
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
    setDoubtQuestionNos(new Set());
    setHydratedDoubtQuestionNosSessionKey(null);
    releaseExamFullscreen();

    if (mode === 'paper-route') {
      navigate('/labs/zquiz-exam-activities');
      return;
    }

    setView('list');
    void loadActivities();
  }

  async function doSubmitExam(paper: ZquizExamPaper) {
    if (isAfterDeadlineRef.current) {
      setSubmitState({
        attempt: null,
        error: '考试已截止，不能再交卷。系统将以最后一次成功保存的答案作为收卷依据。',
        loading: false,
        result: null,
      });
      return;
    }

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

      clearDoubtQuestionNosSession(paper);
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
      setDoubtQuestionNos(new Set());
      setHydratedDoubtQuestionNosSessionKey(null);
      releaseExamFullscreen();
      if (mode === 'list') {
        void loadActivities();
      }
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

      if (paperRef.current && dirtyRef.current && !isAfterDeadlineRef.current) {
        queueAutosave();
      }
    }
  }

  function handleSubmitExam() {
    const paper = paperRef.current;

    if (!paper || submitting || isAfterDeadline) {
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
        {listState.error ? <Alert showIcon title={listState.error} type="error" /> : null}
        {paperState.error ? <Alert showIcon title={paperState.error} type="error" /> : null}

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
                        onClick={() => {
                          requestExamFullscreen();
                          navigate(`/labs/zquiz-exam-activities/${activity.id}`);
                        }}
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
            <Alert showIcon title={paperState.error} type="error" />
          ) : (
            <Empty description="暂无考试卷面" />
          )}
        </Card>
      );
    }

    return (
      <div ref={paperWheelScopeRef} className="flex w-full flex-col gap-5">
        <div
          className="sticky top-0 z-floating-action-bar -mx-4 px-4 py-3"
          style={EXAM_TOOLBAR_STYLE}
        >
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-text">
                {paper.activity.title}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ExamToolbarStatusTags
                autosaveState={autosaveState}
                isAfterDeadline={isAfterDeadline}
                now={now}
                paper={paper}
                submitting={submitting}
              />
              {setIsDark ? (
                <ThemeModeToggle isDark={isDark} onToggle={() => setIsDark((value) => !value)} />
              ) : null}
              <Button
                disabled={isAfterDeadline}
                icon={<SendOutlined />}
                loading={submitting}
                onClick={handleSubmitExam}
                type="primary"
              >
                交卷
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
          {autosaveState.error ? (
            <Alert showIcon title={autosaveState.error} type="warning" />
          ) : null}

          {submitState.error ? <Alert showIcon title={submitState.error} type="error" /> : null}

          {isAfterDeadline ? (
            <Alert
              showIcon
              title="考试已截止，答题、自动保存和交卷已停止，系统将以最后一次成功保存的答案作为收卷依据。"
              type="warning"
            />
          ) : null}

          <div className="flex flex-col gap-6">
            {questionStatusGroups.map((group, groupIndex) => {
              const shouldShowItemScore = !hasUniformQuestionGroupScore(group);

              return (
                <section className="flex flex-col gap-4" key={group.type}>
                  <h2
                    className="text-sm font-semibold text-text-secondary"
                    style={{
                      borderBottom: '1px solid var(--ant-color-border-secondary)',
                      paddingBottom: 8,
                    }}
                  >
                    {formatQuestionGroupTitle(group, groupIndex)}
                  </h2>
                  <div className="flex flex-col gap-4">
                    {group.items.map(({ item }) => (
                      <div
                        id={`exam-question-${item.paperItemNo}`}
                        key={`${item.paperItemNo}-${item.questionId}`}
                        style={{ scrollMarginTop: QUESTION_WHEEL_NAVIGATION_ANCHOR_OFFSET_PX }}
                      >
                        <ExamQuestionCard
                          disabled={submitting || isAfterDeadline}
                          isDoubted={doubtQuestionNos.has(item.paperItemNo)}
                          item={item}
                          showScore={shouldShowItemScore}
                          value={answers[String(item.paperItemNo)]}
                          onAnswerChange={handleAnswerChange}
                          onDoubtToggle={handleToggleDoubtQuestion}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderStandaloneExamRoute() {
    if (view === 'paper' && currentPaper) {
      return (
        <div className="flex h-full min-h-0 bg-bg-layout text-text">
          <aside
            className="min-h-0 shrink-0 bg-bg-container"
            style={{
              borderRight: '1px solid var(--ant-color-border-secondary)',
              width: EXAM_STANDALONE_SIDEBAR_WIDTH,
            }}
          >
            <ExamAnswerStatusSidebar
              answerCount={answerCount}
              groups={questionStatusGroups}
              paper={currentPaper}
              snapshot={activeLayoutSnapshot}
            />
          </aside>
          <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">{renderPaper()}</main>
        </div>
      );
    }

    return (
      <main className="h-full overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl">
          {view === 'list' ? (
            <>
              {renderHeader()}
              {renderList()}
            </>
          ) : null}
          {view === 'paper' ? renderPaper() : null}
          {view === 'result' ? renderResult() : null}
        </div>
      </main>
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
            {submitState.error ? <Alert showIcon title={submitState.error} type="error" /> : null}
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
                title="本次考试包含待人工批改题，当前总分只包含已自动评分的部分。"
                type="warning"
              />
            ) : null}

            {submitState.error ? <Alert showIcon title={submitState.error} type="warning" /> : null}

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

  if (isStandaloneExamShell) {
    return renderStandaloneExamRoute();
  }

  return (
    <div className="flex flex-col gap-6">
      {view === 'list' ? (
        <>
          {renderHeader()}
          {renderList()}
        </>
      ) : null}
      {view === 'paper' ? renderPaper() : null}
      {view === 'result' ? renderResult() : null}
    </div>
  );
}

export function ZquizExamActivitiesLabPage() {
  return <ZquizExamActivitiesLabPageContent mode="list" />;
}

export function ZquizExamPaperLabPage() {
  const params = useParams();
  const activityId = Number(params.activityId);

  return <ZquizExamActivitiesLabPageContent activityId={activityId} mode="paper-route" />;
}
