// src/labs/student-evaluation-comment/ui/ai-draft-workbench.tsx

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  CheckOutlined,
  DeleteOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Collapse,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType, TableRowSelection } from 'antd/es/table/interface';

import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import type { StudentEvaluationCommentAiDraftEdit } from '../application/ai-draft-workflow';
import {
  createStudentEvaluationCommentAiDraftWorkflowState,
  resolveStudentEvaluationCommentAiDispositionLabel,
  resolveStudentEvaluationCommentAiDraftValidation,
  resolveStudentEvaluationCommentAiGenerationBlockingReason,
  studentEvaluationCommentAiDraftWorkflowReducer,
} from '../application/ai-draft-workflow';
import {
  formatStudentEvaluationCommentDateTime,
  formatStudentEvaluationCommentStatus,
  resolveStudentEvaluationCommentErrorMessage,
} from '../application/display';
import {
  confirmStudentEvaluationCommentAiDrafts,
  discardStudentEvaluationCommentAiDrafts,
  generateStudentEvaluationCommentAiDrafts,
  saveStudentEvaluationCommentAiDraft,
} from '../infrastructure/api';
import type {
  StudentEvaluationCommentAiDraftMutationItem,
  StudentEvaluationCommentClassScopeStudent,
  StudentEvaluationCommentWorkspace,
} from '../types';

type StudentEvaluationCommentAiDraftWorkbenchProps = {
  manualDirtyStudentIds: ReadonlySet<string>;
  onDirtyChange?: (isDirty: boolean) => void;
  onRefreshWorkspace: () => Promise<StudentEvaluationCommentWorkspace>;
  resetToken: number;
  workspace: StudentEvaluationCommentWorkspace;
};

const AI_POLL_FAST_WINDOW_MS = 60_000;
const AI_POLL_FAST_INTERVAL_MS = 3_000;
const AI_POLL_SLOW_INTERVAL_MS = 10_000;
const AI_POLL_MAX_DURATION_MS = 20 * 60_000;
const AI_POLL_MAX_CONSECUTIVE_FAILURES = 3;

const TONE_OPTIONS = [
  { label: '温暖鼓励', value: 'WARM_ENCOURAGING' },
  { label: '客观平衡', value: 'OBJECTIVE_BALANCED' },
  { label: '简洁直接', value: 'CONCISE_DIRECT' },
] as const;
const LENGTH_OPTIONS = [
  { label: '80–120 字', value: 'CHARS_80_120' },
  { label: '120–180 字', value: 'CHARS_120_180' },
  { label: '180–260 字', value: 'CHARS_180_260' },
] as const;
const ADDRESS_OPTIONS = [
  { label: '第二人称', value: 'SECOND_PERSON' },
  { label: '第三人称', value: 'THIRD_PERSON' },
] as const;

