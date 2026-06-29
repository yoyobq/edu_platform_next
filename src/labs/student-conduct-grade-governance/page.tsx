// src/labs/student-conduct-grade-governance/page.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AuditOutlined,
  ClearOutlined,
  CloudSyncOutlined,
  EditOutlined,
  ReloadOutlined,
  SaveOutlined,
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
  importStudentConductGradeMaterials,
  isExpiredUpstreamSessionError,
  listStudentPrivateProfileClassOptions,
  patchStudentConductGradeCorrections,
  type PatchStudentConductGradeCorrectionsResult,
  type PatchStudentConductGradeCorrectionStudentInput,
  readStudentConductGradePatchRowIssues,
  refreshStudentConductGradeClassFromUpstream,
  type RefreshStudentConductGradeClassResult,
  resolveStudentConductGradePatchErrorMessage,
  resolveUpstreamErrorMessage,
  type StudentConductGradeClassTermOption,
  type StudentConductGradeClassTermOptions,
  type StudentConductGradeEffectiveView,
  type StudentConductGradeFieldCell,
  type StudentConductGradeMaterialImportResult,
  type StudentConductGradePatchFieldKey,
  type StudentConductGradePatchRowIssue,
  type StudentConductGradeStudent,
  type StudentPrivateProfileClassOption,
  type StudentPrivateProfileClassOverview,
} from './api';
import { StudentConductGradeMaterialImportPanel } from './material-import-panel';
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

type ConductPatchDraft = {
  clearFieldKeys: StudentConductGradePatchFieldKey[];
  confirmedGrade?: string;
  score?: string;
};

type ConductPatchRowIssueView = StudentConductGradePatchRowIssue & {
  studentId: string | null;
};

const STUDENT_NUMBER_COLUMN_WIDTH = 98;
const STUDENT_NAME_COLUMN_WIDTH = 82;
const CONDUCT_SCORE_COLUMN_WIDTH = 72;
const CONDUCT_GRADE_COLUMN_WIDTH = 84;
const CONDUCT_PATCH_SCORE_COLUMN_WIDTH = 116;
const CONDUCT_PATCH_GRADE_COLUMN_WIDTH = 116;
const CONDUCT_PATCH_CLEAR_COLUMN_WIDTH = 150;
const CONDUCT_STATUS_COLUMN_WIDTH = 112;
const CONDUCT_ACTION_COLUMN_WIDTH = 82;
const CONDUCT_TABLE_SCROLL_X =
  STUDENT_NUMBER_COLUMN_WIDTH +
  STUDENT_NAME_COLUMN_WIDTH +
  CONDUCT_SCORE_COLUMN_WIDTH +
  CONDUCT_GRADE_COLUMN_WIDTH +
  CONDUCT_STATUS_COLUMN_WIDTH +
  CONDUCT_ACTION_COLUMN_WIDTH;
const CONDUCT_PATCH_TABLE_SCROLL_X =
  CONDUCT_TABLE_SCROLL_X +
  CONDUCT_PATCH_SCORE_COLUMN_WIDTH +
  CONDUCT_PATCH_GRADE_COLUMN_WIDTH +
  CONDUCT_PATCH_CLEAR_COLUMN_WIDTH;

const CONDUCT_CONFIRMED_GRADE_OPTIONS = ['优', '良', '中', '差'].map((grade) => ({
  label: grade,
  value: grade,
}));

