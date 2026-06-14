// src/labs/zquiz-activity-builder/page.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Segmented,
  Select,
  Skeleton,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';

import { ResponsiveGrid, ResponsiveGridItem } from '@/shared/ui/responsive-layout';

import { zquizActivityBuilderLabAccess } from './access';
import {
  buildZquizActivityDraftInput,
  collectZquizExamAttempts,
  getZquizActivityTeacherDetail,
  getZquizExamTeacherProgress,
  listLocalClassOptions,
  listZquizAssemblyQuestions,
  listZquizBanks,
  listZquizKnowledgeNodes,
  listZquizTeacherActivities,
  type LocalClassOption,
  publishZquizActivity,
  resolveZquizActivityBuilderErrorMessage,
  saveZquizActivityDraft,
  validateZquizActivityPublishDraft,
  type ZquizActivityItem,
  type ZquizActivityMode,
  type ZquizActivityStatus,
  type ZquizActivityTarget,
  type ZquizAssemblyQuestion,
  type ZquizExamTeacherProgress,
  type ZquizGenerationRuleStrategy,
  type ZquizKnowledgeNode,
  type ZquizQuestionType,
  type ZquizTeacherActivityDetail,
  type ZquizTeacherActivitySummary,
  type ZquizTeacherBank,
} from './api';
import { zquizActivityBuilderLabMeta } from './meta';

type ActivityFilters = {
  bankId?: number;
  keyword: string;
  mode?: ZquizActivityMode;
  status?: ZquizActivityStatus;
};

type QuestionFilters = {
  keyword: string;
  knowledgeNodeId: number | null;
  questionType?: ZquizQuestionType;
};

type RandomRuleDraft = {
  count: number;
  id: string;
  includeChildren: boolean;
  knowledgeNodeIds: number[];
  questionType: ZquizQuestionType;
  scoreMax: number;
};

type EditorFormValues = {
  attemptLimit?: number | null;
  bankId?: number;
  durationMinutes?: number | null;
  endsAt?: Dayjs | null;
  shuffleOptions?: boolean;
  shuffleQuestions?: boolean;
  startsAt?: Dayjs | null;
  targetClassIds?: string[];
  title?: string;
};

type EditorState = {
  activityId: number | null;
  active: boolean;
  loading: boolean;
  mode: ZquizActivityMode;
  status: ZquizActivityStatus;
};

type AsyncListState<T> = {
  error: string | null;
  items: T[];
  loading: boolean;
};

type ExamProgressState = {
  collecting: boolean;
  error: string | null;
  loading: boolean;
  progress: ZquizExamTeacherProgress | null;
};

const EMPTY_QUESTION_FILTERS: QuestionFilters = {
  keyword: '',
  knowledgeNodeId: null,
  questionType: undefined,
};

const EMPTY_EDITOR_STATE: EditorState = {
  activityId: null,
  active: false,
  loading: false,
  mode: 'PRACTICE',
  status: 'DRAFT',
};

const EMPTY_EXAM_PROGRESS_STATE: ExamProgressState = {
  collecting: false,
  error: null,
  loading: false,
  progress: null,
};

const MODE_LABELS: Record<ZquizActivityMode, string> = {
  EXAM: '考试',
  PRACTICE: '练习',
};

const STATUS_LABELS: Record<ZquizActivityStatus, string> = {
  CLOSED: '已关闭',
  DRAFT: '草稿',
  PUBLISHED: '已发布',
};

const STATUS_TAG_COLORS: Record<ZquizActivityStatus, string> = {
  CLOSED: 'default',
  DRAFT: 'gold',
  PUBLISHED: 'green',
};

const QUESTION_TYPE_LABELS: Record<ZquizQuestionType, string> = {
  ESSAY: '问答题',
  FILL_BLANK: '填空题',
  MULTIPLE_CHOICE: '多选题',
  SINGLE_CHOICE: '单选题',
  TRUE_FALSE: '判断题',
};

const QUESTION_TYPE_OPTIONS = [
  { label: '单选题', value: 'SINGLE_CHOICE' },
  { label: '多选题', value: 'MULTIPLE_CHOICE' },
  { label: '判断题', value: 'TRUE_FALSE' },
  { label: '填空题', value: 'FILL_BLANK' },
  { label: '问答题', value: 'ESSAY' },
] satisfies readonly { label: string; value: ZquizQuestionType }[];

const MODE_OPTIONS = [
  { label: '练习', value: 'PRACTICE' },
  { label: '考试', value: 'EXAM' },
] satisfies readonly { label: string; value: ZquizActivityMode }[];

const STATUS_OPTIONS = [
  { label: '草稿', value: 'DRAFT' },
  { label: '已发布', value: 'PUBLISHED' },
  { label: '已关闭', value: 'CLOSED' },
] satisfies readonly { label: string; value: ZquizActivityStatus }[];

const GENERATION_STRATEGY_OPTIONS = [
  { label: '固定题单', value: 'FIXED' },
  { label: '知识点随机', value: 'RANDOM_BY_KNOWLEDGE' },
] satisfies readonly { label: string; value: ZquizGenerationRuleStrategy }[];

let randomRuleDraftIdSeq = 0;

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

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDuration(value: number | null) {
  return value === null ? '不限时' : `${value} 分钟`;
}

function formatAttemptLimit(value: number | null) {
  return value === null ? '不限次' : `${value} 次`;
}

function toPickerValue(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed : null;
}

function toBusinessDateTime(value: Dayjs | null | undefined) {
  return value ? value.format('YYYY-MM-DD HH:mm:ss.SSS') : null;
}

function getBankLabel(bank: ZquizTeacherBank) {
  return `${bank.name}（${bank.code}）`;
}

function getClassLabel(option: Pick<LocalClassOption, 'classCode' | 'className'>) {
  return `${option.className}（${option.classCode}）`;
}

function getQuestionLabel(question: ZquizAssemblyQuestion | null, questionId: number) {
  return question?.stem || `题目 #${questionId}`;
}

function getKnowledgeNodeLabel(node: ZquizKnowledgeNode) {
  const codeText = node.code ? `（${node.code}）` : '';
  const typeText = node.nodeType === 'CATEGORY' ? '分类' : '知识点';

  return `${node.name}${codeText} · ${typeText} · ${node.totalQuestionCount} 题`;
}

