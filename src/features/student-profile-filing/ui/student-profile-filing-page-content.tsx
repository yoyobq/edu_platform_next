// src/features/student-profile-filing/ui/student-profile-filing-page-content.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CloudSyncOutlined,
  FileDoneOutlined,
  ReloadOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Empty,
  Progress,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  formatUpstreamSessionDateTime,
  isExpiredUpstreamSessionError,
  type StoredUpstreamSession,
  UpstreamLoginModal,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import {
  countStudentProfileFilingCompleteness,
  formatStudentProfileFilingClassLabel,
  isStudentProfileFilingDroppedStudent,
  listMissingStudentProfileFilingCompletenessLabels,
  listStudentProfileFilingRefreshableStudentIds,
  resolveStudentProfileFilingActionIntent,
  STUDENT_PROFILE_FILING_ACTION_LABELS,
  STUDENT_PROFILE_FILING_COMPLETENESS_ITEMS,
  summarizeStudentProfileFilingStudents,
} from '../application/student-profile-filing-view-model';
import {
  getStudentProfileFilingClassOverview,
  listStudentProfileFilingClassOptions,
  refreshStudentProfileFilingClass,
  refreshStudentProfileFilingStudent,
  resolveUpstreamErrorMessage,
  type StudentProfileFilingBatchRefreshItem,
  type StudentProfileFilingClassOption,
  type StudentProfileFilingClassOverview,
  type StudentProfileFilingStudent,
} from '../infrastructure/student-profile-filing-api';

import './student-profile-filing-page-content.css';

type CurrentAccount = {
  accountId: number;
  displayName: string;
  lockedUpstreamLoginUserId: string | null;
  staffId: string | null;
};

export type StudentProfileFilingPageContentProps = {
  currentAccount: CurrentAccount;
};

type PendingFilingAction =
  | {
      classId: string;
      studentId: string;
      type: 'student';
    }
  | {
      classId: string;
      type: 'class';
    };

type UpstreamActionRequest = {
  action: PendingFilingAction;
  session: StoredUpstreamSession;
};

type RefreshDigest = {
  expiresAt: string | null;
  failureCount: number;
  requestedCount: number;
  results: StudentProfileFilingBatchRefreshItem[];
  scopeLabel: string;
  successCount: number;
  traceId: string | null;
};

const COMPACT_WORKBENCH_QUERY = '(max-width: 1120px)';

function useCompactWorkbenchLayout() {
  const [isCompactWorkbenchLayout, setIsCompactWorkbenchLayout] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(COMPACT_WORKBENCH_QUERY).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(COMPACT_WORKBENCH_QUERY);
    const handleChange = () => {
      setIsCompactWorkbenchLayout(mediaQuery.matches);
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return isCompactWorkbenchLayout;
}

function buildRefreshableTooltip(student: StudentProfileFilingStudent) {
  const actionIntent = resolveStudentProfileFilingActionIntent(student);

  if (actionIntent === 'CREATE') {
    return '从学工系统读取资料并建立本地快照';
  }

  if (actionIntent === 'UPDATE') {
    return '从学工系统更新本地资料快照';
  }

  return '缺少学工系统学生关联，无法建档';
}

function buildStudentRefreshDigest(input: {
  changedSections: readonly string[];
  expiresAt: string | null;
  studentId: string;
  success: boolean;
  traceId: string | null;
  warningCodes: readonly string[];
}) {
  return {
    expiresAt: input.expiresAt,
    failureCount: input.success ? 0 : 1,
    requestedCount: 1,
    results: [
      {
        changedSections: [...input.changedSections],
        errorCode: null,
        errorMessage: null,
        snapshotUpdated: input.success,
        status: input.success ? 'SUCCESS' : 'FAILED',
        studentId: input.studentId,
        warningCodes: [...input.warningCodes],
      },
    ],
    scopeLabel: '单人建档',
    successCount: input.success ? 1 : 0,
    traceId: input.traceId,
  };
}

function renderRefreshIssue(result: StudentProfileFilingBatchRefreshItem) {
  if (result.errorMessage) {
    return result.errorMessage;
  }

  if (result.errorCode) {
    return result.errorCode;
  }

  if (result.warningCodes.length > 0) {
    return result.warningCodes.join('、');
  }

  return '无';
}

function formatMissingProfileTagLabel(label: string) {
  return `缺${label}信息`;
}

function formatFilingDateTimeParts(value: string | null | undefined) {
  if (!value) {
    return {
      date: '未建档',
      time: null,
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: value,
      time: null,
    };
  }

  return {
    date: date.toLocaleDateString('zh-CN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
    }),
  };
}

