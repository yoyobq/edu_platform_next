// src/features/student-roster-membership-reconciliation/ui/student-roster-membership-reconciliation-page-content.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReconciliationOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Spin,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  type AcademicSemesterRecord,
  AcademicSemesterSelect,
  sortAcademicSemestersForDisplay,
} from '@/entities/academic-semester';
import type { AuthAccessGroup } from '@/entities/auth-access';
import { buildDepartmentSelectOptions, DepartmentSelect } from '@/entities/department';
import {
  buildUpstreamLoginCredentialsInitialValues,
  canUseRememberedUpstreamLoginCredentials,
  canUseStoredUpstreamSessionForLockedUser,
  type StoredUpstreamSession,
  type UpstreamLoginFormValues,
  UpstreamLoginModal,
  useUpstreamSession,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import { hasAutomaticRosterCommitWork } from '../application/commit-work';
import {
  buildCommitConfirmations,
  buildDefaultConfirmationDrafts,
  buildDefaultPreRegisteredReviewDrafts,
  buildDefaultReplacementDecisionDrafts,
  buildPreRegisteredReviewCommitPayload,
  buildReplacementDecisionCommitPayload,
  canEndDecision,
  type ConfirmationDraft,
  DECISION_OUTCOME_COLORS,
  DECISION_OUTCOME_LABELS,
  getConfirmationDecisionOptions,
  getEffectiveSemesterLabel,
  getReplacementDecisionOptions,
  mergeCommitEndDecisions,
  type PreRegisteredReviewDraft,
  type PreRegisteredReviewOutcome,
  REASON_CODE_LABELS,
  type ReplacementDecisionDraft,
  requiresEffectiveSemester,
  requiresPreRegisteredLocalReview,
  switchConfirmationDraftDecisionOutcome,
  updateConfirmationDraftEffectiveSemester,
  updateConfirmationDraftReasonCode,
  updateConfirmationDraftReasonText,
} from '../application/confirmation-policy';
import {
  buildRosterReviewItems,
  countRosterReviewItemsByKind,
  filterRosterReviewItems,
  ROSTER_REVIEW_KIND_LABELS,
  ROSTER_REVIEW_KIND_ORDER,
  type RosterReviewItem,
  type RosterReviewKind,
} from '../application/result-view-model';
import {
  hasRosterMembershipLocalClassOptionsAccess,
  resolveRosterSyncPermissionStrategy,
} from '../application/roster-sync-permission';
import {
  formatDecisionSemester,
  missingDecisionSemester,
  STATUS_CHANGE_LABELS,
  suggestStatusChangeDecision,
} from '../application/status-change-evidence';
import type {
  ClaimClassAdviserForRosterSyncResult,
  CurrentRosterMembershipAccount,
  LocalRosterClassOption,
  PreviousClassAdviserClassesResult,
  RosterMembershipDepartmentOption,
  StudentRosterMembershipConfirmationInput,
  StudentRosterMembershipEndDecisionInput,
  StudentRosterMembershipReconciliationItem,
  StudentRosterMembershipReconciliationResult,
  StudentStatus,
} from '../application/types';
import {
  claimClassAdviserForRosterSync,
  commitUpstreamStudentRosterReconciliation,
  dryRunReconcileUpstreamStudentRoster,
  fetchCurrentRosterMembershipAccount,
  fetchPreviousClassAdviserClasses,
  fetchRosterMembershipDepartmentOptions,
  isExpiredUpstreamSessionError,
  listLocalClassOptions,
  refreshRosterStatusChange,
  requestAcademicSemesters,
  resolveStudentRosterMembershipErrorMessage,
} from '../infrastructure/api';
import { isRosterMembershipPermissionError } from '../infrastructure/api-errors';

type PendingRosterAction =
  | { type: 'load-class-list' }
  | { type: 'refresh-status'; classCode: string; studentId: string }
  | { classCode: string; type: 'dry-run' }
  | {
      classCode: string;
      confirmations: StudentRosterMembershipConfirmationInput[];
      endDecisions: StudentRosterMembershipEndDecisionInput[];
      type: 'commit';
    };

type ResultFilterKey = 'missing-semester' | 'status-events' | 'focus' | 'all' | RosterReviewKind;

type StudentRosterMembershipReconciliationPageContentProps = {
  accessGroup?: readonly AuthAccessGroup[];
  lockedUpstreamLoginUserId?: string | null;
  refreshSiteSession?: () => Promise<void>;
  slotGroup?: readonly string[];
};

type ClassAdviserClaimNotice = {
  description: string;
  title: string;
};

const PAGE_DESCRIPTION = '按单个本地班级对齐校园网班级名册与本地学生班级归属。';

const RESULT_TABLE_DEFAULT_PAGE_SIZE = 8;
const LOCKED_UPSTREAM_SESSION_MISMATCH_MESSAGE = '请使用当前登录账号对应的工号登录智慧校园。';

const PRIMARY_STATUS_TAG_STYLE = {
  backgroundColor: 'var(--ant-color-primary-bg)',
  borderColor: 'var(--ant-color-primary-bg)',
  color: 'var(--ant-color-primary)',
};

const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  DROPPED: '退学',
  ENROLLED: '在读',
  GRADUATED: '已毕业',
  NOT_CHECKED_IN: '确认未报到',
  OFF_CAMPUS_INTERNSHIP: '下厂/校外实习',
  PRE_REGISTERED: '预报到',
  SUSPENDED: '暂离',
};

type StatusTagTone = 'default' | 'error' | 'primary' | 'success' | 'warning';

function resolveUpstreamRefreshFailureMessage(error: unknown) {
  if (isExpiredUpstreamSessionError(error)) {
    return 'upstream 会话已失效，请重新登录后继续。';
  }

  return resolveStudentRosterMembershipErrorMessage(error);
}

function resolveClassAdviserClaimFailureMessage(reason: string | null | undefined) {
  switch (reason) {
    case 'HISTORY_NOT_MATCHED':
      return '当前校园网账号未被识别为该班历史班主任，未继续同步。';
    case 'EMPTY_ROSTER':
      return '目标班暂无可同步学生，未自动认定班主任。';
    default:
      return '未能自动认定班主任，未继续同步。';
  }
}

function isSuccessfulClassAdviserClaimReason(reason: string | null | undefined) {
  return reason === 'CLAIMED' || reason === 'ALREADY_CLAIMED';
}

function resolveClassAdviserClaimNotice(
  result: ClaimClassAdviserForRosterSyncResult,
): ClassAdviserClaimNotice | null {
  if (result.reason === 'CLAIMED') {
    return {
      description: '已根据校园网历史班主任信息完成本地任职认定，并刷新当前登录会话。',
      title: '已获得该班班主任身份',
    };
  }

  if (result.reason === 'ALREADY_CLAIMED') {
    return {
      description: '本地已存在该班班主任任职，并已刷新当前登录会话。',
      title: '已确认该班班主任身份',
    };
  }

  return null;
}

function formatNullableValue(value: number | string | null | undefined) {
  return value ?? <span className="text-text-secondary">-</span>;
}

function getStudentDisplayName(item: StudentRosterMembershipReconciliationItem) {
  return item.studentName || item.studentId || item.upstreamStudentId || item.key;
}

function getResultRowKey(item: StudentRosterMembershipReconciliationItem) {
  return [
    item.category,
    item.action,
    item.key,
    item.studentId ?? 'no-student',
    item.upstreamStudentId ?? 'no-upstream-student',
    item.rowIndex ?? 'no-row',
  ].join(':');
}

function getReportedStatusLabel(value: string | null) {
  if (value === '0') {
    return '未正式报到';
  }

  if (value === '1') {
    return '已报到';
  }

  return '-';
}

function getInSchoolStatusLabel(value: string | null) {
  if (value === '0') {
    return '不在校';
  }

  if (value === '1') {
    return '在校';
  }

  return '-';
}

function getReportedStatusTagTone(value: string | null): StatusTagTone {
  if (value === '0') {
    return 'warning';
  }

  if (value === '1') {
    return 'primary';
  }

  return 'default';
}

function getInSchoolStatusTagTone(value: string | null): StatusTagTone {
  if (value === '0') {
    return 'warning';
  }

  if (value === '1') {
    return 'primary';
  }

  return 'default';
}

function getStudentStatusTagTone(status: StudentStatus): StatusTagTone {
  switch (status) {
    case 'ENROLLED':
      return 'primary';
    case 'OFF_CAMPUS_INTERNSHIP':
      return 'success';
    case 'PRE_REGISTERED':
    case 'SUSPENDED':
      return 'warning';
    case 'DROPPED':
      return 'error';
    case 'GRADUATED':
    case 'NOT_CHECKED_IN':
      return 'default';
  }
}

function renderStatusTag(label: string, tone: StatusTagTone) {
  if (tone === 'primary') {
    return <Tag style={PRIMARY_STATUS_TAG_STYLE}>{label}</Tag>;
  }

  return tone === 'default' ? <Tag>{label}</Tag> : <Tag color={tone}>{label}</Tag>;
}

function renderStudentStatusTag(status: StudentStatus | null) {
  if (!status) {
    return null;
  }

  return renderStatusTag(STUDENT_STATUS_LABELS[status], getStudentStatusTagTone(status));
}

function renderMetadataLine(label: string, value: number | string | null | undefined) {
  return (
    <span className="text-text-secondary">
      {label}：{formatNullableValue(value)}
    </span>
  );
}