const CONDUCT_PATCH_FIELD_LABELS: Record<StudentConductGradePatchFieldKey, string> = {
  confirmedGrade: '确认等级',
  score: '分数',
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

function normalizeConductPatchDraft(draft: ConductPatchDraft) {
  const score = draft.score?.trim();
  const confirmedGrade = draft.confirmedGrade?.trim();
  const clearFieldKeys = Array.from(new Set(draft.clearFieldKeys));
  const nextDraft: ConductPatchDraft = {
    clearFieldKeys,
    ...(score ? { score } : {}),
    ...(confirmedGrade ? { confirmedGrade } : {}),
  };

  if (!nextDraft.score && !nextDraft.confirmedGrade && clearFieldKeys.length === 0) {
    return null;
  }

  return nextDraft;
}

function isConductPatchClearSelected(
  draft: ConductPatchDraft | undefined,
  fieldKey: StudentConductGradePatchFieldKey,
) {
  return draft?.clearFieldKeys.includes(fieldKey) ?? false;
}

function canClearConductPatchField(
  student: StudentConductGradeStudent,
  fieldKey: StudentConductGradePatchFieldKey,
) {
  return student.manualPatchFieldKeys.includes(fieldKey);
}

function isUpstreamConductGradeField(cell: StudentConductGradeFieldCell) {
  return Boolean(cell.value !== null && cell.source === 'UPSTREAM');
}

function canPatchConductGradeStudent(student: StudentConductGradeStudent) {
  if (
    student.status === 'UPSTREAM_CONFIRMED' &&
    !canClearConductPatchField(student, 'score') &&
    !canClearConductPatchField(student, 'confirmedGrade')
  ) {
    return false;
  }

  return (
    !isUpstreamConductGradeField(student.fields.score) ||
    !isUpstreamConductGradeField(student.fields.confirmedGrade) ||
    canClearConductPatchField(student, 'score') ||
    canClearConductPatchField(student, 'confirmedGrade')
  );
}

function canPatchConductGradeView(view: StudentConductGradeEffectiveView | null) {
  return view?.students.some((student) => canPatchConductGradeStudent(student)) ?? false;
}

function buildConductPatchStudentInputs(
  students: readonly StudentConductGradeStudent[],
  drafts: Record<string, ConductPatchDraft>,
) {
  return students
    .map((student): PatchStudentConductGradeCorrectionStudentInput | null => {
      const draft = drafts[student.studentId];
      const normalizedDraft = draft ? normalizeConductPatchDraft(draft) : null;

      if (!normalizedDraft) {
        return null;
      }

      return {
        studentId: student.studentId,
        ...(normalizedDraft.score ? { score: normalizedDraft.score } : {}),
        ...(normalizedDraft.confirmedGrade
          ? { confirmedGrade: normalizedDraft.confirmedGrade }
          : {}),
        ...(normalizedDraft.clearFieldKeys.length > 0
          ? { clearFieldKeys: normalizedDraft.clearFieldKeys }
          : {}),
      };
    })
    .filter((student): student is PatchStudentConductGradeCorrectionStudentInput =>
      Boolean(student),
    );
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
  ]
    .filter(Boolean)
    .join(' ');
}

