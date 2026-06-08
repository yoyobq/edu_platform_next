// src/labs/zquiz-practice-activities/page.tsx

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileSearchOutlined,
  HourglassOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
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
  Typography,
} from 'antd';

import {
  buildZquizPracticeSubmitAnswers,
  getMyZquizPracticeActivity,
  getMyZquizPracticeAttempt,
  listMyZquizPracticeActivities,
  resolveZquizPracticeErrorMessage,
  startZquizPractice,
  submitZquizPractice,
  type ZquizPracticeActivity,
  type ZquizPracticeAttempt,
  type ZquizPracticeAttemptGradingStatus,
  type ZquizPracticeAttemptItem,
  type ZquizPracticeAttemptItemGradingStatus,
  type ZquizPracticeAttemptStatus,
  type ZquizPracticeAvailability,
  type ZquizPracticeDraftAnswers,
  type ZquizPracticePaper,
  type ZquizPracticePaperAsset,
  type ZquizPracticePaperItem,
} from './api';

type ActivityViewState = {
  activities: ZquizPracticeActivity[];
  error: string | null;
  loading: boolean;
};

type PaperViewState = {
  error: string | null;
  loading: boolean;
  paper: PracticePaperView | null;
};

type AttemptViewState = {
  attempt: ZquizPracticeAttempt | null;
  error: string | null;
  loading: boolean;
};

type PracticeView = 'list' | 'paper' | 'result';
type DraftAnswer = unknown;
type DraftAnswers = ZquizPracticeDraftAnswers;
type PracticePaperView = Omit<ZquizPracticePaper, 'signedPaperToken'>;

const DRAFT_STORAGE_PREFIX = 'zquiz-practice-draft:';
const LAST_ATTEMPT_STORAGE_PREFIX = 'zquiz-practice-last-attempt:';

const AVAILABILITY_LABELS: Record<ZquizPracticeAvailability, string> = {
  CLOSED: '已关闭',
  ENDED: '已结束',
  NOT_STARTED: '未开始',
  OPEN: '开放中',
};

const AVAILABILITY_TAG_COLORS: Record<ZquizPracticeAvailability, string> = {
  CLOSED: 'default',
  ENDED: 'red',
  NOT_STARTED: 'gold',
  OPEN: 'green',
};

const QUESTION_TYPE_LABELS: Record<ZquizPracticePaperItem['type'], string> = {
  ESSAY: '问答题',
  FILL_BLANK: '填空题',
  MULTIPLE_CHOICE: '多选题',
  SINGLE_CHOICE: '单选题',
  TRUE_FALSE: '判断题',
};

const ATTEMPT_STATUS_LABELS: Record<ZquizPracticeAttemptStatus, string> = {
  ABANDONED: '已放弃',
  GRADED: '已评分',
  IN_PROGRESS: '作答中',
  SUBMITTED: '已提交',
};

const ATTEMPT_GRADING_STATUS_LABELS: Record<ZquizPracticeAttemptGradingStatus, string> = {
  AUTO_GRADED: '自动评分',
  MANUAL_GRADED: '人工已评',
  MANUAL_PENDING: '待人工批改',
  NOT_GRADED: '未评分',
};

const ITEM_GRADING_STATUS_LABELS: Record<ZquizPracticeAttemptItemGradingStatus, string> = {
  AUTO_GRADED: '自动评分',
  MANUAL_GRADED: '人工已评',
  MANUAL_PENDING: '待批改',
  UNANSWERED: '未作答',
};

const ITEM_GRADING_STATUS_TAG_COLORS: Record<ZquizPracticeAttemptItemGradingStatus, string> = {
  AUTO_GRADED: 'blue',
  MANUAL_GRADED: 'green',
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
  });
}

function formatDuration(value: number | null) {
  return value === null ? '不限时' : `${value} 分钟`;
}

