// src/labs/zquiz-exam-teacher-gradebook/page.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChartOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import { zquizExamTeacherGradebookLabAccess } from './access';
import {
  getZquizExamQuestionAnalysis,
  getZquizExamTeacherGradebook,
  getZquizExamTeacherTargets,
  listZquizTeacherExamActivities,
  resolveZquizExamTeacherGradebookErrorMessage,
  type ZquizActivityStatus,
  type ZquizAttemptGradingStatus,
  type ZquizAttemptStatus,
  type ZquizExamGradebookAttempt,
  type ZquizExamGradebookStudent,
  type ZquizExamQuestionAnalysis,
  type ZquizExamQuestionAnalysisItem,
  type ZquizExamScorePolicy,
  type ZquizExamTarget,
  type ZquizExamTeacherGradebook,
  type ZquizQuestionStatus,
  type ZquizQuestionType,
  type ZquizTeacherExamActivity,
} from './api';
import { zquizExamTeacherGradebookLabMeta } from './meta';

type FilterFormValues = {
  activityId?: number | null;
  classId?: string;
  scorePolicy?: ZquizExamScorePolicy;
};

type AsyncDataState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

type ResultTabKey = 'analysis' | 'gradebook';

const EMPTY_GRADEBOOK_STATE: AsyncDataState<ZquizExamTeacherGradebook> = {
  data: null,
  error: null,
  loading: false,
};

const EMPTY_ANALYSIS_STATE: AsyncDataState<ZquizExamQuestionAnalysis> = {
  data: null,
  error: null,
  loading: false,
};

const EMPTY_ACTIVITIES_STATE: AsyncDataState<ZquizTeacherExamActivity[]> = {
  data: [],
  error: null,
  loading: false,
};

const EMPTY_TARGETS_STATE: AsyncDataState<ZquizExamTarget[]> = {
  data: [],
  error: null,
  loading: false,
};

const ACTIVITY_STATUS_LABELS: Record<ZquizActivityStatus, string> = {
  CLOSED: '已关闭',
  DRAFT: '草稿',
  PUBLISHED: '已发布',
};

const SCORE_POLICY_LABELS: Record<ZquizExamScorePolicy, string> = {
  HIGHEST_SCORE: '最高分',
  LATEST_ATTEMPT: '最新一次',
};

const SCORE_POLICY_OPTIONS = [
  { label: '最新一次', value: 'LATEST_ATTEMPT' },
  { label: '最高分', value: 'HIGHEST_SCORE' },
] satisfies readonly { label: string; value: ZquizExamScorePolicy }[];

const ATTEMPT_STATUS_LABELS: Record<ZquizAttemptStatus, string> = {
  ABANDONED: '已放弃',
  GRADED: '已批改',
  IN_PROGRESS: '进行中',
  SUBMITTED: '已提交',
};

const ATTEMPT_STATUS_COLORS: Record<ZquizAttemptStatus, string> = {
  ABANDONED: 'default',
  GRADED: 'green',
  IN_PROGRESS: 'blue',
  SUBMITTED: 'gold',
};

const GRADING_STATUS_LABELS: Record<ZquizAttemptGradingStatus, string> = {
  AUTO_GRADED: '自动批改',
  MANUAL_GRADED: '人工已批',
  MANUAL_PENDING: '待人工',
  NOT_GRADED: '未批改',
};

const GRADING_STATUS_COLORS: Record<ZquizAttemptGradingStatus, string> = {
  AUTO_GRADED: 'green',
  MANUAL_GRADED: 'green',
  MANUAL_PENDING: 'gold',
  NOT_GRADED: 'default',
};

const QUESTION_TYPE_LABELS: Record<ZquizQuestionType, string> = {
  ESSAY: '问答题',
  FILL_BLANK: '填空题',
  MULTIPLE_CHOICE: '多选题',
  SINGLE_CHOICE: '单选题',
  TRUE_FALSE: '判断题',
};

const QUESTION_STATUS_LABELS: Record<ZquizQuestionStatus, string> = {
  ACTIVE: '启用',
  ARCHIVED: '归档',
  DRAFT: '草稿',
};

