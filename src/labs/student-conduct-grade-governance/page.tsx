// src/labs/student-conduct-grade-governance/page.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AuditOutlined,
  ClearOutlined,
  CloudSyncOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Input,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  theme,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLoaderData } from 'react-router';

import {
  buildAcademicTermKey as buildTermKey,
  buildAcademicTermOrdinalByKey,
  formatAcademicSchoolYear as formatSchoolYear,
  formatAcademicSemester as formatSemester,
  formatAcademicTermLabel,
  sortAcademicTermsByTimelineDesc,
} from '@/entities/academic-semester';
import {
  type StoredUpstreamSession,
  UpstreamLoginModal,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import { buildStableColumnSizing } from '@/shared/ui/stable-table';

import { studentConductGradeGovernanceLabAccess } from './access';
import {
  cleanupStudentConductGradeCorrection,
  fetchStudentConductGradeClassTermOptions,
  fetchStudentConductGradeEffectiveView,
  fetchStudentPrivateProfileClassOverview,
  isExpiredUpstreamSessionError,
  listStudentPrivateProfileClassOptions,
  refreshStudentConductGradeClassFromUpstream,
  type RefreshStudentConductGradeClassResult,
  resolveUpstreamErrorMessage,
  type StudentConductGradeClassTermOption,
  type StudentConductGradeClassTermOptions,
  type StudentConductGradeEffectiveView,
  type StudentConductGradeFieldCell,
  type StudentConductGradeStudent,
  type StudentPrivateProfileClassOption,
  type StudentPrivateProfileClassOverview,
} from './api';
import { studentConductGradeGovernanceLabMeta } from './meta';

import './student-conduct-grade-governance-page.css';

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
  term?: StudentConductGradeClassTermOption;
};

type UpstreamActionRequest = {
  action: PendingConductSyncRequest;
  session: StoredUpstreamSession;
};

const STUDENT_NUMBER_COLUMN_WIDTH = 98;
const STUDENT_NAME_COLUMN_WIDTH = 82;
const CONDUCT_SCORE_COLUMN_WIDTH = 72;
const CONDUCT_GRADE_COLUMN_WIDTH = 84;
const CONDUCT_STATUS_COLUMN_WIDTH = 112;
const CONDUCT_CONFLICT_COLUMN_WIDTH = 150;
const CONDUCT_ACTION_COLUMN_WIDTH = 82;
const CONDUCT_TABLE_SCROLL_X =
  STUDENT_NUMBER_COLUMN_WIDTH +
  STUDENT_NAME_COLUMN_WIDTH +
  CONDUCT_SCORE_COLUMN_WIDTH +
  CONDUCT_GRADE_COLUMN_WIDTH +
  CONDUCT_STATUS_COLUMN_WIDTH +
  CONDUCT_CONFLICT_COLUMN_WIDTH +
  CONDUCT_ACTION_COLUMN_WIDTH;

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

function resolveDefaultTermKey(
  terms: readonly StudentConductGradeClassTermOption[],
  preferredTermKey?: string | null,
) {
  if (preferredTermKey && terms.some((term) => buildTermKey(term) === preferredTermKey)) {
    return preferredTermKey;
  }

  const defaultTerm = terms[0] ?? null;

  return defaultTerm ? buildTermKey(defaultTerm) : null;
}

function formatTermLabel(term: StudentConductGradeClassTermOption) {
  return formatAcademicTermLabel(term);
}

