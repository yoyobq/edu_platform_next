// src/labs/zquiz-practice-activities/page.tsx

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
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
  Radio,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';

import {
  listMyZquizPracticeActivities,
  resolveZquizPracticeErrorMessage,
  startZquizPractice,
  type ZquizPracticeActivity,
  type ZquizPracticeAvailability,
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
  paper: ZquizPracticePaper | null;
};

type PracticeView = 'list' | 'paper';
type DraftAnswer = unknown;
type DraftAnswers = Record<string, unknown>;

const DRAFT_STORAGE_PREFIX = 'zquiz-practice-draft:';

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

function getDraftStorageKey(token: string) {
  return `${DRAFT_STORAGE_PREFIX}${token}`;
}

function readDraftAnswers(token: string): DraftAnswers {
  try {
    const storedValue = window.localStorage.getItem(getDraftStorageKey(token));

    if (!storedValue) {
      return {};
    }

    const parsed = JSON.parse(storedValue);

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeDraftAnswers(token: string, answers: DraftAnswers) {
  window.localStorage.setItem(getDraftStorageKey(token), JSON.stringify(answers));
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
          placeholder={`本空 ${formatScore(blank.score)} 分`}
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
      placeholder="在此输入答案，当前仅本地暂存。"
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
  const [startingActivityId, setStartingActivityId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<DraftAnswers>({});
  const draftWriteTimerRef = useRef<number | null>(null);
  const latestAnswersRef = useRef<DraftAnswers>({});
  const paperTokenRef = useRef<string | null>(null);

  const activityCountText = useMemo(() => {
    if (listState.loading) {
      return '读取中';
    }

    return `${listState.activities.length} 个练习`;
  }, [listState.activities.length, listState.loading]);

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
    } catch (error) {
      setListState({
        activities: [],
        error: resolveZquizPracticeErrorMessage(error, '暂时无法读取可选练习列表。'),
        loading: false,
      });
    }
  }, []);

  const scheduleDraftWrite = useCallback((token: string, nextAnswers: DraftAnswers) => {
    latestAnswersRef.current = nextAnswers;

    if (draftWriteTimerRef.current !== null) {
      window.clearTimeout(draftWriteTimerRef.current);
    }

    draftWriteTimerRef.current = window.setTimeout(() => {
      writeDraftAnswers(token, latestAnswersRef.current);
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

      if (paperTokenRef.current) {
        writeDraftAnswers(paperTokenRef.current, latestAnswersRef.current);
      }
    };
  }, []);

  const flushDraftWrite = useCallback(() => {
    if (draftWriteTimerRef.current !== null) {
      window.clearTimeout(draftWriteTimerRef.current);
      draftWriteTimerRef.current = null;
    }

    if (paperTokenRef.current) {
      writeDraftAnswers(paperTokenRef.current, latestAnswersRef.current);
    }
  }, []);

  const handleStartPractice = useCallback(async (activityId: number) => {
    setStartingActivityId(activityId);
    setPaperState({
      error: null,
      loading: true,
      paper: null,
    });

    try {
      const paper = await startZquizPractice({
        activityId,
      });

      setPaperState({
        error: null,
        loading: false,
        paper,
      });
      const draftAnswers = readDraftAnswers(paper.signedPaperToken);

      paperTokenRef.current = paper.signedPaperToken;
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

  const handleAnswerChange = useCallback(
    (paperItemNo: number, value: DraftAnswer) => {
      const token = paperTokenRef.current;

      if (!token) {
        return;
      }

      setAnswers((current) => {
        const nextAnswers = {
          ...current,
          [String(paperItemNo)]: value,
        };

        scheduleDraftWrite(token, nextAnswers);

        return nextAnswers;
      });
    },
    [scheduleDraftWrite],
  );

  function handleBackToList() {
    flushDraftWrite();
    setView('list');
    setPaperState({
      error: null,
      loading: false,
      paper: null,
    });
    paperTokenRef.current = null;
    latestAnswersRef.current = {};
    setAnswers({});
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

    return (
      <Card
        title={paper ? paper.activity.title : '作答'}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={handleBackToList}>
            返回列表
          </Button>
        }
      >
        {paperState.loading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : paperState.error ? (
          <Alert showIcon message={paperState.error} type="error" />
        ) : paper ? (
          <div className="flex flex-col gap-5">
            <Alert
              showIcon
              icon={<CheckCircleOutlined />}
              message="答案已本地暂存，提交接口就绪后可在此接入正式提交。"
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
                  key: 'token',
                  label: '卷面 Token',
                  children: (
                    <Typography.Text copyable ellipsis>
                      {paper.signedPaperToken}
                    </Typography.Text>
                  ),
                },
              ]}
            />

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

            <div className="flex justify-end">
              <Button disabled type="primary">
                提交待后端接口就绪
              </Button>
            </div>
          </div>
        ) : (
          <Empty description="暂无卷面" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {renderHeader()}
      {view === 'list' ? renderList() : null}
      {view === 'paper' ? renderPaper() : null}
    </div>
  );
}