function formatAttemptLimit(value: number | null) {
  return value === null ? '不限次' : `${value} 次`;
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatOptionalScore(value: number | null) {
  return value === null ? '未设分值' : `${formatScore(value)} 分`;
}

function formatScorePair(scoreAwarded: number, scoreMax: number) {
  return `${formatScore(scoreAwarded)} / ${formatScore(scoreMax)}`;
}

function formatFileSize(value: number | null) {
  if (value === null) {
    return '大小未知';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function resolveDisabledReason(activity: ZquizPracticeActivity) {
  if (activity.availability === 'OPEN' && !activity.canStart) {
    return '次数已用完';
  }

  if (activity.availability === 'NOT_STARTED') {
    return `开放时间：${formatDateTime(activity.startsAt)}`;
  }

  if (activity.availability === 'ENDED') {
    return '已结束';
  }

  if (activity.availability === 'CLOSED') {
    return '已关闭';
  }

  return null;
}

function canStartActivity(activity: ZquizPracticeActivity) {
  return activity.availability === 'OPEN' && activity.canStart;
}

function createDraftStorageKey(activityId: number) {
  const randomId =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `${DRAFT_STORAGE_PREFIX}${activityId}:${randomId}`;
}

function getLastAttemptStorageKey(activityId: number) {
  return `${LAST_ATTEMPT_STORAGE_PREFIX}${activityId}`;
}

function writeDraftAnswers(storageKey: string, answers: DraftAnswers) {
  window.localStorage.setItem(storageKey, JSON.stringify(answers));
}

function clearDraftAnswers(storageKey: string) {
  window.localStorage.removeItem(storageKey);
}

function readLastAttemptIds(activities: ZquizPracticeActivity[]) {
  const attemptIds: Record<number, string> = {};

  for (const activity of activities) {
    const attemptId = window.localStorage.getItem(getLastAttemptStorageKey(activity.id));

    if (attemptId) {
      attemptIds[activity.id] = attemptId;
    }
  }

  return attemptIds;
}

function writeLastAttemptId(activityId: number, attemptId: string) {
  window.localStorage.setItem(getLastAttemptStorageKey(activityId), attemptId);
}

function ActivityMeta({ activity }: { activity: ZquizPracticeActivity }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      <span className="text-xs text-text-secondary">开始：{formatDateTime(activity.startsAt)}</span>
      <span className="text-xs text-text-secondary">结束：{formatDateTime(activity.endsAt)}</span>
      <span className="text-xs text-text-secondary">
        限时：{formatDuration(activity.durationMinutes)}
      </span>
      <span className="text-xs text-text-secondary">
        次数：{formatAttemptLimit(activity.attemptLimit)}
      </span>
    </div>
  );
}

function ActivityStatusTag({ activity }: { activity: ZquizPracticeActivity }) {
  return (
    <Tag color={AVAILABILITY_TAG_COLORS[activity.availability]}>
      {AVAILABILITY_LABELS[activity.availability]}
    </Tag>
  );
}

const AssetList = memo(function AssetList({ assets }: { assets: ZquizPracticePaperAsset[] }) {
  if (assets.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-text-secondary">附件</span>
      <div className="flex flex-wrap gap-2">
        {assets.map((asset) => (
          <Tag key={`${asset.storageKey}-${asset.sortOrder}`}>
            {asset.originalName || asset.storageKey} · {asset.kind} ·{' '}
            {formatFileSize(asset.sizeBytes)}
          </Tag>
        ))}
      </div>
    </div>
  );
});

const ChoiceAnswerInput = memo(function ChoiceAnswerInput({
  answer,
  item,
  onAnswerChange,
}: {
  answer: DraftAnswer;
  item: ZquizPracticePaperItem;
  onAnswerChange: (paperItemNo: number, value: DraftAnswer) => void;
}) {
  const options =
    item.options.length > 0
      ? item.options
      : [
          { content: '正确', label: 'TRUE', sortOrder: 1 },
          { content: '错误', label: 'FALSE', sortOrder: 2 },
        ];

  if (item.type === 'MULTIPLE_CHOICE') {
    const value = Array.isArray(answer) ? (answer as string[]) : [];

    return (
      <Checkbox.Group
        value={value}
        onChange={(nextValue) => onAnswerChange(item.paperItemNo, nextValue)}
      >
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <Checkbox key={option.label} value={option.label}>
              {option.label}. {option.content}
            </Checkbox>
          ))}
        </div>
      </Checkbox.Group>
    );
  }

  const value = typeof answer === 'string' ? answer : null;

  return (
    <Radio.Group
      value={value}
      onChange={(event) => onAnswerChange(item.paperItemNo, event.target.value)}
    >
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <Radio key={option.label} value={option.label}>
            {option.label}. {option.content}
          </Radio>
        ))}
      </div>
    </Radio.Group>
  );
});