function renderDecisionOutcomeTag(
  outcome: NonNullable<StudentRosterMembershipReconciliationItem['recommendedDecisionOutcome']>,
  prefix?: string,
) {
  const label = DECISION_OUTCOME_LABELS[outcome];

  return (
    <Tag color={DECISION_OUTCOME_COLORS[outcome]}>{prefix ? `${prefix}：${label}` : label}</Tag>
  );
}

function renderReasonCode(
  reasonCode: StudentRosterMembershipReconciliationItem['recommendedReasonCode'],
) {
  return reasonCode ? REASON_CODE_LABELS[reasonCode] : '-';
}

export function StudentRosterMembershipReconciliationPageContent({
  accessGroup = [],
  lockedUpstreamLoginUserId = null,
  refreshSiteSession,
  slotGroup = [],
}: StudentRosterMembershipReconciliationPageContentProps) {
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const [currentAccount, setCurrentAccount] = useState<CurrentRosterMembershipAccount | null>(null);
  const [isLoadingCurrentAccount, setIsLoadingCurrentAccount] = useState(true);
  const [isLoadingClassList, setIsLoadingClassList] = useState(false);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [isLoadingLocalClassOptions, setIsLoadingLocalClassOptions] = useState(false);
  const [isLoadingAcademicSemesters, setIsLoadingAcademicSemesters] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [classListError, setClassListError] = useState<string | null>(null);
  const [departmentOptionsError, setDepartmentOptionsError] = useState<string | null>(null);
  const [localClassOptionsError, setLocalClassOptionsError] = useState<string | null>(null);
  const [academicSemestersError, setAcademicSemestersError] = useState<string | null>(null);
  const [reconciliationError, setReconciliationError] = useState<string | null>(null);
  const [classAdviserClaimNotice, setClassAdviserClaimNotice] =
    useState<ClassAdviserClaimNotice | null>(null);
  const [postCommitRefreshNotice, setPostCommitRefreshNotice] =
    useState<ClassAdviserClaimNotice | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingRosterAction | null>(null);
  const [hasAutoLoadedClassList, setHasAutoLoadedClassList] = useState(false);
  const [isCommitReviewOpen, setIsCommitReviewOpen] = useState(false);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [resultFilter, setResultFilter] = useState<ResultFilterKey>('focus');
  const [resultTablePage, setResultTablePage] = useState(1);
  const [resultTablePageSize, setResultTablePageSize] = useState(RESULT_TABLE_DEFAULT_PAGE_SIZE);
  const [classListResult, setClassListResult] = useState<PreviousClassAdviserClassesResult | null>(
    null,
  );
  const [departmentOptionRecords, setDepartmentOptionRecords] = useState<
    RosterMembershipDepartmentOption[]
  >([]);
  const [localClassOptions, setLocalClassOptions] = useState<LocalRosterClassOption[]>([]);
  const [academicSemesters, setAcademicSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [localClassKeyword, setLocalClassKeyword] = useState('');
  const [localClassOptionsRefreshKey, setLocalClassOptionsRefreshKey] = useState(0);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | undefined>();
  const [selectedClassCode, setSelectedClassCode] = useState<string | undefined>();
  const [reconciliationResult, setReconciliationResult] =
    useState<StudentRosterMembershipReconciliationResult | null>(null);
  const [confirmationDrafts, setConfirmationDrafts] = useState<Record<string, ConfirmationDraft>>(
    {},
  );
  const [replacementDecisionDrafts, setReplacementDecisionDrafts] = useState<
    Record<string, ReplacementDecisionDraft>
  >({});
  const [preRegisteredReviewDrafts, setPreRegisteredReviewDrafts] = useState<
    Record<string, PreRegisteredReviewDraft>
  >({});
  const {
    clear,
    clearRememberedCredentials,
    keepAliveFailure,
    login: loginUpstream,
    persistSessionFromResult,
    rememberedCredentials,
    refreshSession,
    session: storedSession,
  } = useUpstreamSession({
    account: currentAccount,
    keepAlive: true,
    lockedUserId: lockedUpstreamLoginUserId,
  });
  const canUseRememberedCredentials = canUseRememberedUpstreamLoginCredentials({
    lockedUserId: lockedUpstreamLoginUserId,
    rememberedCredentials,
  });
  const canUseLocalClassOptions = hasRosterMembershipLocalClassOptionsAccess({
    accessGroup,
    slotGroup,
  });
  const academicSemesterOptions = useMemo(
    () => sortAcademicSemestersForDisplay(academicSemesters),
    [academicSemesters],
  );
  const departmentOptions = useMemo(
    () => buildDepartmentSelectOptions(departmentOptionRecords),
    [departmentOptionRecords],
  );
  const classOptions = useMemo(
    () =>
      classListResult?.classes.map((item) => ({
        label: `${item.name} (${item.code})`,
        value: item.code,
      })) ?? [],
    [classListResult],
  );
  const localClassSelectOptions = useMemo(
    () =>
      localClassOptions.map((item) => ({
        label: `${item.className} (${item.classCode})`,
        value: item.classCode,
      })),
    [localClassOptions],
  );
  const selectedClass =
    classListResult?.classes.find((item) => item.code === selectedClassCode) ?? null;
  const selectedLocalClass =
    localClassOptions.find((item) => item.classCode === selectedClassCode) ?? null;
  const selectedClassLabel =
    selectedClass?.name ??
    (selectedLocalClass
      ? `${selectedLocalClass.className} (${selectedLocalClass.classCode})`
      : selectedClassCode);
  const reviewItems = useMemo(
    () => buildRosterReviewItems(reconciliationResult?.items ?? [], getResultRowKey),
    [reconciliationResult],
  );
  const reviewCounts = useMemo(() => countRosterReviewItemsByKind(reviewItems), [reviewItems]);
  const pendingReplacementDecisionKeys = useMemo(
    () =>
      new Set(
        Object.entries(replacementDecisionDrafts)
          .filter(([, draft]) => draft.selected)
          .map(([itemKey]) => itemKey),
      ),
    [replacementDecisionDrafts],
  );
  const focusReviewItems = useMemo(() => {
    const focusedItems = filterRosterReviewItems(reviewItems, 'focus');
    const focusedRowKeys = new Set(focusedItems.map((item) => item.rowKey));
    const selectedReplacementDecisionItems = reviewItems.filter(
      (item) =>
        item.kind === 'local-decision' &&
        (pendingReplacementDecisionKeys.has(item.item.key) || missingDecisionSemester(item.item)) &&
        !focusedRowKeys.has(item.rowKey),
    );

    return [...focusedItems, ...selectedReplacementDecisionItems];
  }, [pendingReplacementDecisionKeys, reviewItems]);
  const visibleReviewItems = useMemo(() => {
    const filtered =
      resultFilter === 'focus'
        ? focusReviewItems
        : resultFilter === 'missing-semester'
          ? reviewItems.filter((row) => missingDecisionSemester(row.item))
          : resultFilter === 'status-events'
            ? reviewItems.filter((row) => row.item.statusChangeEvidence?.events.length)
            : filterRosterReviewItems(reviewItems, resultFilter);
    const keyword = studentSearch.trim();
    return filtered.filter(
      (row) =>
        !keyword ||
        row.item.studentId?.includes(keyword) ||
        row.item.studentName?.includes(keyword),
    );
  }, [focusReviewItems, resultFilter, reviewItems, studentSearch]);
  const detailItem = reviewItems.find((row) => row.item.key === detailKey) ?? null;
  const resultFilterOptions = useMemo(() => {
    return [
      {
        label: `缺少生效学期 ${reviewItems.filter((row) => missingDecisionSemester(row.item)).length}`,
        value: 'missing-semester',
      },
      {
        label: `有学籍变动 ${reviewItems.filter((row) => row.item.statusChangeEvidence?.events.length).length}`,
        value: 'status-events',
      },
      {
        label: `人工复核项 ${focusReviewItems.length}`,
        value: 'focus',
      },
      ...ROSTER_REVIEW_KIND_ORDER.filter((kind) => reviewCounts[kind] > 0).map((kind) => ({
        label: `${ROSTER_REVIEW_KIND_LABELS[kind]} ${reviewCounts[kind]}`,
        value: kind,
      })),
      {
        label: `全部 ${reviewItems.length}`,
        value: 'all',
      },
    ];
  }, [focusReviewItems.length, reviewCounts, reviewItems]);
  const commitConfirmations = useMemo(
    () => buildCommitConfirmations(reconciliationResult?.items ?? [], confirmationDrafts),
    [confirmationDrafts, reconciliationResult],
  );
  const replacementDecisionCommitPayload = useMemo(
    () =>
      buildReplacementDecisionCommitPayload(
        reconciliationResult?.items ?? [],
        replacementDecisionDrafts,
      ),
    [reconciliationResult, replacementDecisionDrafts],
  );
  const preRegisteredReviewCommitPayload = useMemo(
    () =>
      buildPreRegisteredReviewCommitPayload(
        reconciliationResult?.items ?? [],
        preRegisteredReviewDrafts,
        {
          resolveItemKey: getResultRowKey,
        },
      ),
    [preRegisteredReviewDrafts, reconciliationResult],
  );
  const commitConfirmationsPayload = useMemo(
    () => [
      ...commitConfirmations.confirmations,
      ...preRegisteredReviewCommitPayload.confirmations,
      ...replacementDecisionCommitPayload.confirmations,
    ],
    [
      commitConfirmations.confirmations,
      preRegisteredReviewCommitPayload.confirmations,
      replacementDecisionCommitPayload.confirmations,
    ],
  );
  const commitEndDecisions = useMemo(
    () =>
      mergeCommitEndDecisions(
        preRegisteredReviewCommitPayload.endDecisions,
        replacementDecisionCommitPayload.endDecisions,
      ),
    [preRegisteredReviewCommitPayload.endDecisions, replacementDecisionCommitPayload.endDecisions],
  );
  const hasInvalidCommitWork =
    commitConfirmations.invalidItems.length > 0 ||
    preRegisteredReviewCommitPayload.invalidItems.length > 0 ||
    replacementDecisionCommitPayload.invalidItems.length > 0;
  const hasCommitWork =
    commitConfirmationsPayload.length > 0 ||
    commitEndDecisions.length > 0 ||
    hasInvalidCommitWork ||
    hasAutomaticRosterCommitWork(reconciliationResult?.items ?? []);
  const isLoadingClassSelection =
    isLoadingClassList || isLoadingDepartments || isLoadingLocalClassOptions;
  const isRunningAction =
    isLoadingClassSelection || isPreviewing || isCommitting || isRefreshingStatus;
  const canCommit =
    Boolean(reconciliationResult) &&
    hasCommitWork &&
    commitConfirmations.invalidItems.length === 0 &&
    preRegisteredReviewCommitPayload.invalidItems.length === 0 &&
    replacementDecisionCommitPayload.invalidItems.length === 0 &&
    !isRunningAction;

  const applyReconciliationResult = useCallback(
    (result: StudentRosterMembershipReconciliationResult) => {
      setReconciliationResult(result);
      setConfirmationDrafts(buildDefaultConfirmationDrafts(result.items));
      setReplacementDecisionDrafts(buildDefaultReplacementDecisionDrafts(result.items));
      setPreRegisteredReviewDrafts(
        buildDefaultPreRegisteredReviewDrafts(result.items, {
          resolveItemKey: getResultRowKey,
        }),
      );
      const nextReviewItems = buildRosterReviewItems(result.items, getResultRowKey);
      setResultFilter(
        filterRosterReviewItems(nextReviewItems, 'focus').length > 0 ? 'focus' : 'all',
      );
      setResultTablePage(1);
    },
    [],
  );

  const clearCurrentSession = useCallback(
    (message?: string) => {
      clear();
      setClassListResult(null);
      setSelectedClassCode(undefined);
      setReconciliationResult(null);
      setClassAdviserClaimNotice(null);
      setPostCommitRefreshNotice(null);
      setHasAutoLoadedClassList(false);
      setConfirmationDrafts({});
      setReplacementDecisionDrafts({});
      setPreRegisteredReviewDrafts({});
      setResultFilter('focus');
      setResultTablePage(1);
      setClassListError(null);
      setDepartmentOptionsError(null);
      setLocalClassOptionsError(null);
      setReconciliationError(message ?? null);
      setPendingAction(null);
    },
    [clear],
  );

  const promptUpstreamLogin = useCallback(
    (input: {
      action: PendingRosterAction;
      message: string;
      session?: StoredUpstreamSession | null;
    }) => {
      if (input.action.type === 'refresh-status') clear();
      else clearCurrentSession();
      setPendingAction(input.action);
      setLoginError(input.message);
      setIsLoginModalOpen(true);
      loginForm.setFieldsValue(
        buildUpstreamLoginCredentialsInitialValues({
          fallbackUserId: input.session?.upstreamLoginId,
          lockedUserId: lockedUpstreamLoginUserId,
          rememberedCredentials,
        }),
      );
    },
    [clear, clearCurrentSession, lockedUpstreamLoginUserId, loginForm, rememberedCredentials],
  );

  const handleActionError = useCallback((action: PendingRosterAction, error: unknown) => {
    const message = resolveStudentRosterMembershipErrorMessage(error);

    switch (action.type) {
      case 'load-class-list':
        setClassListResult(null);
        setSelectedClassCode(undefined);
        setClassListError(message);
        return;
      case 'refresh-status':
      case 'dry-run':
      case 'commit':
        setReconciliationError(message);
        return;
    }
  }, []);

  const performAction = useCallback(
    async (session: StoredUpstreamSession, action: PendingRosterAction) => {
      const runActionWithSession = async (currentSession: StoredUpstreamSession) => {
        switch (action.type) {
          case 'refresh-status': {
            setIsRefreshingStatus(true);
            setReconciliationError(null);
            const result = await refreshRosterStatusChange({
              classCode: action.classCode,
              studentId: action.studentId,
              upstreamSessionToken: currentSession.upstreamSessionToken,
            });
            persistSessionFromResult(currentSession, result);
            setReconciliationResult((current) =>
              current?.classCode === action.classCode
                ? {
                    ...current,
                    items: current.items.map((item) =>
                      item.studentId === action.studentId
                        ? { ...item, statusChangeEvidence: result.evidence }
                        : item,
                    ),
                  }
                : current,
            );
            return;
          }
          case 'load-class-list': {
            setIsLoadingClassList(true);
            setClassListError(null);
            setReconciliationError(null);
            const result = await fetchPreviousClassAdviserClasses({
              upstreamSessionToken: currentSession.upstreamSessionToken,
            });

            persistSessionFromResult(currentSession, result);
            setClassListResult(result);
            setSelectedClassCode((currentClassCode) => {
              if (result.classes.some((item) => item.code === currentClassCode)) {
                return currentClassCode;
              }

              return result.classes.at(-1)?.code;
            });
            setReconciliationResult(null);
            setClassAdviserClaimNotice(null);
            setPostCommitRefreshNotice(null);
            setConfirmationDrafts({});
            setReplacementDecisionDrafts({});
            setPreRegisteredReviewDrafts({});
            setResultFilter('focus');
            setResultTablePage(1);
            return;
          }
          case 'dry-run': {
            setIsPreviewing(true);
            setReconciliationError(null);
            setClassAdviserClaimNotice(null);
            setPostCommitRefreshNotice(null);

            const runDryRunWithSession = async (
              sessionForDryRun: StoredUpstreamSession,
              claimNotice: ClassAdviserClaimNotice | null = null,
            ) => {
              const result = await dryRunReconcileUpstreamStudentRoster({
                classCode: action.classCode,
                upstreamSessionToken: sessionForDryRun.upstreamSessionToken,
              });

              persistSessionFromResult(sessionForDryRun, result);
              applyReconciliationResult(result);
              setClassAdviserClaimNotice(claimNotice);
            };
            const claimAndRefreshSession = async (sessionToClaim: StoredUpstreamSession) => {
              const claimResult = await claimClassAdviserForRosterSync({
                classCode: action.classCode,
                upstreamSessionToken: sessionToClaim.upstreamSessionToken,
              });
              const claimedSession = persistSessionFromResult(sessionToClaim, claimResult);

              if (
                !claimResult.claimed &&
                !isSuccessfulClassAdviserClaimReason(claimResult.reason)
              ) {
                throw new Error(resolveClassAdviserClaimFailureMessage(claimResult.reason));
              }

              if (!refreshSiteSession) {
                throw new Error('班主任认定已完成，但当前登录会话尚未刷新，请重新登录后重试。');
              }

              try {
                await refreshSiteSession();
              } catch {
                throw new Error('班主任认定已完成，但当前登录会话刷新失败，请重新登录后重试。');
              }

              return {
                notice: resolveClassAdviserClaimNotice(claimResult),
                session: claimedSession,
              };
            };
            const permissionStrategy = resolveRosterSyncPermissionStrategy({
              accessGroup,
              slotGroup,
            });

            if (permissionStrategy === 'claim-before-dry-run') {
              const claimed = await claimAndRefreshSession(currentSession);
              await runDryRunWithSession(claimed.session, claimed.notice);
              return;
            }

            if (permissionStrategy === 'dry-run-before-claim') {
              try {
                await runDryRunWithSession(currentSession);
                return;
              } catch (dryRunError) {
                if (!isRosterMembershipPermissionError(dryRunError)) {
                  throw dryRunError;
                }

                const claimed = await claimAndRefreshSession(currentSession);
                await runDryRunWithSession(claimed.session, claimed.notice);
                return;
              }
            }

            await runDryRunWithSession(currentSession);
            return;
          }
          case 'commit': {
            setIsCommitting(true);
            setReconciliationError(null);
            setClassAdviserClaimNotice(null);
            setPostCommitRefreshNotice(null);
            const result = await commitUpstreamStudentRosterReconciliation({
              classCode: action.classCode,
              confirmations: action.confirmations,
              endDecisions: action.endDecisions,
              upstreamSessionToken: currentSession.upstreamSessionToken,
            });
            const committedSession = persistSessionFromResult(currentSession, result);

            applyReconciliationResult(result);

            if (result.requiresReconfirm) {
              setReconciliationError('数据已变化，本次未写库。请根据最新结果重新确认。');
              return;
            }

            if (!result.committed) {
              return;
            }

            const refreshAfterCommit = async (sessionForRefresh: StoredUpstreamSession) => {
              setIsPreviewing(true);
              const refreshedResult = await dryRunReconcileUpstreamStudentRoster({
                classCode: action.classCode,
                upstreamSessionToken: sessionForRefresh.upstreamSessionToken,
              });

              persistSessionFromResult(sessionForRefresh, refreshedResult);
              applyReconciliationResult(refreshedResult);
              setPostCommitRefreshNotice({
                description: '已重新预读校园网学生花名册，并展示最新归属差异。',
                title: '已提交并刷新核对结果',
              });
            };

            try {
              await refreshAfterCommit(committedSession);
            } catch (refreshError) {
              if (isExpiredUpstreamSessionError(refreshError)) {
                try {
                  const refreshedSession = await refreshSession(committedSession);
                  await refreshAfterCommit(refreshedSession);
                  return;
                } catch (retryError) {
                  setReconciliationError(
                    `本次核对已提交并写库，但自动重新预读失败：${resolveStudentRosterMembershipErrorMessage(
                      retryError,
                    )}`,
                  );
                  return;
                }
              }

              setReconciliationError(
                `本次核对已提交并写库，但自动重新预读失败：${resolveStudentRosterMembershipErrorMessage(
                  refreshError,
                )}`,
              );
            }
            return;
          }
        }
      };

      try {
        await runActionWithSession(session);
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          let refreshedSession: StoredUpstreamSession;

          try {
            refreshedSession = await refreshSession(session);
          } catch (refreshError) {
            promptUpstreamLogin({
              action,
              message: resolveUpstreamRefreshFailureMessage(refreshError),
              session,
            });
            return;
          }

          try {
            await runActionWithSession(refreshedSession);
            return;
          } catch (retryError) {
            if (isExpiredUpstreamSessionError(retryError)) {
              promptUpstreamLogin({
                action,
                message: 'upstream 会话已失效，请重新登录后继续。',
                session: refreshedSession,
              });
              return;
            }

            handleActionError(action, retryError);
            return;
          }
        }

        handleActionError(action, error);
      } finally {
        setIsLoadingClassList(false);
        setIsPreviewing(false);
        setIsCommitting(false);
        setIsRefreshingStatus(false);
      }
    },
    [
      accessGroup,
      applyReconciliationResult,
      handleActionError,
      persistSessionFromResult,
      promptUpstreamLogin,
      refreshSiteSession,
      refreshSession,
      slotGroup,
    ],
  );

  const ensureSessionAndRun = useCallback(
    async (action: PendingRosterAction) => {
      setPageError(null);
      setLoginError(null);

      if (!currentAccount) {
        setPageError('当前登录会话尚未恢复，请稍后重试。');
        return;
      }

      const canUseStoredSession = canUseStoredUpstreamSessionForLockedUser({
        lockedUserId: lockedUpstreamLoginUserId,
        session: storedSession,
      });

      if (!storedSession || !canUseStoredSession) {
        if (storedSession && !canUseStoredSession) {
          clear();
          setLoginError(LOCKED_UPSTREAM_SESSION_MISMATCH_MESSAGE);
        }

        setPendingAction(action);
        setIsLoginModalOpen(true);
        loginForm.setFieldsValue(
          buildUpstreamLoginCredentialsInitialValues({
            lockedUserId: lockedUpstreamLoginUserId,
            rememberedCredentials,
          }),
        );
        return;
      }

      await performAction(storedSession, action);
    },
    [
      clear,
      currentAccount,
      lockedUpstreamLoginUserId,
      loginForm,
      performAction,
      rememberedCredentials,
      storedSession,
    ],
  );

  useEffect(() => {
    let isCancelled = false;

    async function bootstrapCurrentAccount() {
      setIsLoadingCurrentAccount(true);
      setPageError(null);

      try {
        const account = await fetchCurrentRosterMembershipAccount();

        if (!isCancelled) {
          setCurrentAccount(account);
        }
      } catch (error) {
        if (!isCancelled) {
          setCurrentAccount(null);
          setPageError(resolveStudentRosterMembershipErrorMessage(error));
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingCurrentAccount(false);
        }
      }
    }

    void bootstrapCurrentAccount();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!keepAliveFailure) {
      return;
    }

    clearCurrentSession(keepAliveFailure.message);
    setLoginError(keepAliveFailure.message);
    loginForm.setFieldsValue(
      buildUpstreamLoginCredentialsInitialValues({
        fallbackUserId: keepAliveFailure.upstreamLoginId,
        lockedUserId: lockedUpstreamLoginUserId,
        rememberedCredentials,
      }),
    );
    setIsLoginModalOpen(true);
  }, [
    clearCurrentSession,
    keepAliveFailure,
    lockedUpstreamLoginUserId,
    loginForm,
    rememberedCredentials,
  ]);

  useEffect(() => {
    if (!currentAccount) {
      return;
    }

    let isCancelled = false;

    async function loadAcademicSemesters() {
      setIsLoadingAcademicSemesters(true);
      setAcademicSemestersError(null);

      try {
        const semesters = await requestAcademicSemesters();

        if (!isCancelled) {
          setAcademicSemesters(semesters);
          setAcademicSemestersError(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setAcademicSemesters([]);
          setAcademicSemestersError(resolveStudentRosterMembershipErrorMessage(error));
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingAcademicSemesters(false);
        }
      }
    }

    void loadAcademicSemesters();

    return () => {
      isCancelled = true;
    };
  }, [currentAccount]);

  useEffect(() => {
    if (!canUseLocalClassOptions || !currentAccount) {
      return;
    }

    let isCancelled = false;

    async function loadDepartmentOptions() {
      setIsLoadingDepartments(true);
      setDepartmentOptionsError(null);

      try {
        const departments = await fetchRosterMembershipDepartmentOptions();

        if (!isCancelled) {
          setDepartmentOptionRecords(departments);
          setDepartmentOptionsError(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setDepartmentOptionsError(resolveStudentRosterMembershipErrorMessage(error));
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingDepartments(false);
        }
      }
    }

    void loadDepartmentOptions();

    return () => {
      isCancelled = true;
    };
  }, [canUseLocalClassOptions, currentAccount]);

  useEffect(() => {
    if (!canUseLocalClassOptions || !currentAccount) {
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(
      () => {
        async function loadLocalClasses() {
          setIsLoadingLocalClassOptions(true);
          setLocalClassOptionsError(null);

          try {
            const classes = await listLocalClassOptions({
              departmentId: selectedDepartmentId,
              keyword: localClassKeyword,
            });

            if (!isCancelled) {
              setLocalClassOptions(classes);
              setLocalClassOptionsError(null);
            }
          } catch (error) {
            if (!isCancelled) {
              setLocalClassOptions([]);
              setLocalClassOptionsError(resolveStudentRosterMembershipErrorMessage(error));
            }
          } finally {
            if (!isCancelled) {
              setIsLoadingLocalClassOptions(false);
            }
          }
        }

        void loadLocalClasses();
      },
      localClassKeyword.trim() ? 300 : 0,
    );

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    canUseLocalClassOptions,
    currentAccount,
    localClassKeyword,
    localClassOptionsRefreshKey,
    selectedDepartmentId,
  ]);

  useEffect(() => {
    if (
      canUseLocalClassOptions ||
      !currentAccount ||
      !storedSession ||
      hasAutoLoadedClassList ||
      classListResult
    ) {
      return;
    }

    if (
      !canUseStoredUpstreamSessionForLockedUser({
        lockedUserId: lockedUpstreamLoginUserId,
        session: storedSession,
      })
    ) {
      clear();
      return;
    }

    setHasAutoLoadedClassList(true);
    void performAction(storedSession, {
      type: 'load-class-list',
    });
  }, [
    canUseLocalClassOptions,
    classListResult,
    clear,
    currentAccount,
    hasAutoLoadedClassList,
    lockedUpstreamLoginUserId,
    performAction,
    storedSession,
  ]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(visibleReviewItems.length / resultTablePageSize));

    setResultTablePage((currentPage) => Math.min(currentPage, maxPage));
  }, [resultTablePageSize, visibleReviewItems.length]);

  async function handleLoadClassList() {
    await ensureSessionAndRun({
      type: 'load-class-list',
    });
  }

  function handleSwitchUpstreamAccount() {
    setPendingAction(canUseLocalClassOptions ? null : { type: 'load-class-list' });
    setIsLoginModalOpen(true);
    setLoginError(null);
    loginForm.setFieldsValue(
      buildUpstreamLoginCredentialsInitialValues({
        lockedUserId: lockedUpstreamLoginUserId,
        rememberedCredentials,
      }),
    );
  }

  async function handleDryRun() {
    if (!selectedClassCode) {
      setReconciliationError(
        canUseLocalClassOptions ? '请先选择一个本地班级。' : '请先从班级列表选择一个班级。',
      );
      return;
    }

    await ensureSessionAndRun({
      classCode: selectedClassCode,
      type: 'dry-run',
    });
  }

  async function handleCommit() {
    if (!selectedClassCode || !reconciliationResult) {
      setReconciliationError('请先完成 dry-run 预览。');
      return;
    }

    if (commitConfirmations.invalidItems.length > 0) {
      setReconciliationError('存在无法提交的确认项，请检查学生编号、确认选项和生效学期。');
      return;
    }

    if (preRegisteredReviewCommitPayload.invalidItems.length > 0) {
      setReconciliationError('存在无法提交的预报到改判项，请检查学生编号和退学起始学期。');
      return;
    }

    if (replacementDecisionCommitPayload.invalidItems.length > 0) {
      setReconciliationError('存在无法提交的人工复核裁定项，请检查学生编号、确认选项和生效学期。');
      return;
    }

    if (!hasCommitWork) {
      setReconciliationError(null);
      return;
    }

    await ensureSessionAndRun({
      classCode: selectedClassCode,
      confirmations: commitConfirmationsPayload,
      endDecisions: commitEndDecisions,
      type: 'commit',
    });
  }

  function updateConfirmationDraft(
    item: StudentRosterMembershipReconciliationItem,
    updater: (draft: ConfirmationDraft | undefined) => ConfirmationDraft,
  ) {
    setConfirmationDrafts((current) => ({
      ...current,
      [item.key]: updater(current[item.key]),
    }));
  }

  function updateReplacementDecisionDraft(
    item: StudentRosterMembershipReconciliationItem,
    updater: (draft: ReplacementDecisionDraft | undefined) => ReplacementDecisionDraft,
  ) {
    setReplacementDecisionDrafts((current) => ({
      ...current,
      [item.key]: updater(current[item.key]),
    }));
  }

  function updatePreRegisteredReviewDraft(
    item: StudentRosterMembershipReconciliationItem,
    updater: (draft: PreRegisteredReviewDraft | undefined) => PreRegisteredReviewDraft,
  ) {
    const key = getResultRowKey(item);

    setPreRegisteredReviewDrafts((current) => ({
      ...current,
      [key]: updater(current[key]),
    }));
  }

  function renderEffectiveSemesterSelect(input: {
    onChange: (effectiveSemesterId: number | null) => void;
    value?: number | null;
  }) {
    return (
      <AcademicSemesterSelect
        allowClear
        emptyText={academicSemestersError ?? '当前没有可选学期'}
        loading={isLoadingAcademicSemesters}
        placeholder="选择生效学期"
        records={academicSemesterOptions}
        showHiddenState
        style={{ width: '100%' }}
        value={input.value ?? undefined}
        onChange={(value) => {
          input.onChange(value ?? null);
        }}
      />
    );
  }

  function renderEffectiveSemesterField(input: {
    onChange: (effectiveSemesterId: number | null) => void;
    reasonCode: StudentRosterMembershipReconciliationItem['recommendedReasonCode'];
    value?: number | null;
  }) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-text-secondary">{getEffectiveSemesterLabel(input.reasonCode)}</span>
        {renderEffectiveSemesterSelect({
          value: input.value,
          onChange: input.onChange,
        })}
      </div>
    );
  }

  function renderConfirmationDraftEditor(input: {
    draft: ConfirmationDraft;
    onChange: (draft: ConfirmationDraft) => void;
    options: ReturnType<typeof getConfirmationDecisionOptions>;
  }) {
    const { draft, onChange, options } = input;
    const choices = options.flatMap((option) =>
      option.reasonOptions.map((reasonCode) => ({
        value: `${option.decisionOutcome}:${reasonCode}`,
        label:
          reasonCode === 'CLASS_MEMBERSHIP_CORRECTION' ||
          reasonCode === 'UPSTREAM_ROSTER_ERROR_CONFIRMED'
            ? `${reasonCode === 'CLASS_MEMBERSHIP_CORRECTION' ? '班级归属修正' : '校园网名单有误'}（${DECISION_OUTCOME_LABELS[option.decisionOutcome]}）`
            : REASON_CODE_LABELS[reasonCode],
        option,
        reasonCode,
      })),
    );

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span>实际情况</span>
          <Select
            aria-label="实际情况"
            value={`${draft.decisionOutcome}:${draft.reasonCode}`}
            options={choices.map(({ value, label }) => ({ value, label }))}
            onChange={(value) => {
              const choice = choices.find((entry) => entry.value === value);
              if (choice) {
                const switched = switchConfirmationDraftDecisionOutcome(draft, choice.option);
                onChange(updateConfirmationDraftReasonCode(switched, choice.reasonCode));
              }
            }}
          />
        </div>
        {requiresEffectiveSemester(draft.reasonCode)
          ? renderEffectiveSemesterField({
              reasonCode: draft.reasonCode,
              value: draft.effectiveSemesterId,
              onChange: (effectiveSemesterId) => {
                onChange(updateConfirmationDraftEffectiveSemester(draft, effectiveSemesterId));
              },
            })
          : null}
        <Alert
          type="info"
          showIcon
          title="提交后的名单影响"
          description={describeDecisionImpact(draft)}
        />
        <Input.TextArea
          autoSize={{ maxRows: 4, minRows: 2 }}
          maxLength={255}
          aria-label="裁定依据或备注"
          placeholder="裁定依据或备注（可选）"
          showCount
          value={draft.reasonText}
          onChange={(event) => {
            onChange(updateConfirmationDraftReasonText(draft, event.target.value));
          }}
        />
      </div>
    );
  }

  function renderConfirmationEditor(item: StudentRosterMembershipReconciliationItem) {
    if (!item.requiresConfirmation) {
      return null;
    }

    const options = getConfirmationDecisionOptions(item.action);
    const draft = confirmationDrafts[item.key];

    if (!item.studentId || options.length === 0 || !draft) {
      return <Alert type="warning" showIcon title="该确认项缺少可提交的学生编号或确认策略。" />;
    }

    return renderConfirmationDraftEditor({
      draft,
      options,
      onChange: (nextDraft) => {
        updateConfirmationDraft(item, () => nextDraft);
      },
    });
  }

  function renderReplacementDecisionEditor(item: StudentRosterMembershipReconciliationItem) {
    if (!canEndDecision(item)) return null;
    const options = getReplacementDecisionOptions(item.action);
    const draft = replacementDecisionDrafts[item.key];
    if (!item.studentId || !options.length || !draft) {
      return <Alert type="warning" showIcon title="该裁定缺少可修订的学生编号或处理选项。" />;
    }
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          {draft.selected ? <Tag color="processing">待提交</Tag> : null}
          <Button
            disabled={isRunningAction}
            onClick={() => {
              if (draft.selected) {
                const original = buildDefaultReplacementDecisionDrafts([item])[item.key];
                if (original) updateReplacementDecisionDraft(item, () => original);
              } else {
                updateReplacementDecisionDraft(item, () => ({ ...draft, selected: true }));
              }
            }}
          >
            {draft.selected ? '撤销修改' : '修改裁定'}
          </Button>
        </div>
        {draft.selected
          ? renderConfirmationDraftEditor({
              draft,
              options,
              onChange: (nextDraft) =>
                updateReplacementDecisionDraft(item, () => ({ ...nextDraft, selected: true })),
            })
          : null}
      </div>
    );
  }

  function renderCampusNetworkReturnTag(
    presence: StudentRosterMembershipReconciliationItem['upstreamPresence'],
  ) {
    if (presence === 'RETURNED') {
      return null;
    }

    const color = presence === 'MISSING' ? 'warning' : 'default';
    const label = presence === 'MISSING' ? '校园网名单未返回' : '校园网状态未知';

    return <Tag color={color}>{label}</Tag>;
  }

  function renderEnrollmentStatusTags(item: StudentRosterMembershipReconciliationItem) {
    const reportedTag = renderStatusTag(
      getReportedStatusLabel(item.isEnrolled),
      getReportedStatusTagTone(item.isEnrolled),
    );

    return (
      <div className="flex flex-wrap gap-1">
        {item.isEnrolled === '0' ? (
          <Tooltip title="校园网显示未报到，实际情况可能并不一致。">{reportedTag}</Tooltip>
        ) : (
          reportedTag
        )}
        {renderStatusTag(
          getInSchoolStatusLabel(item.isInSchool),
          getInSchoolStatusTagTone(item.isInSchool),
        )}
      </div>
    );
  }

  function renderStudentCell(reviewItem: RosterReviewItem) {
    const item = reviewItem.item;
    const displayName = getStudentDisplayName(item);
    const shouldShowStudentId = Boolean(item.studentId && item.studentId !== displayName);

    return (
      <div className="flex flex-col gap-1">
        <span className="font-medium text-text">{displayName}</span>
        {shouldShowStudentId ? (
          <span className="tabular-nums text-text-secondary">{item.studentId}</span>
        ) : null}
      </div>
    );
  }

  function shouldShowReviewBusinessText(reviewItem: RosterReviewItem) {
    const item = reviewItem.item;

    if (reviewItem.kind === 'local-decision') {
      return false;
    }

    if (reviewItem.kind === 'automatic' && item.action === 'NO_CHANGE') {
      return false;
    }

    return true;
  }

  function renderReviewSummaryCell(reviewItem: RosterReviewItem) {
    const shouldShowBusinessText = shouldShowReviewBusinessText(reviewItem);
    const recommendedDecisionTag = reviewItem.item.recommendedDecisionOutcome
      ? renderDecisionOutcomeTag(reviewItem.item.recommendedDecisionOutcome, '建议')
      : null;

    return (
      <div className="flex flex-col gap-2">
        {recommendedDecisionTag ? (
          <div className="flex flex-wrap gap-1">{recommendedDecisionTag}</div>
        ) : null}
        {shouldShowBusinessText ? (
          <span className="font-medium text-text">{reviewItem.businessSummary}</span>
        ) : null}
        {shouldShowBusinessText && reviewItem.businessDetail ? (
          <span className="text-text-secondary">{reviewItem.businessDetail}</span>
        ) : null}
      </div>
    );
  }

  function renderActiveDecisionCell(item: StudentRosterMembershipReconciliationItem) {
    if (!item.activeDecisionOutcome && !item.activeDecisionReasonCode) {
      return <span className="text-text-secondary">-</span>;
    }

    return (
      <div className="flex flex-col gap-1">
        {item.activeDecisionOutcome ? (
          <div className="flex flex-wrap gap-1">
            {renderDecisionOutcomeTag(item.activeDecisionOutcome)}
          </div>
        ) : null}
        <span className="text-text-secondary">
          {renderReasonCode(item.activeDecisionReasonCode)}
        </span>
        <span>{formatDecisionSemester(item, academicSemesters)}</span>
        {missingDecisionSemester(item) ? <Tag color="warning">需补齐时间</Tag> : null}
      </div>
    );
  }

  function renderLocalMembershipCell(item: StudentRosterMembershipReconciliationItem) {
    const hasMembershipConflict =
      Boolean(item.currentClassCode) && item.currentClassCode !== item.classCode;
    const studentStatusTag = renderStudentStatusTag(item.studentStatus);

    if (!hasMembershipConflict) {
      return (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-text">{item.currentClassName ?? item.className}</span>
          {studentStatusTag ? <div className="flex flex-wrap gap-1">{studentStatusTag}</div> : null}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1">
        {renderMetadataLine('目标班级', item.className)}
        {renderMetadataLine('当前归属', item.currentClassName ?? item.currentClassCode)}
        {studentStatusTag ? <div className="flex flex-wrap gap-1">{studentStatusTag}</div> : null}
      </div>
    );
  }

  function renderCampusNetworkStatusCell(item: StudentRosterMembershipReconciliationItem) {
    return (
      <div className="flex flex-col gap-1">
        {renderCampusNetworkReturnTag(item.upstreamPresence)}
        <span className="text-text-secondary">{formatNullableValue(item.upstreamClassName)}</span>
        {renderEnrollmentStatusTags(item)}
      </div>
    );
  }

  function renderPreRegisteredReviewEditor(item: StudentRosterMembershipReconciliationItem) {
    if (!requiresPreRegisteredLocalReview(item)) {
      return null;
    }

    const draft = preRegisteredReviewDrafts[getResultRowKey(item)] ?? {
      outcome: 'PRE_REGISTERED',
    };

    return (
      <div className="flex min-w-[280px] flex-col gap-2">
        <Radio.Group
          optionType="button"
          value={draft.outcome}
          options={[
            {
              label: '保留预报到',
              value: 'PRE_REGISTERED',
            },
            {
              label: '确认不再报到',
              value: 'NOT_CHECKED_IN',
            },
            {
              label: '确认已退学',
              value: 'DROPPED',
            },
          ]}
          onChange={(event) => {
            const nextOutcome = event.target.value as PreRegisteredReviewOutcome;

            updatePreRegisteredReviewDraft(item, (current) => ({
              effectiveSemesterId: nextOutcome === 'DROPPED' ? current?.effectiveSemesterId : null,
              note: current?.note,
              outcome: nextOutcome,
            }));
          }}
        />
        {draft.outcome !== 'PRE_REGISTERED' ? (
          <>
            {draft.outcome === 'DROPPED'
              ? renderEffectiveSemesterField({
                  reasonCode: 'DROPPED_CONFIRMED',
                  value: draft.effectiveSemesterId,
                  onChange: (effectiveSemesterId) => {
                    updatePreRegisteredReviewDraft(item, (current) => ({
                      effectiveSemesterId,
                      note: current?.note,
                      outcome: current?.outcome ?? draft.outcome,
                    }));
                  },
                })
              : null}
            <Input.TextArea
              autoSize={{ maxRows: 3, minRows: 2 }}
              maxLength={255}
              placeholder="可选处理说明"
              showCount
              value={draft.note}
              onChange={(event) => {
                updatePreRegisteredReviewDraft(item, (current) => ({
                  effectiveSemesterId: current?.effectiveSemesterId,
                  note: event.target.value,
                  outcome: current?.outcome,
                }));
              }}
            />
          </>
        ) : null}
      </div>
    );
  }

  function renderOperationCell(reviewItem: RosterReviewItem) {
    const item = reviewItem.item;
    const editor =
      renderConfirmationEditor(item) ??
      renderPreRegisteredReviewEditor(item) ??
      renderReplacementDecisionEditor(item);

    return (
      <div className="flex flex-col gap-3">
        {renderReviewSummaryCell(reviewItem)}
        {editor}
      </div>
    );
  }

  const resultColumns: ColumnsType<RosterReviewItem> = [
    {
      fixed: 'left',
      key: 'student',
      render: (_, item) => renderStudentCell(item),
      title: '学生信息',
      width: 160,
    },
    {
      key: 'local-membership',
      render: (_, item) => renderLocalMembershipCell(item.item),
      title: '本地归属与状态',
      width: 220,
    },
    {
      key: 'campus-network-status',
      render: (_, item) => renderCampusNetworkStatusCell(item.item),
      title: '校园网状态',
      width: 220,
    },
    {
      key: 'active-decision',
      render: (_, item) => renderActiveDecisionCell(item.item),
      title: '当前裁定与生效时间',
      width: 250,
    },
    {
      key: 'status-change',
      title: '学籍变动',
      width: 230,
      render: (_, row) => {
        const evidence = row.item.statusChangeEvidence;
        const event = evidence?.events
          .slice()
          .sort((a, b) => (b.changeTime ?? '').localeCompare(a.changeTime ?? ''))[0];
        return event ? (
          <div className="flex flex-col gap-1">
            <span>
              {STATUS_CHANGE_LABELS[event.typeCode ?? ''] ??
                `其他变动（${event.typeCode ?? '未知'}）`}
            </span>
            <span>{event.changeTime ?? '日期缺失'}</span>
            {!evidence?.complete ? <Tag color="warning">证据不完整</Tag> : null}
          </div>
        ) : (
          <span>
            {evidence?.state === 'FETCHED_EMPTY'
              ? '校园网无变动记录'
              : evidence?.state === 'UNAVAILABLE'
                ? '暂不可用'
                : '尚未获取'}
          </span>
        );
      },
    },
    {
      key: 'operation',
      render: (_, row) => (
        <div className="flex flex-col items-start gap-2">
          {replacementDecisionDrafts[row.item.key]?.selected ? (
            <Tag color="processing">有待提交修改</Tag>
          ) : null}
          <Button onClick={() => setDetailKey(row.item.key)}>查看证据与处理</Button>
        </div>
      ),
      title: '处理',
      width: 170,
    },
  ];

  function clearReconciliationViewState() {
    setDetailKey(null);
    setStudentSearch('');
    setReconciliationResult(null);
    setClassAdviserClaimNotice(null);
    setPostCommitRefreshNotice(null);
    setConfirmationDrafts({});
    setReplacementDecisionDrafts({});
    setPreRegisteredReviewDrafts({});
    setResultFilter('focus');
    setResultTablePage(1);
    setReconciliationError(null);
  }

  function renderResultActionBar() {
    if (!reconciliationResult) {
      return null;
    }

    return (
      <div className="border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-80 flex-1">{renderResultStatusAlert()}</div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type={hasCommitWork ? 'primary' : 'default'}
              loading={isCommitting}
              disabled={!canCommit}
              onClick={() => setIsCommitReviewOpen(true)}
            >
              {hasCommitWork ? '检查并提交变更' : '无需提交'}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              disabled={!selectedClassCode || isRunningAction}
              onClick={() => void handleDryRun()}
            >
              重新预读并核对
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function renderLocalClassListCard() {
    return (
      <Card title="班级选择与核对">
        <div className="flex flex-col gap-4">
          {departmentOptionsError ? (
            <Alert type="warning" showIcon title={departmentOptionsError} />
          ) : null}
          {localClassOptionsError ? (
            <Alert type="warning" showIcon title={localClassOptionsError} />
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-60 flex-col gap-1">
              <span className="text-xs text-text-secondary">系部</span>
              <DepartmentSelect
                allowClear
                emptyText="当前没有可选系部"
                loading={isLoadingDepartments}
                options={departmentOptions}
                placeholder="全部系部"
                value={selectedDepartmentId}
                style={{ width: '100%' }}
                onChange={(value) => {
                  setSelectedDepartmentId(value);
                  setSelectedClassCode(undefined);
                  clearReconciliationViewState();
                }}
              />
            </div>
            <div className="flex min-w-80 flex-1 flex-col gap-1">
              <span className="text-xs text-text-secondary">核对班级</span>
              <Select
                allowClear
                showSearch
                filterOption={false}
                loading={isLoadingLocalClassOptions}
                notFoundContent={isLoadingLocalClassOptions ? '正在加载班级' : '没有匹配班级'}
                optionFilterProp="label"
                aria-label="核对班级"
                placeholder="输入班级名称或代码搜索"
                value={selectedClassCode}
                options={localClassSelectOptions}
                style={{ width: '100%' }}
                onChange={(value) => {
                  setSelectedClassCode(value);
                  clearReconciliationViewState();
                }}
                onSearch={(keyword) => {
                  setLocalClassKeyword(keyword);
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {!reconciliationResult ? (
                <Button
                  type="primary"
                  loading={isPreviewing}
                  disabled={!selectedClassCode || isRunningAction}
                  onClick={() => void handleDryRun()}
                >
                  预读校园网学生花名册并核对
                </Button>
              ) : null}
              <Button
                icon={<ReloadOutlined />}
                loading={isLoadingLocalClassOptions}
                disabled={isRunningAction && !isLoadingLocalClassOptions}
                onClick={() => {
                  setLocalClassOptionsRefreshKey((current) => current + 1);
                }}
              >
                刷新本地班级
              </Button>
              <Button
                type="link"
                icon={<SwapOutlined />}
                disabled={isRunningAction}
                onClick={handleSwitchUpstreamAccount}
              >
                切换校园网账号
              </Button>
            </div>
          </div>
          {renderResultActionBar()}
        </div>
      </Card>
    );
  }

  function renderPreviousClassAdviserClassListCard() {
    return (
      <Card title="班级选择与核对">
        <div className="flex flex-col gap-4">
          {classListError ? <Alert type="warning" showIcon title={classListError} /> : null}
          {classListResult ? (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-80 flex-1 flex-col gap-1">
                  <span className="text-xs text-text-secondary">核对班级</span>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="选择要核对的班级"
                    value={selectedClassCode}
                    options={classOptions}
                    style={{ width: '100%' }}
                    onChange={(value) => {
                      setSelectedClassCode(value);
                      clearReconciliationViewState();
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {!reconciliationResult ? (
                    <Button
                      type="primary"
                      loading={isPreviewing}
                      disabled={!selectedClassCode || isRunningAction}
                      onClick={() => void handleDryRun()}
                    >
                      预读校园网学生花名册并核对
                    </Button>
                  ) : null}
                  <Button
                    icon={<ReloadOutlined />}
                    loading={isLoadingClassList}
                    disabled={isRunningAction && !isLoadingClassList}
                    onClick={() => void handleLoadClassList()}
                  >
                    重新读取历史班主任信息
                  </Button>
                  <Button
                    type="link"
                    icon={<SwapOutlined />}
                    disabled={isRunningAction}
                    onClick={handleSwitchUpstreamAccount}
                  >
                    切换校园网账号
                  </Button>
                </div>
              </div>
              {renderResultActionBar()}
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                icon={<ReloadOutlined />}
                loading={isLoadingClassList}
                disabled={isRunningAction && !isLoadingClassList}
                onClick={() => void handleLoadClassList()}
              >
                读取历史班主任信息
              </Button>
              <Button
                type="link"
                icon={<SwapOutlined />}
                disabled={isRunningAction}
                onClick={handleSwitchUpstreamAccount}
              >
                切换校园网账号
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  function renderClassListCard() {
    return canUseLocalClassOptions
      ? renderLocalClassListCard()
      : renderPreviousClassAdviserClassListCard();
  }

  function describeDecisionImpact(
    draft: Pick<ConfirmationDraft, 'decisionOutcome' | 'reasonCode' | 'effectiveSemesterId'>,
  ) {
    if (draft.reasonCode === 'NOT_CHECKED_IN_CONFIRMED') return '所有学期均不纳入本班名单。';
    const semester = academicSemesters.find((entry) => entry.id === draft.effectiveSemesterId);
    if (!semester) return '请先选择生效学期，再确认名单影响。';
    const label = `${semester.schoolYear}—${semester.schoolYear + 1} 学年第 ${semester.termNumber} 学期`;
    return draft.decisionOutcome === 'EXCLUDE'
      ? `从 ${label}起（含该学期），不再纳入本班名单。`
      : `从 ${label}起（含该学期），纳入本班名单。`;
  }

  function renderCommitReview() {
    const automaticItems = reviewItems.filter(
      (row) =>
        row.item.category === 'AUTO_APPLY' &&
        row.item.action !== 'NO_CHANGE' &&
        !commitConfirmationsPayload.some((draft) => draft.studentId === row.item.studentId),
    );
    return (
      <Modal
        title="确认本班待提交变更"
        open={isCommitReviewOpen}
        onCancel={() => setIsCommitReviewOpen(false)}
        okText="确认提交"
        cancelText="继续核对"
        width={720}
        okButtonProps={{ disabled: !canCommit }}
        onOk={() => {
          setIsCommitReviewOpen(false);
          void handleCommit();
        }}
      >
        <div className="flex flex-col gap-4">
          <p>{selectedClassLabel} · 本次提交包含全班待处理项，不受列表搜索和筛选影响。</p>
          {commitConfirmationsPayload.map((draft) => {
            const item = reconciliationResult?.items.find(
              (entry) => entry.studentId === draft.studentId,
            );
            return (
              <Card
                key={draft.studentId}
                size="small"
                title={`${item?.studentName ?? '学生'} · ${draft.studentId}`}
              >
                <div className="flex flex-col gap-2">
                  <span className="text-text-secondary">
                    已保存：
                    {item?.activeDecisionReasonCode
                      ? REASON_CODE_LABELS[item.activeDecisionReasonCode]
                      : '暂无裁定'}
                    {item?.activeDecisionId
                      ? ` · ${formatDecisionSemester(item, academicSemesters)}`
                      : ''}
                  </span>
                  <strong>提交后：{REASON_CODE_LABELS[draft.reasonCode]}</strong>
                  <span>{describeDecisionImpact(draft)}</span>
                  {draft.reasonText ? <span>依据或备注：{draft.reasonText}</span> : null}
                </div>
              </Card>
            );
          })}
          {automaticItems.length ? (
            <div>
              <strong>同时按核对结果更新班级归属（{automaticItems.length} 项）</strong>
              <ul>
                {automaticItems.map((row) => (
                  <li key={row.rowKey}>
                    {getStudentDisplayName(row.item)} · {row.item.studentId} · {row.businessSummary}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <span className="text-text-secondary">
            确认后保存本地裁定及班级归属；校园网原始记录不会被改写。
          </span>
        </div>
      </Modal>
    );
  }

  function renderCurrentDecision(item: StudentRosterMembershipReconciliationItem) {
    const labels: Partial<Record<NonNullable<typeof item.activeDecisionReasonCode>, string>> = {
      DROPPED_CONFIRMED: '已退学',
      NOT_CHECKED_IN_CONFIRMED: '未报到',
      TRANSFERRED_IN_CONFIRMED: '已转入本班',
      TRANSFERRED_OUT_CONFIRMED: '已转出本班',
      REENROLLED_CONFIRMED: '复学至本班',
      RETAINED_GRADE_CONFIRMED: '留级至本班',
    };
    const label = item.activeDecisionReasonCode ? labels[item.activeDecisionReasonCode] : null;
    return (
      <div className="flex flex-col gap-2">
        <strong>
          {label ??
            (item.activeDecisionOutcome
              ? DECISION_OUTCOME_LABELS[item.activeDecisionOutcome]
              : '尚未裁定')}
        </strong>
        {item.activeDecisionOutcome && item.activeDecisionReasonCode ? (
          <span className="text-text-secondary">
            {missingDecisionSemester(item)
              ? '尚未设置起始学期'
              : describeDecisionImpact({
                  decisionOutcome: item.activeDecisionOutcome,
                  reasonCode: item.activeDecisionReasonCode,
                  effectiveSemesterId: item.activeDecisionEffectiveSemesterId,
                })}
          </span>
        ) : null}
      </div>
    );
  }

  function renderEvidenceDrawer() {
    const item = detailItem?.item;
    const evidence = item?.statusChangeEvidence;
    const suggestion = item ? suggestStatusChangeDecision(item, academicSemesters) : null;
    const options = item
      ? item.activeDecisionId
        ? getReplacementDecisionOptions(item.action)
        : getConfirmationDecisionOptions(item.action)
      : [];
    const canPrefill =
      suggestion &&
      ((requiresPreRegisteredLocalReview(item!) && suggestion.reasonCode === 'DROPPED_CONFIRMED') ||
        options.some(
          (option) =>
            option.decisionOutcome === suggestion.decisionOutcome &&
            option.reasonOptions.includes(suggestion.reasonCode),
        ));
    return (
      <Drawer
        title={item ? `${item.studentName ?? '学生'} · ${item.studentId ?? ''}` : '学生核对'}
        open={Boolean(detailItem)}
        onClose={() => setDetailKey(null)}
        size="large"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-text-secondary">{hasCommitWork ? '有待提交变更' : ''}</span>
            <div className="flex gap-2">
              <Button onClick={() => setDetailKey(null)}>返回名单</Button>
              <Button
                type="primary"
                disabled={!canCommit}
                onClick={() => setIsCommitReviewOpen(true)}
              >
                检查并提交变更
              </Button>
            </div>
          </div>
        }
      >
        {item && detailItem ? (
          <div className="flex flex-col gap-5">
            <section aria-label="当前结果">
              <div className="flex items-start justify-between gap-4">
                {renderCurrentDecision(item)}
                {!replacementDecisionDrafts[item.key]?.selected
                  ? renderReplacementDecisionEditor(item)
                  : null}
              </div>
            </section>
            <section aria-label="校园网记录">
              <h3>校园网记录</h3>
              {reconciliationError ? (
                <Alert type="error" showIcon title={reconciliationError} />
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  花名册：
                  {item.upstreamPresence === 'RETURNED'
                    ? '仍列在本班'
                    : item.upstreamPresence === 'MISSING'
                      ? '未列在本班'
                      : '未确认'}
                </span>
                {renderEnrollmentStatusTags(item)}
              </div>
              {!evidence?.complete && evidence?.events.length ? (
                <Alert type="warning" showIcon title="记录不完整，请核实后手工裁定。" />
              ) : null}
              {evidence?.events.length ? (
                <Timeline
                  items={[...evidence.events].reverse().map((event) => ({
                    key: event.logId,
                    title: event.changeTime ?? '日期缺失',
                    content: (
                      <div>
                        {STATUS_CHANGE_LABELS[event.typeCode ?? ''] ??
                          `其他变动（${event.typeCode ?? '未知'}）`}{' '}
                        · {event.className ?? event.classCode ?? '班级缺失'} ·{' '}
                        {event.grade ?? '年级缺失'}级
                      </div>
                    ),
                  }))}
                />
              ) : (
                <p>
                  {evidence?.state === 'FETCHED_EMPTY'
                    ? '学籍变动：未查到记录'
                    : evidence?.state === 'UNAVAILABLE'
                      ? '学籍变动：暂时无法查询'
                      : '学籍变动：尚未查询'}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="small"
                  loading={isRefreshingStatus}
                  disabled={
                    isRunningAction ||
                    !item.studentId ||
                    (!item.currentMembershipId && !item.activeDecisionId)
                  }
                  onClick={() =>
                    item.studentId &&
                    void ensureSessionAndRun({
                      type: 'refresh-status',
                      studentId: item.studentId,
                      classCode: item.classCode,
                    })
                  }
                >
                  刷新学籍变动
                </Button>
                {evidence?.observedAt ? (
                  <span className="text-xs text-text-secondary">
                    查询于{' '}
                    {new Date(evidence.observedAt).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </span>
                ) : null}
              </div>
              {!item.currentMembershipId && !item.activeDecisionId ? (
                <p>请先建立本地班级归属，再获取学籍变动。</p>
              ) : null}
            </section>
            {canPrefill && suggestion ? (
              <Card size="small" title="建议裁定">
                <div className="flex flex-col gap-3">
                  <strong>{REASON_CODE_LABELS[suggestion.reasonCode]}</strong>
                  <span>{describeDecisionImpact(suggestion)}</span>
                  <span className="text-text-secondary">请核实起始学期。</span>
                  {item.activeDecisionOutcome === suggestion.decisionOutcome &&
                  item.activeDecisionReasonCode === suggestion.reasonCode &&
                  item.activeDecisionEffectiveSemesterId === suggestion.effectiveSemesterId ? (
                    <Tag color="success">与当前裁定一致</Tag>
                  ) : (
                    <Button
                      disabled={isRunningAction}
                      onClick={() => {
                        if (item.activeDecisionId)
                          updateReplacementDecisionDraft(item, () => ({
                            ...suggestion,
                            selected: true,
                          }));
                        else if (requiresPreRegisteredLocalReview(item))
                          updatePreRegisteredReviewDraft(item, () => ({
                            outcome: 'DROPPED',
                            effectiveSemesterId: suggestion.effectiveSemesterId,
                            note: suggestion.reasonText,
                          }));
                        else updateConfirmationDraft(item, () => suggestion);
                      }}
                    >
                      采用建议
                    </Button>
                  )}
                </div>
              </Card>
            ) : null}
            {!item.activeDecisionId || replacementDecisionDrafts[item.key]?.selected ? (
              <section aria-label="修改裁定">
                <h3>修改裁定</h3>
                {renderOperationCell(detailItem)}
              </section>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    );
  }

  function renderObservationTable() {
    if (!reconciliationResult) {
      return null;
    }

    return (
      <div className="flex flex-col gap-3">
        <Input.Search
          placeholder="按姓名或学号查找"
          allowClear
          value={studentSearch}
          onChange={(event) => {
            setStudentSearch(event.target.value);
            setResultTablePage(1);
          }}
        />
        {renderEvidenceDrawer()}
        <Tabs
          activeKey={resultFilter}
          items={resultFilterOptions.map((option) => ({
            key: option.value,
            label: option.label,
          }))}
          onChange={(key) => {
            setResultFilter(key as ResultFilterKey);
            setResultTablePage(1);
          }}
        />
        {visibleReviewItems.length > 0 ? (
          <Table<RosterReviewItem>
            columns={resultColumns}
            dataSource={visibleReviewItems}
            pagination={{
              current: resultTablePage,
              pageSize: resultTablePageSize,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 项`,
              total: visibleReviewItems.length,
              onChange: (page, pageSize) => {
                setResultTablePage(page);
                setResultTablePageSize(pageSize);
              },
            }}
            rowKey="rowKey"
            scroll={{ x: 1120 }}
            size="medium"
          />
        ) : (
          <Alert
            type="info"
            showIcon
            title="当前筛选下没有学生项"
            description="可以切换到“全部”或其他分类继续观察。"
          />
        )}
      </div>
    );
  }

  function renderResultStatusAlert() {
    if (!reconciliationResult) {
      return null;
    }

    if (reconciliationResult.requiresReconfirm) {
      return (
        <Alert
          type="warning"
          showIcon
          title="本次提交未保存"
          description="重新核对发现校园网名单或本地记录已变化。当前页面已替换为最新结果，请重新确认后再提交。"
        />
      );
    }

    if (academicSemestersError) {
      return (
        <Alert
          type="warning"
          showIcon
          title="暂时无法加载生效学期"
          description={academicSemestersError}
        />
      );
    }

    if (commitConfirmations.invalidItems.length > 0) {
      return (
        <Alert
          type="warning"
          showIcon
          title="存在无法提交的确认项"
          description="后端要求必须确认的项需要完整提交；请检查这些项是否缺少学生编号、确认策略或生效学期。"
        />
      );
    }

    if (preRegisteredReviewCommitPayload.invalidItems.length > 0) {
      return (
        <Alert
          type="warning"
          showIcon
          title="存在无法提交的预报到改判项"
          description="改判为不再报到或退学时，必须能定位本地学生编号；退学还需要选择退学起始学期。"
        />
      );
    }

    if (replacementDecisionCommitPayload.invalidItems.length > 0) {
      return (
        <Alert
          type="warning"
          showIcon
          title="存在无法提交的人工复核裁定项"
          description="人工复核本地裁定时，需要完整的新裁定信息；请检查学生编号、确认选项和生效学期。"
        />
      );
    }

    if (reconciliationResult.committed) {
      return <Alert type="success" showIcon title="本次核对已保存。" />;
    }

    if (postCommitRefreshNotice) {
      return (
        <Alert
          type="success"
          showIcon
          title={postCommitRefreshNotice.title}
          description={postCommitRefreshNotice.description}
        />
      );
    }

    if (classAdviserClaimNotice) {
      return (
        <Alert
          type="success"
          showIcon
          title={classAdviserClaimNotice.title}
          description={
            hasCommitWork
              ? `${classAdviserClaimNotice.description} 预读结果不会写库，确认差异后可检查并提交变更。`
              : `${classAdviserClaimNotice.description} 当前没有需要写库的变更，无需检查并提交变更。`
          }
        />
      );
    }

    if (!hasCommitWork) {
      return <Alert type="info" showIcon title="当前没有需要保存的变更。无需检查并提交变更。" />;
    }

    return <Alert type="info" showIcon title="核对结果尚未保存。确认差异后可检查并提交变更。" />;
  }

  function renderReconciliationResultSection() {
    return (
      <div className="flex flex-col gap-5">
        {reconciliationError ? (
          <Alert
            type={reconciliationResult?.requiresReconfirm ? 'warning' : 'error'}
            showIcon
            title={reconciliationError}
          />
        ) : null}
        {reconciliationResult ? (
          <>{renderObservationTable()}</>
        ) : (
          <div className="max-w-3xl">
            <Alert
              type="info"
              showIcon
              title="还没有核对结果"
              description={
                selectedClassCode
                  ? `已选择 ${selectedClassLabel}，点击“预读校园网学生花名册并核对”后展示差异。`
                  : canUseLocalClassOptions
                    ? '请先选择一个本地班级。'
                    : '请先读取班级列表并选择班级。'
              }
            />
          </div>
        )}
      </div>
    );
  }

  if (isLoadingCurrentAccount) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!currentAccount) {
    return (
      <div className="flex flex-col gap-6">
        <Alert
          type="error"
          showIcon
          title={pageError ?? '当前登录会话已失效，请重新登录后再试。'}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <DecoratedPageHeader
        description={PAGE_DESCRIPTION}
        colorScheme="purple"
        icon={<ReconciliationOutlined />}
        title="班级名册归属对齐"
      />
      {pageError ? <Alert type="error" showIcon title={pageError} /> : null}
      {renderCommitReview()}
      {renderClassListCard()}
      {renderReconciliationResultSection()}

      <UpstreamLoginModal
        form={loginForm}
        hasRememberedCredentials={canUseRememberedCredentials}
        isSubmitting={isSubmittingLogin}
        loginError={loginError}
        lockedUserId={lockedUpstreamLoginUserId}
        open={isLoginModalOpen}
        onClearRememberedCredentials={clearRememberedCredentials}
        onCancel={() => {
          setIsLoginModalOpen(false);
          setPendingAction(null);
          setLoginError(null);
          loginForm.resetFields(['password']);
        }}
        onFinish={async (values) => {
          setIsSubmittingLogin(true);
          setLoginError(null);

          try {
            const nextSession = await loginUpstream(values);
            const nextPendingAction = pendingAction;

            setIsLoginModalOpen(false);
            setPendingAction(null);
            loginForm.setFieldsValue({
              password: '',
              userId: nextSession.upstreamLoginId ?? '',
            });
            if (nextPendingAction) {
              await performAction(nextSession, nextPendingAction);
            } else if (!canUseLocalClassOptions) {
              setHasAutoLoadedClassList(true);
              await performAction(nextSession, {
                type: 'load-class-list',
              });
            }
          } catch (error) {
            setLoginError(resolveStudentRosterMembershipErrorMessage(error));
          } finally {
            setIsSubmittingLogin(false);
          }
        }}
      />
    </div>
  );
}
