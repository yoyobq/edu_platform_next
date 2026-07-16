// src/labs/student-evaluation-comment/ui/class-scope-editor.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClearOutlined,
  CloudUploadOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntApp,
  AutoComplete,
  Button,
  Card,
  Form,
  Input,
  Radio,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useBlocker } from 'react-router';

import {
  AcademicSemesterSelect,
  pickAcademicSemesterId,
  sortAcademicSemestersForDisplay,
} from '@/entities/academic-semester';

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
  getStudentEvaluationCommentClassScope,
  listStudentEvaluationCommentClassOptions,
  listStudentEvaluationCommentSemesters,
} from '../infrastructure/api';
import type {
  StudentEvaluationCommentClassOption,
  StudentEvaluationCommentClassOptionSource,
  StudentEvaluationCommentClassScope,
  StudentEvaluationCommentClassScopeStudent,
  StudentEvaluationCommentKind,
  StudentEvaluationCommentScopeInput,
  StudentEvaluationCommentSemester,
} from '../types';

type ClassScopeEditorProps = {
  classOptionSource: StudentEvaluationCommentClassOptionSource;
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
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      return;
    }

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

function formatClassOptionLabel(option: StudentEvaluationCommentClassOption) {
  const code = option.classCode ? ` · ${option.classCode}` : '';
  return `${option.className}${code} · ${option.id}`;
}

function resolveClassOptionHelp(source: StudentEvaluationCommentClassOptionSource) {
  if (source === 'ALL') {
    return '可搜索本地班级，也可直接输入 classId。最终权限以后端 active 任职事实为准。';
  }

  if (source === 'MANAGED') {
    return '候选项来自本人班主任班级；辅导员范围仍可直接输入 classId。';
  }

  return '当前没有覆盖辅导员任职的班级候选接口，请直接输入本地 classId。';
}

function resolveDraftStatusTag(
  student: StudentEvaluationCommentClassScopeStudent,
  draftContent: string,
) {
  const state = resolveStudentEvaluationCommentDraftState(student, draftContent);

  if (state.isInvalid) {
    return <Tag color="error">超出长度</Tag>;
  }

  if (state.action === 'CLEAR') {
    return <Tag color="warning">待清除</Tag>;
  }

  if (state.action === 'UPSERT') {
    return (
      <Tag color={student.comment ? 'processing' : 'success'}>
        {student.comment ? '待更新' : '待新建'}
      </Tag>
    );
  }

  return <Tag>已同步</Tag>;
}

