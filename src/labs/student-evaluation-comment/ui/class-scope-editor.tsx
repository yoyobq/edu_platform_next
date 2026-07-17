// src/labs/student-evaluation-comment/ui/class-scope-editor.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClearOutlined, CloudUploadOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, App as AntApp, Button, Card, Input, Radio, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useBlocker } from 'react-router';

import { AcademicTermTabs } from '@/entities/academic-semester';

import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import {
  buildStudentEvaluationCommentWriteItems,
  countStudentEvaluationCommentCodePoints,
  resolveStudentEvaluationCommentDraftState,
  STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS,
} from '../application/comment-draft';
import {
  formatStudentEvaluationCommentDateTime,
  formatStudentEvaluationCommentStatus,
  isStudentEvaluationCommentConflict,
  resolveStudentEvaluationCommentErrorMessage,
} from '../application/display';
import {
  batchWriteStudentEvaluationComments,
  getStudentEvaluationCommentWorkspace,
} from '../infrastructure/api';
import type {
  StudentEvaluationCommentClassScopeStudent,
  StudentEvaluationCommentKind,
  StudentEvaluationCommentScopeInput,
  StudentEvaluationCommentWorkspace,
} from '../types';

type ClassScopeEditorProps = {
  onDirtyChange?: (isDirty: boolean) => void;
};

function requestDiscardConfirmation(
  modal: ReturnType<typeof AntApp.useApp>['modal'],
  description = '继续后将放弃当前尚未保存的评语修改。',
) {
  return new Promise<boolean>((resolve) => {
    modal.confirm({
      cancelText: '继续编辑',
      content: description,
      okButtonProps: { danger: true },
      okText: '放弃修改',
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
      title: '存在未保存修改',
    });
  });
}

function useUnsavedCommentProtection(isDirty: boolean) {
  const { modal } = AntApp.useApp();
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    const confirmation = modal.confirm({
      cancelText: '留在当前页',
      content: '离开后将丢失当前尚未保存的评语修改。',
      okButtonProps: { danger: true },
      okText: '离开页面',
      onCancel: () => blocker.reset(),
      onOk: () => blocker.proceed(),
      title: '存在未保存修改',
    });

    return () => confirmation.destroy();
  }, [blocker, modal]);
}

function resolveDraftStatusTag(
  student: StudentEvaluationCommentClassScopeStudent,
  draftContent: string,
) {
  const state = resolveStudentEvaluationCommentDraftState(student, draftContent);
  if (state.isInvalid) return <Tag color="error">超出长度</Tag>;
  if (state.action === 'CLEAR') return <Tag color="warning">待清除</Tag>;
  if (state.action === 'UPSERT') {
    return (
      <Tag color={student.comment ? 'processing' : 'success'}>
        {student.comment ? '待更新' : '待新建'}
      </Tag>
    );
  }
  return <Tag>已同步</Tag>;
}

function findWriteAction(workspace: StudentEvaluationCommentWorkspace | null) {
  return workspace?.actions.find((item) => item.action === 'WRITE_COMMENTS') ?? null;
}