const QUESTION_STATUS_COLORS: Record<ZquizQuestionStatus, string> = {
  ACTIVE: 'green',
  ARCHIVED: 'default',
  DRAFT: 'gold',
};

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '—';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function formatScorePair(scoreAwarded: number | null, scoreMax: number | null) {
  if (scoreAwarded === null || scoreMax === null) {
    return '—';
  }

  return `${formatScore(scoreAwarded)} / ${formatScore(scoreMax)}`;
}

function formatRate(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '—';
  }

  return `${formatScore(value * 100)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  const date = new Date(value.includes(' ') ? value.replace(' ', 'T') : value);

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

function formatActivityOptionLabel(activity: ZquizTeacherExamActivity) {
  return `${activity.title}（${ACTIVITY_STATUS_LABELS[activity.status]} / ${activity.targetCount} 班 / ${activity.itemCount} 题）`;
}

function formatClassOptionLabel(target: ZquizExamTarget) {
  return target.classCodeSnapshot
    ? `${target.classNameSnapshot}（${target.classCodeSnapshot}）`
    : target.classNameSnapshot;
}

function renderAttemptStatusTag(status: ZquizAttemptStatus) {
  return <Tag color={ATTEMPT_STATUS_COLORS[status]}>{ATTEMPT_STATUS_LABELS[status]}</Tag>;
}

function renderGradingStatusTag(status: ZquizAttemptGradingStatus) {
  return <Tag color={GRADING_STATUS_COLORS[status]}>{GRADING_STATUS_LABELS[status]}</Tag>;
}

function renderQuestionStatusTag(status: ZquizQuestionStatus | null) {
  if (!status) {
    return <Typography.Text type="secondary">—</Typography.Text>;
  }

  return <Tag color={QUESTION_STATUS_COLORS[status]}>{QUESTION_STATUS_LABELS[status]}</Tag>;
}

function renderScoreCell(row: ZquizExamGradebookStudent) {
  if (row.scoreAwarded === null || row.scoreMax === null) {
    return <Typography.Text type="secondary">未完成</Typography.Text>;
  }

  return (
    <Space size={4} wrap>
      <Typography.Text>{formatScorePair(row.scoreAwarded, row.scoreMax)}</Typography.Text>
      <Tag color="blue">{formatRate(row.scoreRate)}</Tag>
    </Space>
  );
}

function renderAttemptCell(
  attempt: ZquizExamGradebookAttempt | null,
  options: {
    showScore?: boolean;
  } = {},
) {
  if (!attempt) {
    return <Typography.Text type="secondary">—</Typography.Text>;
  }

  const shouldShowScore = options.showScore && attempt.status !== 'IN_PROGRESS';

  return (
    <Flex vertical gap={4}>
      <Space size={4} wrap>
        <Tag>第 {attempt.attemptNo} 次</Tag>
        {renderAttemptStatusTag(attempt.status)}
        {renderGradingStatusTag(attempt.gradingStatus)}
      </Space>
      {shouldShowScore ? (
        <span>{formatScorePair(attempt.scoreAwarded, attempt.scoreMax)}</span>
      ) : null}
      <Typography.Text type="secondary">{formatDateTime(attempt.submittedAt)}</Typography.Text>
    </Flex>
  );
}

function renderGradebookSummary(gradebook: ZquizExamTeacherGradebook) {
  const completionRate =
    gradebook.targetStudentCount > 0
      ? gradebook.completedStudentCount / gradebook.targetStudentCount
      : null;

  return (
    <ResponsiveGrid className="gap-4" columns={{ compact: 1, regular: 2, large: 4 }}>
      <Statistic title="目标学生" value={gradebook.targetStudentCount} />
      <Statistic title="已完成主成绩" value={gradebook.completedStudentCount} />
      <Statistic title="完成率" value={formatRate(completionRate)} />
      <Statistic title="主成绩策略" value={SCORE_POLICY_LABELS[gradebook.scorePolicy]} />
    </ResponsiveGrid>
  );
}

function renderAnalysisSummary(analysis: ZquizExamQuestionAnalysis) {
  const totals = analysis.items.reduce(
    (current, item) => ({
      answeredAttemptCount: current.answeredAttemptCount + item.answeredAttemptCount,
      manualPendingCount: current.manualPendingCount + item.manualPendingCount,
      scoreAwardedSum: current.scoreAwardedSum + item.scoreAwardedSum,
      scoreMaxSum: current.scoreMaxSum + item.scoreMaxSum,
    }),
    {
      answeredAttemptCount: 0,
      manualPendingCount: 0,
      scoreAwardedSum: 0,
      scoreMaxSum: 0,
    },
  );
  const averageScoreRate =
    totals.scoreMaxSum > 0 ? totals.scoreAwardedSum / totals.scoreMaxSum : null;

  return (
    <ResponsiveGrid className="gap-4" columns={{ compact: 1, regular: 2, large: 5 }}>
      <Statistic title="题目数" value={analysis.items.length} />
      <Statistic title="主成绩 attempt" value={analysis.selectedAttemptCount} />
      <Statistic title="已答题次" value={totals.answeredAttemptCount} />
      <Statistic title="待人工批改" value={totals.manualPendingCount} />
      <Statistic title="整体得分率" value={formatRate(averageScoreRate)} />
    </ResponsiveGrid>
  );
}

export function ZquizExamTeacherGradebookLabPage() {
  const [form] = Form.useForm<FilterFormValues>();
  const selectedActivityId = Form.useWatch('activityId', form);
  const [activeTab, setActiveTab] = useState<ResultTabKey>('gradebook');
  const [gradebookState, setGradebookState] =
    useState<AsyncDataState<ZquizExamTeacherGradebook>>(EMPTY_GRADEBOOK_STATE);
  const [analysisState, setAnalysisState] =
    useState<AsyncDataState<ZquizExamQuestionAnalysis>>(EMPTY_ANALYSIS_STATE);
  const [activitiesState, setActivitiesState] =
    useState<AsyncDataState<ZquizTeacherExamActivity[]>>(EMPTY_ACTIVITIES_STATE);
  const [targetsState, setTargetsState] =
    useState<AsyncDataState<ZquizExamTarget[]>>(EMPTY_TARGETS_STATE);

  const readFilterValues = useCallback(async (): Promise<FilterFormValues | null> => {
    try {
      return await form.validateFields();
    } catch {
      return null;
    }
  }, [form]);

  const loadActivities = useCallback(async () => {
    setActivitiesState((current) => ({
      ...current,
      error: null,
      loading: true,
    }));

    try {
      const data = await listZquizTeacherExamActivities({ limit: 200 });

      setActivitiesState({
        data,
        error: null,
        loading: false,
      });
    } catch (error) {
      setActivitiesState((current) => ({
        ...current,
        error: resolveZquizExamTeacherGradebookErrorMessage(error, '考试活动加载失败。'),
        loading: false,
      }));
    }
  }, []);

  const loadTargets = useCallback(async (activityId: number | null | undefined) => {
    if (!activityId) {
      setTargetsState({
        data: [],
        error: null,
        loading: false,
      });
      return;
    }

    setTargetsState((current) => ({
      ...current,
      error: null,
      loading: true,
    }));

    try {
      const detail = await getZquizExamTeacherTargets({ activityId });

      setTargetsState({
        data: detail?.targets ?? [],
        error: null,
        loading: false,
      });
    } catch (error) {
      setTargetsState((current) => ({
        ...current,
        error: resolveZquizExamTeacherGradebookErrorMessage(error, '目标班级加载失败。'),
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const loadGradebook = useCallback(
    async (values?: FilterFormValues) => {
      const filterValues = values ?? (await readFilterValues());

      if (!filterValues) {
        return;
      }

      setGradebookState((current) => ({
        ...current,
        error: null,
        loading: true,
      }));

      try {
        const data = await getZquizExamTeacherGradebook({
          activityId: filterValues.activityId,
          classId: filterValues.classId,
          scorePolicy: filterValues.scorePolicy,
        });

        setGradebookState({
          data,
          error: null,
          loading: false,
        });
      } catch (error) {
        setGradebookState((current) => ({
          ...current,
          error: resolveZquizExamTeacherGradebookErrorMessage(error, '成绩单查询失败。'),
          loading: false,
        }));
      }
    },
    [readFilterValues],
  );

  const loadAnalysis = useCallback(
    async (values?: FilterFormValues) => {
      const filterValues = values ?? (await readFilterValues());

      if (!filterValues) {
        return;
      }

      setAnalysisState((current) => ({
        ...current,
        error: null,
        loading: true,
      }));

      try {
        const data = await getZquizExamQuestionAnalysis({
          activityId: filterValues.activityId,
          scorePolicy: filterValues.scorePolicy,
        });

        setAnalysisState({
          data,
          error: null,
          loading: false,
        });
      } catch (error) {
        setAnalysisState((current) => ({
          ...current,
          error: resolveZquizExamTeacherGradebookErrorMessage(error, '按题分析查询失败。'),
          loading: false,
        }));
      }
    },
    [readFilterValues],
  );

  const handleLoadAll = useCallback(async () => {
    const values = await readFilterValues();

    if (!values) {
      return;
    }

    await Promise.all([loadGradebook(values), loadAnalysis(values)]);
  }, [loadAnalysis, loadGradebook, readFilterValues]);

  const activityOptions = useMemo(
    () =>
      (activitiesState.data ?? []).map((activity) => ({
        label: formatActivityOptionLabel(activity),
        value: activity.id,
      })),
    [activitiesState.data],
  );

  const targetOptions = useMemo(
    () =>
      (targetsState.data ?? []).map((target) => ({
        label: formatClassOptionLabel(target),
        value: target.classId,
      })),
    [targetsState.data],
  );

  const gradebookColumns = useMemo<ColumnsType<ZquizExamGradebookStudent>>(
    () => [
      {
        dataIndex: 'studentId',
        fixed: 'left',
        key: 'studentId',
        sorter: (left, right) => left.studentId.localeCompare(right.studentId),
        title: '学号',
        width: 140,
      },
      {
        dataIndex: 'studentName',
        fixed: 'left',
        key: 'studentName',
        sorter: (left, right) => left.studentName.localeCompare(right.studentName),
        title: '学生',
        width: 120,
      },
      {
        key: 'class',
        render: (_, row) => (
          <Flex vertical gap={2}>
            <span>{row.className}</span>
            <Typography.Text type="secondary">{row.classCode}</Typography.Text>
          </Flex>
        ),
        sorter: (left, right) =>
          `${left.className}${left.classCode}`.localeCompare(
            `${right.className}${right.classCode}`,
          ),
        title: '班级',
        width: 180,
      },
      {
        key: 'score',
        render: (_, row) => renderScoreCell(row),
        sorter: (left, right) => (left.scoreRate ?? -1) - (right.scoreRate ?? -1),
        title: '主成绩',
        width: 160,
      },
      {
        key: 'selectedAttempt',
        render: (_, row) => renderAttemptCell(row.selectedAttempt, { showScore: true }),
        title: '主成绩 attempt',
        width: 240,
      },
      {
        key: 'latestAttempt',
        render: (_, row) => renderAttemptCell(row.latestAttempt, { showScore: true }),
        title: '最新 attempt',
        width: 240,
      },
    ],
    [],
  );

  const analysisColumns = useMemo<ColumnsType<ZquizExamQuestionAnalysisItem>>(
    () => [
      {
        dataIndex: 'questionId',
        fixed: 'left',
        key: 'questionId',
        sorter: (left, right) => left.questionId - right.questionId,
        title: '题目 ID',
        width: 110,
      },
      {
        dataIndex: 'questionType',
        key: 'questionType',
        render: (type: ZquizQuestionType) => QUESTION_TYPE_LABELS[type],
        title: '题型',
        width: 120,
      },
      {
        dataIndex: 'questionStatus',
        key: 'questionStatus',
        render: (status: ZquizQuestionStatus | null) => renderQuestionStatusTag(status),
        title: '题目状态',
        width: 120,
      },
      {
        dataIndex: 'stem',
        ellipsis: true,
        key: 'stem',
        render: (stem: string | null) => stem || '—',
        title: '题干',
        width: 280,
      },
      {
        dataIndex: 'attemptCount',
        key: 'attemptCount',
        sorter: (left, right) => left.attemptCount - right.attemptCount,
        title: '主成绩 attempt',
        width: 130,
      },
      {
        key: 'answered',
        render: (_, item) => `${item.answeredAttemptCount} / ${item.unansweredAttemptCount}`,
        title: '已答 / 未答',
        width: 130,
      },
      {
        key: 'correct',
        render: (_, item) => `${item.correctCount} / ${item.incorrectCount}`,
        title: '正确 / 错误',
        width: 130,
      },
      {
        dataIndex: 'manualPendingCount',
        key: 'manualPendingCount',
        sorter: (left, right) => left.manualPendingCount - right.manualPendingCount,
        title: '待人工',
        width: 110,
      },
      {
        key: 'scoreSum',
        render: (_, item) => formatScorePair(item.scoreAwardedSum, item.scoreMaxSum),
        title: '得分合计',
        width: 140,
      },
      {
        dataIndex: 'averageScoreRate',
        key: 'averageScoreRate',
        render: (rate: number | null) => formatRate(rate),
        sorter: (left, right) => (left.averageScoreRate ?? -1) - (right.averageScoreRate ?? -1),
        title: '平均得分率',
        width: 130,
      },
      {
        dataIndex: 'correctRate',
        key: 'correctRate',
        render: (rate: number | null) => formatRate(rate),
        sorter: (left, right) => (left.correctRate ?? -1) - (right.correctRate ?? -1),
        title: '正确率',
        width: 120,
      },
    ],
    [],
  );

  const gradebookContent = useMemo(() => {
    if (gradebookState.loading && !gradebookState.data) {
      return <Skeleton active paragraph={{ rows: 8 }} />;
    }

    if (!gradebookState.data && !gradebookState.error) {
      return <Empty description="暂无成绩单" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <Flex vertical gap={16}>
        {gradebookState.error ? (
          <Alert showIcon type="error" message={gradebookState.error} />
        ) : null}
        {gradebookState.data ? (
          <>
            {renderGradebookSummary(gradebookState.data)}
            <Table<ZquizExamGradebookStudent>
              columns={gradebookColumns}
              dataSource={gradebookState.data.rows}
              loading={gradebookState.loading}
              locale={{ emptyText: <Empty description="暂无成绩单行" /> }}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              rowKey={(row) => `${row.classCode}:${row.studentId}`}
              scroll={{ x: 1080 }}
            />
          </>
        ) : null}
      </Flex>
    );
  }, [gradebookColumns, gradebookState.data, gradebookState.error, gradebookState.loading]);

  const analysisContent = useMemo(() => {
    if (analysisState.loading && !analysisState.data) {
      return <Skeleton active paragraph={{ rows: 8 }} />;
    }

    if (!analysisState.data && !analysisState.error) {
      return <Empty description="暂无按题分析" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <Flex vertical gap={16}>
        {analysisState.error ? <Alert showIcon type="error" message={analysisState.error} /> : null}
        {analysisState.data ? (
          <>
            {renderAnalysisSummary(analysisState.data)}
            <Table<ZquizExamQuestionAnalysisItem>
              columns={analysisColumns}
              dataSource={analysisState.data.items}
              loading={analysisState.loading}
              locale={{ emptyText: <Empty description="暂无按题分析" /> }}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              rowKey={(item) => item.questionId}
              scroll={{ x: 1520 }}
            />
          </>
        ) : null}
      </Flex>
    );
  }, [analysisColumns, analysisState.data, analysisState.error, analysisState.loading]);

  const resultTabs = useMemo(
    () => [
      {
        children: gradebookContent,
        key: 'gradebook',
        label: '成绩单',
      },
      {
        children: analysisContent,
        key: 'analysis',
        label: '按题分析',
      },
    ],
    [analysisContent, gradebookContent],
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <Flex vertical gap={12}>
          <Flex align="center" gap={12} wrap>
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              Zquiz 考试成绩分析 Lab
            </Typography.Title>
            <Tag color="blue">负责人：{zquizExamTeacherGradebookLabMeta.owner}</Tag>
            <Tag color="purple">复核时间：{zquizExamTeacherGradebookLabMeta.reviewAt}</Tag>
            <Tag color="green">环境：{zquizExamTeacherGradebookLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">
              访问级别：{zquizExamTeacherGradebookLabAccess.allowedAccessLevels.join(', ')}
            </Tag>
          </Flex>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {zquizExamTeacherGradebookLabMeta.purpose}
          </Typography.Paragraph>
        </Flex>
      </Card>

      <Card title="查询条件">
        <Flex vertical gap={16}>
          {activitiesState.error ? (
            <Alert showIcon type="error" message={activitiesState.error} />
          ) : null}
          {targetsState.error ? <Alert showIcon type="error" message={targetsState.error} /> : null}
          <Alert
            showIcon
            type="info"
            message="成绩单与按题分析只统计已完成 attempt；进行中 attempt 只在最新 attempt 中展示。"
          />
          <Form<FilterFormValues>
            form={form}
            initialValues={{ scorePolicy: 'LATEST_ATTEMPT' }}
            layout="vertical"
            requiredMark={false}
          >
            <ResponsiveGrid className="gap-4" columns={{ compact: 1, regular: 2, large: 4 }}>
              <Form.Item
                label="活动内容"
                name="activityId"
                rules={[{ required: true, message: '请选择活动内容。' }]}
              >
                <Select<number>
                  allowClear
                  loading={activitiesState.loading}
                  optionFilterProp="label"
                  options={activityOptions}
                  placeholder="选择考试活动"
                  showSearch
                  onChange={(activityId) => {
                    form.setFieldValue('classId', undefined);
                    void loadTargets(activityId);
                  }}
                />
              </Form.Item>
              <Form.Item label="班级" name="classId">
                <Select<string>
                  allowClear
                  disabled={!selectedActivityId}
                  loading={targetsState.loading}
                  optionFilterProp="label"
                  options={targetOptions}
                  placeholder="全部班级"
                  showSearch
                />
              </Form.Item>
              <Form.Item label="主成绩策略" name="scorePolicy">
                <Select<ZquizExamScorePolicy> options={SCORE_POLICY_OPTIONS} />
              </Form.Item>
              <Form.Item label="操作">
                <Space wrap>
                  <Button
                    icon={<SearchOutlined />}
                    loading={gradebookState.loading || analysisState.loading}
                    onClick={() => void handleLoadAll()}
                    type="primary"
                  >
                    查询全部
                  </Button>
                  <Button
                    icon={<FileSearchOutlined />}
                    loading={gradebookState.loading}
                    onClick={() => void loadGradebook()}
                  >
                    成绩单
                  </Button>
                  <Button
                    icon={<BarChartOutlined />}
                    loading={analysisState.loading}
                    onClick={() => void loadAnalysis()}
                  >
                    按题分析
                  </Button>
                </Space>
              </Form.Item>
            </ResponsiveGrid>
          </Form>
        </Flex>
      </Card>

      <Card
        title="查询结果"
        extra={
          <Button
            disabled={!gradebookState.data && !analysisState.data}
            icon={<ReloadOutlined />}
            loading={gradebookState.loading || analysisState.loading}
            onClick={() => {
              if (activeTab === 'gradebook') {
                void loadGradebook();
                return;
              }

              void loadAnalysis();
            }}
          >
            刷新当前
          </Button>
        }
      >
        <Tabs
          activeKey={activeTab}
          items={resultTabs}
          onChange={(key) => setActiveTab(key as ResultTabKey)}
        />
      </Card>
    </div>
  );
}
