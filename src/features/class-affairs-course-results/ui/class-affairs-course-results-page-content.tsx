// src/features/class-affairs-course-results/ui/class-affairs-course-results-page-content.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CloudSyncOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  theme,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { AcademicTermTabs } from '@/entities/academic-semester';
import {
  buildUpstreamLoginCredentialsInitialValues,
  canUseRememberedUpstreamLoginCredentials,
  canUseStoredUpstreamSessionForLockedUser,
  isExpiredUpstreamSessionError,
  type StoredUpstreamSession,
  type UpstreamLoginFormValues,
  UpstreamLoginModal,
  useUpstreamSession,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import {
  buildCourseGradeRefreshRequest,
  type CourseGradeRefreshFeedback,
  type CourseGradeRefreshRequest,
  type CourseGradeRefreshScope,
  resolveCourseGradeRefreshFeedback,
} from '../application/course-grade-refresh';
import {
  type ClassCourseGradeAction,
  type ClassCourseGradeCourseColumn,
  type ClassCourseGradeMatrix,
  type ClassCourseGradeStudentRow,
  type ClassCourseGradeWorkspace,
  getClassCourseGradeWorkspace,
  type ManagedCourseResultRecord,
  refreshClassCourseGrades,
  resolveUpstreamErrorMessage,
} from '../infrastructure/class-affairs-course-results-api';
import {
  COURSE_RESULTS_REASON_LABELS,
  COURSE_RESULTS_STUDENT_STATUS_LABELS,
} from '../lib/result-display';

type CurrentAccount = {
  accountId: number;
  displayName: string;
  lockedUpstreamLoginUserId: string | null;
  staffId: string | null;
};

const STUDENT_NUMBER_COLUMN_WIDTH = 106;
const STUDENT_NAME_COLUMN_WIDTH = 88;
const COURSE_COLUMN_WIDTH = 76;

function findAction(
  workspace: ClassCourseGradeWorkspace | null,
  action: ClassCourseGradeAction['action'],
) {
  return workspace?.actions.find((item) => item.action === action) ?? null;
}

function filterRows(rows: readonly ClassCourseGradeStudentRow[], keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return [...rows];
  return rows.filter(
    (row) =>
      row.studentId.toLowerCase().includes(normalized) ||
      row.studentName.toLowerCase().includes(normalized),
  );
}

function scoreParts(result: ManagedCourseResultRecord) {
  const total = result.totalScore?.trim();
  const periodic = result.periodicFinalTotalScore?.trim();
  if (total && periodic && total !== periodic) return [total, periodic];
  return [total || periodic || '-'];
}

function renderScoreText(value: string) {
  const isFailing = /^-?\d+(?:\.\d+)?$/.test(value) && Number(value) < 60;
  return isFailing ? <span style={{ color: 'var(--ant-color-error)' }}>{value}</span> : value;
}

function renderScoreCell(row: ClassCourseGradeStudentRow, courseKey: string) {
  const results = row.cells.find((cell) => cell.courseKey === courseKey)?.results ?? [];
  if (!results.length) return <span className="text-text-secondary">-</span>;

  return (
    <span>
      {results.map((result, resultIndex) => (
        <span key={`${courseKey}:${resultIndex}`}>
          {resultIndex > 0 ? <span className="text-text-tertiary"> ｜ </span> : null}
          {scoreParts(result).map((part, partIndex) => (
            <span key={`${part}:${partIndex}`}>
              {partIndex > 0 ? <span className="text-text-tertiary"> / </span> : null}
              {renderScoreText(part)}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

function courseColumns(
  columns: readonly ClassCourseGradeCourseColumn[],
  colorText: string,
): ColumnsType<ClassCourseGradeStudentRow> {
  return columns.map((course) => ({
    align: 'center',
    key: course.key,
    render: (_, row) => renderScoreCell(row, course.key),
    title: (
      <Tooltip title={course.teacherName ? `授课教师：${course.teacherName}` : null}>
        <span
          style={{
            color: colorText,
            display: 'block',
            fontSize: 12,
            lineHeight: 1.25,
            whiteSpace: 'normal',
            wordBreak: 'break-all',
          }}
        >
          {course.courseName ?? course.courseId ?? '未命名课程'}
        </span>
      </Tooltip>
    ),
    width: COURSE_COLUMN_WIDTH,
  }));
}

function identityColumns(): ColumnsType<ClassCourseGradeStudentRow> {
  return [
    {
      dataIndex: 'studentId',
      fixed: 'left',
      key: 'studentId',
      title: '学号',
      width: STUDENT_NUMBER_COLUMN_WIDTH,
    },
    {
      dataIndex: 'studentName',
      fixed: 'left',
      key: 'studentName',
      title: '姓名',
      width: STUDENT_NAME_COLUMN_WIDTH,
    },
  ];
}

function buildRegularColumns(
  matrix: ClassCourseGradeMatrix | null,
  colorText: string,
): ColumnsType<ClassCourseGradeStudentRow> {
  return [...identityColumns(), ...courseColumns(matrix?.courseColumns ?? [], colorText)];
}

function buildSpecialColumns(
  matrix: ClassCourseGradeMatrix | null,
  colorText: string,
): ColumnsType<ClassCourseGradeStudentRow> {
  return [
    ...identityColumns(),
    {
      align: 'center',
      key: 'studentStatus',
      render: (_, row) => <Tag>{COURSE_RESULTS_STUDENT_STATUS_LABELS[row.studentStatus]}</Tag>,
      title: '学生状态',
      width: 100,
    },
    {
      align: 'center',
      key: 'decisionReasonCode',
      render: (_, row) => (
        <Tag color="gold">
          {row.decisionReasonCode
            ? COURSE_RESULTS_REASON_LABELS[row.decisionReasonCode]
            : row.rosterEligibilityStatus}
        </Tag>
      ),
      title: '特殊原因',
      width: 140,
    },
    {
      dataIndex: 'specialReasonMessage',
      key: 'specialReasonMessage',
      render: (value: string | null) => value || '该学生按特殊情况展示',
      title: '说明',
      width: 220,
    },
    ...courseColumns(matrix?.courseColumns ?? [], colorText),
  ];
}

function matrixScrollX(matrix: ClassCourseGradeMatrix | null, special: boolean) {
  return (
    STUDENT_NUMBER_COLUMN_WIDTH +
    STUDENT_NAME_COLUMN_WIDTH +
    (special ? 460 : 0) +
    (matrix?.courseColumns.length ?? 0) * COURSE_COLUMN_WIDTH
  );
}

export function ClassAffairsCourseResultsPageContent({
  currentAccount,
}: {
  currentAccount: CurrentAccount;
}) {
  const { token } = theme.useToken();
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const [workspace, setWorkspace] = useState<ClassCourseGradeWorkspace | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [refreshFeedback, setRefreshFeedback] = useState<CourseGradeRefreshFeedback | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [pendingRefreshRequest, setPendingRefreshRequest] =
    useState<CourseGradeRefreshRequest | null>(null);
  const lockedUpstreamLoginUserId = currentAccount.lockedUpstreamLoginUserId?.trim() || null;
  const {
    clear,
    clearRememberedCredentials,
    keepAliveFailure,
    login: loginUpstream,
    persistSessionFromResult,
    rememberedCredentials,
    session: storedSession,
  } = useUpstreamSession({
    account: currentAccount,
    keepAlive: true,
    lockedUserId: lockedUpstreamLoginUserId,
  });
  const hasRememberedCredentials = canUseRememberedUpstreamLoginCredentials({
    lockedUserId: lockedUpstreamLoginUserId,
    rememberedCredentials,
  });
  const selectedRefreshAction = findAction(workspace, 'REFRESH_SELECTED_TERM');
  const allRefreshAction = findAction(workspace, 'REFRESH_ALL_TERMS');
  const regularRows = useMemo(
    () => filterRows(workspace?.view?.regularMatrix.studentRows ?? [], studentSearch),
    [studentSearch, workspace?.view?.regularMatrix.studentRows],
  );
  const specialRows = useMemo(
    () => filterRows(workspace?.view?.specialMatrix.studentRows ?? [], studentSearch),
    [studentSearch, workspace?.view?.specialMatrix.studentRows],
  );
  const regularColumns = useMemo(
    () => buildRegularColumns(workspace?.view?.regularMatrix ?? null, token.colorText),
    [token.colorText, workspace?.view?.regularMatrix],
  );
  const specialColumns = useMemo(
    () => buildSpecialColumns(workspace?.view?.specialMatrix ?? null, token.colorText),
    [token.colorText, workspace?.view?.specialMatrix],
  );

  const loadWorkspace = useCallback(async (input: { classId?: string; semesterId?: number }) => {
    setIsLoading(true);
    setWorkspaceError(null);
    setRefreshFeedback(null);
    try {
      setWorkspace(await getClassCourseGradeWorkspace(input));
    } catch (error) {
      setWorkspaceError(resolveUpstreamErrorMessage(error, '暂时无法读取班级成绩工作台。'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace({});
  }, [loadWorkspace]);

  const runRefresh = useCallback(
    async (session: StoredUpstreamSession, request: CourseGradeRefreshRequest) => {
      setIsRefreshing(true);
      setWorkspaceError(null);
      setRefreshFeedback(null);
      setLoginError(null);
      try {
        const result = await refreshClassCourseGrades({
          classId: request.classId,
          scope: request.scope,
          semesterId: request.mutationSemesterId,
          upstreamSessionToken: session.upstreamSessionToken,
        });
        persistSessionFromResult(session, result);
        setPendingRefreshRequest(null);
        await loadWorkspace({
          classId: request.classId,
          semesterId: request.returnSemesterId ?? undefined,
        });
        setRefreshFeedback(resolveCourseGradeRefreshFeedback(result));
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          clear();
          setPendingRefreshRequest(request);
          setLoginError('智慧校园登录已失效，请重新登录后继续同步成绩。');
          loginForm.setFieldsValue(
            buildUpstreamLoginCredentialsInitialValues({
              fallbackUserId: session.upstreamLoginId,
              lockedUserId: lockedUpstreamLoginUserId,
              rememberedCredentials,
            }),
          );
          setIsLoginModalOpen(true);
          return;
        }
        setWorkspaceError(resolveUpstreamErrorMessage(error, '暂时无法同步成绩。'));
      } finally {
        setIsRefreshing(false);
      }
    },
    [
      clear,
      loadWorkspace,
      lockedUpstreamLoginUserId,
      loginForm,
      persistSessionFromResult,
      rememberedCredentials,
    ],
  );

  const requestRefresh = useCallback(
    async (scope: CourseGradeRefreshScope) => {
      const selectedClass = workspace?.selectedClass;
      const selectedTerm = workspace?.selectedTerm;
      if (!selectedClass || (scope === 'SELECTED_TERM' && !selectedTerm)) return;

      const request = buildCourseGradeRefreshRequest({
        classId: selectedClass.classId,
        scope,
        selectedSemesterId: selectedTerm?.semesterId ?? null,
      });
      setPendingRefreshRequest(request);
      setLoginError(null);

      const canUseStoredSession = canUseStoredUpstreamSessionForLockedUser({
        lockedUserId: lockedUpstreamLoginUserId,
        session: storedSession,
      });
      if (!storedSession || !canUseStoredSession) {
        if (storedSession && !canUseStoredSession) {
          clear();
          setLoginError('请使用当前登录账号对应的工号登录智慧校园。');
        }
        loginForm.setFieldsValue(
          buildUpstreamLoginCredentialsInitialValues({
            lockedUserId: lockedUpstreamLoginUserId,
            rememberedCredentials,
          }),
        );
        setIsLoginModalOpen(true);
        return;
      }
      await runRefresh(storedSession, request);
    },
    [
      clear,
      lockedUpstreamLoginUserId,
      loginForm,
      rememberedCredentials,
      runRefresh,
      storedSession,
      workspace,
    ],
  );

  const handleLoginFinish = useCallback(
    async (values: UpstreamLoginFormValues) => {
      if (!pendingRefreshRequest) {
        setLoginError('同步请求已失效，请重新选择范围。');
        return;
      }
      setIsSubmittingLogin(true);
      setLoginError(null);
      try {
        const nextSession = await loginUpstream(values);
        const request = pendingRefreshRequest;
        setPendingRefreshRequest(null);
        setIsLoginModalOpen(false);
        loginForm.resetFields();
        await runRefresh(nextSession, request);
      } catch (error) {
        setLoginError(resolveUpstreamErrorMessage(error, '暂时无法登录智慧校园。'));
      } finally {
        setIsSubmittingLogin(false);
      }
    },
    [loginForm, loginUpstream, pendingRefreshRequest, runRefresh],
  );

  useEffect(() => {
    if (!keepAliveFailure) return;
    clear();
    setLoginError(keepAliveFailure.message);
    loginForm.setFieldsValue(
      buildUpstreamLoginCredentialsInitialValues({
        fallbackUserId: keepAliveFailure.upstreamLoginId,
        lockedUserId: lockedUpstreamLoginUserId,
        rememberedCredentials,
      }),
    );
    setIsLoginModalOpen(true);
  }, [clear, keepAliveFailure, lockedUpstreamLoginUserId, loginForm, rememberedCredentials]);

  const view = workspace?.view ?? null;
  const isBusy = isLoading || isRefreshing;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-6">
      <DecoratedPageHeader
        badge={<Tag color="blue">班务管理</Tag>}
        description="后端统一计算可操作班级、真实学期、正式名单和课程矩阵；本页只负责选择与渲染。"
        icon={<FileSearchOutlined />}
        title="成绩汇总"
      />

      <section className="rounded-card bg-bg-container p-5 shadow-card">
        <div className="flex flex-col gap-4">
          {workspaceError ? <Alert showIcon title={workspaceError} type="error" /> : null}
          {(workspace?.warnings ?? []).map((warning) => (
            <Alert
              key={`${warning.code}-${warning.schoolYear}-${warning.termNumber}`}
              showIcon
              description={warning.message}
              title={`${warning.schoolYear} 学年第 ${warning.termNumber} 学期配置提醒`}
              type={warning.isCurrent ? 'warning' : 'info'}
            />
          ))}
          {refreshFeedback ? (
            <Alert
              showIcon
              description={
                <div className="flex flex-col gap-2">
                  <span>{refreshFeedback.description}</span>
                  {refreshFeedback.failures.length ? (
                    <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
                      {refreshFeedback.failures.map((failure) => (
                        <li key={`${failure.studentNumber}:${failure.message}`}>
                          {failure.studentNumber}：{failure.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              }
              title={refreshFeedback.title}
              type={refreshFeedback.type}
            />
          ) : null}
          <ResponsiveGrid
            className="gap-4"
            columns={{
              compact: 1,
              regular: 'minmax(0, 320px) minmax(0, 260px) auto',
            }}
          >
            <label className="flex flex-col gap-2">
              <span className="text-sm text-text-secondary">负责班级</span>
              <Select
                disabled={isBusy}
                loading={isLoading}
                optionFilterProp="label"
                options={(workspace?.classOptions ?? []).map((item) => ({
                  label: `${item.className}（${item.classCode}）`,
                  value: item.classId,
                }))}
                placeholder="暂无可操作班级"
                showSearch
                value={workspace?.selectedClass?.classId}
                onChange={(classId) => {
                  setStudentSearch('');
                  void loadWorkspace({ classId });
                }}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-text-secondary">学生</span>
              <Input
                allowClear
                placeholder="输入学号或姓名"
                prefix={<SearchOutlined />}
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
              />
            </label>
            <div className="flex items-end">
              <Button
                disabled={isBusy || !workspace?.selectedClass}
                icon={<ReloadOutlined />}
                onClick={() =>
                  void loadWorkspace({
                    classId: workspace?.selectedClass?.classId,
                    semesterId: workspace?.selectedTerm?.semesterId,
                  })
                }
              >
                重新加载
              </Button>
            </div>
          </ResponsiveGrid>
          <Space wrap>
            <Button
              disabled={isBusy || !selectedRefreshAction?.allowed}
              icon={<CloudSyncOutlined />}
              loading={isRefreshing}
              title={selectedRefreshAction?.reasonMessage ?? undefined}
              type="primary"
              onClick={() => void requestRefresh('SELECTED_TERM')}
            >
              同步当前所选学期
            </Button>
            <Button
              disabled={isBusy || !allRefreshAction?.allowed}
              icon={<CloudSyncOutlined />}
              title={allRefreshAction?.reasonMessage ?? undefined}
              onClick={() => void requestRefresh('ALL_TERMS')}
            >
              同步全部真实学期
            </Button>
            {view ? (
              <span className="text-sm text-text-secondary">
                正式名单 {view.includedRosterCount} 人 · 普通 {view.regularStudentCount} 人 · 特殊{' '}
                {view.specialStudentCount} 人 · 成绩 {view.resultRowCount} 行
              </span>
            ) : null}
          </Space>
          {!selectedRefreshAction?.allowed && selectedRefreshAction?.reasonMessage ? (
            <Alert showIcon title={selectedRefreshAction.reasonMessage} type="warning" />
          ) : null}
        </div>
      </section>

      <section className="class-affairs-course-results-table-shell">
        {isLoading && !workspace ? (
          <div className="flex min-h-80 items-center justify-center">
            <Spin size="large" />
          </div>
        ) : workspace?.termOptions.length ? (
          <AcademicTermTabs
            activeSemesterId={workspace.selectedTerm?.semesterId}
            disabled={isBusy}
            records={workspace.termOptions}
            onChange={(semesterId) => {
              setStudentSearch('');
              void loadWorkspace({
                classId: workspace.selectedClass?.classId,
                semesterId,
              });
            }}
          >
            {isLoading ? (
              <div className="flex min-h-80 items-center justify-center">
                <Spin size="large" />
              </div>
            ) : view ? (
              <div className="flex flex-col gap-5">
                <Table<ClassCourseGradeStudentRow>
                  columns={regularColumns}
                  dataSource={regularRows}
                  locale={{
                    emptyText: (
                      <Empty
                        description="正式名单中暂无匹配学生"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ),
                  }}
                  pagination={{
                    defaultPageSize: 60,
                    pageSizeOptions: [30, 60],
                    showSizeChanger: true,
                  }}
                  rowKey="studentId"
                  scroll={{ x: matrixScrollX(view.regularMatrix, false) }}
                  size="small"
                  tableLayout="fixed"
                />
                {specialRows.length ? (
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="text-base font-medium text-text">特殊情况学生成绩</div>
                      <div className="text-sm text-text-secondary">
                        仅展示后端正式名单候选中，由后端判定为特殊情况的历史成绩。
                      </div>
                    </div>
                    <Table<ClassCourseGradeStudentRow>
                      columns={specialColumns}
                      dataSource={specialRows}
                      pagination={{
                        defaultPageSize: 30,
                        pageSizeOptions: [15, 30],
                        showSizeChanger: true,
                      }}
                      rowKey="studentId"
                      scroll={{ x: matrixScrollX(view.specialMatrix, true) }}
                      size="small"
                      tableLayout="fixed"
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-80 items-center justify-center">
                <Empty description="当前学期暂无成绩" />
              </div>
            )}
          </AcademicTermTabs>
        ) : (
          <div className="flex min-h-80 items-center justify-center">
            <Empty
              description={
                workspace?.status === 'NO_CLASSES' ? '暂无可操作班级' : '暂无可查看真实学期'
              }
            />
          </div>
        )}
      </section>

      <UpstreamLoginModal
        description="同步完成后会重查本地成绩工作台，不在查询过程中访问智慧校园。"
        form={loginForm}
        hasRememberedCredentials={hasRememberedCredentials}
        isSubmitting={isSubmittingLogin}
        loginError={loginError}
        lockedUserId={lockedUpstreamLoginUserId}
        okText="授权并同步"
        open={isLoginModalOpen}
        title="需要登录智慧校园"
        onCancel={() => {
          setIsLoginModalOpen(false);
          setPendingRefreshRequest(null);
          setLoginError(null);
        }}
        onClearRememberedCredentials={clearRememberedCredentials}
        onFinish={handleLoginFinish}
      />
    </div>
  );
}