const BlankAnswerInput = memo(function BlankAnswerInput({
  answer,
  item,
  onAnswerChange,
}: {
  answer: DraftAnswer;
  item: ZquizPracticePaperItem;
  onAnswerChange: (paperItemNo: number, value: DraftAnswer) => void;
}) {
  const currentValue =
    answer && typeof answer === 'object' && !Array.isArray(answer)
      ? (answer as Record<string, string>)
      : {};
  const blanks = item.blanks.length > 0 ? item.blanks : [{ blankNo: 1, score: item.scoreMax }];

  return (
    <div className="flex flex-col gap-3">
      {blanks.map((blank) => (
        <Input
          key={blank.blankNo}
          addonBefore={`空 ${blank.blankNo}`}
          placeholder={formatOptionalScore(blank.score)}
          value={currentValue[String(blank.blankNo)] || ''}
          onChange={(event) =>
            onAnswerChange(item.paperItemNo, {
              ...currentValue,
              [String(blank.blankNo)]: event.target.value,
            })
          }
        />
      ))}
    </div>
  );
});

const EssayAnswerInput = memo(function EssayAnswerInput({
  answer,
  item,
  onAnswerChange,
}: {
  answer: DraftAnswer;
  item: ZquizPracticePaperItem;
  onAnswerChange: (paperItemNo: number, value: DraftAnswer) => void;
}) {
  const value = typeof answer === 'string' ? answer : '';

  return (
    <Input.TextArea
      autoSize={{ minRows: 4, maxRows: 10 }}
      placeholder="在此输入答案。"
      value={value}
      onChange={(event) => onAnswerChange(item.paperItemNo, event.target.value)}
    />
  );
});

const PaperAnswerInput = memo(function PaperAnswerInput({
  answer,
  item,
  onAnswerChange,
}: {
  answer: DraftAnswer;
  item: ZquizPracticePaperItem;
  onAnswerChange: (paperItemNo: number, value: DraftAnswer) => void;
}) {
  if (item.type === 'FILL_BLANK') {
    return <BlankAnswerInput answer={answer} item={item} onAnswerChange={onAnswerChange} />;
  }

  if (item.type === 'ESSAY') {
    return <EssayAnswerInput answer={answer} item={item} onAnswerChange={onAnswerChange} />;
  }

  return <ChoiceAnswerInput answer={answer} item={item} onAnswerChange={onAnswerChange} />;
});

const PaperQuestionCard = memo(function PaperQuestionCard({
  answer,
  item,
  onAnswerChange,
}: {
  answer: DraftAnswer;
  item: ZquizPracticePaperItem;
  onAnswerChange: (paperItemNo: number, value: DraftAnswer) => void;
}) {
  return (
    <Card
      title={
        <Space wrap>
          <span>第 {item.paperItemNo} 题</span>
          <Tag>{QUESTION_TYPE_LABELS[item.type]}</Tag>
          <Tag color="blue">{formatScore(item.scoreMax)} 分</Tag>
        </Space>
      }
    >
      <div className="flex flex-col gap-4">
        <Typography.Paragraph style={{ marginBottom: 0 }}>{item.stem}</Typography.Paragraph>
        <AssetList assets={item.assets} />
        <PaperAnswerInput answer={answer} item={item} onAnswerChange={onAnswerChange} />
      </div>
    </Card>
  );
});