export function StudentEvaluationCommentAiDraftWorkbench({
  manualDirtyStudentIds,
  onDirtyChange,
  onRefreshWorkspace,
  resetToken,
  workspace,
}: StudentEvaluationCommentAiDraftWorkbenchProps) {
  const { message, modal } = AntApp.useApp();
  const students = useMemo(() => workspace.view?.students ?? [], [workspace.view]);
  const scopeKey = workspace.view?.scope.scopeKey ?? '';
  const semesterId = workspace.view?.scope.semesterId ?? null;
  const classId = workspace.view?.classItem.id ?? '';
  const [state, dispatch] = useReducer(
    studentEvaluationCommentAiDraftWorkflowReducer,
    { scopeKey, students },
    createStudentEvaluationCommentAiDraftWorkflowState,
  );
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [pollingPaused, setPollingPaused] = useState(false);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savingDraftIds, setSavingDraftIds] = useState<string[]>([]);
  const [batchAction, setBatchAction] = useState<'confirm' | 'discard' | null>(null);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const pollStartedAtRef = useRef<number | null>(null);
  const consecutivePollFailuresRef = useRef(0);
  const resetStudentsRef = useRef(students);

  useEffect(() => {
    resetStudentsRef.current = students;
  }, [students]);

  useEffect(() => {
    dispatch({ scopeKey, students: resetStudentsRef.current, type: 'RESET_SCOPE' });
    setGenerationError(null);
    setPollError(null);
    setPollingPaused(false);
    setPollingTimedOut(false);
    setDraftErrors({});
    pollStartedAtRef.current = null;
    consecutivePollFailuresRef.current = 0;
  }, [resetToken, scopeKey]);

  useEffect(() => {
    dispatch({ students, type: 'WORKSPACE_MERGED' });
  }, [students]);

  const edits = useMemo(() => Object.values(state.edits), [state.edits]);
  const editsByStudentId = useMemo(
    () => new Map(edits.map((edit) => [edit.studentId, edit] as const)),
    [edits],
  );
  const hasDirtyAiDrafts = edits.some((edit) => edit.isDirty);

  useEffect(() => {
    onDirtyChange?.(hasDirtyAiDrafts);
  }, [hasDirtyAiDrafts, onDirtyChange]);

  useEffect(
    () => () => {
      onDirtyChange?.(false);
    },
    [onDirtyChange],
  );

  const generateAction = workspace.actions.find((action) => action.action === 'GENERATE_AI_DRAFTS');
  const generateAllowed = generateAction?.allowed === true;
  const generationBlockingReasons = useMemo(
    () =>
      new Map(
        students.map((student) => [
          student.studentId,
          resolveStudentEvaluationCommentAiGenerationBlockingReason({
            generateAllowed,
            hasManualDraft: manualDirtyStudentIds.has(student.studentId),
            student,
          }),
        ]),
      ),
    [generateAllowed, manualDirtyStudentIds, students],
  );
  const availableTargetStudentIds = useMemo(
    () =>
      students.flatMap((student) =>
        generationBlockingReasons.get(student.studentId) ? [] : [student.studentId],
      ),
    [generationBlockingReasons, students],
  );
  const selectedTargetStudentIds = useMemo(() => {
    const availableTargetStudentIdSet = new Set(availableTargetStudentIds);
    return state.targetStudentIds.filter((studentId) => availableTargetStudentIdSet.has(studentId));
  }, [availableTargetStudentIds, state.targetStudentIds]);
  const styleExampleOptions = useMemo(
    () =>
      students.flatMap((student) =>
        student.comment
          ? [{ label: `${student.studentName} · ${student.studentId}`, value: student.studentId }]
          : [],
      ),
    [students],
  );

  useEffect(() => {
    if (selectedTargetStudentIds.length === state.targetStudentIds.length) return;
    dispatch({ studentIds: selectedTargetStudentIds, type: 'SET_TARGET_STUDENTS' });
  }, [selectedTargetStudentIds, state.targetStudentIds.length]);

  const refreshAiFacts = useCallback(async () => {
    const nextWorkspace = await onRefreshWorkspace();
    dispatch({ students: nextWorkspace.view?.students ?? [], type: 'WORKSPACE_MERGED' });
    return nextWorkspace;
  }, [onRefreshWorkspace]);

  const shouldPoll =
    students.some((student) => student.isAiDraftGenerating) ||
    state.pendingAutoSelectStudentIds.length > 0;

  useEffect(() => {
    if (!shouldPoll) {
      pollStartedAtRef.current = null;
      consecutivePollFailuresRef.current = 0;
      setPollError(null);
      setPollingPaused(false);
      setPollingTimedOut(false);
      return;
    }
    if (pollingPaused || pollingTimedOut) return;

    pollStartedAtRef.current ??= Date.now();
    let cancelled = false;
    let timerId: number | undefined;

    const scheduleNextPoll = () => {
      const startedAt = pollStartedAtRef.current ?? Date.now();
      const elapsed = Date.now() - startedAt;
      if (elapsed >= AI_POLL_MAX_DURATION_MS) {
        setPollingTimedOut(true);
        return;
      }
      timerId = window.setTimeout(
        () => void poll(),
        elapsed < AI_POLL_FAST_WINDOW_MS ? AI_POLL_FAST_INTERVAL_MS : AI_POLL_SLOW_INTERVAL_MS,
      );
    };

    const poll = async () => {
      try {
        const nextWorkspace = await refreshAiFacts();
        if (cancelled) return;
        consecutivePollFailuresRef.current = 0;
        setPollError(null);
        const nextStudents = nextWorkspace.view?.students ?? [];
        const nextShouldPoll =
          nextStudents.some((student) => student.isAiDraftGenerating) ||
          state.pendingAutoSelectStudentIds.some((studentId) => {
            const student = nextStudents.find((item) => item.studentId === studentId);
            return student?.isAiDraftGenerating === true;
          });
        if (nextShouldPoll) scheduleNextPoll();
      } catch (error) {
        if (cancelled) return;
        consecutivePollFailuresRef.current += 1;
        setPollError(resolveStudentEvaluationCommentErrorMessage(error, 'ai'));
        if (consecutivePollFailuresRef.current >= AI_POLL_MAX_CONSECUTIVE_FAILURES) {
          setPollingPaused(true);
          return;
        }
        scheduleNextPoll();
      }
    };

    scheduleNextPoll();

    return () => {
      cancelled = true;
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [
    pollingPaused,
    pollingTimedOut,
    refreshAiFacts,
    shouldPoll,
    state.pendingAutoSelectStudentIds,
  ]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshAiFacts();
      setPollError(null);
      setPollingPaused(false);
      setPollingTimedOut(false);
      consecutivePollFailuresRef.current = 0;
      pollStartedAtRef.current = Date.now();
    } catch (error) {
      setPollError(resolveStudentEvaluationCommentErrorMessage(error, 'ai'));
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshAiFacts]);

  const handleGenerate = useCallback(async () => {
    if (!classId || semesterId === null || selectedTargetStudentIds.length === 0) return;

    setIsGenerating(true);
    setGenerationError(null);
    try {
      const result = await generateStudentEvaluationCommentAiDrafts({
        classId,
        semesterId,
        studentIds: selectedTargetStudentIds,
        styleExampleStudentIds: state.styleExampleStudentIds,
        ...state.options,
      });
      dispatch({ result, type: 'GENERATION_SETTLED' });
      pollStartedAtRef.current = Date.now();
      setPollingPaused(false);
      setPollingTimedOut(false);
      message.success(
        result.counts.accepted > 0
          ? `已受理 ${result.counts.accepted} 名学生，草稿生成完成后会自动刷新。`
          : '本次没有新增 AI 草稿生成任务。',
      );
      await refreshAiFacts();
    } catch (error) {
      setGenerationError(resolveStudentEvaluationCommentErrorMessage(error, 'ai'));
    } finally {
      setIsGenerating(false);
    }
  }, [
    classId,
    message,
    refreshAiFacts,
    selectedTargetStudentIds,
    semesterId,
    state.options,
    state.styleExampleStudentIds,
  ]);

  const handleSaveDraft = useCallback(
    async (student: StudentEvaluationCommentClassScopeStudent) => {
      const edit = editsByStudentId.get(student.studentId);
      if (!edit || semesterId === null) return;
      const validation = resolveStudentEvaluationCommentAiDraftValidation(edit);
      if (validation.isInvalid || edit.isStale) return;

      setSavingDraftIds((current) => [...new Set([...current, edit.draftId])]);
      setDraftErrors((current) => ({ ...current, [edit.draftId]: '' }));
      try {
        const result = await saveStudentEvaluationCommentAiDraft({
          classId,
          content: validation.normalizedContent,
          draftId: edit.draftId,
          expectedRevision: edit.revision,
          semesterId,
        });
        dispatch({ draft: result.draft, studentId: student.studentId, type: 'DRAFT_SAVED' });
        message.success(`${student.studentName}的 AI 草稿已保存。`);
        await refreshAiFacts();
      } catch (error) {
        setDraftErrors((current) => ({
          ...current,
          [edit.draftId]: resolveStudentEvaluationCommentErrorMessage(error, 'ai'),
        }));
      } finally {
        setSavingDraftIds((current) => current.filter((draftId) => draftId !== edit.draftId));
      }
    },
    [classId, editsByStudentId, message, refreshAiFacts, semesterId],
  );

  const selectedEdits = state.selectedDraftIds.flatMap((draftId) => {
    const edit = state.edits[draftId];
    return edit ? [edit] : [];
  });
  const selectedDraftsBlocked = selectedEdits.some((edit) => {
    const validation = resolveStudentEvaluationCommentAiDraftValidation(edit);
    return edit.isDirty || edit.isStale || validation.isInvalid || isExpired(edit.expiresAt);
  });

  const runBatchAction = useCallback(
    async (action: 'confirm' | 'discard') => {
      if (semesterId === null || selectedEdits.length === 0) return;
      if (
        !(await requestAiDraftBatchConfirmation({
          action,
          count: selectedEdits.length,
          modal,
        }))
      ) {
        return;
      }

      const items: StudentEvaluationCommentAiDraftMutationItem[] = selectedEdits.map((edit) => ({
        draftId: edit.draftId,
        expectedRevision: edit.revision,
      }));
      setBatchAction(action);
      try {
        if (action === 'confirm') {
          const result = await confirmStudentEvaluationCommentAiDrafts({
            items,
            scope: { classId, semesterId },
          });
          message.success(`已确认 ${result.confirmedCount} 条正式评语。`);
        } else {
          const result = await discardStudentEvaluationCommentAiDrafts({
            items,
            scope: { classId, semesterId },
          });
          message.success(`已放弃 ${result.discardedCount} 条 AI 草稿。`);
        }
        dispatch({ draftIds: items.map((item) => item.draftId), type: 'DRAFTS_REMOVED' });
        await refreshAiFacts();
      } catch (error) {
        setPollError(resolveStudentEvaluationCommentErrorMessage(error, 'ai'));
        try {
          await refreshAiFacts();
        } catch {
          // Keep the actionable mutation error visible when the recovery read also fails.
        }
      } finally {
        setBatchAction(null);
      }
    },
    [classId, message, modal, refreshAiFacts, selectedEdits, semesterId],
  );

  const generationColumns = useMemo<ColumnsType<StudentEvaluationCommentClassScopeStudent>>(
    () => [
      { dataIndex: 'studentId', title: '学号', width: 130 },
      { dataIndex: 'studentName', title: '姓名', width: 110 },
      {
        dataIndex: 'studentStatus',
        render: (status: string) => <Tag>{formatStudentEvaluationCommentStatus(status)}</Tag>,
        title: '学籍状态',
        width: 100,
      },
      {
        render: (_, student) =>
          renderGenerationStatus({
            blockingReason: generationBlockingReasons.get(student.studentId) ?? null,
            disposition: state.generationDispositions[student.studentId],
          }),
        title: '生成资格 / 结果',
        width: 190,
      },
    ],
    [generationBlockingReasons, state.generationDispositions],
  );
  const generationRowSelection = useMemo<
    TableRowSelection<StudentEvaluationCommentClassScopeStudent>
  >(
    () => ({
      getCheckboxProps: (student) => ({
        disabled: Boolean(generationBlockingReasons.get(student.studentId)),
        title: generationBlockingReasons.get(student.studentId) ?? undefined,
      }),
      onChange: (selectedRowKeys) =>
        dispatch({ studentIds: selectedRowKeys.map(String), type: 'SET_TARGET_STUDENTS' }),
      selectedRowKeys: selectedTargetStudentIds,
    }),
    [generationBlockingReasons, selectedTargetStudentIds],
  );

  const reviewStudents = useMemo(
    () =>
      students.filter(
        (student) =>
          Boolean(student.aiDraft) ||
          student.isAiDraftGenerating ||
          state.noDraftStudentIds.includes(student.studentId) ||
          editsByStudentId.has(student.studentId),
      ),
    [editsByStudentId, state.noDraftStudentIds, students],
  );
  const reviewColumns = useMemo<ColumnsType<StudentEvaluationCommentClassScopeStudent>>(
    () => [
      { dataIndex: 'studentId', title: '学号', width: 130 },
      { dataIndex: 'studentName', title: '姓名', width: 110 },
      {
        render: (_, student) =>
          renderDraftStatus({
            edit: editsByStudentId.get(student.studentId),
            noDraft: state.noDraftStudentIds.includes(student.studentId),
            student,
          }),
        title: '草稿状态',
        width: 120,
      },
      {
        render: (_, student) => {
          const edit = editsByStudentId.get(student.studentId);
          return edit ? (
            <span className="line-clamp-2 whitespace-pre-wrap break-words">{edit.content}</span>
          ) : (
            <span>等待生成结果</span>
          );
        },
        title: '草稿摘要',
        width: 360,
      },
      {
        render: (_, student) => {
          const edit = editsByStudentId.get(student.studentId);
          return edit ? formatStudentEvaluationCommentDateTime(edit.expiresAt) : '—';
        },
        title: '到期时间',
        width: 180,
      },
    ],
    [editsByStudentId, state.noDraftStudentIds],
  );
  const reviewRowSelection = useMemo<TableRowSelection<StudentEvaluationCommentClassScopeStudent>>(
    () => ({
      getCheckboxProps: (student) => {
        const edit = editsByStudentId.get(student.studentId);
        return {
          disabled: !edit || edit.isStale || isExpired(edit.expiresAt),
          title: edit?.isStale ? '草稿状态已变化，请重新加载' : undefined,
        };
      },
      onChange: (_, selectedRows) =>
        dispatch({
          draftIds: selectedRows.flatMap((student) => {
            const edit = editsByStudentId.get(student.studentId);
            return edit ? [edit.draftId] : [];
          }),
          type: 'SET_SELECTED_DRAFTS',
        }),
      selectedRowKeys: reviewStudents.flatMap((student) => {
        const edit = editsByStudentId.get(student.studentId);
        return edit && state.selectedDraftIds.includes(edit.draftId) ? [student.studentId] : [];
      }),
    }),
    [editsByStudentId, reviewStudents, state.selectedDraftIds],
  );

  if (!workspace.view || semesterId === null) {
    return <Alert showIcon title="AI 草稿仅支持已选定真实学期的学期评语。" type="info" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card
        extra={<Tag color={generateAllowed ? 'processing' : undefined}>AI 草稿</Tag>}
        title="生成 AI 评语草稿"
      >
        <div className="flex flex-col gap-4">
          <Alert
            showIcon
            description="系统只为符合条件的目标读取已确认操行依据；生成结果先保存为 7 天有效的加密草稿，不会直接写入正式评语。"
            title="选择目标学生后受理异步生成"
            type="info"
          />
          {!generateAllowed ? (
            <Alert
              showIcon
              title={generateAction?.reasonMessage ?? 'AI 生成功能当前不可用'}
              type="warning"
            />
          ) : null}
          {generationError ? <Alert showIcon title={generationError} type="error" /> : null}

          <Collapse
            items={[
              {
                children: (
                  <ResponsiveGrid className="gap-4" columns={{ compact: 1, regular: 2, wide: 4 }}>
                    <GenerationOption
                      label="语气"
                      options={TONE_OPTIONS}
                      value={state.options.tone}
                      onChange={(tone) => dispatch({ options: { tone }, type: 'SET_OPTIONS' })}
                    />
                    <GenerationOption
                      label="篇幅"
                      options={LENGTH_OPTIONS}
                      value={state.options.length}
                      onChange={(length) => dispatch({ options: { length }, type: 'SET_OPTIONS' })}
                    />
                    <GenerationOption
                      label="称谓"
                      options={ADDRESS_OPTIONS}
                      value={state.options.address}
                      onChange={(address) =>
                        dispatch({ options: { address }, type: 'SET_OPTIONS' })
                      }
                    />
                    <div>
                      <div className="mb-2">正式评语风格样例（最多 5 人）</div>
                      <Select
                        allowClear
                        maxCount={5}
                        mode="multiple"
                        optionFilterProp="label"
                        options={styleExampleOptions}
                        placeholder="可选"
                        style={{ width: '100%' }}
                        value={state.styleExampleStudentIds}
                        onChange={(studentIds) =>
                          dispatch({ studentIds, type: 'SET_STYLE_EXAMPLES' })
                        }
                      />
                    </div>
                  </ResponsiveGrid>
                ),
                key: 'options',
                label: '高级生成设置',
              },
            ]}
          />

          <Space wrap>
            <Button
              disabled={!generateAllowed || availableTargetStudentIds.length === 0}
              onClick={() =>
                dispatch({
                  studentIds: availableTargetStudentIds,
                  type: 'SET_TARGET_STUDENTS',
                })
              }
            >
              全选可生成对象
            </Button>
            <Button
              disabled={selectedTargetStudentIds.length === 0}
              onClick={() => dispatch({ studentIds: [], type: 'SET_TARGET_STUDENTS' })}
            >
              清空选择
            </Button>
            <Tag>{`已选择 ${selectedTargetStudentIds.length} / ${availableTargetStudentIds.length}`}</Tag>
            <Button
              disabled={!generateAllowed || selectedTargetStudentIds.length === 0}
              icon={<RobotOutlined />}
              loading={isGenerating}
              type="primary"
              onClick={() => void handleGenerate()}
            >
              生成所选学生草稿
            </Button>
          </Space>

          <Table
            columns={generationColumns}
            dataSource={students}
            pagination={false}
            rowKey="studentId"
            rowSelection={generationRowSelection}
            scroll={{ x: 720 }}
          />
        </div>
      </Card>

      <Card
        extra={
          <Space wrap>
            {shouldPoll && !pollingPaused && !pollingTimedOut ? (
              <Tag color="processing">自动刷新中</Tag>
            ) : null}
            <Button
              icon={<ReloadOutlined />}
              loading={isRefreshing}
              onClick={() => void handleRefresh()}
            >
              刷新草稿
            </Button>
          </Space>
        }
        title={`AI 草稿审阅（${reviewStudents.length}）`}
      >
        <div className="flex flex-col gap-4">
          {pollError ? <Alert showIcon title={pollError} type="error" /> : null}
          {pollingPaused ? (
            <Alert showIcon title="连续刷新失败，已暂停自动刷新；可手动重试。" type="warning" />
          ) : null}
          {pollingTimedOut ? (
            <Alert
              showIcon
              title="自动刷新已持续 20 分钟并暂停；任务可能仍在后台处理，可手动刷新。"
              type="warning"
            />
          ) : null}
          {state.selectedDraftIds.length > 0 ? (
            <Alert
              showIcon
              action={
                <Space wrap>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={batchAction === 'discard'}
                    onClick={() => void runBatchAction('discard')}
                  >
                    放弃所选草稿
                  </Button>
                  <Button
                    disabled={selectedDraftsBlocked}
                    icon={<CheckOutlined />}
                    loading={batchAction === 'confirm'}
                    type="primary"
                    onClick={() => void runBatchAction('confirm')}
                  >
                    确认写入正式评语
                  </Button>
                </Space>
              }
              description={
                selectedDraftsBlocked
                  ? '所选草稿包含未保存修改、过期或状态冲突；请先保存或重新加载。'
                  : '本轮新到达的草稿会自动选中；写入前仍会进行二次确认。'
              }
              title={`已选择 ${state.selectedDraftIds.length} 条 AI 草稿`}
              type="info"
            />
          ) : null}

          {reviewStudents.length === 0 ? (
            <Empty description="当前范围没有生成中或待确认的 AI 草稿" />
          ) : (
            <Table
              columns={reviewColumns}
              dataSource={reviewStudents}
              expandable={{
                expandedRowRender: (student) => {
                  const edit = editsByStudentId.get(student.studentId);
                  if (!edit) {
                    return (
                      <Alert
                        showIcon
                        title={
                          state.noDraftStudentIds.includes(student.studentId)
                            ? '本次未生成草稿，可重新选择该学生后重试。'
                            : 'AI 正在生成草稿。'
                        }
                        type="info"
                      />
                    );
                  }
                  const validation = resolveStudentEvaluationCommentAiDraftValidation(edit);
                  const serverDraft = student.aiDraft;

                  return (
                    <div className="flex flex-col gap-4 p-4">
                      {edit.isStale ? (
                        <Alert
                          showIcon
                          description="本地文本已保留；重新加载服务端版本会放弃当前未保存修改。"
                          title="草稿状态已变化"
                          type="warning"
                        />
                      ) : null}
                      {draftErrors[edit.draftId] ? (
                        <Alert showIcon title={draftErrors[edit.draftId]} type="error" />
                      ) : null}
                      <Input.TextArea
                        aria-label={`${student.studentName}AI 评语草稿`}
                        autoSize={{ maxRows: 10, minRows: 5 }}
                        disabled={savingDraftIds.includes(edit.draftId)}
                        showCount={{
                          formatter: () => `${validation.codePointLength} / 1000`,
                        }}
                        status={validation.isInvalid ? 'error' : undefined}
                        value={edit.content}
                        onChange={(event) =>
                          dispatch({
                            content: event.target.value,
                            draftId: edit.draftId,
                            type: 'EDIT_DRAFT',
                          })
                        }
                      />
                      <Space wrap>
                        <Button
                          disabled={!serverDraft || !edit.isDirty}
                          onClick={() => {
                            if (!serverDraft) return;
                            dispatch({
                              draft: serverDraft,
                              studentId: student.studentId,
                              type: 'RESET_DRAFT_EDIT',
                            });
                          }}
                        >
                          放弃未保存修改
                        </Button>
                        <Button
                          disabled={!edit.isDirty || edit.isStale || validation.isInvalid}
                          icon={<SaveOutlined />}
                          loading={savingDraftIds.includes(edit.draftId)}
                          type="primary"
                          onClick={() => void handleSaveDraft(student)}
                        >
                          保存 AI 草稿
                        </Button>
                        <span>
                          最近更新：{formatStudentEvaluationCommentDateTime(edit.updatedAt)}
                        </span>
                      </Space>
                    </div>
                  );
                },
                rowExpandable: (student) =>
                  Boolean(editsByStudentId.get(student.studentId)) ||
                  student.isAiDraftGenerating ||
                  state.noDraftStudentIds.includes(student.studentId),
              }}
              pagination={false}
              rowKey="studentId"
              rowSelection={reviewRowSelection}
              scroll={{ x: 980 }}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

function GenerationOption<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  value: T;
}) {
  return (
    <div>
      <div className="mb-2">{label}</div>
      <Select options={[...options]} style={{ width: '100%' }} value={value} onChange={onChange} />
    </div>
  );
}

function renderGenerationStatus(input: {
  blockingReason: string | null;
  disposition?: keyof typeof DISPOSITION_TAG_COLORS;
}) {
  if (input.blockingReason === '已有 AI 草稿' || input.blockingReason === '已有正式评语') {
    return <Tag>{input.blockingReason}</Tag>;
  }
  if (input.disposition) {
    return (
      <Tag color={DISPOSITION_TAG_COLORS[input.disposition]}>
        {resolveStudentEvaluationCommentAiDispositionLabel(input.disposition)}
      </Tag>
    );
  }
  return input.blockingReason ? (
    <Tag>{input.blockingReason}</Tag>
  ) : (
    <Tag color="success">可生成</Tag>
  );
}

const DISPOSITION_TAG_COLORS = {
  ACCEPTED: 'processing',
  ALREADY_GENERATING: 'processing',
  BASIS_MISSING: 'warning',
  DRAFT_EXISTS: 'default',
  FORMAL_COMMENT_EXISTS: 'default',
} as const;

function renderDraftStatus(input: {
  edit?: StudentEvaluationCommentAiDraftEdit;
  noDraft: boolean;
  student: StudentEvaluationCommentClassScopeStudent;
}) {
  if (input.edit?.isStale) return <Tag color="warning">状态冲突</Tag>;
  if (input.edit?.isDirty) return <Tag color="warning">修改未保存</Tag>;
  if (input.edit && isExpired(input.edit.expiresAt)) return <Tag color="error">已过期</Tag>;
  if (input.edit) return <Tag color="success">待确认</Tag>;
  if (input.student.isAiDraftGenerating) return <Tag color="processing">生成中</Tag>;
  if (input.noDraft) return <Tag color="warning">未生成</Tag>;
  return <Tag>无草稿</Tag>;
}

function isExpired(expiresAt: string) {
  const time = new Date(expiresAt).getTime();
  return Number.isNaN(time) || time <= Date.now();
}

function requestAiDraftBatchConfirmation(input: {
  action: 'confirm' | 'discard';
  count: number;
  modal: ReturnType<typeof AntApp.useApp>['modal'];
}) {
  return new Promise<boolean>((resolve) => {
    const isConfirm = input.action === 'confirm';
    input.modal.confirm({
      cancelText: '返回审阅',
      content: isConfirm
        ? `将把所选 ${input.count} 条 AI 草稿原子批量写入正式评语，成功后草稿会被删除。`
        : `将永久删除所选 ${input.count} 条 AI 草稿，删除后无法恢复。`,
      okButtonProps: isConfirm ? undefined : { danger: true },
      okText: isConfirm ? '确认写入正式评语' : '确认放弃草稿',
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
      title: isConfirm ? '确认 AI 草稿为正式评语？' : '放弃所选 AI 草稿？',
    });
  });
}