function filterConductStudents(
  students: readonly StudentConductGradeStudent[],
  input: {
    keyword: string;
  },
) {
  const keyword = input.keyword.trim().toLowerCase();

  return students
    .filter((student) => {
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

function formatPatchResultTitle(result: PatchStudentConductGradeCorrectionsResult) {
  return [
    `提交 ${result.totalRows} 行，影响学生 ${result.affectedStudents} 名`,
    `写入字段 ${result.writtenFieldCount} 个，清除补正字段 ${result.clearedFieldCount} 个`,
    `upstream 非空跳过 ${result.skippedUpstreamFieldCount} 个，自动清除旧补正 ${result.clearedUpstreamFieldCount} 个`,
    `未变化字段 ${result.unchangedFieldCount} 个`,
  ].join('。');
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
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [cleanupStudentId, setCleanupStudentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<RefreshStudentConductGradeClassResult | null>(null);
  const [patchResult, setPatchResult] = useState<PatchStudentConductGradeCorrectionsResult | null>(
    null,
  );
  const [patchDrafts, setPatchDrafts] = useState<Record<string, ConductPatchDraft>>({});
  const [patchRowIssues, setPatchRowIssues] = useState<ConductPatchRowIssueView[]>([]);
  const [materialImportFiles, setMaterialImportFiles] = useState<File[]>([]);
  const [materialImportResult, setMaterialImportResult] =
    useState<StudentConductGradeMaterialImportResult | null>(null);
  const [materialImportErrorMessage, setMaterialImportErrorMessage] = useState<string | null>(null);
  const [isPatchMode, setIsPatchMode] = useState(false);
  const [isPatchingCorrections, setIsPatchingCorrections] = useState(false);
  const [isImportingMaterial, setIsImportingMaterial] = useState(false);
  const [syncingScope, setSyncingScope] = useState<'ALL_TERMS' | 'TERM' | null>(null);
  const [upstreamActionRequest, setUpstreamActionRequest] = useState<UpstreamActionRequest | null>(
    null,
  );
  const loadRequestSeqRef = useRef(0);
  const cleanupRequestSeqRef = useRef(0);
  const materialImportRequestSeqRef = useRef(0);
  const patchRequestSeqRef = useRef(0);
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
      }),
    [conductView?.students, studentSearch],
  );
  const patchDraftCount = useMemo(() => Object.keys(patchDrafts).length, [patchDrafts]);
  const materialWarningConfirmationKeys = useMemo(
    () =>
      materialImportResult?.status === 'WARNING_CONFIRMATION_REQUIRED'
        ? materialImportResult.warnings
            .map((warning) => warning.warningKey)
            .filter((warningKey): warningKey is string => Boolean(warningKey))
        : [],
    [materialImportResult],
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
    isPatchMode ||
    isImportingMaterial ||
    isPatchingCorrections ||
    !selectedClass ||
    !selectedTerm ||
    terms.length === 0 ||
    termGenerationBlocked;
  const conductPatchDisabled =
    isLoadingCatalog ||
    isLoadingData ||
    isImportingMaterial ||
    isPatchingCorrections ||
    !selectedClass ||
    !selectedTerm ||
    !conductView ||
    termGenerationBlocked;
  const conductPatchVisible = canPatchConductGradeView(conductView);

  useEffect(() => {
    activeSelectionRef.current = {
      classOption: selectedClass,
      classId: selectedClassId,
      term: selectedTerm,
      termKey: selectedTermKey,
    };
  }, [selectedClass, selectedClassId, selectedTerm, selectedTermKey]);

  const resetPatchWorkspace = useCallback(
    (
      options: {
        keepPatchMode?: boolean;
        preserveMaterialImportResult?: boolean;
        preserveResult?: boolean;
      } = {},
    ) => {
      setIsPatchMode(Boolean(options.keepPatchMode));
      setPatchDrafts({});
      setPatchRowIssues([]);
      setMaterialImportFiles([]);
      setMaterialImportErrorMessage(null);

      if (!options.preserveResult) {
        setPatchResult(null);
      }

      if (!options.preserveMaterialImportResult) {
        setMaterialImportResult(null);
      }
    },
    [],
  );

  const updatePatchDraft = useCallback(
    (studentId: string, updater: (draft: ConductPatchDraft) => ConductPatchDraft) => {
      setPatchDrafts((currentDrafts) => {
        const currentDraft = currentDrafts[studentId] ?? {
          clearFieldKeys: [],
        };
        const nextDraft = normalizeConductPatchDraft(
          updater({
            ...currentDraft,
            clearFieldKeys: [...currentDraft.clearFieldKeys],
          }),
        );
        const nextDrafts = { ...currentDrafts };

        if (nextDraft) {
          nextDrafts[studentId] = nextDraft;
        } else {
          delete nextDrafts[studentId];
        }

        return nextDrafts;
      });
      setPatchRowIssues([]);
    },
    [],
  );

  const handlePatchFieldChange = useCallback(
    (studentId: string, fieldKey: StudentConductGradePatchFieldKey, value: string | undefined) => {
      updatePatchDraft(studentId, (draft) => {
        const nextValue = value?.trim();

        return {
          ...draft,
          [fieldKey]: nextValue || undefined,
          clearFieldKeys: draft.clearFieldKeys.filter((item) => item !== fieldKey),
        };
      });
    },
    [updatePatchDraft],
  );

  const handlePatchClearToggle = useCallback(
    (student: StudentConductGradeStudent, fieldKey: StudentConductGradePatchFieldKey) => {
      if (!canClearConductPatchField(student, fieldKey)) {
        return;
      }

      updatePatchDraft(student.studentId, (draft) => {
        const clearSelected = isConductPatchClearSelected(draft, fieldKey);
        const clearFieldKeys = clearSelected
          ? draft.clearFieldKeys.filter((item) => item !== fieldKey)
          : [...draft.clearFieldKeys, fieldKey];

        return {
          ...draft,
          [fieldKey]: undefined,
          clearFieldKeys,
        };
      });
    },
    [updatePatchDraft],
  );

  const loadSelectionData = useCallback(
    async (
      classOption: StudentPrivateProfileClassOption,
      term: StudentConductGradeClassTermOption,
      options: {
        keepPatchMode?: boolean;
        preserveMaterialImportResult?: boolean;
        preservePatchResult?: boolean;
      } = {},
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
      resetPatchWorkspace({
        keepPatchMode: options.keepPatchMode,
        preserveMaterialImportResult: options.preserveMaterialImportResult,
        preserveResult: options.preservePatchResult,
      });

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
    [resetPatchWorkspace],
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
      resetPatchWorkspace();
      setOverview(null);
      setConductView(null);
      setTerms([]);
      setTermOptions(null);
      setStudentSearch('');

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
    [resetPatchWorkspace],
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
    resetPatchWorkspace();

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
  }, [loadClassTermsAndSelection, resetPatchWorkspace]);

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

  const handleStartPatchMode = useCallback(() => {
    setErrorMessage(null);
    setMaterialImportErrorMessage(null);
    setMaterialImportFiles([]);
    setMaterialImportResult(null);
    setPatchResult(null);
    setPatchRowIssues([]);
    setIsPatchMode(true);
  }, []);

  const handleCancelPatchMode = useCallback(() => {
    resetPatchWorkspace();
  }, [resetPatchWorkspace]);

  const handleSubmitPatch = useCallback(async () => {
    if (!conductView) {
      return;
    }

    if (termGenerationBlocked) {
      setErrorMessage(termBlockingMessage);
      return;
    }

    const students = buildConductPatchStudentInputs(conductView.students, patchDrafts);

    if (students.length === 0) {
      message.warning('请先录入至少一名学生的操行补正。');
      return;
    }

    const patchSelection = activeSelectionRef.current;
    const patchRequestSeq = patchRequestSeqRef.current + 1;
    const canApplyPatchResult = () => {
      const currentSelection = activeSelectionRef.current;

      return (
        currentSelection.classId === patchSelection.classId &&
        currentSelection.termKey === patchSelection.termKey
      );
    };

    patchRequestSeqRef.current = patchRequestSeq;
    setIsPatchingCorrections(true);
    setErrorMessage(null);
    setPatchRowIssues([]);
    setPatchResult(null);

    try {
      const result = await patchStudentConductGradeCorrections({
        classCode: conductView.classCode,
        schoolYear: conductView.schoolYear,
        semester: conductView.semester,
        students,
      });

      if (!canApplyPatchResult()) {
        return;
      }

      setPatchResult(result);
      message[result.skippedUpstreamFieldCount > 0 ? 'warning' : 'success'](
        `操行补录完成：写入 ${result.writtenFieldCount} 个字段，清除 ${result.clearedFieldCount} 个字段`,
      );

      if (patchSelection.classOption && patchSelection.term) {
        await loadSelectionData(patchSelection.classOption, patchSelection.term, {
          preservePatchResult: true,
        });
      }
    } catch (error) {
      if (!canApplyPatchResult()) {
        return;
      }

      const rowIssues = readStudentConductGradePatchRowIssues(error).map((issue) => ({
        ...issue,
        studentId: issue.studentId ?? students[issue.rowIndex]?.studentId ?? null,
      }));

      setPatchRowIssues(rowIssues);
      setErrorMessage(
        resolveStudentConductGradePatchErrorMessage(
          error,
          '暂时无法保存操行补录，请检查输入后再试。',
        ),
      );
    } finally {
      if (patchRequestSeqRef.current === patchRequestSeq) {
        setIsPatchingCorrections(false);
      }
    }
  }, [
    conductView,
    loadSelectionData,
    message,
    patchDrafts,
    termBlockingMessage,
    termGenerationBlocked,
  ]);

  const handleMaterialImportFilesChange = useCallback((files: File[]) => {
    setMaterialImportFiles(files);
    setMaterialImportErrorMessage(null);
    setMaterialImportResult(null);
  }, []);

  const handleRejectMaterialImportFile = useCallback(
    (fileName: string) => {
      message.error(`${fileName} 不是支持的材料格式，请另存为 .docx / .xlsx 后上传。`);
    },
    [message],
  );

  const handleRejectTooManyMaterialImportFiles = useCallback(
    (limit: number) => {
      message.error(`单次最多选择 ${limit} 个操行材料文件。`);
    },
    [message],
  );

  const runMaterialImport = useCallback(
    async (confirmedWarningKeys: readonly string[] = []) => {
      if (!selectedClass || !selectedTerm) {
        return;
      }

      if (termGenerationBlocked) {
        setErrorMessage(termBlockingMessage);
        return;
      }

      if (materialImportFiles.length === 0) {
        message.warning('请先选择操行材料。');
        return;
      }

      const importSelection = activeSelectionRef.current;
      const importRequestSeq = materialImportRequestSeqRef.current + 1;
      const canApplyImportResult = () => {
        const currentSelection = activeSelectionRef.current;

        return (
          currentSelection.classId === importSelection.classId &&
          currentSelection.termKey === importSelection.termKey
        );
      };

      materialImportRequestSeqRef.current = importRequestSeq;
      setIsImportingMaterial(true);
      setMaterialImportErrorMessage(null);

      try {
        const result = await importStudentConductGradeMaterials({
          classCode: selectedClass.classCode,
          confirmedWarningKeys,
          files: materialImportFiles,
          schoolYear: selectedTerm.schoolYear,
          semester: selectedTerm.semester,
        });

        if (!canApplyImportResult()) {
          return;
        }

        setMaterialImportResult(result);

        if (result.status === 'WARNING_CONFIRMATION_REQUIRED') {
          message.warning('操行材料需要确认后才能导入。');
          return;
        }

        if (result.status === 'BLOCKED') {
          message.error('操行材料存在阻断问题，未写入本地补正。');
          return;
        }

        setMaterialImportFiles([]);
        message[result.status === 'NO_CHANGES' ? 'info' : 'success'](
          result.status === 'NO_CHANGES' ? '操行材料解析完成，没有新的补正。' : '操行材料已导入。',
        );

        if (importSelection.classOption && importSelection.term) {
          await loadSelectionData(importSelection.classOption, importSelection.term, {
            keepPatchMode: true,
            preserveMaterialImportResult: true,
          });
        }
      } catch (error) {
        if (!canApplyImportResult()) {
          return;
        }

        setMaterialImportErrorMessage(
          error instanceof Error ? error.message : '暂时无法导入操行材料。',
        );
      } finally {
        if (materialImportRequestSeqRef.current === importRequestSeq) {
          setIsImportingMaterial(false);
        }
      }
    },
    [
      loadSelectionData,
      materialImportFiles,
      message,
      selectedClass,
      selectedTerm,
      termBlockingMessage,
      termGenerationBlocked,
    ],
  );

  const handleConfirmMaterialImportWarnings = useCallback(() => {
    void runMaterialImport(materialWarningConfirmationKeys);
  }, [materialWarningConfirmationKeys, runMaterialImport]);

  const columns = useMemo<ColumnsType<StudentConductGradeStudent>>(() => {
    const baseColumns: ColumnsType<StudentConductGradeStudent> = [
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
      ...(isPatchMode
        ? [
            {
              ...buildStableColumnSizing<StudentConductGradeStudent>(
                CONDUCT_PATCH_SCORE_COLUMN_WIDTH,
              ),
              align: 'center' as const,
              key: 'scorePatch',
              render: (_: unknown, record: StudentConductGradeStudent) => {
                const draft = patchDrafts[record.studentId];
                const clearSelected = isConductPatchClearSelected(draft, 'score');

                return (
                  <div onClick={(event) => event.stopPropagation()}>
                    <Input
                      allowClear
                      disabled={clearSelected || isPatchingCorrections}
                      placeholder={formatFieldValue(record.fields.score)}
                      size="small"
                      value={draft?.score ?? ''}
                      onChange={(event) =>
                        handlePatchFieldChange(record.studentId, 'score', event.target.value)
                      }
                    />
                  </div>
                );
              },
              title: '分数补录',
            },
            {
              ...buildStableColumnSizing<StudentConductGradeStudent>(
                CONDUCT_PATCH_GRADE_COLUMN_WIDTH,
              ),
              align: 'center' as const,
              key: 'confirmedGradePatch',
              render: (_: unknown, record: StudentConductGradeStudent) => {
                const draft = patchDrafts[record.studentId];
                const clearSelected = isConductPatchClearSelected(draft, 'confirmedGrade');

                return (
                  <div onClick={(event) => event.stopPropagation()}>
                    <Select
                      allowClear
                      disabled={clearSelected || isPatchingCorrections}
                      options={CONDUCT_CONFIRMED_GRADE_OPTIONS}
                      placeholder={formatFieldValue(record.fields.confirmedGrade)}
                      size="small"
                      style={{ width: '100%' }}
                      value={draft?.confirmedGrade}
                      onChange={(value) =>
                        handlePatchFieldChange(record.studentId, 'confirmedGrade', value)
                      }
                    />
                  </div>
                );
              },
              title: '等级补录',
            },
            {
              ...buildStableColumnSizing<StudentConductGradeStudent>(
                CONDUCT_PATCH_CLEAR_COLUMN_WIDTH,
              ),
              align: 'center' as const,
              key: 'clearPatch',
              render: (_: unknown, record: StudentConductGradeStudent) => {
                const draft = patchDrafts[record.studentId];
                const clearableFields = (
                  ['score', 'confirmedGrade'] satisfies StudentConductGradePatchFieldKey[]
                ).filter((fieldKey) => canClearConductPatchField(record, fieldKey));

                if (clearableFields.length === 0) {
                  return <span className="text-text-secondary">-</span>;
                }

                return (
                  <Space size={4} wrap onClick={(event) => event.stopPropagation()}>
                    {clearableFields.map((fieldKey) => {
                      const clearSelected = isConductPatchClearSelected(draft, fieldKey);

                      return (
                        <Button
                          danger={clearSelected}
                          disabled={isPatchingCorrections}
                          key={fieldKey}
                          size="small"
                          type={clearSelected ? 'primary' : 'default'}
                          onClick={() => handlePatchClearToggle(record, fieldKey)}
                        >
                          {clearSelected
                            ? `取消${CONDUCT_PATCH_FIELD_LABELS[fieldKey]}`
                            : `清除${CONDUCT_PATCH_FIELD_LABELS[fieldKey]}`}
                        </Button>
                      );
                    })}
                  </Space>
                );
              },
              title: '清除补正',
            },
          ]
        : []),
      {
        ...buildStableColumnSizing<StudentConductGradeStudent>(CONDUCT_STATUS_COLUMN_WIDTH),
        align: 'center',
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => renderStatusTag(status),
        title: '数据源',
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
            {!isPatchMode && record.status === 'CORRECTION_CLEANUP_PENDING' ? (
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
    ];

    return baseColumns;
  }, [
    cleanupStudentId,
    handleCleanup,
    handlePatchClearToggle,
    handlePatchFieldChange,
    isPatchMode,
    isPatchingCorrections,
    patchDrafts,
  ]);

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
              {patchResult ? (
                <Alert
                  showIcon
                  type={patchResult.skippedUpstreamFieldCount > 0 ? 'warning' : 'success'}
                  title="操行补录完成"
                  description={formatPatchResultTitle(patchResult)}
                />
              ) : null}
              {patchRowIssues.length > 0 ? (
                <Alert
                  showIcon
                  type="error"
                  title="操行补录校验失败"
                  description={
                    <Space direction="vertical" size={2}>
                      {patchRowIssues.slice(0, 8).map((issue) => (
                        <span key={`${issue.rowIndex}-${issue.code}`}>
                          第 {issue.rowIndex + 1} 行
                          {issue.studentId ? `（${issue.studentId}）` : ''}：{issue.code}
                          {issue.message ? `，${issue.message}` : ''}
                        </span>
                      ))}
                      {patchRowIssues.length > 8 ? (
                        <span>另有 {patchRowIssues.length - 8} 条行级错误未展开。</span>
                      ) : null}
                    </Space>
                  }
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
                  {conductPatchVisible ? (
                    <Button
                      disabled={conductPatchDisabled || isPatchMode}
                      icon={<EditOutlined />}
                      onClick={handleStartPatchMode}
                    >
                      补录
                    </Button>
                  ) : null}
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
                          {isPatchMode && selectedClass && selectedTerm ? (
                            <StudentConductGradeMaterialImportPanel
                              context={{
                                classLabel: formatClassLabel(selectedClass),
                                termLabel: formatTermLabel(selectedTerm),
                              }}
                              disabled={isPatchingCorrections}
                              errorMessage={materialImportErrorMessage}
                              files={materialImportFiles}
                              isImporting={isImportingMaterial}
                              result={materialImportResult}
                              warningConfirmationKeys={materialWarningConfirmationKeys}
                              onConfirmWarnings={handleConfirmMaterialImportWarnings}
                              onFilesChange={handleMaterialImportFilesChange}
                              onImport={() => void runMaterialImport()}
                              onRejectFile={handleRejectMaterialImportFile}
                              onRejectTooManyFiles={handleRejectTooManyMaterialImportFiles}
                            />
                          ) : null}
                          <Table<StudentConductGradeStudent>
                            columns={columns}
                            dataSource={filteredStudents}
                            footer={
                              isPatchMode
                                ? () => (
                                    <div className="student-conduct-grade-governance-patch-footer">
                                      <span>
                                        已选择 {patchDraftCount} 名学生补录；空白输入不会提交。
                                      </span>
                                      <Space size="small" wrap>
                                        <Button
                                          disabled={isImportingMaterial || isPatchingCorrections}
                                          onClick={handleCancelPatchMode}
                                        >
                                          取消
                                        </Button>
                                        <Button
                                          disabled={isImportingMaterial || patchDraftCount === 0}
                                          icon={<SaveOutlined />}
                                          loading={isPatchingCorrections}
                                          type="primary"
                                          onClick={() => void handleSubmitPatch()}
                                        >
                                          保存补录
                                        </Button>
                                      </Space>
                                    </div>
                                  )
                                : undefined
                            }
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
                            rowClassName={(record, index) =>
                              buildConductRowClassName(record, index, selectedStudentId)
                            }
                            rowKey={(record) => record.studentId}
                            scroll={{
                              x: isPatchMode
                                ? CONDUCT_PATCH_TABLE_SCROLL_X
                                : CONDUCT_TABLE_SCROLL_X,
                            }}
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