function CorrectnessTag({ item }: { item: ZquizPracticeAttemptItem }) {
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
  item: ZquizPracticeAttemptItem;
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
  item: ZquizPracticeAttemptItem;
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
        <Typography.Paragraph style={{ marginBottom: 0 }}>{item.stem}</Typography.Paragraph>
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

export function ZquizPracticeActivitiesLabPage() {
  const [view, setView] = useState<PracticeView>('list');
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
  const [attemptState, setAttemptState] = useState<AttemptViewState>({
    attempt: null,
    error: null,
    loading: false,
  });
  const [startingActivityId, setStartingActivityId] = useState<number | null>(null);
  const [loadingAttemptId, setLoadingAttemptId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastAttemptIds, setLastAttemptIds] = useState<Record<number, string>>({});
  const [answers, setAnswers] = useState<DraftAnswers>({});
  const draftWriteTimerRef = useRef<number | null>(null);
  const draftStorageKeyRef = useRef<string | null>(null);
  const latestAnswersRef = useRef<DraftAnswers>({});
  const paperTokenRef = useRef<string | null>(null);

  const activityCountText = useMemo(() => {
    if (listState.loading) {
      return '读取中';
    }

    return `${listState.activities.length} 个练习`;
  }, [listState.activities.length, listState.loading]);
  const paperAnswerCount = useMemo(() => {
    const paper = paperState.paper;

    return paper ? buildZquizPracticeSubmitAnswers(paper.items, answers).length : 0;
  }, [answers, paperState.paper]);

  const loadActivities = useCallback(async () => {
    setListState((current) => ({
      ...current,
      error: null,
      loading: true,
    }));

    try {
      const activities = await listMyZquizPracticeActivities();

      setListState({
        activities,
        error: null,
        loading: false,
      });
      setLastAttemptIds(readLastAttemptIds(activities));
    } catch (error) {
      setListState({
        activities: [],
        error: resolveZquizPracticeErrorMessage(error, '暂时无法读取可选练习列表。'),
        loading: false,
      });
    }
  }, []);

  const scheduleDraftWrite = useCallback((storageKey: string, nextAnswers: DraftAnswers) => {
    latestAnswersRef.current = nextAnswers;

    if (draftWriteTimerRef.current !== null) {
      window.clearTimeout(draftWriteTimerRef.current);
    }

    draftWriteTimerRef.current = window.setTimeout(() => {
      writeDraftAnswers(storageKey, latestAnswersRef.current);
      draftWriteTimerRef.current = null;
    }, 160);
  }, []);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  useEffect(() => {
    return () => {
      if (draftWriteTimerRef.current !== null) {
        window.clearTimeout(draftWriteTimerRef.current);
        draftWriteTimerRef.current = null;
      }

      if (draftStorageKeyRef.current) {
        clearDraftAnswers(draftStorageKeyRef.current);
      }
    };
  }, []);

  const flushDraftWrite = useCallback(() => {
    if (draftWriteTimerRef.current !== null) {
      window.clearTimeout(draftWriteTimerRef.current);
      draftWriteTimerRef.current = null;
    }

    if (draftStorageKeyRef.current) {
      writeDraftAnswers(draftStorageKeyRef.current, latestAnswersRef.current);
    }
  }, []);

  const handleStartPractice = useCallback(async (activityId: number) => {
    setStartingActivityId(activityId);
    setPaperState({
      error: null,
      loading: true,
      paper: null,
    });
    setAttemptState({
      attempt: null,
      error: null,
      loading: false,
    });

    try {
      const detail = await getMyZquizPracticeActivity({
        activityId,
      });

      if (!detail) {
        throw new Error('练习不存在或不可见。');
      }

      if (!canStartActivity(detail)) {
        throw new Error(resolveDisabledReason(detail) || '练习当前不可开始。');
      }

      const paper = await startZquizPractice({
        activityId,
      });
      const draftStorageKey = createDraftStorageKey(paper.activity.id);
      const draftAnswers: DraftAnswers = {};
      const { signedPaperToken, ...paperView } = paper;

      setPaperState({
        error: null,
        loading: false,
        paper: paperView,
      });

      paperTokenRef.current = signedPaperToken;
      draftStorageKeyRef.current = draftStorageKey;
      latestAnswersRef.current = draftAnswers;
      setAnswers(draftAnswers);
      setView('paper');
    } catch (error) {
      setPaperState({
        error: resolveZquizPracticeErrorMessage(error, '暂时无法开始练习。'),
        loading: false,
        paper: null,
      });
    } finally {
      setStartingActivityId(null);
    }
  }, []);

  const handleLoadAttempt = useCallback(async (attemptId: string) => {
    setLoadingAttemptId(attemptId);
    setView('result');
    setAttemptState({
      attempt: null,
      error: null,
      loading: true,
    });
    setPaperState({
      error: null,
      loading: false,
      paper: null,
    });
    paperTokenRef.current = null;
    draftStorageKeyRef.current = null;
    latestAnswersRef.current = {};
    setAnswers({});

    try {
      const attempt = await getMyZquizPracticeAttempt({
        attemptId,
      });

      if (!attempt) {
        throw new Error('练习结果不存在或不可见。');
      }

      writeLastAttemptId(attempt.activity.id, attempt.id);
      setLastAttemptIds((current) => ({
        ...current,
        [attempt.activity.id]: attempt.id,
      }));
      setAttemptState({
        attempt,
        error: null,
        loading: false,
      });
    } catch (error) {
      setAttemptState({
        attempt: null,
        error: resolveZquizPracticeErrorMessage(error, '暂时无法读取练习结果。'),
        loading: false,
      });
    } finally {
      setLoadingAttemptId(null);
    }
  }, []);

  const handleAnswerChange = useCallback(
    (paperItemNo: number, value: DraftAnswer) => {
      const token = paperTokenRef.current;
      const draftStorageKey = draftStorageKeyRef.current;

      if (!token) {
        return;
      }

      const nextAnswers = {
        ...latestAnswersRef.current,
        [String(paperItemNo)]: value,
      };

      latestAnswersRef.current = nextAnswers;
      setAnswers(nextAnswers);
      if (draftStorageKey) {
        scheduleDraftWrite(draftStorageKey, nextAnswers);
      }
    },
    [scheduleDraftWrite],
  );

  function handleBackToList() {
    flushDraftWrite();
    if (draftStorageKeyRef.current) {
      clearDraftAnswers(draftStorageKeyRef.current);
    }
    setView('list');
    setPaperState({
      error: null,
      loading: false,
      paper: null,
    });
    setAttemptState({
      attempt: null,
      error: null,
      loading: false,
    });
    paperTokenRef.current = null;
    draftStorageKeyRef.current = null;
    latestAnswersRef.current = {};
    setAnswers({});
  }

  async function doSubmitPractice(paper: PracticePaperView) {
    flushDraftWrite();
    setSubmitting(true);
    setPaperState((current) => ({
      ...current,
      error: null,
    }));

    try {
      const signedPaperToken = paperTokenRef.current;

      if (!signedPaperToken) {
        throw new Error('练习提交凭证已失效，请重新开始练习。');
      }

      const attempt = await submitZquizPractice({
        activityId: paper.activity.id,
        answers: buildZquizPracticeSubmitAnswers(paper.items, latestAnswersRef.current),
        signedPaperToken,
      });

      if (draftStorageKeyRef.current) {
        clearDraftAnswers(draftStorageKeyRef.current);
      }
      writeLastAttemptId(paper.activity.id, attempt.id);
      setLastAttemptIds((current) => ({
        ...current,
        [paper.activity.id]: attempt.id,
      }));
      setAttemptState({
        attempt,
        error: null,
        loading: false,
      });
      setPaperState({
        error: null,
        loading: false,
        paper: null,
      });
      paperTokenRef.current = null;
      draftStorageKeyRef.current = null;
      latestAnswersRef.current = {};
      setAnswers({});
      setView('result');
      void loadActivities();
    } catch (error) {
      setPaperState((current) => ({
        ...current,
        error: resolveZquizPracticeErrorMessage(error, '暂时无法提交练习。'),
      }));
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmitPractice() {
    const paper = paperState.paper;

    if (!paper || submitting) {
      return;
    }

    const answerCount = buildZquizPracticeSubmitAnswers(
      paper.items,
      latestAnswersRef.current,
    ).length;

    Modal.confirm({
      cancelText: '取消',
      content: `确定提交练习？已作答 ${answerCount} 题。`,
      okText: '提交',
      onOk: () => doSubmitPractice(paper),
      title: '确认提交',
    });
  }

  function renderHeader() {
    return (
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <Typography.Title level={3} style={{ marginBottom: 0 }}>
                可选练习
              </Typography.Title>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                按开放状态查看练习，开放中的练习可直接开始作答。
              </Typography.Paragraph>
            </div>

            <Space>
              <Tag color="blue">{activityCountText}</Tag>
              <Button
                icon={<ReloadOutlined />}
                loading={listState.loading}
                onClick={loadActivities}
              >
                刷新
              </Button>
            </Space>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tag color="green">开放中</Tag>
            <Tag color="gold">未开始</Tag>
            <Tag color="red">已结束</Tag>
            <Tag>已关闭</Tag>
          </div>
        </div>
      </Card>
    );
  }

  function renderList() {
    return (
      <>
        {listState.error ? (
          <Alert
            showIcon
            action={
              <Button size="small" onClick={loadActivities}>
                重试
              </Button>
            }
            message={listState.error}
            type="error"
          />
        ) : null}
        {view === 'list' && paperState.error ? (
          <Alert showIcon message={paperState.error} type="error" />
        ) : null}

        <Card title="我的可选练习">
          {listState.loading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : listState.activities.length === 0 ? (
            <Empty description="暂无可选练习" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <List<ZquizPracticeActivity>
              dataSource={listState.activities}
              itemLayout="vertical"
              renderItem={(activity) => {
                const disabledReason = resolveDisabledReason(activity);
                const isStartEnabled = canStartActivity(activity);
                const lastAttemptId = lastAttemptIds[activity.id];

                return (
                  <List.Item
                    key={activity.id}
                    actions={[
                      <Button
                        key="start"
                        disabled={!isStartEnabled}
                        icon={<PlayCircleOutlined />}
                        loading={startingActivityId === activity.id}
                        type="primary"
                        onClick={() => void handleStartPractice(activity.id)}
                      >
                        开始练习
                      </Button>,
                      ...(lastAttemptId
                        ? [
                            <Button
                              key="attempt"
                              icon={<FileSearchOutlined />}
                              loading={loadingAttemptId === lastAttemptId}
                              onClick={() => void handleLoadAttempt(lastAttemptId)}
                            >
                              查看结果
                            </Button>,
                          ]
                        : []),
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{activity.title}</span>
                          <ActivityStatusTag activity={activity} />
                        </div>
                      }
                      description={<ActivityMeta activity={activity} />}
                    />

                    {disabledReason ? (
                      <Typography.Text type="secondary">{disabledReason}</Typography.Text>
                    ) : null}
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
    const paper = paperState.paper;
    const title = paper ? paper.activity.title : '作答';
    const extra = (
      <Button disabled={submitting} icon={<ArrowLeftOutlined />} onClick={handleBackToList}>
        返回列表
      </Button>
    );

    if (paperState.loading) {
      return (
        <Card extra={extra} title={title}>
          <Skeleton active paragraph={{ rows: 10 }} />
        </Card>
      );
    }

    if (!paper) {
      return (
        <Card extra={extra} title={title}>
          {paperState.error ? (
            <Alert showIcon message={paperState.error} type="error" />
          ) : (
            <Empty description="暂无卷面" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      );
    }

    return (
      <div className="flex flex-col gap-5">
        <Card extra={extra} title={title}>
          <div className="flex flex-col gap-4">
            {paperState.error ? <Alert showIcon message={paperState.error} type="error" /> : null}
            <Alert
              showIcon
              icon={<CheckCircleOutlined />}
              message="答案会本地暂存，提交后后端立即保存作答和评分结果。"
              type="info"
            />

            <Descriptions
              bordered
              column={2}
              items={[
                {
                  key: 'duration',
                  label: '限时',
                  children: formatDuration(paper.activity.durationMinutes),
                },
                {
                  key: 'attemptLimit',
                  label: '次数限制',
                  children: formatAttemptLimit(paper.activity.attemptLimit),
                },
                {
                  key: 'itemCount',
                  label: '题数',
                  children: `${paper.items.length} 题`,
                },
                {
                  key: 'answered',
                  label: '已作答',
                  children: `${paperAnswerCount} 题`,
                },
              ]}
            />

            <div className="flex justify-end">
              <Button
                icon={<SendOutlined />}
                loading={submitting}
                type="primary"
                onClick={() => void handleSubmitPractice()}
              >
                提交练习
              </Button>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          {paper.items.map((item) => (
            <PaperQuestionCard
              key={`${item.paperItemNo}-${item.questionId}`}
              answer={answers[String(item.paperItemNo)]}
              item={item}
              onAnswerChange={handleAnswerChange}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderResult() {
    const attempt = attemptState.attempt;
    const title = attempt ? `练习结果：${attempt.activity.title}` : '练习结果';
    const extra = (
      <Space>
        {attempt ? (
          <Button
            icon={<ReloadOutlined />}
            loading={attemptState.loading}
            onClick={() => void handleLoadAttempt(attempt.id)}
          >
            重新拉取
          </Button>
        ) : null}
        <Button icon={<ArrowLeftOutlined />} onClick={handleBackToList}>
          返回列表
        </Button>
      </Space>
    );

    if (attemptState.loading) {
      return (
        <Card extra={extra} title={title}>
          <Skeleton active paragraph={{ rows: 10 }} />
        </Card>
      );
    }

    if (!attempt) {
      return (
        <Card extra={extra} title={title}>
          {attemptState.error ? (
            <Alert showIcon message={attemptState.error} type="error" />
          ) : (
            <Empty description="暂无练习结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      );
    }

    return (
      <div className="flex flex-col gap-5">
        <Card extra={extra} title={title}>
          <div className="flex flex-col gap-4">
            {attempt.gradingStatus === 'MANUAL_PENDING' ? (
              <Alert
                showIcon
                message="本次练习包含待人工批改题，当前总分只包含已自动评分的部分。"
                type="warning"
              />
            ) : (
              <Alert showIcon message="本次练习已完成自动评分。" type="success" />
            )}

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
