// src/labs/student-conduct-grade-governance/page.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AuditOutlined,
  ClearOutlined,
  CloudSyncOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLoaderData } from 'react-router';

import type { AcademicSemesterRecord } from '@/entities/academic-semester';
import {
  type StoredUpstreamSession,
  UpstreamLoginModal,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import { studentConductGradeGovernanceLabAccess } from './access';
import {
  cleanupStudentConductGradeCorrection,
  fetchStudentConductGradeEffectiveView,
  fetchStudentPrivateProfileClassOverview,
  isExpiredUpstreamSessionError,
  listStudentPrivateProfileClassOptions,
  refreshStudentConductGradeClassFromUpstream,
  type RefreshStudentConductGradeClassResult,
  requestAcademicSemesters,
  resolveUpstreamErrorMessage,
  type StudentConductGradeEffectiveView,
  type StudentConductGradeFieldCell,
  type StudentConductGradeStudent,
  type StudentPrivateProfileClassOption,
  type StudentPrivateProfileClassOverview,
} from './api';
import { studentConductGradeGovernanceLabMeta } from './meta';

type StudentConductGradeGovernanceLabLoaderData = {
  currentAccount: {
    accountId: number;
    displayName: string;
    lockedUpstreamLoginUserId: string | null;
  };
};

type OverviewReadiness = {
  missingSnapshotCount: number;
  upstreamIdMissingCount: number;
};

type PendingConductSyncRequest = {
  classOption: StudentPrivateProfileClassOption;
  scope: 'ALL_TERMS' | 'TERM';
  semester?: AcademicSemesterRecord;
};

type UpstreamActionRequest = {
  action: PendingConductSyncRequest;
  session: StoredUpstreamSession;
};

const STATUS_LABELS: Record<string, string> = {
  CORRECTION_CLEANUP_PENDING: '补正待清理',
  LOCAL_CORRECTION: '本地补正',
  MISSING: '缺失',
  UPSTREAM_CHANGED_SINCE_CORRECTION: '基线变化待复核',
  UPSTREAM_CONFIRMED: '校园网',
};

const STATUS_PRIORITY: Record<string, number> = {
  CORRECTION_CLEANUP_PENDING: 10,
  UPSTREAM_CHANGED_SINCE_CORRECTION: 20,
  MISSING: 30,
  LOCAL_CORRECTION: 40,
  UPSTREAM_CONFIRMED: 50,
};

function compareTextValue(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? '').localeCompare(b ?? '', 'zh-CN', {
    numeric: true,
    sensitivity: 'base',
  });
}

function formatSchoolYear(value: string | number) {
  const text = String(value);

  if (/^\d{4}$/.test(text)) {
    const startYear = Number(text);
    const endYearSuffix = String((startYear + 1) % 100).padStart(2, '0');

    return `${text.slice(-2)}-${endYearSuffix}学年`;
  }

  return `${text} 学年`;
}

function formatSemester(value: string | number) {
  const text = String(value);

  if (text === '1') {
    return '第一学期';
  }

  if (text === '2') {
    return '第二学期';
  }

  return `第 ${text} 学期`;
}

function buildTermKey(semester: Pick<AcademicSemesterRecord, 'schoolYear' | 'termNumber'>) {
  return `${semester.schoolYear}::${semester.termNumber}`;
}

function sortAcademicSemesters(semesters: readonly AcademicSemesterRecord[]) {
  return [...semesters].sort(
    (first, second) =>
      second.schoolYear - first.schoolYear ||
      second.termNumber - first.termNumber ||
      second.sortOrder - first.sortOrder,
  );
}

function resolveDefaultTermKey(semesters: readonly AcademicSemesterRecord[]) {
  const defaultSemester = semesters.find((semester) => semester.isCurrent) ?? semesters[0] ?? null;

  return defaultSemester ? buildTermKey(defaultSemester) : null;
}

function formatClassLabel(option: StudentPrivateProfileClassOption) {
  return `${option.className || option.classCode}（${option.classCode}）`;
}

function sortClassOptions(options: readonly StudentPrivateProfileClassOption[]) {
  return [...options].sort(
    (first, second) =>
      compareTextValue(second.classCode, first.classCode) ||
      compareTextValue(first.className, second.className),
  );
}