export function StudentEvaluationCommentClassScopeEditor({ onDirtyChange }: ClassScopeEditorProps) {
  const { message, modal } = AntApp.useApp();
  const [workspace, setWorkspace] = useState<StudentEvaluationCommentWorkspace | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const scopeResult = workspace?.view ?? null;
  const draftStates = useMemo(
    () =>
      (scopeResult?.students ?? []).map((student) =>
        resolveStudentEvaluationCommentDraftState(
          student,
          drafts[student.studentId] ?? student.comment?.content ?? '',
        ),
      ),
    [drafts, scopeResult],
  );
  const dirtyCount = draftStates.filter((state) => state.isDirty).length;
  const invalidCount = draftStates.filter((state) => state.isInvalid).length;
  const hasDirtyDrafts = dirtyCount > 0;
  const writeAction = findWriteAction(workspace);

  useUnsavedCommentProtection(hasDirtyDrafts);

  useEffect(() => {
    onDirtyChange?.(hasDirtyDrafts);
  }, [hasDirtyDrafts, onDirtyChange]);

  const replaceWorkspace = useCallback((result: StudentEvaluationCommentWorkspace) => {
    setWorkspace(result);
    setDrafts(
      Object.fromEntries(
        (result.view?.students ?? []).map((student) => [
          student.studentId,
          student.comment?.content ?? '',
        ]),
      ),
    );
    setIsConflict(false);
    setScopeError(null);
  }, []);

  const loadWorkspace = useCallback(
    async (input: {
      classId?: string | null;
      commentKind: StudentEvaluationCommentKind;
      semesterId?: number | null;
    }) => {
      setIsLoading(true);
      setScopeError(null);
      try {
        replaceWorkspace(await getStudentEvaluationCommentWorkspace(input));
        return true;
      } catch (error) {
        setScopeError(resolveStudentEvaluationCommentErrorMessage(error, 'class-scope'));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [replaceWorkspace],
  );

  useEffect(() => {
    void loadWorkspace({ commentKind: 'TERM' });
  }, [loadWorkspace]);

  const changeScope = useCallback(
    async (input: {
      classId?: string | null;
      commentKind: StudentEvaluationCommentKind;
      semesterId?: number | null;
    }) => {
      if (hasDirtyDrafts && !(await requestDiscardConfirmation(modal))) return;
      await loadWorkspace(input);
    },
    [hasDirtyDrafts, loadWorkspace, modal],
  );

  const reloadCurrentWorkspace = useCallback(async () => {
    if (!workspace?.selectedClass) return;
    if (
      hasDirtyDrafts &&
      !(await requestDiscardConfirmation(
        modal,
        isConflict ? '重新加载会使用服务端最新版本，并放弃当前冲突草稿。' : undefined,
      ))
    ) {
      return;
    }
    await loadWorkspace({
      classId: workspace.selectedClass.classId,
      commentKind: workspace.commentKind,
      semesterId: workspace.selectedTerm?.semesterId ?? null,
    });
  }, [hasDirtyDrafts, isConflict, loadWorkspace, modal, workspace]);

  const handleSave = useCallback(async () => {
    if (!scopeResult || !writeAction?.allowed) return;

    let items;
    try {
      items = buildStudentEvaluationCommentWriteItems(scopeResult.students, drafts);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '评语草稿校验失败。');
      return;
    }
    if (!items.length) {
      message.info('当前没有需要保存的修改。');
      return;
    }

    const scope: StudentEvaluationCommentScopeInput = {
      classId: scopeResult.classItem.id,
      commentKind: scopeResult.scope.commentKind,
      semesterId: scopeResult.scope.semesterId,
    };
    setIsSaving(true);
    setScopeError(null);
    setIsConflict(false);
    try {
      const result = await batchWriteStudentEvaluationComments({ items, scope });
      message.success(
        result.status === 'NO_CHANGES'
          ? '服务端确认没有实际变化。'
          : `保存完成：新建 ${result.counts.created}，更新 ${result.counts.updated}，清除 ${result.counts.deleted}。`,
      );
      if (!(await loadWorkspace(scope))) {
        setScopeError('保存已经成功，但最新 revision 读取失败；继续编辑前请重新加载。');
      }
    } catch (error) {
      setIsConflict(isStudentEvaluationCommentConflict(error));
      setScopeError(resolveStudentEvaluationCommentErrorMessage(error, 'save'));
    } finally {
      setIsSaving(false);
    }
  }, [drafts, loadWorkspace, message, scopeResult, writeAction?.allowed]);

  const columns = useMemo<ColumnsType<StudentEvaluationCommentClassScopeStudent>>(
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
        render: (_, student) => {
          const content = drafts[student.studentId] ?? student.comment?.content ?? '';
          const state = resolveStudentEvaluationCommentDraftState(student, content);
          return (
            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
              <Input.TextArea
                aria-label={`${student.studentName}正式评语`}
                autoSize={{ maxRows: 7, minRows: 3 }}
                disabled={isSaving || !writeAction?.allowed}
                placeholder="输入人工正式评语；留空并保存将清除已有评语"
                showCount={{
                  formatter: ({ value }) =>
                    `${countStudentEvaluationCommentCodePoints(value)} / ${STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS}`,
                }}
                status={state.isInvalid ? 'error' : undefined}
                value={content}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [student.studentId]: event.target.value,
                  }))
                }
              />
              <span>
                {student.comment
                  ? `上次更新：${formatStudentEvaluationCommentDateTime(student.comment.updatedAt)}`
                  : '尚未保存正式评语'}
              </span>
            </Space>
          );
        },
        title: '正式评语',
        width: 520,
      },
      {
        align: 'center',
        render: (_, student) =>
          resolveDraftStatusTag(
            student,
            drafts[student.studentId] ?? student.comment?.content ?? '',
          ),
        title: '保存状态',
        width: 100,
      },
      {
        align: 'center',
        render: (_, student) => {
          const content = drafts[student.studentId] ?? student.comment?.content ?? '';
          return (
            <Button
              danger={Boolean(student.comment)}
              disabled={isSaving || !content || !writeAction?.allowed}
              icon={<ClearOutlined />}
              size="small"
              onClick={() => setDrafts((current) => ({ ...current, [student.studentId]: '' }))}
            >
              清空
            </Button>
          );
        },
        title: '操作',
        width: 90,
      },
    ],
    [drafts, isSaving, writeAction?.allowed],
  );

  return (
    <div className="flex flex-col gap-4">
      <Card title="编辑范围">
        <div className="flex flex-col gap-4">
          <Alert
            showIcon
            description="班级、真实学期、默认范围和可执行动作均由后端工作台统一判定。"
            title="每次切换范围都会重新读取工作台"
            type="info"
          />
          {(workspace?.warnings ?? []).map((warning) => (
            <Alert
              key={`${warning.code}-${warning.schoolYear}-${warning.termNumber}`}
              showIcon
              description={warning.message}
              title={`${warning.schoolYear} 学年第 ${warning.termNumber} 学期配置提醒`}
              type={warning.isCurrent ? 'warning' : 'info'}
            />
          ))}
          <ResponsiveGrid className="gap-4" columns={{ compact: 1, regular: 2, wide: 2 }}>
            <div>
              <div className="mb-2">班级</div>
              <div className="w-full">
                <Select
                  disabled={isLoading || isSaving}
                  loading={isLoading}
                  optionFilterProp="label"
                  options={(workspace?.classOptions ?? []).map((option) => ({
                    label: `${option.className} · ${option.classCode}`,
                    value: option.classId,
                  }))}
                  placeholder="暂无可操作班级"
                  showSearch
                  style={{ width: '100%' }}
                  value={workspace?.selectedClass?.classId}
                  onChange={(classId) =>
                    void changeScope({ classId, commentKind: workspace?.commentKind ?? 'TERM' })
                  }
                />
              </div>
            </div>
            <div>
              <div className="mb-2">评语类型</div>
              <Radio.Group
                buttonStyle="solid"
                disabled={isLoading || isSaving || !workspace?.selectedClass}
                optionType="button"
                options={[
                  { label: '学期评语', value: 'TERM' },
                  { label: '毕业评语', value: 'GRADUATION' },
                ]}
                value={workspace?.commentKind ?? 'TERM'}
                onChange={(event) =>
                  void changeScope({
                    classId: workspace?.selectedClass?.classId,
                    commentKind: event.target.value as StudentEvaluationCommentKind,
                  })
                }
              />
            </div>
          </ResponsiveGrid>
          <Button
            disabled={!workspace?.selectedClass}
            icon={<ReloadOutlined />}
            loading={isLoading}
            onClick={() => void reloadCurrentWorkspace()}
          >
            重新加载当前工作台
          </Button>
        </div>
      </Card>

      {scopeError ? (
        <Alert
          showIcon
          action={
            isConflict ? (
              <Button danger onClick={() => void reloadCurrentWorkspace()}>
                重新加载并放弃草稿
              </Button>
            ) : undefined
          }
          description={
            isConflict ? '本地草稿仍然保留；重新加载后以服务端最新 revision 为准。' : undefined
          }
          title={scopeError}
          type="error"
        />
      ) : null}

      {!writeAction?.allowed && writeAction?.reasonMessage ? (
        <Alert showIcon title={writeAction.reasonMessage} type="warning" />
      ) : null}

      {scopeResult ? (
        <AcademicTermTabs
          activeSemesterId={workspace?.selectedTerm?.semesterId}
          disabled={isLoading || isSaving}
          records={workspace?.commentKind === 'TERM' ? workspace.termOptions : []}
          onChange={(semesterId) =>
            void changeScope({
              classId: workspace?.selectedClass?.classId,
              commentKind: 'TERM',
              semesterId,
            })
          }
        >
          <Card
            extra={
              <Space wrap>
                <Tag>{scopeResult.scope.scopeKey}</Tag>
                <Tag color={dirtyCount ? 'warning' : 'success'}>
                  {dirtyCount ? `${dirtyCount} 项未保存` : '全部已同步'}
                </Tag>
                <Button
                  disabled={!dirtyCount || invalidCount > 0 || isLoading || !writeAction?.allowed}
                  icon={<CloudUploadOutlined />}
                  loading={isSaving}
                  type="primary"
                  onClick={() => void handleSave()}
                >
                  {dirtyCount ? `保存 ${dirtyCount}` : '保存'}
                </Button>
              </Space>
            }
            title={`${scopeResult.classItem.className}（${scopeResult.classItem.classCode}）`}
          >
            <div className="flex flex-col gap-4">
              {invalidCount ? (
                <Alert
                  showIcon
                  title={`${invalidCount} 条评语超过 1000 个 Unicode 字符，请修改后保存。`}
                  type="error"
                />
              ) : null}
              <Alert
                showIcon
                description="只提交变化行；更新和清除原样提交读取时的 revision，成功后统一重查工作台。"
                title={
                  scopeResult.scope.commentKind === 'TERM'
                    ? `目标学期正式名单共 ${scopeResult.students.length} 人`
                    : `当前班级活动名单共 ${scopeResult.students.length} 人`
                }
                type="info"
              />
              <Table
                columns={columns}
                dataSource={scopeResult.students}
                loading={isLoading}
                pagination={false}
                rowKey="studentId"
                scroll={{ x: 1050 }}
              />
            </div>
          </Card>
        </AcademicTermTabs>
      ) : null}
    </div>
  );
}
