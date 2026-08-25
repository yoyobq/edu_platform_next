// src/features/student-conduct-alignment/ui/student-conduct-alignment-page-content.tsx

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
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { AcademicTermTabs } from '@/entities/academic-semester';
import {
  type StoredUpstreamSession,
  UpstreamLoginModal,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import { buildStableColumnSizing } from '@/shared/ui/stable-table';

import {
  resolveConductGradeConflictCopy,
  resolveConductGradeFieldLabel,
  resolveConductGradeSourceLabel,
} from '../application/conduct-grade-display';
import { resolveStudentConductGradeIssueMessage } from '../application/material-import-issue-display';
import {
  cleanupStudentConductGradeCorrection,
  fetchStudentConductGradeWorkspace,
  importStudentConductGradeMaterials,
  isExpiredUpstreamSessionError,
  patchStudentConductGradeCorrections,
  type PatchStudentConductGradeCorrectionsResult,
  type PatchStudentConductGradeCorrectionStudentInput,
  readStudentConductGradePatchRowIssues,
  refreshStudentConductGradeClassFromUpstream,
  type RefreshStudentConductGradeClassResult,
  resolveStudentConductGradePatchErrorMessage,
  resolveUpstreamErrorMessage,
  type StudentConductGradeEffectiveView,
  type StudentConductGradeFieldCell,
  type StudentConductGradeMaterialImportPreviewRow,
  type StudentConductGradeMaterialImportResult,
  type StudentConductGradePatchFieldKey,
  type StudentConductGradePatchRowIssue,
  type StudentConductGradeStudent,
  type StudentConductGradeWorkspace,
  type StudentConductGradeWorkspaceAction,
  type StudentConductGradeWorkspaceClassOption,
  type StudentConductGradeWorkspaceTermOption,
  type StudentConductGradeWorkspaceWarning,
} from '../infrastructure/api';

import { StudentConductGradeMaterialImportPanel } from './material-import-panel';

import './student-conduct-alignment-page-content.css';

export type StudentConductAlignmentCurrentAccount = {
  accountId: number;
  displayName: string;
  lockedUpstreamLoginUserId: string | null;
};

type PendingConductSyncRequest = {
  classOption: StudentConductGradeWorkspaceClassOption;
  scope: 'ALL_TERMS' | 'TERM';
  term?: StudentConductGradeWorkspaceTermOption;
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
const CONDUCT_STATUS_COLUMN_WIDTH = 112;
const CONDUCT_ACTION_COLUMN_WIDTH = 82;
const CONDUCT_PATCH_ACTION_COLUMN_WIDTH = 170;
const CONDUCT_TABLE_SCROLL_X =
  STUDENT_NUMBER_COLUMN_WIDTH +
  STUDENT_NAME_COLUMN_WIDTH +
  CONDUCT_SCORE_COLUMN_WIDTH +
  CONDUCT_GRADE_COLUMN_WIDTH +
  CONDUCT_STATUS_COLUMN_WIDTH +
  CONDUCT_ACTION_COLUMN_WIDTH;
const CONDUCT_PATCH_TABLE_SCROLL_X =
  CONDUCT_TABLE_SCROLL_X -
  CONDUCT_SCORE_COLUMN_WIDTH -
  CONDUCT_GRADE_COLUMN_WIDTH +
  CONDUCT_PATCH_SCORE_COLUMN_WIDTH +
  CONDUCT_PATCH_GRADE_COLUMN_WIDTH -
  CONDUCT_ACTION_COLUMN_WIDTH +
  CONDUCT_PATCH_ACTION_COLUMN_WIDTH;

const CONDUCT_CONFIRMED_GRADE_OPTIONS = ['优', '良', '中', '差'].map((grade) => ({
  label: grade,
  value: grade,
}));

const CONDUCT_PATCH_FIELD_KEYS = [
  'score',
  'confirmedGrade',
] satisfies StudentConductGradePatchFieldKey[];
const UPSTREAM_CHANGED_SINCE_CORRECTION = 'UPSTREAM_CHANGED_SINCE_CORRECTION';

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

function buildTermKey(term: StudentConductGradeWorkspaceTermOption) {
  return String(term.semesterId);
}

function formatTermLabel(term: StudentConductGradeWorkspaceTermOption) {
  return term.label;
}

function formatClassLabel(option: StudentConductGradeWorkspaceClassOption) {
  return `${option.className || option.classCode}（${option.classCode}）`;
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

function listClearableConductPatchFields(student: StudentConductGradeStudent) {
  return CONDUCT_PATCH_FIELD_KEYS.filter((fieldKey) =>
    canClearConductPatchField(student, fieldKey),
  );
}

function areAllConductPatchClearFieldsSelected(
  draft: ConductPatchDraft | undefined,
  fieldKeys: readonly StudentConductGradePatchFieldKey[],
) {
  return (
    fieldKeys.length > 0 &&
    fieldKeys.every((fieldKey) => isConductPatchClearSelected(draft, fieldKey))
  );
}

function hasConductGradeConflict(student: StudentConductGradeStudent) {
  return (
    student.conflictCodes.length > 0 ||
    student.fields.score.conflict ||
    student.fields.estimatedGrade.conflict ||
    student.fields.confirmedGrade.conflict
  );
}

function isUpstreamConductGradeField(cell: StudentConductGradeFieldCell) {
  return Boolean(cell.value !== null && cell.source === 'UPSTREAM_CONFIRMED');
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

function buildMaterialImportPreviewDrafts(
  rows: readonly StudentConductGradeMaterialImportPreviewRow[],
) {
  return Object.fromEntries(
    rows.flatMap((row) => {
      const draft = normalizeConductPatchDraft({
        clearFieldKeys: [],
        ...(row.score ? { score: row.score } : {}),
        ...(row.confirmedGrade ? { confirmedGrade: row.confirmedGrade } : {}),
      });

      return draft ? [[row.studentId, draft]] : [];
    }),
  );
}

function mergeMaterialImportPreviewDrafts(
  currentDrafts: Record<string, ConductPatchDraft>,
  rows: readonly StudentConductGradeMaterialImportPreviewRow[],
) {
  const nextDrafts = { ...currentDrafts };

  rows.forEach((row) => {
    const currentDraft = currentDrafts[row.studentId] ?? {
      clearFieldKeys: [],
    };
    const scoreClearSelected = currentDraft.clearFieldKeys.includes('score');
    const gradeClearSelected = currentDraft.clearFieldKeys.includes('confirmedGrade');
    const nextDraft = normalizeConductPatchDraft({
      clearFieldKeys: [...currentDraft.clearFieldKeys],
      ...(currentDraft.score
        ? { score: currentDraft.score }
        : !scoreClearSelected && row.score
          ? { score: row.score }
          : {}),
      ...(currentDraft.confirmedGrade
        ? { confirmedGrade: currentDraft.confirmedGrade }
        : !gradeClearSelected && row.confirmedGrade
          ? { confirmedGrade: row.confirmedGrade }
          : {}),
    });

    if (nextDraft) {
      nextDrafts[row.studentId] = nextDraft;
    } else {
      delete nextDrafts[row.studentId];
    }
  });

  return nextDrafts;
}

function renderFieldCell(cell: StudentConductGradeFieldCell) {
  return <span>{formatFieldValue(cell)}</span>;
}

function renderFieldDetail(cell: StudentConductGradeFieldCell) {
  const conflictCopy = cell.conflict ? resolveConductGradeConflictCopy(cell.conflict) : null;

  return (
    <Space size={4} wrap>
      <span>{formatFieldValue(cell)}</span>
      <Tag>{resolveConductGradeSourceLabel(cell.source)}</Tag>
      {conflictCopy ? (
        <Tooltip title={conflictCopy.description}>
          <Tag color="orange">{conflictCopy.label}</Tag>
        </Tooltip>
      ) : null}
    </Space>
  );
}

function listBaselineConflictFieldLabels(student: StudentConductGradeStudent) {
  return (
    [
      ['score', student.fields.score],
      ['estimatedGrade', student.fields.estimatedGrade],
      ['confirmedGrade', student.fields.confirmedGrade],
    ] as const
  )
    .filter(([, cell]) => cell.conflict === UPSTREAM_CHANGED_SINCE_CORRECTION)
    .map(([fieldKey]) => resolveConductGradeFieldLabel(fieldKey));
}

function listMissingBaselineConflictFieldLabels(student: StudentConductGradeStudent) {
  return (
    [
      ['score', student.fields.score],
      ['estimatedGrade', student.fields.estimatedGrade],
      ['confirmedGrade', student.fields.confirmedGrade],
    ] as const
  )
    .filter(
      ([, cell]) =>
        cell.conflict === UPSTREAM_CHANGED_SINCE_CORRECTION && cell.source === 'MISSING',
    )
    .map(([fieldKey]) => resolveConductGradeFieldLabel(fieldKey));
}

function renderTargetTermSnapshotAlert(missingSnapshotCount: number) {
  return (
    <Alert
      showIcon
      type="warning"
      title="目标学期正式名单存在未初始化快照"
      description={
        <span>
          当前学期正式名单有 {missingSnapshotCount}{' '}
          名学生缺少主快照。页面仍按后端名单展示；同步或补录前可到{' '}
          <a href="/class-affairs/student-profile-filing">学生建档</a>
          完成初始化。
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
      ? 'student-conduct-alignment-row-even'
      : 'student-conduct-alignment-row-odd',
    record.studentId === selectedStudentId ? 'student-conduct-alignment-row-selected' : null,
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
  term: Pick<
    RefreshStudentConductGradeClassResult['termResults'][number],
    'schoolYear' | 'semester'
  >,
  knownTerms: readonly StudentConductGradeWorkspaceTermOption[],
) {
  return (
    knownTerms.find(
      (knownTerm) =>
        String(knownTerm.schoolYear) === term.schoolYear &&
        String(knownTerm.termNumber) === term.semester,
    )?.label ?? `${term.schoolYear}/${term.semester}`
  );
}

function formatSyncResultTitle(
  result: RefreshStudentConductGradeClassResult,
  knownTerms: readonly StudentConductGradeWorkspaceTermOption[],
) {
  const termSummary = result.termResults
    .map((term) => `${resolveTermResultLabel(term, knownTerms)} ${term.status}`)
    .join('；');
  const failureSummary = (result.failures ?? [])
    .slice(0, 3)
    .map((failure) => {
      const studentLabel = failure.studentNumber ? `${failure.studentNumber}：` : '';
      return `${studentLabel}${resolveStudentConductGradeIssueMessage(
        failure,
        '该操行批次处理失败。',
      )}`;
    })
    .join('；');

  return [
    `登记批次 ${result.requestedRegistrationCount} 个，确认 ${result.confirmedRegistrationCount} 个，处理 ${result.processedRegistrationCount} 个，跳过 ${result.skippedRegistrationCount} 个`,
    `写入学生 ${result.writtenStudentCount} 名，新建 ${result.createdCount} 条，更新 ${result.updatedCount} 条，未变化 ${result.unchangedCount} 条，失败 ${result.failureCount} 条`,
    termSummary ? `批次：${termSummary}` : null,
    failureSummary ? `失败详情：${failureSummary}` : null,
    (result.failures?.length ?? 0) > 3
      ? `另有 ${(result.failures?.length ?? 0) - 3} 条失败未展开`
      : null,
    result.traceId ? `traceId：${result.traceId}` : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join('。');
}

function formatRosterEligibilitySummary(view: StudentConductGradeEffectiveView) {
  const summary = view.rosterEligibilitySummary;

  return [
    summary.excludedNotCheckedInCount > 0
      ? `确认未报到排除 ${summary.excludedNotCheckedInCount} 人`
      : null,
    summary.excludedAfterExitCount > 0 ? `离开裁定排除 ${summary.excludedAfterExitCount} 人` : null,
    summary.excludedBeforeEntryCount > 0
      ? `尚未进入该班排除 ${summary.excludedBeforeEntryCount} 人`
      : null,
    summary.unresolvedEffectiveSemesterCount > 0
      ? `生效学期不明确并保守保留 ${summary.unresolvedEffectiveSemesterCount} 人`
      : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join('；');
}

function formatPatchResultTitle(result: PatchStudentConductGradeCorrectionsResult) {
  return [
    `提交 ${result.totalRows} 行，影响学生 ${result.affectedStudents} 名`,
    `写入字段 ${result.writtenFieldCount} 个，清除补正字段 ${result.clearedFieldCount} 个`,
    `校园网已有值跳过 ${result.skippedUpstreamFieldCount} 个，自动清除旧补正 ${result.clearedUpstreamFieldCount} 个`,
    `未变化字段 ${result.unchangedFieldCount} 个`,
  ].join('。');
}

type StudentConductAlignmentPageContentProps = {
  currentAccount: StudentConductAlignmentCurrentAccount;
  initialClassId?: string;
  initialSemesterId?: number;
};

export function StudentConductAlignmentPageContent({
  currentAccount,
  initialClassId,
  initialSemesterId,
}: StudentConductAlignmentPageContentProps) {
  const { message, modal } = App.useApp();
  const [classes, setClasses] = useState<StudentConductGradeWorkspaceClassOption[]>([]);
  const [terms, setTerms] = useState<StudentConductGradeWorkspaceTermOption[]>([]);
  const [workspaceStatus, setWorkspaceStatus] = useState('NO_CLASSES');
  const [workspaceActions, setWorkspaceActions] = useState<StudentConductGradeWorkspaceAction[]>(
    [],
  );
  const [workspaceWarnings, setWorkspaceWarnings] = useState<StudentConductGradeWorkspaceWarning[]>(
    [],
  );
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedTermKey, setSelectedTermKey] = useState<string | null>(null);
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
  const [materialImportPreviewDrafts, setMaterialImportPreviewDrafts] = useState<
    Record<string, ConductPatchDraft>
  >({});
  const [patchRowIssues, setPatchRowIssues] = useState<ConductPatchRowIssueView[]>([]);
  const [materialImportFiles, setMaterialImportFiles] = useState<File[]>([]);
  const [materialImportResult, setMaterialImportResult] =
    useState<StudentConductGradeMaterialImportResult | null>(null);
  const [hasMaterialImportPatchDrafts, setHasMaterialImportPatchDrafts] = useState(false);
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
  const initialSelectionRef = useRef({
    classId: initialClassId,
    semesterId: initialSemesterId,
  });
  const activeSelectionRef = useRef<{
    classOption: StudentConductGradeWorkspaceClassOption | null;
    classId: string | null;
    term: StudentConductGradeWorkspaceTermOption | null;
    termKey: string | null;
  }>({
    classOption: null,
    classId: null,
    term: null,
    termKey: null,
  });
  const lockedUpstreamLoginUserId = currentAccount.lockedUpstreamLoginUserId;
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
  const selectedStudentBaselineConflictFields = useMemo(
    () => (selectedStudent ? listBaselineConflictFieldLabels(selectedStudent) : []),
    [selectedStudent],
  );
  const selectedStudentMissingConflictFields = useMemo(
    () => (selectedStudent ? listMissingBaselineConflictFieldLabels(selectedStudent) : []),
    [selectedStudent],
  );
  const selectedStudentCanReviewCorrection =
    selectedStudent?.manualPatchFieldKeys.some((fieldKey) =>
      CONDUCT_PATCH_FIELD_KEYS.includes(fieldKey as StudentConductGradePatchFieldKey),
    ) ?? false;
  const workspaceActionByCode = useMemo(
    () => new Map(workspaceActions.map((action) => [action.action, action])),
    [workspaceActions],
  );
  const termGenerationBlocked = workspaceStatus === 'CLASS_CONFIG_MISSING';
  const termBlockingMessage =
    selectedClass?.blockingReasonMessage || '当前班级缺少生成操行学期所需配置。';
  const filteredStudents = useMemo(
    () =>
      filterConductStudents(conductView?.students ?? [], {
        keyword: studentSearch,
      }),
    [conductView?.students, studentSearch],
  );
  const targetTermMissingSnapshotCount = useMemo(
    () => conductView?.students.filter((student) => !student.mainSnapshotPresent).length ?? 0,
    [conductView?.students],
  );
  const baselineConflictCount = useMemo(
    () =>
      conductView?.students.filter(
        (student) => student.status === UPSTREAM_CHANGED_SINCE_CORRECTION,
      ).length ?? 0,
    [conductView?.students],
  );
  const rosterEligibilityDescription = conductView
    ? formatRosterEligibilitySummary(conductView)
    : '';
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
  const hasPendingMaterialImportConfirmation = materialWarningConfirmationKeys.length > 0;
  const materialImportPreviewDraftCount = useMemo(
    () => Object.keys(materialImportPreviewDrafts).length,
    [materialImportPreviewDrafts],
  );
  const shouldConfirmLeavingPatchMode =
    isPatchMode &&
    (isImportingMaterial ||
      hasPendingMaterialImportConfirmation ||
      hasMaterialImportPatchDrafts ||
      materialImportPreviewDraftCount > 0);
  const conductSyncMenuItems = useMemo<MenuProps['items']>(
    () => [
      {
        disabled:
          !selectedTerm || workspaceActionByCode.get('REFRESH_SELECTED_TERM')?.allowed !== true,
        key: 'TERM',
        label: selectedTerm ? `同步所选学期（${formatTermLabel(selectedTerm)}）` : '同步所选学期',
      },
      {
        disabled: workspaceActionByCode.get('REFRESH_ALL_TERMS')?.allowed !== true,
        key: 'ALL_TERMS',
        label: '同步该班全部学期',
      },
    ],
    [selectedTerm, workspaceActionByCode],
  );
  const conductSyncDisabled =
    isLoadingCatalog ||
    isLoadingData ||
    isPatchMode ||
    isImportingMaterial ||
    isPatchingCorrections ||
    !selectedClass ||
    (workspaceActionByCode.get('REFRESH_SELECTED_TERM')?.allowed !== true &&
      workspaceActionByCode.get('REFRESH_ALL_TERMS')?.allowed !== true);
  const conductPatchDisabled =
    isLoadingCatalog ||
    isLoadingData ||
    isImportingMaterial ||
    isPatchingCorrections ||
    !selectedClass ||
    !selectedTerm ||
    !conductView ||
    workspaceActionByCode.get('PATCH_CORRECTIONS')?.allowed !== true;
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
      setMaterialImportPreviewDrafts({});
      setHasMaterialImportPatchDrafts(false);
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

  const confirmLeavingPatchMode = useCallback(
    async (leave: () => Promise<void> | void) => {
      if (!shouldConfirmLeavingPatchMode) {
        await leave();
        return;
      }

      modal.confirm({
        title: '离开补录操作？',
        content: '当前补录材料已经处理过，但尚未通过“保存补录”落库。现在离开会丢弃这些内容。',
        okText: '确认离开',
        cancelText: '继续补录',
        onOk: async () => {
          await leave();
        },
      });
    },
    [modal, shouldConfirmLeavingPatchMode],
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

  const handlePatchClearAllToggle = useCallback(
    (student: StudentConductGradeStudent) => {
      const clearableFields = listClearableConductPatchFields(student);

      if (clearableFields.length === 0) {
        return;
      }

      updatePatchDraft(student.studentId, (draft) => {
        const clearSelected = areAllConductPatchClearFieldsSelected(draft, clearableFields);
        const clearFieldKeys = clearSelected
          ? draft.clearFieldKeys.filter((fieldKey) => !clearableFields.includes(fieldKey))
          : Array.from(new Set([...draft.clearFieldKeys, ...clearableFields]));
        const shouldClearScore = clearableFields.includes('score');
        const shouldClearConfirmedGrade = clearableFields.includes('confirmedGrade');

        return {
          ...draft,
          ...(shouldClearScore ? { score: undefined } : {}),
          ...(shouldClearConfirmedGrade ? { confirmedGrade: undefined } : {}),
          clearFieldKeys,
        };
      });
    },
    [updatePatchDraft],
  );

  const applyWorkspaceResult = useCallback((workspace: StudentConductGradeWorkspace) => {
    const nextTermKey = workspace.selectedTerm ? buildTermKey(workspace.selectedTerm) : null;

    setClasses(workspace.classOptions);
    setSelectedClassId(workspace.selectedClass?.id ?? null);
    setTerms(workspace.termOptions);
    setWorkspaceStatus(workspace.status);
    setSelectedTermKey(nextTermKey);
    setWorkspaceActions(workspace.actions);
    setWorkspaceWarnings(workspace.warnings);
    setConductView(workspace.view);
    activeSelectionRef.current = {
      classOption: workspace.selectedClass,
      classId: workspace.selectedClass?.id ?? null,
      term: workspace.selectedTerm,
      termKey: nextTermKey,
    };
  }, []);

  const loadSelectionData = useCallback(
    async (
      classOption: StudentConductGradeWorkspaceClassOption,
      term: StudentConductGradeWorkspaceTermOption,
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
        const workspace = await fetchStudentConductGradeWorkspace({
          classId: classOption.id,
          semesterId: term.semesterId,
        });

        if (loadRequestSeqRef.current !== requestSeq) {
          return;
        }

        applyWorkspaceResult(workspace);
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
    [applyWorkspaceResult, resetPatchWorkspace],
  );

  const loadClassTermsAndSelection = useCallback(
    async (
      classOption: StudentConductGradeWorkspaceClassOption,
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
      setConductView(null);
      setTerms([]);
      setStudentSearch('');

      try {
        const preferredSemesterId = input.preferredTermKey
          ? terms.find((term) => buildTermKey(term) === input.preferredTermKey)?.semesterId
          : undefined;
        const workspace = await fetchStudentConductGradeWorkspace({
          classId: classOption.id,
          semesterId: preferredSemesterId,
        });

        if (loadRequestSeqRef.current !== requestSeq) {
          return;
        }

        applyWorkspaceResult(workspace);
      } catch (error) {
        if (loadRequestSeqRef.current !== requestSeq) {
          return;
        }

        setWorkspaceStatus('NO_TERMS');
        setTerms([]);
        setSelectedTermKey(null);
        setConductView(null);
        setErrorMessage(error instanceof Error ? error.message : '暂时无法加载操行对齐入口。');
      } finally {
        if (loadRequestSeqRef.current === requestSeq) {
          setIsLoadingData(false);
        }
      }
    },
    [applyWorkspaceResult, resetPatchWorkspace, terms],
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
          classId: action.classOption.id,
          scope: action.scope === 'TERM' ? 'SELECTED_TERM' : 'ALL_TERMS',
          semesterId: action.term?.semesterId,
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

          setErrorMessage(resolveUpstreamErrorMessage(error, '暂时无法从校园网同步操行数据。'));
          return;
        }

        if (!canApplySyncResult()) {
          return;
        }

        try {
          const refreshedSession = await refreshSession(session);
          const result = await refreshStudentConductGradeClassFromUpstream({
            classId: action.classOption.id,
            scope: action.scope === 'TERM' ? 'SELECTED_TERM' : 'ALL_TERMS',
            semesterId: action.term?.semesterId,
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
              '学工系统会话已失效，请重新登录后继续校园网同步。',
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
      const workspace = await fetchStudentConductGradeWorkspace(initialSelectionRef.current);

      applyWorkspaceResult(workspace);
      setStudentSearch('');
    } catch (error) {
      setClasses([]);
      setTerms([]);
      setWorkspaceStatus('NO_CLASSES');
      setSelectedClassId(null);
      setSelectedTermKey(null);
      setConductView(null);
      setWorkspaceActions([]);
      setWorkspaceWarnings([]);
      setErrorMessage(error instanceof Error ? error.message : '暂时无法加载操行对齐入口。');
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [applyWorkspaceResult, resetPatchWorkspace]);

  const reloadCurrentSelection = useCallback(async () => {
    await confirmLeavingPatchMode(async () => {
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
    });
  }, [
    confirmLeavingPatchMode,
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
      await confirmLeavingPatchMode(async () => {
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
      });
    },
    [classes, confirmLeavingPatchMode, loadClassTermsAndSelection],
  );

  const handleTermChange = useCallback(
    async (termKey: string) => {
      await confirmLeavingPatchMode(async () => {
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
      });
    },
    [confirmLeavingPatchMode, loadSelectionData, selectedClass, terms],
  );

  const handleCleanup = useCallback(
    async (student: StudentConductGradeStudent) => {
      if (
        !conductView ||
        !selectedClass ||
        !selectedTerm ||
        student.status !== 'CORRECTION_CLEANUP_PENDING'
      ) {
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
          classId: selectedClass.id,
          semesterId: selectedTerm.semesterId,
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
    [
      conductView,
      loadSelectionData,
      message,
      selectedClass,
      selectedTerm,
      termBlockingMessage,
      termGenerationBlocked,
    ],
  );

  const handleStartPatchMode = useCallback(() => {
    setErrorMessage(null);
    setMaterialImportErrorMessage(null);
    setMaterialImportFiles([]);
    setMaterialImportResult(null);
    setMaterialImportPreviewDrafts({});
    setHasMaterialImportPatchDrafts(false);
    setPatchResult(null);
    setPatchRowIssues([]);
    setIsPatchMode(true);
  }, []);

  const handleStartStudentConflictReview = useCallback(
    (student: StudentConductGradeStudent) => {
      if (!isPatchMode) {
        handleStartPatchMode();
      }
      setStudentSearch(student.studentId);
      setSelectedStudentId(null);
      const missingFields = listMissingBaselineConflictFieldLabels(student);
      const missingNotice = missingFields.length
        ? `当前校园网没有${missingFields.join('、')}；清除旧补正后将显示“缺失”。`
        : '';
      message[missingFields.length ? 'warning' : 'info'](
        `已定位到该学生。${missingNotice}请重新填写需要保留的补正，或选择“清除补正”后保存。`,
      );
    },
    [handleStartPatchMode, isPatchMode, message],
  );

  const handleCancelPatchMode = useCallback(() => {
    void confirmLeavingPatchMode(() => {
      resetPatchWorkspace();
    });
  }, [confirmLeavingPatchMode, resetPatchWorkspace]);

  const handleSubmitPatch = useCallback(async () => {
    if (!conductView || !selectedClass || !selectedTerm) {
      return;
    }

    if (termGenerationBlocked) {
      setErrorMessage(termBlockingMessage);
      return;
    }

    if (hasPendingMaterialImportConfirmation) {
      message.warning('请先确认或取消当前材料导入。');
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
        classId: selectedClass.id,
        semesterId: selectedTerm.semesterId,
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
        message: resolveStudentConductGradeIssueMessage(issue, '该学生的操行补录数据不符合要求。'),
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
    hasPendingMaterialImportConfirmation,
    loadSelectionData,
    message,
    patchDrafts,
    selectedClass,
    selectedTerm,
    termBlockingMessage,
    termGenerationBlocked,
  ]);

  const handleMaterialImportFilesChange = useCallback((files: File[]) => {
    setMaterialImportFiles(files);
    setMaterialImportErrorMessage(null);
    setMaterialImportPreviewDrafts({});
    setMaterialImportResult(null);
  }, []);

  const handleRejectMaterialImportFile = useCallback(
    (fileName: string) => {
      message.error(`${fileName} 不是支持的材料格式，请上传 .doc / .docx / .xls / .xlsx 文件。`);
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
    async (
      confirmedWarningKeys: readonly string[] = [],
      selectedMaterialFiles: readonly File[] = materialImportFiles,
    ) => {
      if (!selectedClass || !selectedTerm) {
        return;
      }

      if (termGenerationBlocked) {
        setErrorMessage(termBlockingMessage);
        return;
      }

      if (selectedMaterialFiles.length === 0) {
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
          files: selectedMaterialFiles,
          schoolYear: String(selectedTerm.schoolYear),
          semester: String(selectedTerm.termNumber),
        });

        if (!canApplyImportResult()) {
          return;
        }

        setMaterialImportResult(result);

        if (result.status === 'WARNING_CONFIRMATION_REQUIRED') {
          setMaterialImportPreviewDrafts(buildMaterialImportPreviewDrafts(result.previewRows));
          message.warning('请先确认材料提示，再继续解析。');
          return;
        }

        setMaterialImportPreviewDrafts({});

        if (result.status === 'BLOCKED') {
          message.error('操行材料存在阻断问题，未写入本地补正。');
          return;
        }

        if (result.status === 'NO_CHANGES') {
          setMaterialImportFiles([]);
          message.info('操行材料解析完成，没有新的补正。');
          return;
        }

        setPatchDrafts((currentDrafts) =>
          mergeMaterialImportPreviewDrafts(currentDrafts, result.previewRows),
        );
        setPatchRowIssues([]);
        setHasMaterialImportPatchDrafts(result.previewRows.length > 0);
        setMaterialImportFiles([]);
        message.success('已从材料预填补录草稿，请检查后保存补录。');
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
      materialImportFiles,
      message,
      selectedClass,
      selectedTerm,
      termBlockingMessage,
      termGenerationBlocked,
    ],
  );

  const handleMaterialImportFilesSelected = useCallback(
    (files: File[]) => {
      handleMaterialImportFilesChange(files);
      void runMaterialImport([], files);
    },
    [handleMaterialImportFilesChange, runMaterialImport],
  );

  const handleConfirmMaterialImportWarnings = useCallback(() => {
    if (materialImportResult?.status !== 'WARNING_CONFIRMATION_REQUIRED') {
      return;
    }

    void runMaterialImport(materialWarningConfirmationKeys, materialImportFiles);
  }, [
    materialImportFiles,
    materialImportResult?.status,
    materialWarningConfirmationKeys,
    runMaterialImport,
  ]);

  const renderPatchActionButtons = () => (
    <Space size="small" wrap>
      <Button
        disabled={isImportingMaterial || isPatchingCorrections}
        onClick={handleCancelPatchMode}
      >
        离开补录操作
      </Button>
      <Button
        disabled={
          isImportingMaterial || hasPendingMaterialImportConfirmation || patchDraftCount === 0
        }
        icon={<SaveOutlined />}
        loading={isPatchingCorrections}
        type="primary"
        onClick={() => void handleSubmitPatch()}
      >
        保存补录
      </Button>
    </Space>
  );

  const renderPatchActionBar = () => (
    <div className="student-conduct-alignment-patch-action-bar">
      <span>
        {hasPendingMaterialImportConfirmation
          ? '材料导入等待确认；请在提示框内确认，或离开补录操作。'
          : `已选择 ${patchDraftCount} 名学生补录；只提交已修改或清除字段。`}
      </span>
      {renderPatchActionButtons()}
    </div>
  );

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
        ...buildStableColumnSizing<StudentConductGradeStudent>(
          isPatchMode ? CONDUCT_PATCH_SCORE_COLUMN_WIDTH : CONDUCT_SCORE_COLUMN_WIDTH,
        ),
        align: 'center',
        key: 'score',
        render: (_, record) => {
          if (!isPatchMode) {
            return renderFieldCell(record.fields.score);
          }

          const draft = patchDrafts[record.studentId];
          const previewDraft = hasPendingMaterialImportConfirmation
            ? materialImportPreviewDrafts[record.studentId]
            : undefined;
          const clearSelected = isConductPatchClearSelected(draft, 'score');

          return (
            <div onClick={(event) => event.stopPropagation()}>
              <Input
                allowClear
                disabled={
                  clearSelected || isPatchingCorrections || hasPendingMaterialImportConfirmation
                }
                placeholder={formatFieldValue(record.fields.score)}
                size="small"
                value={draft?.score ?? previewDraft?.score ?? ''}
                onChange={(event) =>
                  handlePatchFieldChange(record.studentId, 'score', event.target.value)
                }
              />
            </div>
          );
        },
        title: '分数',
      },
      {
        ...buildStableColumnSizing<StudentConductGradeStudent>(
          isPatchMode ? CONDUCT_PATCH_GRADE_COLUMN_WIDTH : CONDUCT_GRADE_COLUMN_WIDTH,
        ),
        align: 'center',
        key: 'confirmedGrade',
        render: (_, record) => {
          if (!isPatchMode) {
            return renderConfirmedGradeCell(
              record.fields.confirmedGrade,
              record.fields.estimatedGrade,
            );
          }

          const draft = patchDrafts[record.studentId];
          const previewDraft = hasPendingMaterialImportConfirmation
            ? materialImportPreviewDrafts[record.studentId]
            : undefined;
          const clearSelected = isConductPatchClearSelected(draft, 'confirmedGrade');

          return (
            <div onClick={(event) => event.stopPropagation()}>
              <Select
                allowClear
                disabled={
                  clearSelected || isPatchingCorrections || hasPendingMaterialImportConfirmation
                }
                options={CONDUCT_CONFIRMED_GRADE_OPTIONS}
                placeholder={formatFieldValue(record.fields.confirmedGrade)}
                size="small"
                style={{ width: '100%' }}
                value={draft?.confirmedGrade ?? previewDraft?.confirmedGrade}
                onChange={(value) =>
                  handlePatchFieldChange(record.studentId, 'confirmedGrade', value)
                }
              />
            </div>
          );
        },
        title: '确认等级',
      },
      {
        ...buildStableColumnSizing<StudentConductGradeStudent>(CONDUCT_STATUS_COLUMN_WIDTH),
        align: 'center',
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => renderStatusTag(status),
        title: '数据源',
      },
      {
        ...buildStableColumnSizing<StudentConductGradeStudent>(
          isPatchMode ? CONDUCT_PATCH_ACTION_COLUMN_WIDTH : CONDUCT_ACTION_COLUMN_WIDTH,
        ),
        align: 'center',
        key: 'actions',
        render: (_, record) => {
          const draft = patchDrafts[record.studentId];
          const clearableFields = listClearableConductPatchFields(record);
          const clearSelected = areAllConductPatchClearFieldsSelected(draft, clearableFields);
          const hasConflict = hasConductGradeConflict(record);

          return (
            <Space size={4} wrap onClick={(event) => event.stopPropagation()}>
              {isPatchMode && clearableFields.length > 0 ? (
                <Button
                  danger={clearSelected}
                  disabled={isPatchingCorrections || hasPendingMaterialImportConfirmation}
                  icon={<ClearOutlined />}
                  size="small"
                  type={clearSelected ? 'primary' : 'default'}
                  onClick={() => handlePatchClearAllToggle(record)}
                >
                  {clearSelected ? '取消清除' : '清除补正'}
                </Button>
              ) : null}
              {hasConflict ? (
                <Button
                  size="small"
                  type="link"
                  onClick={() => setSelectedStudentId(record.studentId)}
                >
                  {record.status === UPSTREAM_CHANGED_SINCE_CORRECTION ? '复核' : '查看冲突'}
                </Button>
              ) : null}
              {!isPatchMode && record.status === 'CORRECTION_CLEANUP_PENDING' ? (
                <Popconfirm
                  title="清理已失效本地补正？"
                  description="清理只会移除已失效的本地补正，不会覆盖校园网数据。"
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
          );
        },
        title: '操作',
      },
    ];

    return baseColumns;
  }, [
    cleanupStudentId,
    handleCleanup,
    handlePatchClearAllToggle,
    handlePatchFieldChange,
    hasPendingMaterialImportConfirmation,
    isPatchMode,
    isPatchingCorrections,
    materialImportPreviewDrafts,
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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-6">
      <DecoratedPageHeader
        description="对齐校园网操行数据，补齐历史材料，处理本地补正与冲突。"
        icon={<AuditOutlined />}
        title="操行对齐"
      />

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
            {workspaceWarnings.length > 0 ? (
              <Alert
                showIcon
                type="warning"
                title="部分真实学期尚未配置"
                description={workspaceWarnings.map((warning) => warning.message).join('；')}
              />
            ) : null}
            {targetTermMissingSnapshotCount > 0
              ? renderTargetTermSnapshotAlert(targetTermMissingSnapshotCount)
              : null}
            {rosterEligibilityDescription ? (
              <Alert
                showIcon
                description={rosterEligibilityDescription}
                title="名单已按目标学期校准"
                type={
                  conductView?.rosterEligibilitySummary.unresolvedEffectiveSemesterCount
                    ? 'warning'
                    : 'info'
                }
              />
            ) : null}
            {baselineConflictCount > 0 ? (
              <Alert
                showIcon
                description="校园网记录在本地补正后发生了变化，旧补正已暂停生效。请点击对应学生操作列的“复核”，确认保留或清除补正。"
                title={`有 ${baselineConflictCount} 名学生的操行补正需要复核`}
                type="warning"
              />
            ) : null}
            {syncResult ? (
              <Alert
                showIcon
                type={syncResult.failureCount > 0 ? 'warning' : 'success'}
                title="校园网操行同步完成"
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
                        第 {issue.rowIndex + 1} 行{issue.studentId ? `（${issue.studentId}）` : ''}
                        ：{issue.code}
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
                  本地读取
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
                    校园网同步
                  </Button>
                </Dropdown>
                {conductPatchVisible ? (
                  <Button
                    color="primary"
                    disabled={conductPatchDisabled || isPatchMode}
                    icon={<EditOutlined />}
                    variant="filled"
                    onClick={handleStartPatchMode}
                  >
                    补录
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="student-conduct-alignment-table-shell">
          {isLoadingCatalog ? (
            <div className="flex min-h-80 items-center justify-center">
              <Spin size="large" />
            </div>
          ) : selectedClass && terms.length > 0 && !termGenerationBlocked ? (
            <AcademicTermTabs
              activeSemesterId={selectedTerm?.semesterId}
              disabled={isLoadingData || syncingScope !== null || isPatchingCorrections}
              records={terms}
              onChange={(semesterId) => void handleTermChange(String(semesterId))}
            >
              {isLoadingData ? (
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
                      patchActionBar={renderPatchActionBar()}
                      result={materialImportResult}
                      warningConfirmationKeys={materialWarningConfirmationKeys}
                      onConfirmWarnings={handleConfirmMaterialImportWarnings}
                      onFilesChange={handleMaterialImportFilesChange}
                      onFilesSelected={handleMaterialImportFilesSelected}
                      onRejectFile={handleRejectMaterialImportFile}
                      onRejectTooManyFiles={handleRejectTooManyMaterialImportFiles}
                    />
                  ) : null}
                  <Table<StudentConductGradeStudent>
                    columns={columns}
                    dataSource={filteredStudents}
                    locale={{
                      emptyText: (
                        <Empty description="暂无操行数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                      x: isPatchMode ? CONDUCT_PATCH_TABLE_SCROLL_X : CONDUCT_TABLE_SCROLL_X,
                    }}
                    size="small"
                    tableLayout="fixed"
                  />
                </div>
              ) : (
                <div className="flex min-h-80 items-center justify-center">
                  <Empty description="暂无操行有效视图" />
                </div>
              )}
            </AcademicTermTabs>
          ) : (
            <div className="flex min-h-80 items-center justify-center">
              <Empty
                description={
                  selectedClass
                    ? termGenerationBlocked
                      ? termBlockingMessage
                      : '暂无可对齐学期'
                    : '请选择班级'
                }
              />
            </div>
          )}
        </section>
      </>

      <Drawer
        destroyOnHidden
        open={Boolean(selectedStudent)}
        size={560}
        title={
          selectedStudent
            ? `操行复核 · ${selectedStudent.studentName ?? selectedStudent.studentId}`
            : '操行复核'
        }
        onClose={() => setSelectedStudentId(null)}
      >
        {selectedStudent ? (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            {selectedStudent.status === UPSTREAM_CHANGED_SINCE_CORRECTION ? (
              <Alert
                showIcon
                action={
                  selectedStudentCanReviewCorrection ? (
                    <Button
                      disabled={conductPatchDisabled}
                      type="primary"
                      onClick={() => handleStartStudentConflictReview(selectedStudent)}
                    >
                      进入该生复核
                    </Button>
                  ) : undefined
                }
                description={
                  selectedStudentCanReviewCorrection
                    ? `旧补正涉及：${selectedStudentBaselineConflictFields.join('、') || '未知字段'}。${
                        selectedStudentMissingConflictFields.length
                          ? `当前校园网没有${selectedStudentMissingConflictFields.join('、')}，清除旧补正后这些字段会显示“缺失”。`
                          : ''
                      }请核对当前值；需要保留时重新填写补正，不再需要时清除补正并保存。`
                    : '该冲突涉及当前页面不支持修改的历史字段，请联系管理员进一步处理。'
                }
                title="校园网基线已变化，旧补正暂未生效"
                type="warning"
              />
            ) : null}
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="学生 ID">{selectedStudent.studentId}</Descriptions.Item>
              <Descriptions.Item label="姓名">
                {selectedStudent.studentName ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="学生状态">
                {renderStudentStatusTag(selectedStudent.studentStatus)}
              </Descriptions.Item>
              <Descriptions.Item label="数据状态">
                {renderStatusTag(selectedStudent.status)}
              </Descriptions.Item>
              <Descriptions.Item label="操行记录">
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
                {renderFieldDetail(selectedStudent.fields.score)}
              </Descriptions.Item>
              <Descriptions.Item label="推定等级">
                {renderFieldDetail(selectedStudent.fields.estimatedGrade)}
              </Descriptions.Item>
              <Descriptions.Item label="确认等级">
                {renderFieldDetail(selectedStudent.fields.confirmedGrade)}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions bordered column={1} size="small" title="补正与提示">
              <Descriptions.Item label="本地补正字段">
                {selectedStudent.manualPatchFieldKeys.length > 0 ? (
                  <Space size={4} wrap>
                    {selectedStudent.manualPatchFieldKeys.map((fieldKey) => (
                      <Tag color="blue" key={fieldKey}>
                        {resolveConductGradeFieldLabel(fieldKey)}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  '无'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="需要处理">
                {selectedStudent.conflictCodes.length > 0 ? (
                  <Space size={4} wrap>
                    {selectedStudent.conflictCodes.map((code) => {
                      const conflictCopy = resolveConductGradeConflictCopy(code);

                      return (
                        <Tooltip title={conflictCopy.description} key={code}>
                          <Tag color="orange">{conflictCopy.label}</Tag>
                        </Tooltip>
                      );
                    })}
                  </Space>
                ) : (
                  '无'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="记录警告">
                {selectedStudent.conductSection.warningCodes.length > 0 ? (
                  <Space size={4} wrap>
                    {selectedStudent.conductSection.warningCodes.map((code) => (
                      <Tag color="gold" key={code}>
                        {code}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  '无'
                )}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        ) : null}
      </Drawer>

      <UpstreamLoginModal {...upstreamLoginModalProps} />
    </div>
  );
}