function resolveOverviewReadiness(
  overview: StudentPrivateProfileClassOverview | null,
): OverviewReadiness {
  return {
    missingSnapshotCount:
      overview?.students.filter((student) => !student.snapshotPresent).length ?? 0,
    upstreamIdMissingCount:
      overview?.students.filter((student) => !student.upstreamIdPresent).length ?? 0,
  };
}

function resolveStatusLabel(status: string | null | undefined) {
  if (!status) {
    return '未知';
  }

  return STATUS_LABELS[status] ?? status;
}

function resolveStatusColor(status: string | null | undefined) {
  if (status === 'CORRECTION_CLEANUP_PENDING') {
    return 'gold';
  }

  if (status === 'UPSTREAM_CHANGED_SINCE_CORRECTION') {
    return 'orange';
  }

  if (status === 'LOCAL_CORRECTION') {
    return 'blue';
  }

  if (status === 'UPSTREAM_CONFIRMED') {
    return 'green';
  }

  if (status === 'MISSING') {
    return 'default';
  }

  return 'default';
}

function renderStatusTag(status: string | null | undefined) {
  return <Tag color={resolveStatusColor(status)}>{resolveStatusLabel(status)}</Tag>;
}

function renderStudentStatusTag(status: string | null | undefined) {
  return status ? <Tag>{status}</Tag> : <span className="text-text-secondary">-</span>;
}

function renderStableTextCell(value: string | null | undefined) {
  if (!value) {
    return <span className="text-text-secondary">-</span>;
  }

  return (
    <span
      title={value}
      style={{
        display: 'block',
        fontVariantNumeric: 'tabular-nums',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '100%',
      }}
    >
      {value}
    </span>
  );
}

function formatFieldValue(cell: StudentConductGradeFieldCell) {
  const value = cell.displayValue ?? cell.value;

  if (value === null) {
    return '-';
  }

  const text = String(value).trim();

  return text || '-';
}

function renderFieldCell(cell: StudentConductGradeFieldCell) {
  return <span>{formatFieldValue(cell)}</span>;
}

function filterConductStudents(
  students: readonly StudentConductGradeStudent[],
  input: {
    keyword: string;
    status: string;
  },
) {
  const keyword = input.keyword.trim().toLowerCase();

  return students
    .filter((student) => {
      if (input.status !== 'ALL' && student.status !== input.status) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return (
        student.studentId.toLowerCase().includes(keyword) ||
        (student.studentName?.toLowerCase() ?? '').includes(keyword)
      );
    })
    .sort(
      (first, second) =>
        (STATUS_PRIORITY[first.status] ?? 90) - (STATUS_PRIORITY[second.status] ?? 90) ||
        compareTextValue(first.studentId, second.studentId),
    );
}

function buildStatusOptions(students: readonly StudentConductGradeStudent[]) {
  const statuses = Array.from(new Set(students.map((student) => student.status))).sort(
    (first, second) =>
      (STATUS_PRIORITY[first] ?? 90) - (STATUS_PRIORITY[second] ?? 90) ||
      compareTextValue(first, second),
  );

  return [
    {
      label: '全部状态',
      value: 'ALL',
    },
    ...statuses.map((status) => ({
      label: resolveStatusLabel(status),
      value: status,
    })),
  ];
}

function buildSummaryItems(view: StudentConductGradeEffectiveView | null) {
  const summary = view?.summary;

  return [
    {
      label: '校园网',
      value: summary?.upstreamConfirmedCount ?? 0,
    },
    {
      label: '本地补正',
      value: summary?.localCorrectionCount ?? 0,
    },
    {
      label: '缺失',
      value: summary?.missingCount ?? 0,
    },
    {
      label: '待清理补正',
      value: summary?.correctionCleanupPendingCount ?? 0,
    },
    {
      label: '基线变化待复核',
      value: summary?.upstreamChangedSinceCorrectionCount ?? 0,
    },
  ];
}

function formatSyncScope(action: PendingConductSyncRequest) {
  if (action.scope === 'ALL_TERMS') {
    return '该班所有已确认操行批次';
  }

  return action.semester
    ? `${formatSchoolYear(action.semester.schoolYear)} ${formatSemester(action.semester.termNumber)}`
    : '当前学期';
}

