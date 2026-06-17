// src/features/student-roster-membership-reconciliation/ui/student-roster-membership-reconciliation-page-content.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReconciliationOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Popconfirm,
  Radio,
  Select,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  type AcademicSemesterRecord,
  AcademicSemesterSelect,
  sortAcademicSemestersForDisplay,
} from '@/entities/academic-semester';
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

import type { AuthAccessGroup } from '@/shared/auth-access';
import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import { hasAutomaticRosterCommitWork } from '../application/commit-work';
import {
  buildCommitConfirmations,
  buildCommitEndDecisions,
  buildDefaultConfirmationDrafts,
  buildDefaultEndDecisionDrafts,
  buildDefaultPreRegisteredReviewDrafts,
  buildPreRegisteredReviewCommitPayload,
  canEndDecision,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type ConfirmationDraft,
  DECISION_OUTCOME_COLORS,
  DECISION_OUTCOME_LABELS,
  type EndDecisionDraft,
  getActionLabel,
  getConfirmationDecisionOptions,
  getEffectiveSemesterHelpText,
  getEffectiveSemesterLabel,
  mergeCommitEndDecisions,
  type PreRegisteredReviewDraft,
  type PreRegisteredReviewOutcome,
  REASON_CODE_LABELS,
  requiresEffectiveSemester,
  requiresPreRegisteredLocalReview,
} from '../application/confirmation-policy';
import {
  buildRosterReviewItems,
  countRosterReviewItemsByKind,
  filterRosterReviewItems,
  ROSTER_REVIEW_KIND_COLORS,
  ROSTER_REVIEW_KIND_LABELS,
  ROSTER_REVIEW_KIND_ORDER,
  type RosterReviewItem,
  type RosterReviewKind,
} from '../application/result-view-model';
import {
  hasRosterMembershipLocalClassOptionsAccess,
  resolveRosterSyncPermissionStrategy,
} from '../application/roster-sync-permission';
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
  requestAcademicSemesters,
  resolveStudentRosterMembershipErrorMessage,
} from '../infrastructure/api';
import { isRosterMembershipPermissionError } from '../infrastructure/api-errors';

type PendingRosterAction =
  | { type: 'load-class-list' }
  | { classCode: string; type: 'dry-run' }
  | {
      classCode: string;
      confirmations: StudentRosterMembershipConfirmationInput[];
      endDecisions: StudentRosterMembershipEndDecisionInput[];
      type: 'commit';
    };

type ResultFilterKey = 'focus' | 'all' | RosterReviewKind;

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

function renderCategoryTag(category: StudentRosterMembershipReconciliationItem['category']) {
  return <Tag color={CATEGORY_COLORS[category]}>{CATEGORY_LABELS[category]}</Tag>;
}

function renderActionTag(action: string) {
  return <Tag>{getActionLabel(action)}</Tag>;
}

function getCommitImpactTagColor(reviewItem: RosterReviewItem) {
  if (reviewItem.kind === 'required-confirmation') {
    return 'gold';
  }

  if (reviewItem.kind === 'enrollment-review') {
    return 'warning';
  }

  if (reviewItem.kind === 'local-decision' && canEndDecision(reviewItem.item)) {
    return 'blue';
  }

  if (reviewItem.kind === 'automatic' && reviewItem.item.action !== 'NO_CHANGE') {
    return 'green';
  }

  return 'default';
}

function renderDefaultOperationTag(reviewItem: RosterReviewItem) {
  if (reviewItem.kind === 'enrollment-review') {
    return null;
  }

  return (
    <Tag color={ROSTER_REVIEW_KIND_COLORS[reviewItem.kind]}>{reviewItem.defaultOperationLabel}</Tag>
  );
}

function renderCommitImpactTag(reviewItem: RosterReviewItem) {
  if (reviewItem.kind === 'enrollment-review') {
    return null;
  }

  return <Tag color={getCommitImpactTagColor(reviewItem)}>{reviewItem.commitImpactLabel}</Tag>;
}