function toSelectedItem(question: ZquizAssemblyQuestion): ZquizActivityItem {
  return {
    question,
    questionId: question.id,
    scoreMax: 1,
    sortOrder: 0,
  };
}

function createRandomRuleDraft(index: number): RandomRuleDraft {
  randomRuleDraftIdSeq += 1;

  return {
    count: 1,
    id: `random-rule-${randomRuleDraftIdSeq}-${index}`,
    includeChildren: true,
    knowledgeNodeIds: [],
    questionType: 'SINGLE_CHOICE',
    scoreMax: 1,
  };
}

function toRandomRuleDraft(
  rule: NonNullable<ZquizTeacherActivityDetail['generationRule']>['randomRules'][number],
  index: number,
): RandomRuleDraft {
  return {
    count: rule.count,
    id: `random-rule-${rule.sortOrder}-${index}`,
    includeChildren: rule.includeChildren,
    knowledgeNodeIds: [...rule.knowledgeNodeIds],
    questionType: rule.questionType,
    scoreMax: rule.scoreMax,
  };
}

function toFormValues(detail: ZquizTeacherActivityDetail): EditorFormValues {
  return {
    attemptLimit: detail.attemptLimit,
    bankId: detail.bankId,
    durationMinutes: detail.durationMinutes,
    endsAt: toPickerValue(detail.endsAt),
    shuffleOptions: detail.shuffleOptions,
    shuffleQuestions: detail.shuffleQuestions,
    startsAt: toPickerValue(detail.startsAt),
    targetClassIds: detail.targets.map((target) => target.classId),
    title: detail.title,
  };
}

function renderStatusTag(status: ZquizActivityStatus) {
  return <Tag color={STATUS_TAG_COLORS[status]}>{STATUS_LABELS[status]}</Tag>;
}

function renderModeTag(mode: ZquizActivityMode) {
  return <Tag color={mode === 'PRACTICE' ? 'blue' : 'purple'}>{MODE_LABELS[mode]}</Tag>;
}