export function StudentProfileFilingPageContent({
  currentAccount,
}: StudentProfileFilingPageContentProps) {
  const { message } = AntApp.useApp();
  const [classOptions, setClassOptions] = useState<StudentProfileFilingClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [overview, setOverview] = useState<StudentProfileFilingClassOverview | null>(null);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [isClassFiling, setIsClassFiling] = useState(false);
  const [filingStudentId, setFilingStudentId] = useState<string | null>(null);
  const [upstreamActionRequest, setUpstreamActionRequest] = useState<UpstreamActionRequest | null>(
    null,
  );
  const [refreshDigest, setRefreshDigest] = useState<RefreshDigest | null>(null);
  const lockedUpstreamLoginUserId = currentAccount.lockedUpstreamLoginUserId;
  const isCompactWorkbenchLayout = useCompactWorkbenchLayout();

  const loadOverview = useCallback(
    async (classId: string) => {
      setIsLoadingOverview(true);

      try {
        const nextOverview = await getStudentProfileFilingClassOverview({ classId });

        setOverview(nextOverview);
      } catch (error) {
        setOverview(null);
        message.error(resolveUpstreamErrorMessage(error, '暂时无法加载班级建档概览。'));
      } finally {
        setIsLoadingOverview(false);
      }
    },
    [message],
  );

  const loadClassOptions = useCallback(
    async (preferredClassId?: string | null) => {
      setIsLoadingClasses(true);

      try {
        const nextClassOptions = [...(await listStudentProfileFilingClassOptions())].sort(
          (left, right) => {
            const gradeCompare = (right.gradeYear ?? -1) - (left.gradeYear ?? -1);

            if (gradeCompare !== 0) {
              return gradeCompare;
            }

            return left.classCode.localeCompare(right.classCode, 'zh-CN', {
              numeric: true,
              sensitivity: 'base',
            });
          },
        );
        const nextClassId =
          nextClassOptions.find((item) => item.id === preferredClassId)?.id ??
          nextClassOptions[0]?.id ??
          null;

        setClassOptions(nextClassOptions);
        setSelectedClassId(nextClassId);

        if (nextClassId) {
          await loadOverview(nextClassId);
        } else {
          setOverview(null);
        }
      } catch (error) {
        setClassOptions([]);
        setSelectedClassId(null);
        setOverview(null);
        message.error(resolveUpstreamErrorMessage(error, '暂时无法加载可建档班级。'));
      } finally {
        setIsLoadingClasses(false);
      }
    },
    [loadOverview, message],
  );

  const handleClassChange = useCallback(
    async (classId: string) => {
      setSelectedClassId(classId);
      setRefreshDigest(null);
      await loadOverview(classId);
    },
    [loadOverview],
  );

  const {
    modalProps: upstreamLoginModalProps,
    openLoginModal,
    openLoginModalForExpiredSession,
    persistSessionFromResult,
    refreshSession,
    session: upstreamSession,
  } = useUpstreamLoginModalController<PendingFilingAction>({
    account: currentAccount,
    keepAlive: true,
    lockedUserId: lockedUpstreamLoginUserId,
    resolveLoginErrorMessage: (error) =>
      resolveUpstreamErrorMessage(error, '学工系统登录失败，请检查账号或密码。'),
    onLoginSuccess: ({ pendingAction, session }) => {
      if (pendingAction) {
        setUpstreamActionRequest({
          action: pendingAction,
          session,
        });
      }
    },
  });

  const runStudentFilingWithSession = useCallback(
    async (
      session: StoredUpstreamSession,
      action: Extract<PendingFilingAction, { type: 'student' }>,
    ) => {
      setFilingStudentId(action.studentId);
      setRefreshDigest(null);

      try {
        const result = await refreshStudentProfileFilingStudent({
          studentId: action.studentId,
          upstreamSessionToken: session.upstreamSessionToken,
        });

        persistSessionFromResult(session, result);
        setRefreshDigest(
          buildStudentRefreshDigest({
            changedSections: result.changedSections,
            expiresAt: result.expiresAt,
            studentId: result.studentId,
            success: result.success,
            traceId: result.traceId,
            warningCodes: result.warnings.map((warning) => warning.code),
          }),
        );
        await loadOverview(action.classId);

        if (result.success) {
          message.success('学生建档快照已更新。');
        } else {
          message.warning('学生建档请求已返回，请检查结果。');
        }
      } finally {
        setFilingStudentId(null);
      }
    },
    [loadOverview, message, persistSessionFromResult],
  );

  const runClassFilingWithSession = useCallback(
    async (
      session: StoredUpstreamSession,
      action: Extract<PendingFilingAction, { type: 'class' }>,
    ) => {
      setIsClassFiling(true);
      setRefreshDigest(null);

      try {
        const result = await refreshStudentProfileFilingClass({
          classId: action.classId,
          upstreamSessionToken: session.upstreamSessionToken,
        });

        persistSessionFromResult(session, result);
        setRefreshDigest({
          expiresAt: result.expiresAt,
          failureCount: result.failureCount,
          requestedCount: result.requestedCount,
          results: result.results,
          scopeLabel: '整班建档',
          successCount: result.successCount,
          traceId: result.traceId,
        });
        await loadOverview(action.classId);

        if (result.failureCount > 0) {
          message.warning('整班建档已完成，部分学生需要检查。');
        } else {
          message.success('整班建档快照已更新。');
        }
      } finally {
        setIsClassFiling(false);
      }
    },
    [loadOverview, message, persistSessionFromResult],
  );

  const executeFilingAction = useCallback(
    async (session: StoredUpstreamSession, action: PendingFilingAction) => {
      const runAction = async (nextSession: StoredUpstreamSession) => {
        if (action.type === 'class') {
          await runClassFilingWithSession(nextSession, action);
          return;
        }

        await runStudentFilingWithSession(nextSession, action);
      };

      try {
        await runAction(session);
      } catch (error) {
        if (!isExpiredUpstreamSessionError(error)) {
          message.error(resolveUpstreamErrorMessage(error, '暂时无法完成学生建档。'));
          return;
        }

        try {
          const refreshedSession = await refreshSession(session);

          await runAction(refreshedSession);
        } catch (refreshError) {
          openLoginModalForExpiredSession({
            loginError: resolveUpstreamErrorMessage(
              refreshError,
              '学工系统会话已失效，请重新登录后继续建档。',
            ),
            pendingAction: action,
            session,
          });
        }
      }
    },
    [
      message,
      openLoginModalForExpiredSession,
      refreshSession,
      runClassFilingWithSession,
      runStudentFilingWithSession,
    ],
  );

  const requestFilingAction = useCallback(
    (action: PendingFilingAction) => {
      if (upstreamSession) {
        void executeFilingAction(upstreamSession, action);
        return;
      }

      openLoginModal({
        fallbackUserId: lockedUpstreamLoginUserId ?? currentAccount.staffId,
        pendingAction: action,
      });
    },
    [
      currentAccount.staffId,
      executeFilingAction,
      lockedUpstreamLoginUserId,
      openLoginModal,
      upstreamSession,
    ],
  );

  useEffect(() => {
    void loadClassOptions(null);
  }, [loadClassOptions]);

  useEffect(() => {
    if (!upstreamActionRequest) {
      return;
    }

    setUpstreamActionRequest(null);
    void executeFilingAction(upstreamActionRequest.session, upstreamActionRequest.action);
  }, [executeFilingAction, upstreamActionRequest]);

  const students = useMemo(() => overview?.students ?? [], [overview?.students]);
  const summary = useMemo(() => summarizeStudentProfileFilingStudents(students), [students]);
  const refreshableStudentIds = useMemo(
    () => listStudentProfileFilingRefreshableStudentIds(students),
    [students],
  );
  const selectOptions = useMemo(
    () =>
      classOptions.map((item) => ({
        label: formatStudentProfileFilingClassLabel(item),
        value: item.id,
      })),
    [classOptions],
  );

  const handleClassFiling = useCallback(() => {
    if (!selectedClassId) {
      message.warning('请先选择班级。');
      return;
    }

    if (refreshableStudentIds.length === 0) {
      message.warning('当前班级没有可建档或可更新的学生。');
      return;
    }

    requestFilingAction({
      classId: selectedClassId,
      type: 'class',
    });
  }, [message, refreshableStudentIds, requestFilingAction, selectedClassId]);

  const classFilingActionLabel = useMemo(() => {
    const updatableCount = summary.filedCount + summary.warningCount;

    if (summary.pendingCount > 0 && updatableCount > 0) {
      return '建档/更新当前班级';
    }

    if (updatableCount > 0) {
      return '更新当前班级';
    }

    return '建档当前班级';
  }, [summary.filedCount, summary.pendingCount, summary.warningCount]);

  const columns = useMemo<ColumnsType<StudentProfileFilingStudent>>(
    () => [
      {
        dataIndex: 'studentName',
        fixed: 'left',
        key: 'student',
        render: (_, record) => (
          <div className="student-profile-filing-student-cell">
            <span className="student-profile-filing-student-name-row">
              <span className="student-profile-filing-student-name">{record.studentName}</span>
              {isStudentProfileFilingDroppedStudent(record) ? (
                <Tag color="volcano">退学</Tag>
              ) : null}
            </span>
            <span className="student-profile-filing-muted">{record.studentId}</span>
          </div>
        ),
        title: '学生',
        width: 120,
      },
      {
        key: 'completeness',
        render: (_, record) => {
          const observedCount = countStudentProfileFilingCompleteness(
            record.profileCompletenessFlags,
          );
          const totalCount = STUDENT_PROFILE_FILING_COMPLETENESS_ITEMS.length;
          const missingLabels = listMissingStudentProfileFilingCompletenessLabels(
            record.profileCompletenessFlags,
          );

          return (
            <Tooltip title={missingLabels.length > 0 ? `缺：${missingLabels.join('、')}` : '完整'}>
              <Progress
                percent={Math.round((observedCount / totalCount) * 100)}
                size="small"
                status={observedCount === totalCount ? 'success' : 'active'}
                format={() => `${observedCount}/${totalCount}`}
              />
            </Tooltip>
          );
        },
        title: '资料进度',
        width: 190,
      },
      {
        key: 'warnings',
        render: (_, record) => {
          const tags = [
            ...(!record.upstreamIdPresent
              ? [
                  {
                    color: 'error',
                    key: 'upstream-id-missing',
                    label: '缺学工关联',
                  },
                ]
              : []),
            ...listMissingStudentProfileFilingCompletenessLabels(
              record.profileCompletenessFlags,
            ).map((label) => ({
              color: 'default',
              key: `missing:${label}`,
              label: formatMissingProfileTagLabel(label),
            })),
            ...(record.manualOverrideActive
              ? [
                  {
                    color: 'warning',
                    key: 'manual-override',
                    label: '人工修正',
                  },
                ]
              : []),
            ...(record.upstreamChangedSinceManualPatch
              ? [
                  {
                    color: 'warning',
                    key: 'upstream-changed',
                    label: '上游已变化',
                  },
                ]
              : []),
            ...record.warningCodes.map((code) => ({
              color: 'warning',
              key: `warning:${code}`,
              label: code,
            })),
          ];

          if (tags.length === 0) {
            return <span className="student-profile-filing-muted">无</span>;
          }

          return (
            <Space size={[4, 4]} wrap>
              {tags.map((tag) => (
                <Tag color={tag.color} key={tag.key}>
                  {tag.label}
                </Tag>
              ))}
            </Space>
          );
        },
        title: '提醒',
        width: 300,
      },
      {
        dataIndex: 'lastSyncedAt',
        key: 'lastSyncedAt',
        render: (value: string | null) => {
          const display = formatFilingDateTimeParts(value);

          return (
            <span className="student-profile-filing-date-cell">
              <span className="student-profile-filing-date">{display.date}</span>
              {display.time ? (
                <span className="student-profile-filing-time">{display.time}</span>
              ) : null}
            </span>
          );
        },
        title: '最近建档',
        width: 108,
      },
      {
        fixed: 'right',
        key: 'actions',
        render: (_, record) => {
          const actionIntent = resolveStudentProfileFilingActionIntent(record);

          return (
            <Tooltip title={buildRefreshableTooltip(record)}>
              <Button
                disabled={
                  actionIntent === 'UNAVAILABLE' ||
                  isClassFiling ||
                  (filingStudentId !== null && filingStudentId !== record.studentId)
                }
                icon={<CloudSyncOutlined />}
                loading={filingStudentId === record.studentId}
                size="small"
                onClick={() =>
                  requestFilingAction({
                    classId: overview?.classId ?? selectedClassId ?? '',
                    studentId: record.studentId,
                    type: 'student',
                  })
                }
              >
                {STUDENT_PROFILE_FILING_ACTION_LABELS[actionIntent]}
              </Button>
            </Tooltip>
          );
        },
        title: '操作',
        width: 122,
      },
    ],
    [filingStudentId, isClassFiling, overview?.classId, requestFilingAction, selectedClassId],
  );

  return (
    <div className="student-profile-filing-page">
      <DecoratedPageHeader
        description="同步学生基础资料快照，保证后续业务能基于本地建档数据继续流转。"
        icon={<FileDoneOutlined />}
        title="学生建档"
      />

      <Card>
        <div className="student-profile-filing-toolbar">
          <div className="student-profile-filing-toolbar-main">
            <div className="student-profile-filing-class-select">
              <Select
                disabled={isLoadingClasses || isClassFiling}
                loading={isLoadingClasses}
                options={selectOptions}
                placeholder="选择班级"
                showSearch
                value={selectedClassId}
                optionFilterProp="label"
                onChange={(value) => {
                  void handleClassChange(value);
                }}
              />
            </div>
            <Button
              disabled={!selectedClassId || isClassFiling}
              icon={<ReloadOutlined />}
              loading={isLoadingOverview}
              onClick={() => {
                if (selectedClassId) {
                  void loadOverview(selectedClassId);
                }
              }}
            >
              刷新概览
            </Button>
          </div>
          <Button
            disabled={!selectedClassId || isLoadingOverview || refreshableStudentIds.length === 0}
            icon={<SolutionOutlined />}
            loading={isClassFiling}
            type="primary"
            onClick={handleClassFiling}
          >
            {classFilingActionLabel}
          </Button>
        </div>
      </Card>

      {refreshDigest ? (
        <Alert
          showIcon
          description={`成功 ${refreshDigest.successCount}，失败 ${
            refreshDigest.failureCount
          }，会话有效期 ${formatUpstreamSessionDateTime(refreshDigest.expiresAt)}。`}
          message={`${refreshDigest.scopeLabel}完成，共 ${refreshDigest.requestedCount} 人`}
          type={refreshDigest.failureCount > 0 ? 'warning' : 'success'}
        />
      ) : null}

      <section className="student-profile-filing-workbench-section">
        <div
          className={
            isCompactWorkbenchLayout
              ? 'student-profile-filing-workbench student-profile-filing-workbench-compact'
              : 'student-profile-filing-workbench'
          }
        >
          <div className="student-profile-filing-table-pane">
            <Table<StudentProfileFilingStudent>
              columns={columns}
              dataSource={students}
              loading={isLoadingOverview}
              pagination={{
                defaultPageSize: 30,
                pageSizeOptions: [30, 60],
                showSizeChanger: true,
              }}
              rowKey="studentId"
              scroll={{ x: 820 }}
              size="middle"
              summary={() =>
                refreshDigest && refreshDigest.failureCount > 0 ? (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell colSpan={5} index={0}>
                        <Space size={[8, 8]} wrap>
                          {refreshDigest.results
                            .filter((result) => result.status !== 'SUCCESS')
                            .slice(0, 6)
                            .map((result) => (
                              <Tag color="warning" key={result.studentId}>
                                {result.studentId}: {renderRefreshIssue(result)}
                              </Tag>
                            ))}
                        </Space>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                ) : null
              }
            />
          </div>

          <aside className="student-profile-filing-summary-pane" aria-label="班级建档概览">
            <div className="student-profile-filing-summary-title">建档概览</div>
            <Spin spinning={isLoadingOverview}>
              {overview ? (
                <div className="student-profile-filing-stats">
                  <div className="student-profile-filing-stat-item">
                    <Statistic title="学生数" value={summary.totalCount} />
                  </div>
                  <div className="student-profile-filing-stat-item">
                    <Statistic title="已建档" value={summary.filedCount} />
                  </div>
                  <div className="student-profile-filing-stat-item">
                    <Statistic title="待建档" value={summary.pendingCount} />
                  </div>
                  <div className="student-profile-filing-stat-item">
                    <Statistic title="需关注" value={summary.warningCount} />
                  </div>
                  <div className="student-profile-filing-stat-item">
                    <Statistic title="缺学工关联" value={summary.blockedCount} />
                  </div>
                  <div className="student-profile-filing-stat-item">
                    <Statistic title="可更新" value={summary.refreshableCount} />
                  </div>
                </div>
              ) : (
                <Empty description="暂无概览" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Spin>
          </aside>
        </div>
      </section>

      <UpstreamLoginModal
        description="学生建档需要读取学工系统资料，授权后会写入本地基础资料快照。"
        okText="授权并建档"
        title="登录学工系统"
        {...upstreamLoginModalProps}
      />
    </div>
  );
}