function isTermGenerationBlocked(options: StudentConductGradeClassTermOptions | null) {
  return options?.generationStatus === 'CLASS_CONFIG_MISSING';
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

function renderSnapshotInitializationAlert(missingSnapshotCount: number) {
  return (
    <Alert
      showIcon
      type="warning"
      title="本地快照尚未完整初始化"
      description={
        <span>
          当前班级有 {missingSnapshotCount} 名学生缺少本地快照。请先到{' '}
          <a href="/labs/student-private-profile">学生敏感资料 lab</a> 初始化快照后再治理操行。
        </span>
      }
    />
  );
}

function renderConfirmedGradeCell(
  confirmedGrade: StudentConductGradeFieldCell,
  estimatedGrade: StudentConductGradeFieldCell,
) {
  const estimatedGradeText = formatFieldValue(estimatedGrade);

  return (
    <Tooltip title={`推定等级：${estimatedGradeText}`}>{renderFieldCell(confirmedGrade)}</Tooltip>
  );
}

function buildConductRowClassName(
  record: Pick<StudentConductGradeStudent, 'studentId'>,
  index: number | undefined,
  selectedStudentId: string | null,
) {
  return [
    index !== undefined && index % 2 === 0
      ? 'student-conduct-grade-governance-row-even'
      : 'student-conduct-grade-governance-row-odd',
    record.studentId === selectedStudentId ? 'student-conduct-grade-governance-row-selected' : null,
    'student-conduct-grade-governance-row-clickable',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildConductTableRowProps(
  record: Pick<StudentConductGradeStudent, 'studentId'>,
  index: number | undefined,
  selectedStudentId: string | null,
  setSelectedStudentId: (studentId: string | null) => void,
) {
  return {
    className: buildConductRowClassName(record, index, selectedStudentId),
    onClick: () => {
      setSelectedStudentId(selectedStudentId === record.studentId ? null : record.studentId);
    },
  };
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
  const countByStatus = new Map<string, number>();

  for (const student of students) {
    countByStatus.set(student.status, (countByStatus.get(student.status) ?? 0) + 1);
  }

  const statuses = Array.from(countByStatus.keys()).sort(
    (first, second) =>
      (STATUS_PRIORITY[first] ?? 90) - (STATUS_PRIORITY[second] ?? 90) ||
      compareTextValue(first, second),
  );

  return [
    {
      label: `全部状态（${students.length}）`,
      value: 'ALL',
    },
    ...statuses.map((status) => ({
      label: `${resolveStatusLabel(status)}（${countByStatus.get(status) ?? 0}）`,
      value: status,
    })),
  ];
}

function formatSyncScope(action: PendingConductSyncRequest) {
  if (action.scope === 'ALL_TERMS') {
    return '该班所有已确认操行批次';
  }

  return action.term ? formatTermLabel(action.term) : '所选学期';
}

function resolveTermResultLabel(
  term: Pick<StudentConductGradeClassTermOption, 'schoolYear' | 'semester'>,
  knownTerms: readonly StudentConductGradeClassTermOption[],
) {
  return (
    knownTerms.find(
      (knownTerm) =>
        knownTerm.schoolYear === term.schoolYear && knownTerm.semester === term.semester,
    )?.label ?? `${term.schoolYear}/${term.semester}`
  );
}

function formatSyncResultTitle(
  result: RefreshStudentConductGradeClassResult,
  knownTerms: readonly StudentConductGradeClassTermOption[],
) {
  const termSummary = result.termResults
    .map((term) => `${resolveTermResultLabel(term, knownTerms)} ${term.status}`)
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
  const { token } = theme.useToken();
  const loaderData = useLoaderData() as StudentConductGradeGovernanceLabLoaderData | null;
  const currentAccount = loaderData?.currentAccount ?? null;
  const { message } = App.useApp();
  const [classes, setClasses] = useState<StudentPrivateProfileClassOption[]>([]);
  const [terms, setTerms] = useState<StudentConductGradeClassTermOption[]>([]);
  const [termOptions, setTermOptions] = useState<StudentConductGradeClassTermOptions | null>(null);
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
  const loadRequestSeqRef = useRef(0);
  const cleanupRequestSeqRef = useRef(0);
  const activeSelectionRef = useRef<{
    classOption: StudentPrivateProfileClassOption | null;
    classId: string | null;
    term: StudentConductGradeClassTermOption | null;
    termKey: string | null;
  }>({
    classOption: null,
    classId: null,
    term: null,
    termKey: null,
  });
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
  const selectedTerm = useMemo(
    () => terms.find((term) => buildTermKey(term) === selectedTermKey) ?? null,
    [selectedTermKey, terms],
  );
  const selectedStudent = useMemo(
    () => conductView?.students.find((student) => student.studentId === selectedStudentId) ?? null,
    [conductView?.students, selectedStudentId],
  );
  const overviewReadiness = useMemo(() => resolveOverviewReadiness(overview), [overview]);
  const snapshotInitializationBlocked = overviewReadiness.missingSnapshotCount > 0;
  const termGenerationBlocked = isTermGenerationBlocked(termOptions);
  const termBlockingMessage =
    termOptions?.blockingReasonMessage || '当前班级缺少生成操行学期所需配置。';
  const termOrdinalByKey = useMemo(() => buildAcademicTermOrdinalByKey(terms), [terms]);
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
  const conductSyncMenuItems = useMemo<MenuProps['items']>(
    () => [
      {
        disabled: !selectedTerm || termGenerationBlocked,
        key: 'TERM',
        label: selectedTerm ? `同步所选学期（${formatTermLabel(selectedTerm)}）` : '同步所选学期',
      },
      {
        disabled: termGenerationBlocked,
        key: 'ALL_TERMS',
        label: '同步该班全部学期',
      },
    ],
    [selectedTerm, termGenerationBlocked],
  );
  const conductSyncDisabled =
    isLoadingCatalog ||
    isLoadingData ||
    !selectedClass ||
    !selectedTerm ||
    terms.length === 0 ||
    termGenerationBlocked;

  useEffect(() => {
    activeSelectionRef.current = {
      classOption: selectedClass,
      classId: selectedClassId,
      term: selectedTerm,
      termKey: selectedTermKey,
    };
  }, [selectedClass, selectedClassId, selectedTerm, selectedTermKey]);

  const loadSelectionData = useCallback(
    async (
      classOption: StudentPrivateProfileClassOption,
      term: StudentConductGradeClassTermOption,
    ) => {
      const requestSeq = loadRequestSeqRef.current + 1;
      const termKey = buildTermKey(term);

      loadRequestSeqRef.current = requestSeq;
      activeSelectionRef.current = {
        classOption,
        classId: classOption.id,
        term,
        termKey,
      };
      setIsLoadingData(true);
      setErrorMessage(null);
      setSelectedStudentId(null);

      try {
        const nextOverview = await fetchStudentPrivateProfileClassOverview({
          classId: classOption.id,
        });

        if (loadRequestSeqRef.current !== requestSeq) {
          return;
        }

        setOverview(nextOverview);

        if (resolveOverviewReadiness(nextOverview).missingSnapshotCount > 0) {
          setConductView(null);
          setStatusFilter('ALL');
          return;
        }

        const nextView = await fetchStudentConductGradeEffectiveView({
          classCode: classOption.classCode,
          schoolYear: term.schoolYear,
          semester: term.semester,
        });

        if (loadRequestSeqRef.current !== requestSeq) {
          return;
        }

        setConductView(nextView);
        setStatusFilter('ALL');
      } catch (error) {
        if (loadRequestSeqRef.current !== requestSeq) {
          return;
        }

        setConductView(null);
        setErrorMessage(error instanceof Error ? error.message : '暂时无法加载操行数据。');
      } finally {
        if (loadRequestSeqRef.current === requestSeq) {
          setIsLoadingData(false);
        }
      }
    },
    [],
  );

  const loadClassTermsAndSelection = useCallback(
    async (
      classOption: StudentPrivateProfileClassOption,
      input: {
        preferredTermKey?: string | null;
      } = {},
    ) => {
      const requestSeq = loadRequestSeqRef.current + 1;

      loadRequestSeqRef.current = requestSeq;
      setIsLoadingData(true);
      setErrorMessage(null);
      setSelectedStudentId(null);
      setSyncResult(null);
      setOverview(null);
      setConductView(null);
      setTerms([]);
      setTermOptions(null);
      setStudentSearch('');
      setStatusFilter('ALL');

      try {
        const nextTermOptions = await fetchStudentConductGradeClassTermOptions({
          classCode: classOption.classCode,
        });

        if (loadRequestSeqRef.current !== requestSeq) {
          return;
        }

        const nextTerms = sortAcademicTermsByTimelineDesc(nextTermOptions.terms);
        const nextTermKey = isTermGenerationBlocked(nextTermOptions)
          ? null
          : resolveDefaultTermKey(nextTerms, input.preferredTermKey);
        const nextTerm = nextTerms.find((term) => buildTermKey(term) === nextTermKey) ?? null;

        setTermOptions(nextTermOptions);
        setTerms(nextTerms);
        setSelectedTermKey(nextTermKey);
        activeSelectionRef.current = {
          classOption,
          classId: classOption.id,
          term: nextTerm,
          termKey: nextTermKey,
        };

        if (isTermGenerationBlocked(nextTermOptions) || !nextTerm) {
          return;
        }

        const nextOverview = await fetchStudentPrivateProfileClassOverview({
          classId: classOption.id,
        });

        if (loadRequestSeqRef.current !== requestSeq) {
          return;
        }

        setOverview(nextOverview);

        if (resolveOverviewReadiness(nextOverview).missingSnapshotCount > 0) {
          setConductView(null);
          return;
        }

        const nextView = await fetchStudentConductGradeEffectiveView({
          classCode: classOption.classCode,
          schoolYear: nextTerm.schoolYear,
          semester: nextTerm.semester,
        });

        if (loadRequestSeqRef.current !== requestSeq) {
          return;
        }

        setConductView(nextView);
      } catch (error) {
        if (loadRequestSeqRef.current !== requestSeq) {
          return;
        }

        setTermOptions(null);
        setTerms([]);
        setSelectedTermKey(null);
        setOverview(null);
        setConductView(null);
        setErrorMessage(error instanceof Error ? error.message : '暂时无法加载操行治理入口。');
      } finally {
        if (loadRequestSeqRef.current === requestSeq) {
          setIsLoadingData(false);
        }
      }
    },
    [],
  );

  const runSyncWithSession = useCallback(
    async (session: StoredUpstreamSession, action: PendingConductSyncRequest) => {
      const canApplySyncResult = () => {
        const currentSelection = activeSelectionRef.current;
        const actionTermKey = action.term ? buildTermKey(action.term) : null;

        return (
          currentSelection.classId === action.classOption.id &&
          (action.scope !== 'TERM' || currentSelection.termKey === actionTermKey)
        );
      };

      setSyncingScope(action.scope);
      setErrorMessage(null);

      try {
        const result = await refreshStudentConductGradeClassFromUpstream({
          classCode: action.classOption.classCode,
          schoolYear: action.term?.schoolYear,
          semester: action.term?.semester,
          upstreamSessionToken: session.upstreamSessionToken,
        });

        persistSessionFromResult(session, result);

        if (!canApplySyncResult()) {
          return;
        }

        setSyncResult(result);
        message[result.failureCount > 0 ? 'warning' : 'success'](
          `操行同步完成：${formatSyncScope(action)}`,
        );

        const currentSelection = activeSelectionRef.current;

        if (currentSelection.classOption && currentSelection.term) {
          await loadSelectionData(currentSelection.classOption, currentSelection.term);
        }
      } catch (error) {
        if (!isExpiredUpstreamSessionError(error)) {
          if (!canApplySyncResult()) {
            return;
          }

          setErrorMessage(resolveUpstreamErrorMessage(error, '暂时无法同步操行数据。'));
          return;
        }

        if (!canApplySyncResult()) {
          return;
        }

        try {
          const refreshedSession = await refreshSession(session);
          const result = await refreshStudentConductGradeClassFromUpstream({
            classCode: action.classOption.classCode,
            schoolYear: action.term?.schoolYear,
            semester: action.term?.semester,
            upstreamSessionToken: refreshedSession.upstreamSessionToken,
          });

          persistSessionFromResult(refreshedSession, result);

          if (!canApplySyncResult()) {
            return;
          }

          setSyncResult(result);
          message[result.failureCount > 0 ? 'warning' : 'success'](
            `学工系统会话已续期，操行同步完成：${formatSyncScope(action)}`,
          );

          const currentSelection = activeSelectionRef.current;

          if (currentSelection.classOption && currentSelection.term) {
            await loadSelectionData(currentSelection.classOption, currentSelection.term);
          }
        } catch (refreshError) {
          if (!canApplySyncResult()) {
            return;
          }

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
    ],
  );

  const requestConductSync = useCallback(
    async (action: PendingConductSyncRequest) => {
      setSyncResult(null);

      if (termGenerationBlocked) {
        setErrorMessage(termBlockingMessage);
        return;
      }

      if (!upstreamSession) {
        openLoginModal({
          pendingAction: action,
        });
        return;
      }

      await runSyncWithSession(upstreamSession, action);
    },
    [
      openLoginModal,
      runSyncWithSession,
      termBlockingMessage,
      termGenerationBlocked,
      upstreamSession,
    ],
  );

  const handleConductSyncMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(
    ({ key }) => {
      if (!selectedClass) {
        return;
      }

      if (key === 'TERM') {
        if (!selectedTerm) {
          return;
        }

        void requestConductSync({
          classOption: selectedClass,
          scope: 'TERM',
          term: selectedTerm,
        });
        return;
      }

      if (key === 'ALL_TERMS') {
        void requestConductSync({
          classOption: selectedClass,
          scope: 'ALL_TERMS',
        });
      }
    },
    [requestConductSync, selectedClass, selectedTerm],
  );

  const loadCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    setErrorMessage(null);
    setSyncResult(null);

    try {
      const nextClasses = await listStudentPrivateProfileClassOptions();
      const sortedClasses = sortClassOptions(nextClasses);
      const nextClass = sortedClasses[0] ?? null;

      setClasses(sortedClasses);
      setSelectedClassId(nextClass?.id ?? null);
      setTerms([]);
      setTermOptions(null);
      setSelectedTermKey(null);
      setOverview(null);
      setConductView(null);
      setStudentSearch('');
      setStatusFilter('ALL');

      if (nextClass) {
        await loadClassTermsAndSelection(nextClass);
      }
    } catch (error) {
      setClasses([]);
      setTerms([]);
      setTermOptions(null);
      setSelectedClassId(null);
      setSelectedTermKey(null);
      setOverview(null);
      setConductView(null);
      setErrorMessage(error instanceof Error ? error.message : '暂时无法加载操行治理入口。');
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [loadClassTermsAndSelection]);

  const reloadCurrentSelection = useCallback(async () => {
    if (!selectedClass) {
      await loadCatalog();
      return;
    }

    if (!selectedTerm || termGenerationBlocked) {
      await loadClassTermsAndSelection(selectedClass, {
        preferredTermKey: selectedTermKey,
      });
      return;
    }

    await loadSelectionData(selectedClass, selectedTerm);
  }, [
    loadCatalog,
    loadClassTermsAndSelection,
    loadSelectionData,
    selectedClass,
    selectedTerm,
    selectedTermKey,
    termGenerationBlocked,
  ]);

  const handleClassChange = useCallback(
    async (classId: string) => {
      const nextClass = classes.find((item) => item.id === classId) ?? null;

      activeSelectionRef.current = {
        classOption: nextClass,
        classId: nextClass?.id ?? null,
        term: null,
        termKey: null,
      };
      setSelectedClassId(classId || null);
      setStudentSearch('');
      setStatusFilter('ALL');

      if (nextClass) {
        await loadClassTermsAndSelection(nextClass);
      }
    },
    [classes, loadClassTermsAndSelection],
  );

  const handleTermChange = useCallback(
    async (termKey: string) => {
      const nextTerm = terms.find((term) => buildTermKey(term) === termKey) ?? null;

      activeSelectionRef.current = {
        classOption: selectedClass,
        classId: selectedClass?.id ?? null,
        term: nextTerm,
        termKey: termKey || null,
      };
      setSelectedTermKey(termKey || null);
      setStudentSearch('');
      setStatusFilter('ALL');

      if (selectedClass && nextTerm) {
        await loadSelectionData(selectedClass, nextTerm);
      }
    },
    [loadSelectionData, selectedClass, terms],
  );

  const handleCleanup = useCallback(
    async (student: StudentConductGradeStudent) => {
      if (!conductView || student.status !== 'CORRECTION_CLEANUP_PENDING') {
        return;
      }

      if (termGenerationBlocked) {
        setErrorMessage(termBlockingMessage);
        return;
      }

      const cleanupSelection = activeSelectionRef.current;
      const cleanupRequestSeq = cleanupRequestSeqRef.current + 1;
      const canApplyCleanupResult = () => {
        const currentSelection = activeSelectionRef.current;

        return (
          currentSelection.classId === cleanupSelection.classId &&
          currentSelection.termKey === cleanupSelection.termKey
        );
      };

      cleanupRequestSeqRef.current = cleanupRequestSeq;
      setCleanupStudentId(student.studentId);
      setErrorMessage(null);

      try {
        const result = await cleanupStudentConductGradeCorrection({
          classCode: conductView.classCode,
          schoolYear: conductView.schoolYear,
          semester: conductView.semester,
          studentId: student.studentId,
        });

        if (!canApplyCleanupResult()) {
          return;
        }

        message.success(`已清理 ${result.clearedFieldKeys.length} 个失效补正字段`);

        if (cleanupSelection.classOption && cleanupSelection.term) {
          await loadSelectionData(cleanupSelection.classOption, cleanupSelection.term);
        }
      } catch (error) {
        if (!canApplyCleanupResult()) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : '暂时无法清理操行补正。');
      } finally {
        if (cleanupRequestSeqRef.current === cleanupRequestSeq) {
          setCleanupStudentId(null);
        }
      }
    },
    [conductView, loadSelectionData, message, termBlockingMessage, termGenerationBlocked],
  );

  const columns = useMemo<ColumnsType<StudentConductGradeStudent>>(
    () => [
      {
        ...buildStableColumnSizing<StudentConductGradeStudent>(STUDENT_NUMBER_COLUMN_WIDTH),
        align: 'center',
        dataIndex: 'studentId',
        fixed: 'left',
        key: 'studentId',
        render: (value: string) => renderStableTextCell(value),
        title: '学号',
      },
      {
        ...buildStableColumnSizing<StudentConductGradeStudent>(STUDENT_NAME_COLUMN_WIDTH),
        dataIndex: 'studentName',
        fixed: 'left',
        key: 'studentName',
        render: (value: string | null) => renderStableTextCell(value),
        title: '姓名',
      },
      {
        ...buildStableColumnSizing<StudentConductGradeStudent>(CONDUCT_SCORE_COLUMN_WIDTH),
        align: 'center',
        key: 'score',
        render: (_, record) => renderFieldCell(record.fields.score),
        title: '分数',
      },
      {
        ...buildStableColumnSizing<StudentConductGradeStudent>(CONDUCT_GRADE_COLUMN_WIDTH),
        align: 'center',
        key: 'confirmedGrade',
        render: (_, record) =>
          renderConfirmedGradeCell(record.fields.confirmedGrade, record.fields.estimatedGrade),
        title: '确认等级',
      },
      {
        ...buildStableColumnSizing<StudentConductGradeStudent>(CONDUCT_STATUS_COLUMN_WIDTH),
        align: 'center',
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => renderStatusTag(status),
        title: '本地存储',
      },
      {
        ...buildStableColumnSizing<StudentConductGradeStudent>(CONDUCT_CONFLICT_COLUMN_WIDTH),
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
      },
      {
        ...buildStableColumnSizing<StudentConductGradeStudent>(CONDUCT_ACTION_COLUMN_WIDTH),
        align: 'center',
        key: 'actions',
        render: (_, record) => (
          <Space onClick={(event) => event.stopPropagation()}>
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

      {snapshotInitializationBlocked ? (
        <section className="rounded-card bg-bg-container p-5 shadow-card">
          <div className="flex flex-col gap-4">
            <label className="flex max-w-sm flex-col gap-2">
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
            {renderSnapshotInitializationAlert(overviewReadiness.missingSnapshotCount)}
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-card bg-bg-container p-5 shadow-card">
            <div className="flex flex-col gap-4">
              {errorMessage ? <Alert showIcon title={errorMessage} type="error" /> : null}
              {termGenerationBlocked ? (
                <Alert
                  showIcon
                  type="warning"
                  title="班级操行学期配置缺失"
                  description={termBlockingMessage}
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
                  description={formatSyncResultTitle(syncResult, terms)}
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
                    placeholder="输入学号或姓名"
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
                <div className="flex items-end gap-2">
                  <Button
                    disabled={isLoadingCatalog || isLoadingData}
                    icon={<ReloadOutlined />}
                    onClick={() => void reloadCurrentSelection()}
                  >
                    重新加载
                  </Button>
                  <Dropdown
                    disabled={conductSyncDisabled}
                    menu={{
                      items: conductSyncMenuItems,
                      onClick: handleConductSyncMenuClick,
                    }}
                    trigger={['click']}
                  >
                    <Button
                      disabled={conductSyncDisabled}
                      icon={<CloudSyncOutlined />}
                      loading={syncingScope !== null}
                    >
                      同步操行
                    </Button>
                  </Dropdown>
                </div>
              </div>
            </div>
          </section>

          <section className="student-conduct-grade-governance-table-shell">
            {isLoadingCatalog ? (
              <div className="flex min-h-80 items-center justify-center">
                <Spin size="large" />
              </div>
            ) : selectedClass && terms.length > 0 && !termGenerationBlocked ? (
              <Tabs
                activeKey={selectedTermKey ?? undefined}
                items={terms.map((term) => {
                  const termKey = buildTermKey(term);
                  const isActive = termKey === selectedTermKey;
                  const termOrdinal = termOrdinalByKey.get(termKey) ?? null;

                  return {
                    children: isActive ? (
                      isLoadingData ? (
                        <div className="flex min-h-80 items-center justify-center">
                          <Spin size="large" />
                        </div>
                      ) : conductView ? (
                        <div className="flex flex-col gap-4">
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
                            onRow={(record, index) =>
                              buildConductTableRowProps(
                                record,
                                index,
                                selectedStudentId,
                                setSelectedStudentId,
                              )
                            }
                            pagination={{
                              defaultPageSize: 50,
                              pageSizeOptions: [30, 50, 100],
                              showSizeChanger: true,
                            }}
                            rowKey={(record) => record.studentId}
                            scroll={{ x: CONDUCT_TABLE_SCROLL_X }}
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
                      <span className="student-conduct-grade-governance-term-tab-label">
                        <span
                          className={[
                            'student-conduct-grade-governance-term-tab-primary',
                            isActive
                              ? 'student-conduct-grade-governance-term-tab-primary-active'
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {formatSchoolYear(term.schoolYear)}
                        </span>
                        <span className="student-conduct-grade-governance-term-tab-secondary">
                          <span className="student-conduct-grade-governance-term-tab-secondary-text">
                            {formatSemester(term.semester)}
                          </span>
                          {termOrdinal !== null ? (
                            <span className="student-conduct-grade-governance-term-tab-badge">
                              {termOrdinal}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    ),
                  };
                })}
                size="small"
                tabBarGutter={token.marginXS}
                tabPlacement="start"
                onChange={(key) => void handleTermChange(key)}
              />
            ) : (
              <div className="flex min-h-80 items-center justify-center">
                <Empty
                  description={
                    selectedClass
                      ? termGenerationBlocked
                        ? termBlockingMessage
                        : '暂无可治理学期'
                      : '请选择班级'
                  }
                />
              </div>
            )}
          </section>
        </>
      )}

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