export function ZquizActivityBuilderLabPage() {
  const [form] = Form.useForm<EditorFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [banksState, setBanksState] = useState<AsyncListState<ZquizTeacherBank>>({
    error: null,
    items: [],
    loading: false,
  });
  const [activitiesState, setActivitiesState] = useState<
    AsyncListState<ZquizTeacherActivitySummary>
  >({
    error: null,
    items: [],
    loading: false,
  });
  const [classesState, setClassesState] = useState<AsyncListState<LocalClassOption>>({
    error: null,
    items: [],
    loading: false,
  });
  const [questionsState, setQuestionsState] = useState<AsyncListState<ZquizAssemblyQuestion>>({
    error: null,
    items: [],
    loading: false,
  });
  const [knowledgeNodesState, setKnowledgeNodesState] = useState<
    AsyncListState<ZquizKnowledgeNode>
  >({
    error: null,
    items: [],
    loading: false,
  });
  const [activityFilters, setActivityFilters] = useState<ActivityFilters>({
    keyword: '',
  });
  const [questionFilters, setQuestionFilters] = useState<QuestionFilters>(EMPTY_QUESTION_FILTERS);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR_STATE);
  const [generationStrategy, setGenerationStrategy] =
    useState<ZquizGenerationRuleStrategy>('FIXED');
  const [randomRules, setRandomRules] = useState<RandomRuleDraft[]>([]);
  const [selectedItems, setSelectedItems] = useState<ZquizActivityItem[]>([]);
  const [targetSnapshots, setTargetSnapshots] = useState<ZquizActivityTarget[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [examProgressState, setExamProgressState] =
    useState<ExamProgressState>(EMPTY_EXAM_PROGRESS_STATE);
  const selectedBankId = Form.useWatch('bankId', form);

  const readOnly = editor.active && editor.status !== 'DRAFT';

  const bankById = useMemo(() => {
    return new Map(banksState.items.map((bank) => [bank.id, bank]));
  }, [banksState.items]);

  const bankSelectOptions = useMemo(() => {
    return banksState.items.map((bank) => ({
      label: getBankLabel(bank),
      value: bank.id,
    }));
  }, [banksState.items]);

  const classSelectOptions = useMemo(() => {
    const options = new Map<string, { label: string; value: string }>();

    for (const option of classesState.items) {
      options.set(option.id, {
        label: getClassLabel(option),
        value: option.id,
      });
    }

    for (const target of targetSnapshots) {
      if (!options.has(target.classId)) {
        options.set(target.classId, {
          label: target.classCodeSnapshot
            ? `${target.classNameSnapshot}（${target.classCodeSnapshot}）`
            : target.classNameSnapshot,
          value: target.classId,
        });
      }
    }

    return Array.from(options.values());
  }, [classesState.items, targetSnapshots]);

  const knowledgeNodeSelectOptions = useMemo(() => {
    return knowledgeNodesState.items.map((node) => ({
      label: getKnowledgeNodeLabel(node),
      value: node.id,
    }));
  }, [knowledgeNodesState.items]);

  const selectedQuestionIds = useMemo(() => {
    return new Set(selectedItems.map((item) => item.questionId));
  }, [selectedItems]);

  const totalScore = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.scoreMax, 0);
  }, [selectedItems]);

  const randomQuestionCount = useMemo(() => {
    return randomRules.reduce((sum, rule) => sum + rule.count, 0);
  }, [randomRules]);

  const randomTotalScore = useMemo(() => {
    return randomRules.reduce((sum, rule) => sum + rule.count * rule.scoreMax, 0);
  }, [randomRules]);

  const loadBanks = useCallback(async () => {
    setBanksState((current) => ({ ...current, error: null, loading: true }));

    try {
      const banks = await listZquizBanks({ status: 'ACTIVE' });
      setBanksState({ error: null, items: banks, loading: false });
    } catch (error) {
      setBanksState({
        error: resolveZquizActivityBuilderErrorMessage(error, '暂时无法加载题库。'),
        items: [],
        loading: false,
      });
    }
  }, []);

  const loadActivities = useCallback(async (filters: ActivityFilters) => {
    setActivitiesState((current) => ({ ...current, error: null, loading: true }));

    try {
      const activities = await listZquizTeacherActivities({
        bankId: filters.bankId,
        keyword: filters.keyword,
        mode: filters.mode,
        status: filters.status,
      });
      setActivitiesState({ error: null, items: activities, loading: false });
    } catch (error) {
      setActivitiesState({
        error: resolveZquizActivityBuilderErrorMessage(error, '暂时无法加载活动列表。'),
        items: [],
        loading: false,
      });
    }
  }, []);

  const loadClasses = useCallback(async () => {
    setClassesState((current) => ({ ...current, error: null, loading: true }));

    try {
      const classes = await listLocalClassOptions();
      setClassesState({ error: null, items: classes, loading: false });
    } catch (error) {
      setClassesState({
        error: resolveZquizActivityBuilderErrorMessage(error, '暂时无法加载目标班级。'),
        items: [],
        loading: false,
      });
    }
  }, []);

  const loadQuestions = useCallback(
    async (bankId: number, filters: QuestionFilters = questionFilters) => {
      setQuestionsState((current) => ({ ...current, error: null, loading: true }));

      try {
        const questions = await listZquizAssemblyQuestions({
          bankId,
          keyword: filters.keyword,
          knowledgeNodeId: filters.knowledgeNodeId,
          questionType: filters.questionType,
        });
        setQuestionsState({ error: null, items: questions, loading: false });
      } catch (error) {
        setQuestionsState({
          error: resolveZquizActivityBuilderErrorMessage(error, '暂时无法加载题目。'),
          items: [],
          loading: false,
        });
      }
    },
    [questionFilters],
  );

  const loadKnowledgeNodes = useCallback(async (bankId: number) => {
    setKnowledgeNodesState((current) => ({ ...current, error: null, loading: true }));

    try {
      const knowledgeNodes = await listZquizKnowledgeNodes({ bankId });
      setKnowledgeNodesState({ error: null, items: knowledgeNodes, loading: false });
    } catch (error) {
      setKnowledgeNodesState({
        error: resolveZquizActivityBuilderErrorMessage(error, '暂时无法加载知识点。'),
        items: [],
        loading: false,
      });
    }
  }, []);

  const loadExamProgress = useCallback(async (activityId: number) => {
    setExamProgressState((current) => ({ ...current, error: null, loading: true }));

    try {
      const progress = await getZquizExamTeacherProgress({ activityId });
      setExamProgressState({
        collecting: false,
        error: null,
        loading: false,
        progress,
      });
    } catch (error) {
      setExamProgressState((current) => ({
        ...current,
        error: resolveZquizActivityBuilderErrorMessage(error, '暂时无法加载考试进度。'),
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    void loadBanks();
    void loadClasses();
  }, [loadBanks, loadClasses]);

  useEffect(() => {
    void loadActivities(activityFilters);
  }, [activityFilters, loadActivities]);

  const applyDetail = useCallback(
    (detail: ZquizTeacherActivityDetail) => {
      const generationRule = detail.mode === 'EXAM' ? detail.generationRule : null;

      setEditor({
        activityId: detail.id,
        active: true,
        loading: false,
        mode: detail.mode,
        status: detail.status,
      });
      setGenerationStrategy(generationRule?.strategy ?? 'FIXED');
      setRandomRules(generationRule?.randomRules.map(toRandomRuleDraft) ?? []);
      setSelectedItems(generationRule?.strategy === 'RANDOM_BY_KNOWLEDGE' ? [] : detail.items);
      setTargetSnapshots(detail.targets);
      setSubmitError(null);
      setExamProgressState(EMPTY_EXAM_PROGRESS_STATE);
      form.setFieldsValue(toFormValues(detail));
    },
    [form],
  );

  const resetEditorForCreate = useCallback(
    (mode: ZquizActivityMode) => {
      setEditor({
        activityId: null,
        active: true,
        loading: false,
        mode,
        status: 'DRAFT',
      });
      setQuestionsState({ error: null, items: [], loading: false });
      setKnowledgeNodesState({ error: null, items: [], loading: false });
      setQuestionFilters(EMPTY_QUESTION_FILTERS);
      setGenerationStrategy('FIXED');
      setRandomRules([]);
      setSelectedItems([]);
      setTargetSnapshots([]);
      setSubmitError(null);
      setExamProgressState(EMPTY_EXAM_PROGRESS_STATE);
      form.resetFields();
      form.setFieldsValue({
        attemptLimit: mode === 'EXAM' ? 1 : null,
        durationMinutes: mode === 'EXAM' ? 90 : null,
        endsAt: null,
        shuffleOptions: true,
        shuffleQuestions: true,
        startsAt: null,
        targetClassIds: [],
        title: '',
      });
    },
    [form],
  );

  const handleLoadDetail = useCallback(
    async (activity: ZquizTeacherActivitySummary) => {
      setEditor({
        activityId: activity.id,
        active: true,
        loading: true,
        mode: activity.mode,
        status: activity.status,
      });
      setSubmitError(null);
      setExamProgressState(EMPTY_EXAM_PROGRESS_STATE);
      setKnowledgeNodesState({ error: null, items: [], loading: false });
      setQuestionFilters(EMPTY_QUESTION_FILTERS);

      try {
        const detail = await getZquizActivityTeacherDetail({
          activityId: activity.id,
          mode: activity.mode,
        });

        if (!detail) {
          throw new Error('后端未返回活动详情。');
        }

        applyDetail(detail);
        await Promise.all([
          loadQuestions(detail.bankId, EMPTY_QUESTION_FILTERS),
          detail.mode === 'EXAM' ? loadKnowledgeNodes(detail.bankId) : Promise.resolve(),
          detail.mode === 'EXAM' && detail.status === 'PUBLISHED'
            ? loadExamProgress(detail.id)
            : Promise.resolve(),
        ]);
      } catch (error) {
        setEditor((current) => ({ ...current, loading: false }));
        setSubmitError(resolveZquizActivityBuilderErrorMessage(error, '暂时无法读取活动详情。'));
      }
    },
    [applyDetail, loadExamProgress, loadKnowledgeNodes, loadQuestions],
  );

  const buildDraftSource = useCallback(() => {
    const values = form.getFieldsValue(true);
    const fixedItems = selectedItems.map((item) => ({
      questionId: item.questionId,
      scoreMax: item.scoreMax,
    }));
    const shuffleOptions = values.shuffleOptions ?? true;
    const shuffleQuestions = values.shuffleQuestions ?? true;
    const isRandomExam = editor.mode === 'EXAM' && generationStrategy === 'RANDOM_BY_KNOWLEDGE';

    return {
      activityId: editor.activityId,
      attemptLimit: values.attemptLimit,
      bankId: values.bankId,
      durationMinutes: values.durationMinutes,
      endsAt: toBusinessDateTime(values.endsAt),
      generationRule:
        editor.mode === 'EXAM'
          ? isRandomExam
            ? {
                randomRules: randomRules.map((rule) => ({
                  count: rule.count,
                  includeChildren: rule.includeChildren,
                  knowledgeNodeIds: rule.knowledgeNodeIds,
                  questionType: rule.questionType,
                  scoreMax: rule.scoreMax,
                })),
                shuffleOptions,
                shuffleQuestions,
                strategy: 'RANDOM_BY_KNOWLEDGE' as const,
              }
            : {
                fixedItems,
                shuffleOptions,
                shuffleQuestions,
                strategy: 'FIXED' as const,
              }
          : undefined,
      items: isRandomExam ? [] : fixedItems,
      ...(editor.mode === 'PRACTICE'
        ? {
            shuffleOptions,
            shuffleQuestions,
          }
        : {}),
      startsAt: toBusinessDateTime(values.startsAt),
      targetClassIds: values.targetClassIds ?? [],
      title: values.title,
    };
  }, [editor.activityId, editor.mode, form, generationStrategy, randomRules, selectedItems]);

  const handleSaveDraft = useCallback(async () => {
    if (!editor.active || readOnly) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await form.validateFields();
      const detail = await saveZquizActivityDraft(editor.mode, buildDraftSource());
      applyDetail(detail);
      await loadActivities(activityFilters);
      messageApi.success('草稿已保存。');
    } catch (error) {
      setSubmitError(resolveZquizActivityBuilderErrorMessage(error, '暂时无法保存草稿。'));
    } finally {
      setSubmitting(false);
    }
  }, [
    activityFilters,
    applyDetail,
    buildDraftSource,
    editor.active,
    editor.mode,
    form,
    loadActivities,
    messageApi,
    readOnly,
  ]);

  const handlePublish = useCallback(async () => {
    if (!editor.active || readOnly) {
      return;
    }

    setSubmitError(null);

    try {
      await form.validateFields();
      const draftInput = buildZquizActivityDraftInput(buildDraftSource());
      const publishErrors = validateZquizActivityPublishDraft({
        ...draftInput,
        mode: editor.mode,
      });

      if (publishErrors.length > 0) {
        setSubmitError(publishErrors.join('\n'));
        return;
      }

      Modal.confirm({
        title: `确认发布${MODE_LABELS[editor.mode]}`,
        content: `确定发布“${draftInput.title}”？发布后不能再保存草稿。`,
        okText: '发布',
        onOk: async () => {
          setSubmitting(true);

          try {
            const savedDetail = await saveZquizActivityDraft(editor.mode, buildDraftSource());
            const publishedDetail = await publishZquizActivity({
              activityId: savedDetail.id,
              mode: editor.mode,
            });
            applyDetail(publishedDetail);
            if (publishedDetail.mode === 'EXAM') {
              await loadExamProgress(publishedDetail.id);
            }
            await loadActivities(activityFilters);
            messageApi.success('活动已发布。');
          } catch (error) {
            setSubmitError(resolveZquizActivityBuilderErrorMessage(error, '暂时无法发布活动。'));
            throw error;
          } finally {
            setSubmitting(false);
          }
        },
      });
    } catch (error) {
      setSubmitError(resolveZquizActivityBuilderErrorMessage(error, '请先补齐必填配置。'));
    }
  }, [
    activityFilters,
    applyDetail,
    buildDraftSource,
    editor.active,
    editor.mode,
    form,
    loadExamProgress,
    loadActivities,
    messageApi,
    readOnly,
  ]);

  const handleCollectExamAttempts = useCallback(() => {
    if (!editor.activityId || editor.mode !== 'EXAM' || editor.status !== 'PUBLISHED') {
      return;
    }

    const activityId = editor.activityId;

    Modal.confirm({
      content: '将使用学生最后一次自动保存的草稿作为最终答案。已提交或已评分的作答不会被覆盖。',
      okText: '收卷',
      onOk: () => {
        void (async () => {
          setExamProgressState((current) => ({
            ...current,
            collecting: true,
            error: null,
          }));

          try {
            const result = await collectZquizExamAttempts({
              activityId,
            });

            setExamProgressState({
              collecting: false,
              error: null,
              loading: false,
              progress: result.progress,
            });
            messageApi.success(
              `收卷完成：收取 ${result.collectedCount} 份，跳过 ${result.skippedCount} 份。`,
            );
          } catch (error) {
            setExamProgressState((current) => ({
              ...current,
              collecting: false,
              error: resolveZquizActivityBuilderErrorMessage(error, '暂时无法主动收卷。'),
            }));
          }
        })();
      },
      title: '确认主动收卷',
    });
  }, [editor.activityId, editor.mode, editor.status, messageApi]);

  const handleBankChange = useCallback(
    (bankId: number | undefined) => {
      setSelectedItems([]);
      setRandomRules([]);
      setQuestionsState({ error: null, items: [], loading: false });
      setKnowledgeNodesState({ error: null, items: [], loading: false });
      setQuestionFilters(EMPTY_QUESTION_FILTERS);

      if (bankId) {
        void loadQuestions(bankId, EMPTY_QUESTION_FILTERS);
        if (editor.mode === 'EXAM') {
          void loadKnowledgeNodes(bankId);
        }
      }
    },
    [editor.mode, loadKnowledgeNodes, loadQuestions],
  );

  const handleSearchQuestions = useCallback(() => {
    if (!selectedBankId) {
      messageApi.warning('请先选择题库。');
      return;
    }

    void loadQuestions(selectedBankId, questionFilters);
  }, [loadQuestions, messageApi, questionFilters, selectedBankId]);

  const handleAddQuestion = useCallback(
    (question: ZquizAssemblyQuestion) => {
      if (readOnly || selectedQuestionIds.has(question.id)) {
        return;
      }

      setSelectedItems((current) => [...current, toSelectedItem(question)]);
    },
    [readOnly, selectedQuestionIds],
  );

  const handleMoveSelectedItem = useCallback((questionId: number, direction: -1 | 1) => {
    setSelectedItems((current) => {
      const currentIndex = current.findIndex((item) => item.questionId === questionId);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
      return next;
    });
  }, []);

  const handleScoreChange = useCallback((questionId: number, scoreMax: number | null) => {
    if (!scoreMax || scoreMax <= 0) {
      return;
    }

    setSelectedItems((current) =>
      current.map((item) => (item.questionId === questionId ? { ...item, scoreMax } : item)),
    );
  }, []);

  const handleRemoveSelectedItem = useCallback((questionId: number) => {
    setSelectedItems((current) => current.filter((item) => item.questionId !== questionId));
  }, []);

  const handleAddRandomRule = useCallback(() => {
    setRandomRules((current) => [...current, createRandomRuleDraft(current.length)]);
  }, []);

  const handleUpdateRandomRule = useCallback(
    (ruleId: string, patch: Partial<Omit<RandomRuleDraft, 'id'>>) => {
      setRandomRules((current) =>
        current.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
      );
    },
    [],
  );

  const handleMoveRandomRule = useCallback((ruleId: string, direction: -1 | 1) => {
    setRandomRules((current) => {
      const currentIndex = current.findIndex((rule) => rule.id === ruleId);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
      return next;
    });
  }, []);

  const handleRemoveRandomRule = useCallback((ruleId: string) => {
    setRandomRules((current) => current.filter((rule) => rule.id !== ruleId));
  }, []);

  const activityColumns = useMemo<ColumnsType<ZquizTeacherActivitySummary>>(
    () => [
      {
        dataIndex: 'title',
        key: 'title',
        render: (title: string, activity) => (
          <Space orientation="vertical" size={2}>
            <Typography.Text strong>{title}</Typography.Text>
            <Typography.Text type="secondary">
              {bankById.get(activity.bankId)?.name ?? `题库 #${activity.bankId}`}
            </Typography.Text>
          </Space>
        ),
        title: '活动',
      },
      {
        dataIndex: 'mode',
        key: 'mode',
        render: (mode: ZquizActivityMode) => renderModeTag(mode),
        title: '类型',
        width: 90,
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (status: ZquizActivityStatus) => renderStatusTag(status),
        title: '状态',
        width: 100,
      },
      {
        key: 'counts',
        render: (_, activity) => `${activity.itemCount} 题 / ${activity.targetCount} 班`,
        title: '配置',
        width: 140,
      },
      {
        key: 'rules',
        render: (_, activity) => (
          <Space orientation="vertical" size={2}>
            <Typography.Text>{formatDuration(activity.durationMinutes)}</Typography.Text>
            <Typography.Text type="secondary">
              {formatAttemptLimit(activity.attemptLimit)}
            </Typography.Text>
          </Space>
        ),
        title: '规则',
        width: 130,
      },
      {
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        render: (updatedAt: string) => formatDateTime(updatedAt),
        title: '更新',
        width: 180,
      },
      {
        key: 'actions',
        render: (_, activity) => (
          <Button
            icon={activity.status === 'DRAFT' ? <EditOutlined /> : <EyeOutlined />}
            onClick={() => void handleLoadDetail(activity)}
            size="small"
            type="link"
          >
            {activity.status === 'DRAFT' ? '编辑' : '查看'}
          </Button>
        ),
        title: '操作',
        width: 100,
      },
    ],
    [bankById, handleLoadDetail],
  );

  const selectedItemColumns = useMemo<ColumnsType<ZquizActivityItem>>(
    () => [
      {
        key: 'sortOrder',
        render: (_, __, index) => index + 1,
        title: '序号',
        width: 70,
      },
      {
        key: 'question',
        render: (_, item) => (
          <Space orientation="vertical" size={2}>
            <Typography.Text>{getQuestionLabel(item.question, item.questionId)}</Typography.Text>
            <Typography.Text type="secondary">
              {item.question ? QUESTION_TYPE_LABELS[item.question.type] : '题目已不可用'}
            </Typography.Text>
          </Space>
        ),
        title: '题目',
      },
      {
        dataIndex: 'scoreMax',
        key: 'scoreMax',
        render: (scoreMax: number, item) => (
          <InputNumber
            disabled={readOnly}
            min={0.01}
            precision={2}
            value={scoreMax}
            onChange={(value) => handleScoreChange(item.questionId, value)}
            style={{ width: '100%' }}
          />
        ),
        title: '分值',
        width: 120,
      },
      {
        key: 'actions',
        render: (_, item, index) => (
          <Space>
            <Button
              aria-label="上移题目"
              disabled={readOnly || index === 0}
              icon={<ArrowUpOutlined />}
              onClick={() => handleMoveSelectedItem(item.questionId, -1)}
              size="small"
            />
            <Button
              aria-label="下移题目"
              disabled={readOnly || index === selectedItems.length - 1}
              icon={<ArrowDownOutlined />}
              onClick={() => handleMoveSelectedItem(item.questionId, 1)}
              size="small"
            />
            <Button
              danger
              aria-label="移除题目"
              disabled={readOnly}
              icon={<DeleteOutlined />}
              onClick={() => handleRemoveSelectedItem(item.questionId)}
              size="small"
            />
          </Space>
        ),
        title: '操作',
        width: 160,
      },
    ],
    [
      handleMoveSelectedItem,
      handleRemoveSelectedItem,
      handleScoreChange,
      readOnly,
      selectedItems.length,
    ],
  );

  const randomRuleColumns = useMemo<ColumnsType<RandomRuleDraft>>(
    () => [
      {
        key: 'sortOrder',
        render: (_, __, index) => index + 1,
        title: '序号',
        width: 70,
      },
      {
        key: 'knowledgeNodeIds',
        render: (_, rule) => (
          <Select<number[]>
            disabled={readOnly}
            loading={knowledgeNodesState.loading}
            maxTagCount="responsive"
            mode="multiple"
            optionFilterProp="label"
            options={knowledgeNodeSelectOptions}
            placeholder="选择知识点"
            showSearch
            style={{ width: '100%' }}
            value={rule.knowledgeNodeIds}
            onChange={(knowledgeNodeIds) => handleUpdateRandomRule(rule.id, { knowledgeNodeIds })}
          />
        ),
        title: '知识点',
        width: 320,
      },
      {
        dataIndex: 'includeChildren',
        key: 'includeChildren',
        render: (includeChildren: boolean, rule) => (
          <Switch
            checked={includeChildren}
            disabled={readOnly}
            onChange={(checked) => handleUpdateRandomRule(rule.id, { includeChildren: checked })}
          />
        ),
        title: '含子节点',
        width: 100,
      },
      {
        dataIndex: 'questionType',
        key: 'questionType',
        render: (questionType: ZquizQuestionType, rule) => (
          <Select<ZquizQuestionType>
            disabled={readOnly}
            options={QUESTION_TYPE_OPTIONS}
            style={{ width: '100%' }}
            value={questionType}
            onChange={(nextQuestionType) =>
              handleUpdateRandomRule(rule.id, { questionType: nextQuestionType })
            }
          />
        ),
        title: '题型',
        width: 150,
      },
      {
        dataIndex: 'count',
        key: 'count',
        render: (count: number, rule) => (
          <InputNumber
            disabled={readOnly}
            min={1}
            precision={0}
            style={{ width: '100%' }}
            value={count}
            onChange={(nextCount) => {
              if (nextCount) {
                handleUpdateRandomRule(rule.id, { count: nextCount });
              }
            }}
          />
        ),
        title: '数量',
        width: 100,
      },
      {
        dataIndex: 'scoreMax',
        key: 'scoreMax',
        render: (scoreMax: number, rule) => (
          <InputNumber
            disabled={readOnly}
            min={0.01}
            precision={2}
            style={{ width: '100%' }}
            value={scoreMax}
            onChange={(nextScoreMax) => {
              if (nextScoreMax) {
                handleUpdateRandomRule(rule.id, { scoreMax: nextScoreMax });
              }
            }}
          />
        ),
        title: '单题分值',
        width: 120,
      },
      {
        key: 'actions',
        render: (_, rule, index) => (
          <Space>
            <Button
              aria-label="上移随机规则"
              disabled={readOnly || index === 0}
              icon={<ArrowUpOutlined />}
              onClick={() => handleMoveRandomRule(rule.id, -1)}
              size="small"
            />
            <Button
              aria-label="下移随机规则"
              disabled={readOnly || index === randomRules.length - 1}
              icon={<ArrowDownOutlined />}
              onClick={() => handleMoveRandomRule(rule.id, 1)}
              size="small"
            />
            <Button
              danger
              aria-label="删除随机规则"
              disabled={readOnly}
              icon={<DeleteOutlined />}
              onClick={() => handleRemoveRandomRule(rule.id)}
              size="small"
            />
          </Space>
        ),
        title: '操作',
        width: 160,
      },
    ],
    [
      handleMoveRandomRule,
      handleRemoveRandomRule,
      handleUpdateRandomRule,
      knowledgeNodeSelectOptions,
      knowledgeNodesState.loading,
      randomRules.length,
      readOnly,
    ],
  );

  const questionColumns = useMemo<ColumnsType<ZquizAssemblyQuestion>>(
    () => [
      {
        dataIndex: 'type',
        key: 'type',
        render: (type: ZquizQuestionType) => <Tag>{QUESTION_TYPE_LABELS[type]}</Tag>,
        title: '题型',
        width: 100,
      },
      {
        dataIndex: 'stem',
        key: 'stem',
        render: (stem: string, question) => (
          <Space orientation="vertical" size={2}>
            <Typography.Text>{stem}</Typography.Text>
            <Typography.Text type="secondary">
              {question.options.length > 0 ? `${question.options.length} 个选项` : '无选项'}
            </Typography.Text>
          </Space>
        ),
        title: '题目',
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => (
          <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status}</Tag>
        ),
        title: '状态',
        width: 100,
      },
      {
        key: 'actions',
        render: (_, question) => {
          const selected = selectedQuestionIds.has(question.id);

          return (
            <Button
              disabled={readOnly || selected || question.status !== 'ACTIVE'}
              icon={<PlusOutlined />}
              onClick={() => handleAddQuestion(question)}
              size="small"
              type={selected ? 'default' : 'primary'}
            >
              {selected ? '已选' : '加入'}
            </Button>
          );
        },
        title: '操作',
        width: 110,
      },
    ],
    [handleAddQuestion, readOnly, selectedQuestionIds],
  );

  function renderExamGenerationStrategyCard() {
    if (editor.mode !== 'EXAM') {
      return null;
    }

    return (
      <Card size="small" title="考试组卷策略">
        <Flex vertical gap={12}>
          <Segmented
            disabled={readOnly || submitting}
            options={GENERATION_STRATEGY_OPTIONS}
            value={generationStrategy}
            onChange={(value) => setGenerationStrategy(value as ZquizGenerationRuleStrategy)}
          />
          <Space wrap>
            <Tag color={generationStrategy === 'FIXED' ? 'blue' : 'purple'}>
              {generationStrategy === 'FIXED' ? '固定题单' : '知识点随机'}
            </Tag>
            {generationStrategy === 'FIXED' ? (
              <>
                <Tag>{selectedItems.length} 题</Tag>
                <Tag>{formatScore(totalScore)} 分</Tag>
              </>
            ) : (
              <>
                <Tag>{randomRules.length} 组规则</Tag>
                <Tag>{randomQuestionCount} 题</Tag>
                <Tag>{formatScore(randomTotalScore)} 分</Tag>
              </>
            )}
          </Space>
        </Flex>
      </Card>
    );
  }

  function renderRandomRuleCard() {
    const bankId = typeof selectedBankId === 'number' ? selectedBankId : null;

    return (
      <Card
        size="small"
        title={`随机抽题规则：${randomRules.length} 组 / ${randomQuestionCount} 题 / ${formatScore(
          randomTotalScore,
        )} 分`}
        extra={
          <Space>
            <Button
              disabled={!bankId}
              icon={<ReloadOutlined />}
              loading={knowledgeNodesState.loading}
              onClick={() => {
                if (bankId) {
                  void loadKnowledgeNodes(bankId);
                }
              }}
            >
              刷新知识点
            </Button>
            <Button
              disabled={readOnly || !bankId}
              icon={<PlusOutlined />}
              onClick={handleAddRandomRule}
              type="primary"
            >
              添加规则
            </Button>
          </Space>
        }
      >
        <Flex vertical gap={12}>
          {!bankId ? <Alert showIcon title="请选择题库后配置随机抽题规则。" type="info" /> : null}
          {knowledgeNodesState.error ? (
            <Alert showIcon title={knowledgeNodesState.error} type="error" />
          ) : null}
          {randomQuestionCount > 200 ? (
            <Alert showIcon title="随机组卷总题量不能超过 200 题。" type="warning" />
          ) : null}

          <Table<RandomRuleDraft>
            columns={randomRuleColumns}
            dataSource={randomRules}
            loading={knowledgeNodesState.loading}
            locale={{ emptyText: <Empty description="还未配置随机抽题规则" /> }}
            pagination={false}
            rowKey={(rule) => rule.id}
            scroll={{ x: 1020 }}
          />
        </Flex>
      </Card>
    );
  }

  function renderExamProgressCard() {
    if (editor.mode !== 'EXAM' || editor.status !== 'PUBLISHED' || !editor.activityId) {
      return null;
    }

    const activityId = editor.activityId;
    const progress = examProgressState.progress;

    return (
      <Card
        size="small"
        title="考试进度"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              loading={examProgressState.loading}
              onClick={() => void loadExamProgress(activityId)}
            >
              刷新进度
            </Button>
            <Button
              danger
              loading={examProgressState.collecting}
              onClick={handleCollectExamAttempts}
            >
              主动收卷
            </Button>
          </Space>
        }
      >
        <Flex vertical gap={12}>
          {examProgressState.error ? (
            <Alert showIcon title={examProgressState.error} type="error" />
          ) : null}

          {examProgressState.loading && !progress ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : progress ? (
            <Descriptions
              bordered
              column={3}
              size="small"
              items={[
                {
                  key: 'targetStudentCount',
                  label: '目标学生',
                  children: progress.targetStudentCount,
                },
                {
                  key: 'startedStudentCount',
                  label: '已开始',
                  children: progress.startedStudentCount,
                },
                {
                  key: 'notStartedStudentCount',
                  label: '未开始',
                  children: progress.notStartedStudentCount,
                },
                {
                  key: 'totalAttemptCount',
                  label: '作答总数',
                  children: progress.totalAttemptCount,
                },
                {
                  key: 'inProgressAttemptCount',
                  label: '作答中',
                  children: progress.inProgressAttemptCount,
                },
                {
                  key: 'submittedAttemptCount',
                  label: '已提交',
                  children: progress.submittedAttemptCount,
                },
                {
                  key: 'gradedAttemptCount',
                  label: '已评分',
                  children: progress.gradedAttemptCount,
                },
                {
                  key: 'abandonedAttemptCount',
                  label: '已放弃',
                  children: progress.abandonedAttemptCount,
                },
                {
                  key: 'notGradedAttemptCount',
                  label: '未评分',
                  children: progress.notGradedAttemptCount,
                },
                {
                  key: 'autoGradedAttemptCount',
                  label: '自动评分',
                  children: progress.autoGradedAttemptCount,
                },
                {
                  key: 'manualPendingAttemptCount',
                  label: '待人工批改',
                  children: progress.manualPendingAttemptCount,
                },
                {
                  key: 'manualGradedAttemptCount',
                  label: '人工已评',
                  children: progress.manualGradedAttemptCount,
                },
              ]}
            />
          ) : (
            <Empty description="暂无考试进度" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Flex>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {messageContextHolder}

      <Card>
        <Flex vertical gap={12}>
          <Flex align="center" gap={12} wrap>
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              Zquiz 教师组卷 Lab
            </Typography.Title>
            <Tag color="blue">负责人：{zquizActivityBuilderLabMeta.owner}</Tag>
            <Tag color="purple">复核时间：{zquizActivityBuilderLabMeta.reviewAt}</Tag>
            <Tag color="green">环境：{zquizActivityBuilderLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">权限：ADMIN / STAFF</Tag>
          </Flex>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {zquizActivityBuilderLabMeta.purpose}
          </Typography.Paragraph>
        </Flex>
      </Card>

      <Card
        title="活动列表"
        extra={
          <Space>
            <Button
              icon={<PlusOutlined />}
              onClick={() => resetEditorForCreate('PRACTICE')}
              type="primary"
            >
              新建练习
            </Button>
            <Button icon={<PlusOutlined />} onClick={() => resetEditorForCreate('EXAM')}>
              新建考试
            </Button>
          </Space>
        }
      >
        <Flex vertical gap={16}>
          <ResponsiveGrid className="gap-4" columns={{ compact: 1, regular: 2, large: 4, wide: 5 }}>
            <ResponsiveGridItem span={{ wide: 2 }}>
              <Input.Search
                allowClear
                placeholder="搜索活动标题"
                value={activityFilters.keyword}
                onChange={(event) =>
                  setActivityFilters((current) => ({
                    ...current,
                    keyword: event.target.value,
                  }))
                }
                onSearch={() => void loadActivities(activityFilters)}
              />
            </ResponsiveGridItem>
            <Select<ZquizActivityMode | undefined>
              allowClear
              placeholder="类型"
              options={MODE_OPTIONS}
              value={activityFilters.mode}
              onChange={(mode) => setActivityFilters((current) => ({ ...current, mode }))}
            />
            <Select<ZquizActivityStatus | undefined>
              allowClear
              placeholder="状态"
              options={STATUS_OPTIONS}
              value={activityFilters.status}
              onChange={(status) => setActivityFilters((current) => ({ ...current, status }))}
            />
            <Select<number | undefined>
              allowClear
              loading={banksState.loading}
              placeholder="题库"
              options={bankSelectOptions}
              value={activityFilters.bankId}
              onChange={(bankId) => setActivityFilters((current) => ({ ...current, bankId }))}
            />
            <Button
              icon={<ReloadOutlined />}
              loading={activitiesState.loading}
              onClick={() => void loadActivities(activityFilters)}
            >
              刷新
            </Button>
          </ResponsiveGrid>

          {activitiesState.error ? <Alert type="error" title={activitiesState.error} /> : null}

          <Table<ZquizTeacherActivitySummary>
            columns={activityColumns}
            dataSource={activitiesState.items}
            loading={activitiesState.loading}
            locale={{ emptyText: <Empty description="暂无活动" /> }}
            pagination={false}
            rowKey={(activity) => `${activity.mode}:${activity.id}`}
            scroll={{ x: 940 }}
          />
        </Flex>
      </Card>

      {editor.active ? (
        <Card
          title={
            <Space>
              <span>{editor.activityId ? '编辑活动' : '新建活动'}</span>
              {renderModeTag(editor.mode)}
              {renderStatusTag(editor.status)}
            </Space>
          }
          extra={
            <Space>
              <Button
                onClick={() => {
                  setEditor(EMPTY_EDITOR_STATE);
                  setExamProgressState(EMPTY_EXAM_PROGRESS_STATE);
                  setGenerationStrategy('FIXED');
                  setKnowledgeNodesState({ error: null, items: [], loading: false });
                  setRandomRules([]);
                }}
              >
                关闭
              </Button>
              <Button
                disabled={readOnly}
                icon={<SaveOutlined />}
                loading={submitting}
                onClick={() => void handleSaveDraft()}
              >
                保存草稿
              </Button>
              <Button
                disabled={readOnly}
                icon={<SendOutlined />}
                loading={submitting}
                onClick={() => void handlePublish()}
                type="primary"
              >
                发布
              </Button>
            </Space>
          }
        >
          {editor.loading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : (
            <Flex vertical gap={16}>
              {submitError ? (
                <Alert showIcon type="error" title="操作未完成" description={submitError} />
              ) : null}

              {readOnly ? (
                <Alert showIcon type="info" title="该活动已离开草稿状态，只能查看配置。" />
              ) : null}

              {renderExamProgressCard()}

              <Form<EditorFormValues>
                disabled={readOnly || submitting}
                form={form}
                layout="vertical"
                requiredMark={false}
              >
                <ResponsiveGrid className="gap-4" columns={{ compact: 1, regular: 2, large: 4 }}>
                  <ResponsiveGridItem span={{ regular: 2, large: 2 }}>
                    <Form.Item
                      label="活动标题"
                      name="title"
                      rules={[{ required: true, message: '请输入活动标题。' }]}
                    >
                      <Input maxLength={128} placeholder="例如：期中练习" />
                    </Form.Item>
                  </ResponsiveGridItem>
                  <Form.Item
                    label="题库"
                    name="bankId"
                    rules={[{ required: true, message: '请选择题库。' }]}
                  >
                    <Select<number>
                      loading={banksState.loading}
                      onChange={handleBankChange}
                      options={bankSelectOptions}
                      placeholder="选择题库"
                      showSearch
                      optionFilterProp="label"
                    />
                  </Form.Item>
                  <Form.Item label="作答次数" name="attemptLimit">
                    <InputNumber
                      min={1}
                      precision={0}
                      placeholder="不限次数"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item label="开始时间" name="startsAt">
                    <DatePicker showTime style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="结束时间" name="endsAt">
                    <DatePicker showTime style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="时长" name="durationMinutes">
                    <InputNumber
                      min={1}
                      precision={0}
                      placeholder="不限时"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item label="目标班级" name="targetClassIds">
                    <Select<string[]>
                      loading={classesState.loading}
                      maxTagCount="responsive"
                      mode="multiple"
                      optionFilterProp="label"
                      options={classSelectOptions}
                      placeholder="选择目标班级"
                      showSearch
                    />
                  </Form.Item>
                  <Form.Item label="题目乱序" name="shuffleQuestions" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="选项乱序" name="shuffleOptions" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </ResponsiveGrid>
              </Form>

              {classesState.error ? <Alert type="error" title={classesState.error} /> : null}

              {renderExamGenerationStrategyCard()}

              {editor.mode === 'EXAM' && generationStrategy === 'RANDOM_BY_KNOWLEDGE' ? (
                renderRandomRuleCard()
              ) : (
                <>
                  <Card
                    size="small"
                    title={`已选题目：${selectedItems.length} 题 / ${formatScore(totalScore)} 分`}
                  >
                    <Table<ZquizActivityItem>
                      columns={selectedItemColumns}
                      dataSource={selectedItems}
                      locale={{ emptyText: <Empty description="还未选择题目" /> }}
                      pagination={false}
                      rowKey={(item) => item.questionId}
                      scroll={{ x: 760 }}
                    />
                  </Card>

                  <Card size="small" title="题库题目">
                    <Flex vertical gap={12}>
                      <ResponsiveGrid
                        className="gap-4"
                        columns={{ compact: 1, regular: 2, large: 4 }}
                      >
                        <Input.Search
                          allowClear
                          placeholder="搜索题干"
                          value={questionFilters.keyword}
                          onChange={(event) =>
                            setQuestionFilters((current) => ({
                              ...current,
                              keyword: event.target.value,
                            }))
                          }
                          onSearch={handleSearchQuestions}
                        />
                        <Select<ZquizQuestionType | undefined>
                          allowClear
                          placeholder="题型"
                          options={QUESTION_TYPE_OPTIONS}
                          value={questionFilters.questionType}
                          onChange={(questionType) =>
                            setQuestionFilters((current) => ({ ...current, questionType }))
                          }
                        />
                        <InputNumber
                          min={1}
                          precision={0}
                          placeholder="知识点 ID"
                          style={{ width: '100%' }}
                          value={questionFilters.knowledgeNodeId}
                          onChange={(knowledgeNodeId) =>
                            setQuestionFilters((current) => ({ ...current, knowledgeNodeId }))
                          }
                        />
                        <Button
                          icon={<SearchOutlined />}
                          loading={questionsState.loading}
                          onClick={handleSearchQuestions}
                        >
                          查询题目
                        </Button>
                      </ResponsiveGrid>

                      {banksState.error ? <Alert type="error" title={banksState.error} /> : null}
                      {questionsState.error ? (
                        <Alert type="error" title={questionsState.error} />
                      ) : null}

                      <Table<ZquizAssemblyQuestion>
                        columns={questionColumns}
                        dataSource={questionsState.items}
                        loading={questionsState.loading}
                        locale={{ emptyText: <Empty description="请选择题库后查询题目" /> }}
                        pagination={false}
                        rowKey={(question) => question.id}
                        scroll={{ x: 780 }}
                      />
                    </Flex>
                  </Card>
                </>
              )}
            </Flex>
          )}
        </Card>
      ) : null}
    </div>
  );
}
