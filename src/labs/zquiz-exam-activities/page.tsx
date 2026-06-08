// src/labs/zquiz-exam-activities/page.tsx

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
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
  Typography,
} from 'antd';

import {
  autosaveZquizExam,
  buildZquizExamAnswers,
  buildZquizExamDraftAnswersFromServer,
  getMyZquizExamActivity,
  listMyZquizExamActivities,
  resolveZquizExamErrorMessage,
  startZquizExam,
  submitZquizExam,
  type ZquizExamActivity,
  type ZquizExamAttemptGradingStatus,
  type ZquizExamAttemptStatus,
  type ZquizExamAvailability,
  type ZquizExamDraftAnswers,
  type ZquizExamPaper,
  type ZquizExamPaperAsset,
  type ZquizExamPaperItem,
  type ZquizExamSubmitResult,
} from './api';

type ExamView = 'list' | 'paper' | 'submitted';
type DraftAnswer = unknown;
type DraftAnswers = ZquizExamDraftAnswers;

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
  error: string | null;
  loading: boolean;
  result: ZquizExamSubmitResult | null;
};

type AutosaveState = {
  error: string | null;
  lastSavedAt: string | null;
  status: 'dirty' | 'error' | 'idle' | 'saved' | 'saving';
};

const AUTOSAVE_DEBOUNCE_MS = 1200;
const AUTOSAVE_INTERVAL_MS = 20_000;

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
  value,
}: {
  disabled: boolean;
  item: ZquizExamPaperItem;
  onAnswerChange: (paperItemNo: number, value: DraftAnswer) => void;
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
        <Space wrap>
          <span>第 {item.paperItemNo} 题</span>
          <Tag>{QUESTION_TYPE_LABELS[item.type]}</Tag>
          <Tag color="blue">{formatScore(item.scoreMax)} 分</Tag>
        </Space>
      }
    >
      <div className="flex flex-col gap-4">
        <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
          {item.stem}
        </Typography.Paragraph>
        <AssetList assets={item.assets} />
        {renderAnswer()}
      </div>
    </Card>
  );
}

export function ZquizExamActivitiesLabPage() {
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
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const autosaveTimerRef = useRef<number | null>(null);
  const autosavingRef = useRef(false);
  const dirtyRef = useRef(false);
  const latestAnswersRef = useRef<DraftAnswers>({});
  const paperRef = useRef<ZquizExamPaper | null>(null);
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

  const runAutosave = useCallback(async () => {
    const paper = paperRef.current;

    if (!paper || autosavingRef.current || submittingRef.current) {
      return;
    }

    autosavingRef.current = true;
    dirtyRef.current = false;
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

      setAutosaveState({
        error: null,
        lastSavedAt: result.lastSavedAt,
        status: 'saved',
      });
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
  }, []);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void runAutosave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [runAutosave]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  useEffect(() => {
    paperRef.current = currentPaper;
  }, [currentPaper]);

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
    }, AUTOSAVE_INTERVAL_MS);

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

  const handleAnswerChange = useCallback(
    (paperItemNo: number, value: DraftAnswer) => {
      const nextAnswers = {
        ...latestAnswersRef.current,
        [String(paperItemNo)]: value,
      };

      latestAnswersRef.current = nextAnswers;
      dirtyRef.current = true;
      setAnswers(nextAnswers);
      setAutosaveState((current) => ({
        ...current,
        error: null,
        status: 'dirty',
      }));
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  function resetToList() {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setView('list');
    setPaperState({
      error: null,
      loading: false,
      paper: null,
    });
    setSubmitState({
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
    paperRef.current = null;
    setAnswers({});
    void loadActivities();
  }

  async function doSubmitExam(paper: ZquizExamPaper) {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setSubmitting(true);
    setSubmitState({
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
      setSubmitState({
        error: null,
        loading: false,
        result,
      });
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
      paperRef.current = null;
      setAnswers({});
      setView('submitted');
      void loadActivities();
    } catch (error) {
      setSubmitState({
        error: resolveZquizExamErrorMessage(error, '暂时无法提交考试。'),
        loading: false,
        result: null,
      });
    } finally {
      setSubmitting(false);
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

        <div className="flex flex-col gap-4">
          {paper.items.map((item) => (
            <ExamQuestionCard
              disabled={submitting}
              item={item}
              key={`${item.paperItemNo}-${item.questionId}`}
              value={answers[String(item.paperItemNo)]}
              onAnswerChange={handleAnswerChange}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderSubmitted() {
    const result = submitState.result;

    return (
      <Card
        title={
          <Space>
            <FileDoneOutlined />
            <span>考试已提交</span>
          </Space>
        }
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={resetToList}>
            返回列表
          </Button>
        }
      >
        {submitState.loading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : result ? (
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
          <Alert showIcon message={submitState.error || '暂无提交结果'} type="error" />
        )}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {renderHeader()}
      {view === 'list' ? renderList() : null}
      {view === 'paper' ? renderPaper() : null}
      {view === 'submitted' ? renderSubmitted() : null}
    </div>
  );
}