export function StudentEvaluationCommentClassScopeEditor({
  classOptionSource,
  onDirtyChange,
}: ClassScopeEditorProps) {
  const { message, modal } = AntApp.useApp();
  const [classId, setClassId] = useState('');
  const [classSearchKeyword, setClassSearchKeyword] = useState('');
  const [commentKind, setCommentKind] = useState<StudentEvaluationCommentKind>('TERM');
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const [classOptions, setClassOptions] = useState<StudentEvaluationCommentClassOption[]>([]);
  const [semesters, setSemesters] = useState<StudentEvaluationCommentSemester[]>([]);
  const [classOptionsError, setClassOptionsError] = useState<string | null>(null);
  const [semestersError, setSemestersError] = useState<string | null>(null);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState(false);
  const [isLoadingClassOptions, setIsLoadingClassOptions] = useState(false);
  const [isLoadingSemesters, setIsLoadingSemesters] = useState(false);
  const [isLoadingScope, setIsLoadingScope] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scopeResult, setScopeResult] = useState<StudentEvaluationCommentClassScope | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const classOptionsRequestIdRef = useRef(0);

  const sortedSemesters = useMemo(() => sortAcademicSemestersForDisplay(semesters), [semesters]);

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
  const hasPendingScopeSelection = Boolean(
    scopeResult &&
    (classId.trim() !== scopeResult.classItem.id ||
      commentKind !== scopeResult.scope.commentKind ||
      (commentKind === 'TERM' ? semesterId : null) !== scopeResult.scope.semesterId),
  );

  useUnsavedCommentProtection(hasDirtyDrafts);

  useEffect(() => {
    onDirtyChange?.(hasDirtyDrafts);
  }, [hasDirtyDrafts, onDirtyChange]);

  useEffect(() => {
    const requestId = ++classOptionsRequestIdRef.current;

    if (classOptionSource === 'MANUAL') {
      return;
    }

    const timeout = window.setTimeout(
      () => {
        setIsLoadingClassOptions(true);
        setClassOptionsError(null);

        void listStudentEvaluationCommentClassOptions(classOptionSource, classSearchKeyword)
          .then((items) => {
            if (classOptionsRequestIdRef.current === requestId) {
              setClassOptions(items);
            }
          })
          .catch((error) => {
            if (classOptionsRequestIdRef.current === requestId) {
              setClassOptions([]);
              setClassOptionsError(resolveStudentEvaluationCommentErrorMessage(error, 'options'));
            }
          })
          .finally(() => {
            if (classOptionsRequestIdRef.current === requestId) {
              setIsLoadingClassOptions(false);
            }
          });
      },
      classOptionSource === 'ALL' ? 250 : 0,
    );

    return () => window.clearTimeout(timeout);
  }, [classOptionSource, classSearchKeyword]);

  useEffect(() => {
    setIsLoadingSemesters(true);
    setSemestersError(null);

    void listStudentEvaluationCommentSemesters()
      .then((items) => {
        setSemesters(items);
        setSemesterId((current) => pickAcademicSemesterId(items, current));
      })
      .catch((error) => {
        setSemesters([]);
        setSemestersError(resolveStudentEvaluationCommentErrorMessage(error, 'options'));
      })
      .finally(() => setIsLoadingSemesters(false));
  }, []);

  const replaceScopeResult = useCallback((result: StudentEvaluationCommentClassScope) => {
    setScopeResult(result);
    setDrafts(
      Object.fromEntries(
        result.students.map((student) => [student.studentId, student.comment?.content ?? '']),
      ),
    );
    setClassId(result.classItem.id);
    setCommentKind(result.scope.commentKind);
    setSemesterId(result.scope.semesterId);
    setIsConflict(false);
    setScopeError(null);
  }, []);

  const readScope = useCallback(
    async (input: StudentEvaluationCommentScopeInput) => {
      setIsLoadingScope(true);
      setScopeError(null);

      try {
        replaceScopeResult(await getStudentEvaluationCommentClassScope(input));
        return true;
      } catch (error) {
        setScopeError(resolveStudentEvaluationCommentErrorMessage(error, 'class-scope'));
        return false;
      } finally {
        setIsLoadingScope(false);
      }
    },
    [replaceScopeResult],
  );

  const buildSelectedScopeInput = useCallback((): StudentEvaluationCommentScopeInput | null => {
    const normalizedClassId = classId.trim();

    if (!normalizedClassId) {
      message.warning('请先选择或输入班级 classId。');
      return null;
    }

    if (normalizedClassId.length > 8) {
      message.warning('班级 classId 最长为 8 个字符。');
      return null;
    }

    if (commentKind === 'TERM' && !semesterId) {
      message.warning('学期评语必须选择本地学期。');
      return null;
    }

    return {
      classId: normalizedClassId,
      commentKind,
      semesterId: commentKind === 'TERM' ? semesterId : null,
    };
  }, [classId, commentKind, message, semesterId]);

  const handleLoadScope = useCallback(async () => {
    const input = buildSelectedScopeInput();

    if (!input) {
      return;
    }

    if (hasDirtyDrafts && !(await requestDiscardConfirmation(modal))) {
      return;
    }

    await readScope(input);
  }, [buildSelectedScopeInput, hasDirtyDrafts, modal, readScope]);

  const handleReloadScope = useCallback(async () => {
    if (!scopeResult) {
      return;
    }

    if (
      hasDirtyDrafts &&
      !(await requestDiscardConfirmation(
        modal,
        isConflict ? '重新加载会使用服务端最新版本，并放弃当前冲突草稿。' : undefined,
      ))
    ) {
      return;
    }

    await readScope({
      classId: scopeResult.classItem.id,
      commentKind: scopeResult.scope.commentKind,
      semesterId: scopeResult.scope.semesterId,
    });
  }, [hasDirtyDrafts, isConflict, modal, readScope, scopeResult]);

  const handleSave = useCallback(async () => {
    if (!scopeResult) {
      return;
    }

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

    const scope = {
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

      if (!(await readScope(scope))) {
        setScopeError('保存已经成功，但最新 revision 读取失败；继续编辑前请重新加载。');
      }
    } catch (error) {
      const conflict = isStudentEvaluationCommentConflict(error);
      setIsConflict(conflict);
      setScopeError(resolveStudentEvaluationCommentErrorMessage(error, 'save'));
    } finally {
      setIsSaving(false);
    }
  }, [drafts, message, readScope, scopeResult]);

  const columns = useMemo<ColumnsType<StudentEvaluationCommentClassScopeStudent>>(
    () => [
      {
        dataIndex: 'studentId',
        title: '学号',
        width: 130,
      },
      {
        dataIndex: 'studentName',
        title: '姓名',
        width: 110,
      },
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
                disabled={isSaving}
                placeholder="输入人工正式评语；留空并保存将清除已有评语"
                showCount={{
                  formatter: ({ value }) =>
                    `${countStudentEvaluationCommentCodePoints(value)} / ${STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS}`,
                }}
                status={state.isInvalid ? 'error' : undefined}
                value={content}
                onChange={(event) => {
                  const nextContent = event.target.value;
                  setDrafts((current) => ({
                    ...current,
                    [student.studentId]: nextContent,
                  }));
                }}
              />
              {student.comment ? (
                <span>
                  上次更新：{formatStudentEvaluationCommentDateTime(student.comment.updatedAt)}
                </span>
              ) : (
                <span>尚未保存正式评语</span>
              )}
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
              disabled={isSaving || !content}
              icon={<ClearOutlined />}
              size="small"
              onClick={() => {
                setDrafts((current) => ({
                  ...current,
                  [student.studentId]: '',
                }));
              }}
            >
              清空
            </Button>
          );
        },
        title: '操作',
        width: 90,
      },
    ],
    [drafts, isSaving],
  );

  return (
    <div className="flex flex-col gap-4">
      <Card title="编辑范围">
        <div className="flex flex-col gap-4">
          <Alert
            showIcon
            description={resolveClassOptionHelp(classOptionSource)}
            title="每次只读取并保存一个班级、一个评语类型和一个学期范围。"
            type={classOptionSource === 'MANUAL' ? 'warning' : 'info'}
          />
          {classOptionsError ? (
            <Alert
              showIcon
              description="候选项失败不影响直接输入本地 classId。"
              title={classOptionsError}
              type="warning"
            />
          ) : null}
          {semestersError ? <Alert showIcon title={semestersError} type="warning" /> : null}

          <Form layout="vertical" requiredMark={false} onFinish={() => void handleLoadScope()}>
            <ResponsiveGrid className="gap-4" columns={{ compact: 1, regular: 2, wide: 3 }}>
              <Form.Item help={resolveClassOptionHelp(classOptionSource)} label="班级" required>
                <AutoComplete
                  allowClear
                  disabled={isLoadingScope || isSaving}
                  filterOption={classOptionSource === 'MANAGED'}
                  notFoundContent={isLoadingClassOptions ? '正在加载班级候选' : undefined}
                  options={classOptions.map((option) => ({
                    label: formatClassOptionLabel(option),
                    value: option.id,
                  }))}
                  placeholder="选择班级或输入 classId"
                  value={classId}
                  onChange={(value) => {
                    setClassId(value);
                    if (classOptionSource === 'ALL') {
                      setClassSearchKeyword(value);
                    }
                  }}
                />
              </Form.Item>

              <Form.Item label="评语类型" required>
                <Radio.Group
                  buttonStyle="solid"
                  disabled={isLoadingScope || isSaving}
                  optionType="button"
                  options={[
                    { label: '学期评语', value: 'TERM' },
                    { label: '毕业评语', value: 'GRADUATION' },
                  ]}
                  value={commentKind}
                  onChange={(event) =>
                    setCommentKind(event.target.value as StudentEvaluationCommentKind)
                  }
                />
              </Form.Item>

              {commentKind === 'TERM' ? (
                <Form.Item label="学期" required>
                  <AcademicSemesterSelect
                    disabled={isLoadingSemesters || isLoadingScope || isSaving}
                    loading={isLoadingSemesters}
                    records={sortedSemesters}
                    value={semesterId ?? undefined}
                    onChange={(value) => setSemesterId(value)}
                  />
                </Form.Item>
              ) : null}
            </ResponsiveGrid>

            <Space wrap>
              <Button
                htmlType="submit"
                icon={<SearchOutlined />}
                loading={isLoadingScope}
                type="primary"
              >
                读取班级评语
              </Button>
              {scopeResult ? (
                <Button
                  icon={<ReloadOutlined />}
                  loading={isLoadingScope}
                  onClick={() => void handleReloadScope()}
                >
                  重新加载当前范围
                </Button>
              ) : null}
            </Space>
          </Form>
        </div>
      </Card>

      {scopeError ? (
        <Alert
          showIcon
          action={
            isConflict ? (
              <Button danger onClick={() => void handleReloadScope()}>
                重新加载并放弃草稿
              </Button>
            ) : undefined
          }
          description={
            isConflict
              ? '本地草稿仍然保留；重新加载后将以服务端最新正文和 revision 为准。'
              : undefined
          }
          title={scopeError}
          type="error"
        />
      ) : null}

      {hasPendingScopeSelection ? (
        <Alert
          showIcon
          description="下方表格和保存按钮仍属于上一次已读取范围；点击“读取班级评语”后才会切换。"
          title="筛选条件已改变"
          type="warning"
        />
      ) : null}

      {scopeResult ? (
        <Card
          extra={
            <Space wrap>
              <Tag>{scopeResult.scope.scopeKey}</Tag>
              <Tag color={dirtyCount ? 'warning' : 'success'}>
                {dirtyCount ? `${dirtyCount} 项未保存` : '全部已同步'}
              </Tag>
              <Button
                disabled={!dirtyCount || invalidCount > 0 || isLoadingScope}
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
              description="只会提交发生变化的行；新建使用空 revision，更新或清除会原样提交读取时的 revision。保存成功后自动重新读取。"
              title={`当前活动名单共 ${scopeResult.students.length} 人`}
              type="info"
            />
            <Table
              columns={columns}
              dataSource={scopeResult.students}
              loading={isLoadingScope}
              pagination={false}
              rowKey="studentId"
              scroll={{ x: 1050 }}
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