function getDecisionOutcomeButtonProps(
  outcome: StudentRosterMembershipConfirmationInput['decisionOutcome'],
  isSelected: boolean,
) {
  if (outcome === 'INCLUDE') {
    return isSelected
      ? {
          type: 'primary' as const,
        }
      : {
          color: 'primary' as const,
          variant: 'outlined' as const,
        };
  }

  return {
    color: 'orange' as const,
    variant: isSelected ? ('solid' as const) : ('outlined' as const),
  };
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

function renderDecisionOutcome(
  outcome: StudentRosterMembershipReconciliationItem['recommendedDecisionOutcome'],
) {
  return outcome ? renderDecisionOutcomeTag(outcome) : '-';
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
  const [endDecisionDrafts, setEndDecisionDrafts] = useState<Record<string, EndDecisionDraft>>({});
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
  const focusReviewItems = useMemo(
    () => filterRosterReviewItems(reviewItems, 'focus'),
    [reviewItems],
  );
  const visibleReviewItems = useMemo(
    () => filterRosterReviewItems(reviewItems, resultFilter),
    [resultFilter, reviewItems],
  );
  const resultFilterOptions = useMemo(() => {
    return [
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
  }, [focusReviewItems.length, reviewCounts, reviewItems.length]);
  const commitConfirmations = useMemo(
    () => buildCommitConfirmations(reconciliationResult?.items ?? [], confirmationDrafts),
    [confirmationDrafts, reconciliationResult],
  );
  const selectedEndDecisions = useMemo(
    () => buildCommitEndDecisions(reconciliationResult?.items ?? [], endDecisionDrafts),
    [endDecisionDrafts, reconciliationResult],
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
    () => [...commitConfirmations.confirmations, ...preRegisteredReviewCommitPayload.confirmations],
    [commitConfirmations.confirmations, preRegisteredReviewCommitPayload.confirmations],
  );
  const commitEndDecisions = useMemo(
    () =>
      mergeCommitEndDecisions(selectedEndDecisions, preRegisteredReviewCommitPayload.endDecisions),
    [preRegisteredReviewCommitPayload.endDecisions, selectedEndDecisions],
  );
  const hasCommitWork =
    commitConfirmationsPayload.length > 0 ||
    commitEndDecisions.length > 0 ||
    hasAutomaticRosterCommitWork(reconciliationResult?.items ?? []);
  const isLoadingClassSelection =
    isLoadingClassList || isLoadingDepartments || isLoadingLocalClassOptions;
  const isRunningAction = isLoadingClassSelection || isPreviewing || isCommitting;
  const canCommit =
    Boolean(reconciliationResult) &&
    hasCommitWork &&
    commitConfirmations.invalidItems.length === 0 &&
    preRegisteredReviewCommitPayload.invalidItems.length === 0 &&
    !isRunningAction;

  const applyReconciliationResult = useCallback(
    (result: StudentRosterMembershipReconciliationResult) => {
      setReconciliationResult(result);
      setConfirmationDrafts(buildDefaultConfirmationDrafts(result.items));
      setEndDecisionDrafts(buildDefaultEndDecisionDrafts(result.items));
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
      setEndDecisionDrafts({});
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
      clearCurrentSession();
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
    [clearCurrentSession, lockedUpstreamLoginUserId, loginForm, rememberedCredentials],
  );

  const handleActionError = useCallback((action: PendingRosterAction, error: unknown) => {
    const message = resolveStudentRosterMembershipErrorMessage(error);

    switch (action.type) {
      case 'load-class-list':
        setClassListResult(null);
        setSelectedClassCode(undefined);
        setClassListError(message);
        return;
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
            setEndDecisionDrafts({});
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

  function updateEndDecisionDraft(
    item: StudentRosterMembershipReconciliationItem,
    updater: (draft: EndDecisionDraft | undefined) => EndDecisionDraft,
  ) {
    setEndDecisionDrafts((current) => ({
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
    const helpText = getEffectiveSemesterHelpText(input.reasonCode);

    return (
      <div className="flex flex-col gap-1">
        <span className="text-text-secondary">{getEffectiveSemesterLabel(input.reasonCode)}</span>
        {renderEffectiveSemesterSelect({
          value: input.value,
          onChange: input.onChange,
        })}
        {helpText ? <span className="text-text-secondary">{helpText}</span> : null}
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

    const selectedOption = options.find(
      (option) => option.decisionOutcome === draft.decisionOutcome,
    );

    return (
      <div className="flex min-w-[320px] flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const isSelected = option.decisionOutcome === draft.decisionOutcome;

            return (
              <Button
                key={option.decisionOutcome}
                htmlType="button"
                {...getDecisionOutcomeButtonProps(option.decisionOutcome, isSelected)}
                onClick={() => {
                  const nextReasonCode = option.defaultReasonCode;

                  updateConfirmationDraft(item, (current) => ({
                    decisionOutcome: option.decisionOutcome,
                    effectiveSemesterId: requiresEffectiveSemester(nextReasonCode)
                      ? current?.effectiveSemesterId
                      : undefined,
                    reasonCode: nextReasonCode,
                    reasonText: current?.reasonText,
                  }));
                }}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
        <Select
          value={draft.reasonCode}
          options={(selectedOption?.reasonOptions ?? []).map((reasonCode) => ({
            label: REASON_CODE_LABELS[reasonCode],
            value: reasonCode,
          }))}
          onChange={(reasonCode) => {
            updateConfirmationDraft(item, (current) => ({
              decisionOutcome: current?.decisionOutcome ?? draft.decisionOutcome,
              effectiveSemesterId: requiresEffectiveSemester(reasonCode)
                ? current?.effectiveSemesterId
                : undefined,
              reasonCode,
              reasonText: current?.reasonText,
            }));
          }}
        />
        {requiresEffectiveSemester(draft.reasonCode)
          ? renderEffectiveSemesterField({
              reasonCode: draft.reasonCode,
              value: draft.effectiveSemesterId,
              onChange: (effectiveSemesterId) => {
                updateConfirmationDraft(item, (current) => ({
                  decisionOutcome: current?.decisionOutcome ?? draft.decisionOutcome,
                  effectiveSemesterId,
                  reasonCode: current?.reasonCode ?? draft.reasonCode,
                  reasonText: current?.reasonText,
                }));
              },
            })
          : null}
        <Input.TextArea
          autoSize={{ maxRows: 4, minRows: 2 }}
          maxLength={255}
          placeholder="可选备注"
          showCount
          value={draft.reasonText}
          onChange={(event) => {
            updateConfirmationDraft(item, (current) => ({
              decisionOutcome: current?.decisionOutcome ?? draft.decisionOutcome,
              effectiveSemesterId: current?.effectiveSemesterId,
              reasonCode: current?.reasonCode ?? draft.reasonCode,
              reasonText: event.target.value,
            }));
          }}
        />
      </div>
    );
  }

  function renderEndDecisionEditor(item: StudentRosterMembershipReconciliationItem) {
    if (!canEndDecision(item)) {
      return null;
    }

    const draft = endDecisionDrafts[item.key] ?? { selected: false };

    return (
      <div className="flex min-w-[280px] flex-col gap-2">
        <Checkbox
          checked={draft.selected}
          onChange={(event) => {
            updateEndDecisionDraft(item, (current) => ({
              endReason: current?.endReason,
              selected: event.target.checked,
            }));
          }}
        >
          撤销此裁定
        </Checkbox>
        {draft.selected ? (
          <Input.TextArea
            autoSize={{ maxRows: 3, minRows: 2 }}
            maxLength={255}
            placeholder="可选撤销原因"
            showCount
            value={draft.endReason}
            onChange={(event) => {
              updateEndDecisionDraft(item, (current) => ({
                selected: current?.selected ?? true,
                endReason: event.target.value,
              }));
            }}
          />
        ) : null}
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

    if (reviewItem.kind === 'local-decision' && !canEndDecision(item)) {
      return false;
    }

    if (reviewItem.kind === 'automatic' && item.action === 'NO_CHANGE') {
      return false;
    }

    return true;
  }

  function renderReviewSummaryCell(reviewItem: RosterReviewItem) {
    const shouldShowBusinessText = shouldShowReviewBusinessText(reviewItem);
    const currentDecisionTag = reviewItem.item.activeDecisionOutcome
      ? renderDecisionOutcomeTag(reviewItem.item.activeDecisionOutcome, '当前裁定')
      : null;

    return (
      <div className="flex flex-col gap-2">
        {currentDecisionTag ? (
          <div className="flex flex-wrap gap-1">{currentDecisionTag}</div>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {reviewItem.item.recommendedDecisionOutcome
            ? renderDecisionOutcomeTag(reviewItem.item.recommendedDecisionOutcome, '建议')
            : null}
          {renderDefaultOperationTag(reviewItem)}
          {renderCommitImpactTag(reviewItem)}
        </div>
        {shouldShowBusinessText ? (
          <span className="font-medium text-text">{reviewItem.businessSummary}</span>
        ) : null}
        {shouldShowBusinessText && reviewItem.businessDetail ? (
          <span className="text-text-secondary">{reviewItem.businessDetail}</span>
        ) : null}
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
      renderEndDecisionEditor(item);

    return (
      <div className="flex flex-col gap-3">
        {renderReviewSummaryCell(reviewItem)}
        {editor}
      </div>
    );
  }

  function renderExpandedObservationDetails(reviewItem: RosterReviewItem) {
    const item = reviewItem.item;

    return (
      <Descriptions bordered size="small" column={3}>
        <Descriptions.Item label="业务分组">
          {ROSTER_REVIEW_KIND_LABELS[reviewItem.kind]}
        </Descriptions.Item>
        <Descriptions.Item label="默认处理">
          {renderDefaultOperationTag(reviewItem)}
        </Descriptions.Item>
        <Descriptions.Item label="提交影响">{renderCommitImpactTag(reviewItem)}</Descriptions.Item>
        <Descriptions.Item label="key">{item.key}</Descriptions.Item>
        <Descriptions.Item label="上游行号">{formatNullableValue(item.rowIndex)}</Descriptions.Item>
        <Descriptions.Item label="分类">{renderCategoryTag(item.category)}</Descriptions.Item>
        <Descriptions.Item label="动作">{renderActionTag(item.action)}</Descriptions.Item>
        <Descriptions.Item label="校园网返回">
          {renderCampusNetworkReturnTag(item.upstreamPresence) ?? '已返回'}
        </Descriptions.Item>
        <Descriptions.Item label="upstreamStudentId">
          {formatNullableValue(item.upstreamStudentId)}
        </Descriptions.Item>
        <Descriptions.Item label="报到状态">
          {getReportedStatusLabel(item.isEnrolled)}
        </Descriptions.Item>
        <Descriptions.Item label="在校状态">
          {getInSchoolStatusLabel(item.isInSchool)}
        </Descriptions.Item>
        <Descriptions.Item label="本地学生状态">
          {renderStudentStatusTag(item.studentStatus) ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="IS_ENROLLED">
          {formatNullableValue(item.isEnrolled)}
        </Descriptions.Item>
        <Descriptions.Item label="IS_IN_SCHOOL">
          {formatNullableValue(item.isInSchool)}
        </Descriptions.Item>
        <Descriptions.Item label="当前 membership">
          {formatNullableValue(item.currentMembershipId)}
        </Descriptions.Item>
        <Descriptions.Item label="当前归属班级">
          {formatNullableValue(item.currentClassName ?? item.currentClassCode)}
        </Descriptions.Item>
        <Descriptions.Item label="当前裁定">
          {renderDecisionOutcome(item.activeDecisionOutcome)}
        </Descriptions.Item>
        <Descriptions.Item label="active decision">
          {formatNullableValue(item.activeDecisionId)}
        </Descriptions.Item>
        <Descriptions.Item label={getEffectiveSemesterLabel(item.activeDecisionReasonCode)}>
          {formatNullableValue(item.activeDecisionEffectiveSemesterId)}
        </Descriptions.Item>
        <Descriptions.Item label="推断入学年">
          {formatNullableValue(item.inferredAdmissionYear)}
        </Descriptions.Item>
        <Descriptions.Item label="推断原班序号">
          {formatNullableValue(item.inferredOriginalClassSeq)}
        </Descriptions.Item>
        <Descriptions.Item label="推断目标班序号">
          {formatNullableValue(item.inferredTargetClassSeq)}
        </Descriptions.Item>
        <Descriptions.Item label="推断原班级">
          {formatNullableValue(item.inferredOriginalClassCode)}
        </Descriptions.Item>
        <Descriptions.Item label="推荐裁定">
          {renderDecisionOutcome(item.recommendedDecisionOutcome)}
        </Descriptions.Item>
        <Descriptions.Item label="推荐原因码">
          {renderReasonCode(item.recommendedReasonCode)}
        </Descriptions.Item>
        <Descriptions.Item label="后端说明">{formatNullableValue(item.reason)}</Descriptions.Item>
      </Descriptions>
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
      key: 'operation',
      render: (_, item) => renderOperationCell(item),
      title: '处理方式',
      width: 520,
    },
  ];

  function clearReconciliationViewState() {
    setReconciliationResult(null);
    setClassAdviserClaimNotice(null);
    setPostCommitRefreshNotice(null);
    setConfirmationDrafts({});
    setEndDecisionDrafts({});
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
            <Popconfirm
              cancelText="取消"
              okButtonProps={{ loading: isCommitting }}
              okText="提交"
              title="确认提交核对结果？"
              onConfirm={() => void handleCommit()}
            >
              <Button danger={hasCommitWork} loading={isCommitting} disabled={!canCommit}>
                {hasCommitWork ? '提交核对结果' : '无需提交'}
              </Button>
            </Popconfirm>
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

  function renderObservationTable() {
    if (!reconciliationResult) {
      return null;
    }

    return (
      <div className="flex flex-col gap-3">
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
            expandable={{
              expandedRowRender: renderExpandedObservationDetails,
            }}
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
          title="本次 commit 未写库"
          description="后端重新计算后发现 roster 或本地事实已变化。当前页面已替换为最新结果，请重新确认后再提交。"
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

    if (reconciliationResult.committed) {
      return <Alert type="success" showIcon title="本次核对已提交并写库。" />;
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
              ? `${classAdviserClaimNotice.description} 预读结果不会写库，确认差异后可提交核对结果。`
              : `${classAdviserClaimNotice.description} 当前没有需要写库的变更，无需提交核对结果。`
          }
        />
      );
    }

    if (!hasCommitWork) {
      return <Alert type="info" showIcon title="当前没有需要写库的变更。无需提交核对结果。" />;
    }

    return <Alert type="info" showIcon title="预读结果不会写库。确认差异后可提交核对结果。" />;
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
                  ? `已选择 ${selectedClassLabel}，点击 Dry-run 核对后展示差异。`
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