function formatSyncResultTitle(result: RefreshStudentConductGradeClassResult) {
  const termSummary = result.termResults
    .map(
      (term) =>
        `${formatSchoolYear(term.schoolYear)} ${formatSemester(term.semester)} ${term.status}`,
    )
    .join('；');

  return [
    `登记批次 ${result.requestedRegistrationCount} 个，确认 ${result.confirmedRegistrationCount} 个，处理 ${result.processedRegistrationCount} 个，跳过 ${result.skippedRegistrationCount} 个`,
    `写入学生 ${result.writtenStudentCount} 名，新建 ${result.createdCount} 条，更新 ${result.updatedCount} 条，未变化 ${result.unchangedCount} 条，失败 ${result.failureCount} 条`,
    termSummary ? `批次：${termSummary}` : null,
    result.traceId ? `traceId：${result.traceId}` : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join('。');
}

export function StudentConductGradeGovernanceLabPage() {
  const loaderData = useLoaderData() as StudentConductGradeGovernanceLabLoaderData | null;
  const currentAccount = loaderData?.currentAccount ?? null;
  const { message } = App.useApp();
  const [classes, setClasses] = useState<StudentPrivateProfileClassOption[]>([]);
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedTermKey, setSelectedTermKey] = useState<string | null>(null);
  const [overview, setOverview] = useState<StudentPrivateProfileClassOverview | null>(null);
  const [conductView, setConductView] = useState<StudentConductGradeEffectiveView | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [cleanupStudentId, setCleanupStudentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<RefreshStudentConductGradeClassResult | null>(null);
  const [syncingScope, setSyncingScope] = useState<'ALL_TERMS' | 'TERM' | null>(null);
  const [upstreamActionRequest, setUpstreamActionRequest] = useState<UpstreamActionRequest | null>(
    null,
  );
  const lockedUpstreamLoginUserId = currentAccount?.lockedUpstreamLoginUserId ?? null;
  const {
    modalProps: upstreamLoginModalProps,
    openLoginModal,
    openLoginModalForExpiredSession,
    persistSessionFromResult,
    refreshSession,
    session: upstreamSession,
  } = useUpstreamLoginModalController<PendingConductSyncRequest>({
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

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );
  const selectedSemester = useMemo(
    () => semesters.find((semester) => buildTermKey(semester) === selectedTermKey) ?? null,
    [selectedTermKey, semesters],
  );
  const selectedStudent = useMemo(
    () => conductView?.students.find((student) => student.studentId === selectedStudentId) ?? null,
    [conductView?.students, selectedStudentId],
  );
  const overviewReadiness = useMemo(() => resolveOverviewReadiness(overview), [overview]);
  const summaryItems = useMemo(() => buildSummaryItems(conductView), [conductView]);
  const filteredStudents = useMemo(
    () =>
      filterConductStudents(conductView?.students ?? [], {
        keyword: studentSearch,
        status: statusFilter,
      }),
    [conductView?.students, statusFilter, studentSearch],
  );
  const statusOptions = useMemo(
    () => buildStatusOptions(conductView?.students ?? []),
    [conductView?.students],
  );

  const loadSelectionData = useCallback(
    async (classOption: StudentPrivateProfileClassOption, semester: AcademicSemesterRecord) => {
      setIsLoadingData(true);
      setErrorMessage(null);
      setSelectedStudentId(null);

      try {
        const nextOverview = await fetchStudentPrivateProfileClassOverview({
          classId: classOption.id,
        });

        setOverview(nextOverview);

        const nextView = await fetchStudentConductGradeEffectiveView({
          classCode: classOption.classCode,
          schoolYear: String(semester.schoolYear),
          semester: String(semester.termNumber),
        });

        setConductView(nextView);
        setStatusFilter('ALL');
      } catch (error) {
        setConductView(null);
        setErrorMessage(error instanceof Error ? error.message : '暂时无法加载操行数据。');
      } finally {
        setIsLoadingData(false);
      }
    },
    [],
  );

  const runSyncWithSession = useCallback(
    async (session: StoredUpstreamSession, action: PendingConductSyncRequest) => {
      setSyncingScope(action.scope);
      setErrorMessage(null);

      try {
        const result = await refreshStudentConductGradeClassFromUpstream({
          classCode: action.classOption.classCode,
          schoolYear: action.semester ? String(action.semester.schoolYear) : undefined,
          semester: action.semester ? String(action.semester.termNumber) : undefined,
          upstreamSessionToken: session.upstreamSessionToken,
        });

        persistSessionFromResult(session, result);
        setSyncResult(result);
        message[result.failureCount > 0 ? 'warning' : 'success'](
          `操行同步完成：${formatSyncScope(action)}`,
        );

        if (selectedClass && selectedSemester) {
          await loadSelectionData(selectedClass, selectedSemester);
        }
      } catch (error) {
        if (!isExpiredUpstreamSessionError(error)) {
          setErrorMessage(resolveUpstreamErrorMessage(error, '暂时无法同步操行数据。'));
          return;
        }

        try {
          const refreshedSession = await refreshSession(session);
          const result = await refreshStudentConductGradeClassFromUpstream({
            classCode: action.classOption.classCode,
            schoolYear: action.semester ? String(action.semester.schoolYear) : undefined,
            semester: action.semester ? String(action.semester.termNumber) : undefined,
            upstreamSessionToken: refreshedSession.upstreamSessionToken,
          });

          persistSessionFromResult(refreshedSession, result);
          setSyncResult(result);
          message[result.failureCount > 0 ? 'warning' : 'success'](
            `学工系统会话已续期，操行同步完成：${formatSyncScope(action)}`,
          );

          if (selectedClass && selectedSemester) {
            await loadSelectionData(selectedClass, selectedSemester);
          }
        } catch (refreshError) {
          openLoginModalForExpiredSession({
            loginError: resolveUpstreamErrorMessage(
              refreshError,
              '学工系统会话已失效，请重新登录后继续同步操行。',
            ),
            pendingAction: action,
            session,
          });
        }
      } finally {
        setSyncingScope(null);
      }
    },
    [
      loadSelectionData,
      message,
      openLoginModalForExpiredSession,
      persistSessionFromResult,
      refreshSession,
      selectedClass,
      selectedSemester,
    ],
  );

  const requestConductSync = useCallback(
    async (action: PendingConductSyncRequest) => {
      setSyncResult(null);

      if (!upstreamSession) {
        openLoginModal({
          pendingAction: action,
        });
        return;
      }

      await runSyncWithSession(upstreamSession, action);
    },
    [openLoginModal, runSyncWithSession, upstreamSession],
  );

  const loadCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    setErrorMessage(null);

    try {
      const [nextClasses, nextSemesters] = await Promise.all([
        listStudentPrivateProfileClassOptions(),
        requestAcademicSemesters({ isVisible: true, limit: 500 }),
      ]);
      const sortedClasses = sortClassOptions(nextClasses);
      const sortedSemesters = sortAcademicSemesters(nextSemesters);
      const nextClass = sortedClasses[0] ?? null;
      const nextTermKey =
        sortedSemesters.length > 0 ? resolveDefaultTermKey(sortedSemesters) : null;
      const nextSemester =
        sortedSemesters.find((semester) => buildTermKey(semester) === nextTermKey) ?? null;

      setClasses(sortedClasses);
      setSemesters(sortedSemesters);
      setSelectedClassId(nextClass?.id ?? null);
      setSelectedTermKey(nextTermKey);
      setOverview(null);
      setConductView(null);
      setStudentSearch('');
      setStatusFilter('ALL');

      if (nextClass && nextSemester) {
        await loadSelectionData(nextClass, nextSemester);
      }
    } catch (error) {
      setClasses([]);
      setSemesters([]);
      setSelectedClassId(null);
      setSelectedTermKey(null);
      setOverview(null);
      setConductView(null);
      setErrorMessage(error instanceof Error ? error.message : '暂时无法加载操行治理入口。');
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [loadSelectionData]);

  const reloadCurrentSelection = useCallback(async () => {
    if (!selectedClass || !selectedSemester) {
      await loadCatalog();
      return;
    }

    await loadSelectionData(selectedClass, selectedSemester);
  }, [loadCatalog, loadSelectionData, selectedClass, selectedSemester]);

  const handleClassChange = useCallback(
    async (classId: string) => {
      setSelectedClassId(classId || null);
      setStudentSearch('');
      setStatusFilter('ALL');

      const nextClass = classes.find((item) => item.id === classId) ?? null;

      if (nextClass && selectedSemester) {
        await loadSelectionData(nextClass, selectedSemester);
      }
    },
    [classes, loadSelectionData, selectedSemester],
  );

  const handleTermChange = useCallback(
    async (termKey: string) => {
      const nextSemester = semesters.find((semester) => buildTermKey(semester) === termKey) ?? null;

      setSelectedTermKey(termKey || null);
      setStudentSearch('');
      setStatusFilter('ALL');

      if (selectedClass && nextSemester) {
        await loadSelectionData(selectedClass, nextSemester);
      }
    },
    [loadSelectionData, selectedClass, semesters],
  );

  const handleCleanup = useCallback(
    async (student: StudentConductGradeStudent) => {
      if (!conductView || student.status !== 'CORRECTION_CLEANUP_PENDING') {
        return;
      }

      setCleanupStudentId(student.studentId);
      setErrorMessage(null);

      try {
        const result = await cleanupStudentConductGradeCorrection({
          classCode: conductView.classCode,
          schoolYear: conductView.schoolYear,
          semester: conductView.semester,
          studentId: student.studentId,
        });

        message.success(`已清理 ${result.clearedFieldKeys.length} 个失效补正字段`);

        if (selectedClass && selectedSemester) {
          await loadSelectionData(selectedClass, selectedSemester);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '暂时无法清理操行补正。');
      } finally {
        setCleanupStudentId(null);
      }
    },
    [conductView, loadSelectionData, message, selectedClass, selectedSemester],
  );

  const columns = useMemo<ColumnsType<StudentConductGradeStudent>>(
    () => [
      {
        align: 'center',
        dataIndex: 'studentId',
        key: 'studentId',
        render: (value: string) => renderStableTextCell(value),
        title: '学号',
        width: 98,
      },
      {
        dataIndex: 'studentName',
        key: 'studentName',
        render: (value: string | null) => renderStableTextCell(value),
        title: '姓名',
        width: 82,
      },
      {
        key: 'studentStatus',
        render: (_, record) => renderStudentStatusTag(record.studentStatus),
        title: '学生状态',
        width: 104,
      },
      {
        key: 'score',
        render: (_, record) => renderFieldCell(record.fields.score),
        title: '分数',
        width: 128,
      },
      {
        key: 'estimatedGrade',
        render: (_, record) => renderFieldCell(record.fields.estimatedGrade),
        title: '推定等级',
        width: 132,
      },
      {
        key: 'confirmedGrade',
        render: (_, record) => renderFieldCell(record.fields.confirmedGrade),
        title: '确认等级',
        width: 132,
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => renderStatusTag(status),
        title: '治理状态',
        width: 156,
      },
      {
        key: 'conflictCodes',
        render: (_, record) =>
          record.conflictCodes.length > 0 ? (
            <Space size={4} wrap>
              {record.conflictCodes.map((code) => (
                <Tag color="orange" key={code}>
                  {code}
                </Tag>
              ))}
            </Space>
          ) : (
            <span className="text-text-secondary">-</span>
          ),
        title: '冲突',
        width: 180,
      },
      {
        key: 'actions',
        render: (_, record) => (
          <Space>
            <Button size="small" type="link" onClick={() => setSelectedStudentId(record.studentId)}>
              明细
            </Button>
            {record.status === 'CORRECTION_CLEANUP_PENDING' ? (
              <Popconfirm
                title="清理已失效本地补正？"
                description="清理只会移除 stale correction，不会覆盖 upstream。"
                okText="清理"
                cancelText="取消"
                onConfirm={() => void handleCleanup(record)}
              >
                <Button
                  danger
                  icon={<ClearOutlined />}
                  loading={cleanupStudentId === record.studentId}
                  size="small"
                  type="link"
                >
                  清理
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        ),
        title: '操作',
        width: 132,
      },
    ],
    [cleanupStudentId, handleCleanup],
  );

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!upstreamActionRequest) {
      return;
    }

    setUpstreamActionRequest(null);
    void runSyncWithSession(upstreamActionRequest.session, upstreamActionRequest.action);
  }, [runSyncWithSession, upstreamActionRequest]);

  if (!currentAccount) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-6">
        <Alert showIcon type="warning" title="当前登录会话尚未恢复，请稍后重试。" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-6">
      <DecoratedPageHeader
        badge={<Tag color="blue">{studentConductGradeGovernanceLabMeta.name}</Tag>}
        description={studentConductGradeGovernanceLabMeta.purpose}
        icon={<AuditOutlined />}
        title="操行数据治理"
      />

      <section className="rounded-card bg-bg-container p-5 shadow-card">
        <div className="flex flex-col gap-4">
          {errorMessage ? <Alert showIcon title={errorMessage} type="error" /> : null}
          {overviewReadiness.missingSnapshotCount > 0 ? (
            <Alert
              showIcon
              type="warning"
              title="本地快照尚未完整初始化"
              description={
                <span>
                  当前班级有 {overviewReadiness.missingSnapshotCount} 名学生缺少本地快照。请先到{' '}
                  <a href="/labs/student-private-profile">学生敏感资料 lab</a>{' '}
                  初始化快照后再治理操行。
                </span>
              }
            />
          ) : null}
          {overviewReadiness.upstreamIdMissingCount > 0 ? (
            <Alert
              showIcon
              type="info"
              title="存在无法从 upstream 拉取的学生"
              description={`当前班级有 ${overviewReadiness.upstreamIdMissingCount} 名学生缺少 upstreamId，前端不自行重算名单，班级范围以后端 overview 为准。`}
            />
          ) : null}
          {syncResult ? (
            <Alert
              showIcon
              type={syncResult.failureCount > 0 ? 'warning' : 'success'}
              title="操行 upstream 同步完成"
              description={formatSyncResultTitle(syncResult)}
            />
          ) : null}

          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <label className="flex flex-col gap-2">
              <span className="text-sm text-text-secondary">班级</span>
              <Select
                disabled={isLoadingCatalog || isLoadingData}
                loading={isLoadingCatalog}
                optionFilterProp="label"
                options={classes.map((option) => ({
                  label: formatClassLabel(option),
                  value: option.id,
                }))}
                placeholder="暂无可见班级"
                showSearch
                value={selectedClassId ?? undefined}
                onChange={(value) => void handleClassChange(value)}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-text-secondary">学生</span>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="输入学生 ID 或姓名"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-text-secondary">治理状态</span>
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value)}
              />
            </label>
            <div className="flex items-end">
              <Button
                disabled={isLoadingCatalog || isLoadingData}
                icon={<ReloadOutlined />}
                onClick={() => void reloadCurrentSelection()}
              >
                重新加载
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
      >
        {summaryItems.map((item) => (
          <div className="rounded-card bg-bg-container p-4 shadow-card" key={item.label}>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-text-secondary">{item.label}</span>
              <span className="text-2xl font-semibold text-text">{item.value}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-card bg-bg-container p-5 shadow-card">
        {isLoadingCatalog ? (
          <div className="flex min-h-80 items-center justify-center">
            <Spin size="large" />
          </div>
        ) : selectedClass && semesters.length > 0 ? (
          <Tabs
            activeKey={selectedTermKey ?? undefined}
            items={semesters.map((semester) => {
              const termKey = buildTermKey(semester);
              const isActive = termKey === selectedTermKey;

              return {
                children: isActive ? (
                  isLoadingData ? (
                    <div className="flex min-h-80 items-center justify-center">
                      <Spin size="large" />
                    </div>
                  ) : conductView ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Space size="small" wrap>
                          <Tag>{conductView.className}</Tag>
                          <Tag>{formatSchoolYear(conductView.schoolYear)}</Tag>
                          <Tag>{formatSemester(conductView.semester)}</Tag>
                          <Tag>{conductView.studentCount} 名学生</Tag>
                        </Space>
                        <span className="text-sm text-text-secondary">
                          当前列表 {filteredStudents.length} / {conductView.students.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          icon={<CloudSyncOutlined />}
                          loading={syncingScope === 'TERM'}
                          onClick={() =>
                            void requestConductSync({
                              classOption: selectedClass,
                              scope: 'TERM',
                              semester,
                            })
                          }
                        >
                          同步当前学期
                        </Button>
                        <Button
                          icon={<CloudSyncOutlined />}
                          loading={syncingScope === 'ALL_TERMS'}
                          onClick={() =>
                            void requestConductSync({
                              classOption: selectedClass,
                              scope: 'ALL_TERMS',
                            })
                          }
                        >
                          同步该班操行
                        </Button>
                      </div>
                      <Table<StudentConductGradeStudent>
                        columns={columns}
                        dataSource={filteredStudents}
                        locale={{
                          emptyText: (
                            <Empty
                              description="暂无操行数据"
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                          ),
                        }}
                        pagination={{
                          defaultPageSize: 50,
                          pageSizeOptions: [30, 50, 100],
                          showSizeChanger: true,
                        }}
                        rowKey={(record) => record.studentId}
                        scroll={{ x: 1220 }}
                        size="small"
                        tableLayout="fixed"
                      />
                    </div>
                  ) : (
                    <div className="flex min-h-80 items-center justify-center">
                      <Empty description="暂无操行有效视图" />
                    </div>
                  )
                ) : null,
                key: termKey,
                label: (
                  <span className="flex flex-col gap-1">
                    <span className={isActive ? 'font-medium text-text' : 'text-text'}>
                      {formatSchoolYear(semester.schoolYear)}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-text-secondary">
                      {formatSemester(semester.termNumber)}
                      {semester.isCurrent ? <Tag color="blue">当前</Tag> : null}
                    </span>
                  </span>
                ),
              };
            })}
            size="small"
            tabPlacement="start"
            onChange={(key) => void handleTermChange(key)}
          />
        ) : (
          <div className="flex min-h-80 items-center justify-center">
            <Empty description={selectedClass ? '暂无可见学期' : '请选择班级'} />
          </div>
        )}
      </section>

      <Drawer
        destroyOnHidden
        open={Boolean(selectedStudent)}
        size={560}
        title={selectedStudent?.studentName ?? selectedStudent?.studentId ?? '学生明细'}
        onClose={() => setSelectedStudentId(null)}
      >
        {selectedStudent ? (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="学生 ID">{selectedStudent.studentId}</Descriptions.Item>
              <Descriptions.Item label="姓名">
                {selectedStudent.studentName ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="学生状态">
                {renderStudentStatusTag(selectedStudent.studentStatus)}
              </Descriptions.Item>
              <Descriptions.Item label="治理状态">
                {renderStatusTag(selectedStudent.status)}
              </Descriptions.Item>
              <Descriptions.Item label="操行 section">
                <Space size={4} wrap>
                  <Tag>{selectedStudent.conductSection.sourceStatus}</Tag>
                  <Tag>
                    {selectedStudent.conductSection.snapshotPresent ? '已有快照' : '快照缺失'}
                  </Tag>
                  {selectedStudent.conductSection.sourceTotal !== null ? (
                    <Tag>源记录 {selectedStudent.conductSection.sourceTotal}</Tag>
                  ) : null}
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <Descriptions bordered column={1} size="small" title="字段">
              <Descriptions.Item label="分数">
                {renderFieldCell(selectedStudent.fields.score)}
              </Descriptions.Item>
              <Descriptions.Item label="推定等级">
                {renderFieldCell(selectedStudent.fields.estimatedGrade)}
              </Descriptions.Item>
              <Descriptions.Item label="确认等级">
                {renderFieldCell(selectedStudent.fields.confirmedGrade)}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions bordered column={1} size="small" title="治理信号">
              <Descriptions.Item label="本地补正字段">
                {selectedStudent.manualPatchFieldKeys.length > 0 ? (
                  <Space size={4} wrap>
                    {selectedStudent.manualPatchFieldKeys.map((fieldKey) => (
                      <Tag color="blue" key={fieldKey}>
                        {fieldKey}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="冲突码">
                {selectedStudent.conflictCodes.length > 0 ? (
                  <Space size={4} wrap>
                    {selectedStudent.conflictCodes.map((code) => (
                      <Tag color="orange" key={code}>
                        {code}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="section warning">
                {selectedStudent.conductSection.warningCodes.length > 0 ? (
                  <Space size={4} wrap>
                    {selectedStudent.conductSection.warningCodes.map((code) => (
                      <Tag color="gold" key={code}>
                        {code}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        ) : null}
      </Drawer>

      <UpstreamLoginModal {...upstreamLoginModalProps} />

      <div className="text-xs text-text-tertiary">
        当前 lab 暴露环境：{studentConductGradeGovernanceLabAccess.env.join(', ')}；访问级别：
        {studentConductGradeGovernanceLabAccess.allowedAccessLevels.join(', ')}。
      </div>
    </div>
  );
}
