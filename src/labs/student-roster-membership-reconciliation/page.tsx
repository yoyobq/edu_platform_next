// src/labs/student-roster-membership-reconciliation/page.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReloadOutlined, TeamOutlined } from '@ant-design/icons';
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
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  buildUpstreamLoginCredentialsInitialValues,
  canUseRememberedUpstreamLoginCredentials,
  formatUpstreamSessionDateTime,
  type StoredUpstreamSession,
  type UpstreamLoginFormValues,
  UpstreamLoginModal,
  useUpstreamSession,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import {
  commitStudentRosterMembershipReconciliation,
  type CurrentRosterMembershipAccount,
  dryRunReconcileStudentRosterMembership,
  fetchCurrentRosterMembershipAccount,
  fetchPreviousClassAdviserClasses,
  isExpiredUpstreamSessionError,
  type PreviousClassAdviserClassesResult,
  resolveStudentRosterMembershipErrorMessage,
  type StudentRosterMembershipCategory,
  type StudentRosterMembershipConfirmationInput,
  type StudentRosterMembershipEndDecisionInput,
  type StudentRosterMembershipReconciliationItem,
  type StudentRosterMembershipReconciliationResult,
} from './api';
import {
  buildCommitConfirmations,
  buildCommitEndDecisions,
  buildDefaultConfirmationDrafts,
  buildDefaultEndDecisionDrafts,
  canEndDecision,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type ConfirmationDraft,
  DECISION_OUTCOME_LABELS,
  type EndDecisionDraft,
  getActionLabel,
  getConfirmationDecisionOptions,
  REASON_CODE_LABELS,
} from './confirmation-policy';

type PendingRosterAction =
  | { type: 'load-class-list' }
  | { classCode: string; type: 'dry-run' }
  | {
      classCode: string;
      confirmations: StudentRosterMembershipConfirmationInput[];
      endDecisions: StudentRosterMembershipEndDecisionInput[];
      type: 'commit';
    };

type ResultFilterKey = 'focus' | 'requires-confirmation' | 'all' | StudentRosterMembershipCategory;

const PAGE_DESCRIPTION =
  '按单个本地班级核对 upstream roster 与本地 member_student_class_membership / decision 的归属差异。';

const RESULT_CATEGORY_ORDER: StudentRosterMembershipCategory[] = [
  'DIFFERENCE',
  'UNPROCESSABLE',
  'SUPPRESSED',
  'AUTO_APPLY',
];
const RESULT_TABLE_DEFAULT_PAGE_SIZE = 8;

function resolveUpstreamRefreshFailureMessage(error: unknown) {
  if (isExpiredUpstreamSessionError(error)) {
    return 'upstream 会话已失效，请重新登录后继续。';
  }

  return resolveStudentRosterMembershipErrorMessage(error);
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

function getPendingActionLabel(action: PendingRosterAction | null) {
  switch (action?.type) {
    case 'load-class-list':
      return '读取历史班主任班级';
    case 'dry-run':
      return '预览学生名册归属差异';
    case 'commit':
      return '提交学生名册归属核对';
    default:
      return '执行学生名册归属核对';
  }
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

function hasInactiveEnrollmentSignal(item: StudentRosterMembershipReconciliationItem) {
  return item.isEnrolled === '0' || item.isInSchool === '0';
}

function isFocusResultItem(item: StudentRosterMembershipReconciliationItem) {
  return (
    item.requiresConfirmation ||
    item.category === 'DIFFERENCE' ||
    item.category === 'UNPROCESSABLE' ||
    hasInactiveEnrollmentSignal(item) ||
    canEndDecision(item)
  );
}

function filterResultItems(
  items: readonly StudentRosterMembershipReconciliationItem[],
  filter: ResultFilterKey,
) {
  switch (filter) {
    case 'focus':
      return items.filter(isFocusResultItem);
    case 'requires-confirmation':
      return items.filter((item) => item.requiresConfirmation);
    case 'all':
      return [...items];
    default:
      return items.filter((item) => item.category === filter);
  }
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
  return outcome ? DECISION_OUTCOME_LABELS[outcome] : '-';
}

function renderReasonCode(
  reasonCode: StudentRosterMembershipReconciliationItem['recommendedReasonCode'],
) {
  return reasonCode ? REASON_CODE_LABELS[reasonCode] : '-';
}

export function StudentRosterMembershipReconciliationLabPage() {
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const [currentAccount, setCurrentAccount] = useState<CurrentRosterMembershipAccount | null>(null);
  const [isLoadingCurrentAccount, setIsLoadingCurrentAccount] = useState(true);
  const [isLoadingClassList, setIsLoadingClassList] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [classListError, setClassListError] = useState<string | null>(null);
  const [reconciliationError, setReconciliationError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingRosterAction | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilterKey>('focus');
  const [resultTablePage, setResultTablePage] = useState(1);
  const [resultTablePageSize, setResultTablePageSize] = useState(RESULT_TABLE_DEFAULT_PAGE_SIZE);
  const [classListResult, setClassListResult] = useState<PreviousClassAdviserClassesResult | null>(
    null,
  );
  const [selectedClassCode, setSelectedClassCode] = useState<string | undefined>();
  const [reconciliationResult, setReconciliationResult] =
    useState<StudentRosterMembershipReconciliationResult | null>(null);
  const [confirmationDrafts, setConfirmationDrafts] = useState<Record<string, ConfirmationDraft>>(
    {},
  );
  const [endDecisionDrafts, setEndDecisionDrafts] = useState<Record<string, EndDecisionDraft>>({});
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
  });
  const canUseRememberedCredentials = canUseRememberedUpstreamLoginCredentials({
    rememberedCredentials,
  });
  const classOptions = useMemo(
    () =>
      classListResult?.classes.map((item) => ({
        label: `${item.name} (${item.code})`,
        value: item.code,
      })) ?? [],
    [classListResult],
  );
  const selectedClass =
    classListResult?.classes.find((item) => item.code === selectedClassCode) ?? null;
  const requiredConfirmationItems = useMemo(
    () => reconciliationResult?.items.filter((item) => item.requiresConfirmation) ?? [],
    [reconciliationResult],
  );
  const focusResultItems = useMemo(
    () => reconciliationResult?.items.filter(isFocusResultItem) ?? [],
    [reconciliationResult],
  );
  const visibleReconciliationItems = useMemo(
    () => filterResultItems(reconciliationResult?.items ?? [], resultFilter),
    [reconciliationResult, resultFilter],
  );
  const resultFilterOptions = useMemo(() => {
    const items = reconciliationResult?.items ?? [];

    return [
      {
        label: `重点项 ${focusResultItems.length}`,
        value: 'focus',
      },
      {
        label: `需确认 ${requiredConfirmationItems.length}`,
        value: 'requires-confirmation',
      },
      {
        label: `全部 ${items.length}`,
        value: 'all',
      },
      ...RESULT_CATEGORY_ORDER.map((category) => ({
        label: `${CATEGORY_LABELS[category]} ${items.filter((item) => item.category === category).length}`,
        value: category,
      })),
    ];
  }, [focusResultItems.length, reconciliationResult, requiredConfirmationItems.length]);
  const commitConfirmations = useMemo(
    () => buildCommitConfirmations(reconciliationResult?.items ?? [], confirmationDrafts),
    [confirmationDrafts, reconciliationResult],
  );
  const commitEndDecisions = useMemo(
    () => buildCommitEndDecisions(reconciliationResult?.items ?? [], endDecisionDrafts),
    [endDecisionDrafts, reconciliationResult],
  );
  const isRunningAction = isLoadingClassList || isPreviewing || isCommitting;
  const canCommit =
    Boolean(reconciliationResult) &&
    commitConfirmations.invalidItems.length === 0 &&
    !isRunningAction;

  const applyReconciliationResult = useCallback(
    (result: StudentRosterMembershipReconciliationResult) => {
      setReconciliationResult(result);
      setConfirmationDrafts(buildDefaultConfirmationDrafts(result.items));
      setEndDecisionDrafts(buildDefaultEndDecisionDrafts(result.items));
      setResultFilter(result.items.some(isFocusResultItem) ? 'focus' : 'all');
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
      setConfirmationDrafts({});
      setEndDecisionDrafts({});
      setResultFilter('focus');
      setResultTablePage(1);
      setClassListError(null);
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
          rememberedCredentials,
        }),
      );
    },
    [clearCurrentSession, loginForm, rememberedCredentials],
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
              sessionToken: currentSession.upstreamSessionToken,
            });

            persistSessionFromResult(currentSession, result);
            setClassListResult(result);
            setSelectedClassCode((currentClassCode) =>
              result.classes.some((item) => item.code === currentClassCode)
                ? currentClassCode
                : undefined,
            );
            setReconciliationResult(null);
            setConfirmationDrafts({});
            setEndDecisionDrafts({});
            setResultFilter('focus');
            setResultTablePage(1);
            return;
          }
          case 'dry-run': {
            setIsPreviewing(true);
            setReconciliationError(null);
            const result = await dryRunReconcileStudentRosterMembership({
              classCode: action.classCode,
              upstreamSessionToken: currentSession.upstreamSessionToken,
            });

            persistSessionFromResult(currentSession, result);
            applyReconciliationResult(result);
            return;
          }
          case 'commit': {
            setIsCommitting(true);
            setReconciliationError(null);
            const result = await commitStudentRosterMembershipReconciliation({
              classCode: action.classCode,
              confirmations: action.confirmations,
              endDecisions: action.endDecisions,
              upstreamSessionToken: currentSession.upstreamSessionToken,
            });

            persistSessionFromResult(currentSession, result);
            applyReconciliationResult(result);

            if (result.requiresReconfirm) {
              setReconciliationError('数据已变化，本次未写库。请根据最新结果重新确认。');
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
      applyReconciliationResult,
      handleActionError,
      persistSessionFromResult,
      promptUpstreamLogin,
      refreshSession,
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

      if (!storedSession) {
        setPendingAction(action);
        setIsLoginModalOpen(true);
        loginForm.setFieldsValue(
          buildUpstreamLoginCredentialsInitialValues({
            rememberedCredentials,
          }),
        );
        return;
      }

      await performAction(storedSession, action);
    },
    [currentAccount, loginForm, performAction, rememberedCredentials, storedSession],
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
        rememberedCredentials,
      }),
    );
    setIsLoginModalOpen(true);
  }, [clearCurrentSession, keepAliveFailure, loginForm, rememberedCredentials]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(visibleReconciliationItems.length / resultTablePageSize));

    setResultTablePage((currentPage) => Math.min(currentPage, maxPage));
  }, [resultTablePageSize, visibleReconciliationItems.length]);

  async function handleLoadClassList() {
    await ensureSessionAndRun({
      type: 'load-class-list',
    });
  }

  async function handleDryRun() {
    if (!selectedClassCode) {
      setReconciliationError('请先从班级列表选择一个班级。');
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
      setReconciliationError('存在无法提交的确认项，请检查学生编号和确认选项。');
      return;
    }

    await ensureSessionAndRun({
      classCode: selectedClassCode,
      confirmations: commitConfirmations.confirmations,
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
        <Radio.Group
          optionType="button"
          value={draft.decisionOutcome}
          options={options.map((option) => ({
            label: option.label,
            value: option.decisionOutcome,
          }))}
          onChange={(event) => {
            const nextOption = options.find(
              (option) => option.decisionOutcome === event.target.value,
            );

            if (!nextOption) {
              return;
            }

            updateConfirmationDraft(item, (current) => ({
              decisionOutcome: nextOption.decisionOutcome,
              reasonCode: nextOption.defaultReasonCode,
              reasonText: current?.reasonText,
            }));
          }}
        />
        <Select
          value={draft.reasonCode}
          options={(selectedOption?.reasonOptions ?? []).map((reasonCode) => ({
            label: REASON_CODE_LABELS[reasonCode],
            value: reasonCode,
          }))}
          onChange={(reasonCode) => {
            updateConfirmationDraft(item, (current) => ({
              decisionOutcome: current?.decisionOutcome ?? draft.decisionOutcome,
              reasonCode,
              reasonText: current?.reasonText,
            }));
          }}
        />
        <Input.TextArea
          autoSize={{ maxRows: 4, minRows: 2 }}
          maxLength={255}
          placeholder="可选备注"
          showCount
          value={draft.reasonText}
          onChange={(event) => {
            updateConfirmationDraft(item, (current) => ({
              decisionOutcome: current?.decisionOutcome ?? draft.decisionOutcome,
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
          结束 INCLUDE 裁定
        </Checkbox>
        {draft.selected ? (
          <Input.TextArea
            autoSize={{ maxRows: 3, minRows: 2 }}
            maxLength={255}
            placeholder="可选结束原因"
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

  function renderPresenceTag(
    presence: StudentRosterMembershipReconciliationItem['upstreamPresence'],
  ) {
    const color = presence === 'RETURNED' ? 'green' : presence === 'MISSING' ? 'orange' : 'default';

    return <Tag color={color}>{presence}</Tag>;
  }

  function renderEnrollmentStatusTags(item: StudentRosterMembershipReconciliationItem) {
    return (
      <div className="flex flex-wrap gap-1">
        <Tag color={item.isEnrolled === '0' ? 'orange' : 'default'}>
          在籍 {item.isEnrolled ?? '-'}
        </Tag>
        <Tag color={item.isInSchool === '0' ? 'orange' : 'default'}>
          在校 {item.isInSchool ?? '-'}
        </Tag>
        {hasInactiveEnrollmentSignal(item) ? <Tag color="orange">学籍状态信号</Tag> : null}
      </div>
    );
  }

  function renderStudentCell(item: StudentRosterMembershipReconciliationItem) {
    return (
      <div className="flex flex-col gap-1">
        <span className="font-medium text-text">{getStudentDisplayName(item)}</span>
        <div className="flex flex-wrap gap-1">
          {renderCategoryTag(item.category)}
          {renderActionTag(item.action)}
          {item.requiresConfirmation ? <Tag color="gold">需确认</Tag> : null}
          {canEndDecision(item) ? <Tag color="blue">可结束裁定</Tag> : null}
          {hasInactiveEnrollmentSignal(item) ? <Tag color="orange">非在籍/非在校</Tag> : null}
        </div>
        {renderMetadataLine('studentId', item.studentId)}
        {renderMetadataLine('upstreamStudentId', item.upstreamStudentId)}
      </div>
    );
  }

  function renderMembershipComparison(item: StudentRosterMembershipReconciliationItem) {
    return (
      <div className="grid gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-text">本地归属</span>
          {renderMetadataLine('目标班级', `${item.className} / ${item.classCode}`)}
          {renderMetadataLine('当前归属', item.currentClassCode)}
          {renderMetadataLine('membership', item.currentMembershipId)}
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-medium text-text">上游返回</span>
          <span>{renderPresenceTag(item.upstreamPresence)}</span>
          {renderMetadataLine('上游班级', item.upstreamClassName)}
          {renderMetadataLine('上游 code', item.upstreamClassCode)}
          {renderEnrollmentStatusTags(item)}
        </div>
      </div>
    );
  }

  function renderDecisionCell(item: StudentRosterMembershipReconciliationItem) {
    return (
      <div className="flex flex-col gap-1">
        {renderMetadataLine('当前裁定', renderDecisionOutcome(item.activeDecisionOutcome))}
        {renderMetadataLine('decisionId', item.activeDecisionId)}
        {renderMetadataLine('推荐裁定', renderDecisionOutcome(item.recommendedDecisionOutcome))}
        {renderMetadataLine('推荐原因', renderReasonCode(item.recommendedReasonCode))}
        {renderMetadataLine('后端说明', item.reason)}
      </div>
    );
  }

  function renderOperationCell(item: StudentRosterMembershipReconciliationItem) {
    const editor = renderConfirmationEditor(item) ?? renderEndDecisionEditor(item);

    if (editor) {
      return editor;
    }

    if (item.category === 'UNPROCESSABLE') {
      return <Tag color="orange">仅观察</Tag>;
    }

    if (item.category === 'SUPPRESSED') {
      return <Tag color="blue">已被裁定压制</Tag>;
    }

    if (hasInactiveEnrollmentSignal(item)) {
      return <Tag color="orange">仅观察学籍状态</Tag>;
    }

    return <Tag color="green">无需人工确认</Tag>;
  }

  function renderExpandedObservationDetails(item: StudentRosterMembershipReconciliationItem) {
    return (
      <Descriptions bordered size="small" column={3}>
        <Descriptions.Item label="key">{item.key}</Descriptions.Item>
        <Descriptions.Item label="上游行号">{formatNullableValue(item.rowIndex)}</Descriptions.Item>
        <Descriptions.Item label="分类">{CATEGORY_LABELS[item.category]}</Descriptions.Item>
        <Descriptions.Item label="动作">{getActionLabel(item.action)}</Descriptions.Item>
        <Descriptions.Item label="upstream 出现">{item.upstreamPresence}</Descriptions.Item>
        <Descriptions.Item label="upstreamStudentId">
          {formatNullableValue(item.upstreamStudentId)}
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
        <Descriptions.Item label="active decision">
          {formatNullableValue(item.activeDecisionId)}
        </Descriptions.Item>
        <Descriptions.Item label="推荐原因码">
          {formatNullableValue(item.recommendedReasonCode)}
        </Descriptions.Item>
        <Descriptions.Item label="后端说明">{formatNullableValue(item.reason)}</Descriptions.Item>
      </Descriptions>
    );
  }

  const resultColumns: ColumnsType<StudentRosterMembershipReconciliationItem> = [
    {
      fixed: 'left',
      key: 'student',
      render: (_, item) => renderStudentCell(item),
      title: '学生与状态',
      width: 260,
    },
    {
      key: 'comparison',
      render: (_, item) => renderMembershipComparison(item),
      title: '归属对比',
      width: 340,
    },
    {
      key: 'decision',
      render: (_, item) => renderDecisionCell(item),
      title: '裁定与原因',
      width: 280,
    },
    {
      key: 'operation',
      render: (_, item) => renderOperationCell(item),
      title: '人工处理',
      width: 340,
    },
  ];

  function renderSessionCard() {
    return (
      <Card title="上游会话">
        <div className="flex flex-col gap-4">
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="当前账号">
              {currentAccount?.displayName ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="upstream token">
              {storedSession ? '已持有' : '未持有'}
            </Descriptions.Item>
            <Descriptions.Item label="过期时间">
              {formatUpstreamSessionDateTime(storedSession?.expiresAt ?? null)}
            </Descriptions.Item>
            <Descriptions.Item label="sessionStrategy">
              {reconciliationResult?.sessionStrategy ?? '-'}
            </Descriptions.Item>
          </Descriptions>
          <div className="flex flex-wrap gap-3">
            <Button
              type="primary"
              disabled={isRunningAction}
              onClick={() => {
                setPendingAction(null);
                setIsLoginModalOpen(true);
                loginForm.setFieldsValue(
                  buildUpstreamLoginCredentialsInitialValues({
                    rememberedCredentials,
                  }),
                );
              }}
            >
              {storedSession ? '重新登录 upstream' : '登录 upstream'}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              disabled={!storedSession || isRunningAction}
              loading={isLoadingClassList}
              onClick={() => void ensureSessionAndRun({ type: 'load-class-list' })}
            >
              刷新班级
            </Button>
            <Button
              danger
              disabled={!storedSession || isRunningAction}
              onClick={() => {
                clearCurrentSession();
                setLoginError(null);
              }}
            >
              清空 Token
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  function renderClassListCard() {
    return (
      <Card title="班级选择">
        <div className="flex flex-col gap-4">
          {classListError ? <Alert type="warning" showIcon title={classListError} /> : null}
          <Alert
            type="info"
            showIcon
            title="先从当前 upstream 登录用户的历史班主任班级中选择班级"
            description="classCode 必须已同步到本地 org_class.class_code；如果列表中的班级还没有本地班级，请先走班级同步。"
          />
          <div className="flex flex-wrap gap-3">
            <Button
              icon={<ReloadOutlined />}
              loading={isLoadingClassList}
              disabled={isRunningAction && !isLoadingClassList}
              onClick={() => void handleLoadClassList()}
            >
              读取历史班主任班级
            </Button>
          </div>
          {classListResult ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Tag color="processing">历史班主任班级数：{classListResult.count}</Tag>
                <Tag color="cyan">
                  token 过期：{formatUpstreamSessionDateTime(classListResult.expiresAt)}
                </Tag>
              </div>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="选择要核对的班级"
                value={selectedClassCode}
                options={classOptions}
                style={{ maxWidth: '100%', width: 420 }}
                onChange={(value) => {
                  setSelectedClassCode(value);
                  setReconciliationResult(null);
                  setConfirmationDrafts({});
                  setEndDecisionDrafts({});
                  setResultFilter('focus');
                  setResultTablePage(1);
                  setReconciliationError(null);
                }}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  type="primary"
                  loading={isPreviewing}
                  disabled={!selectedClassCode || isRunningAction}
                  onClick={() => void handleDryRun()}
                >
                  Dry-run 核对
                </Button>
              </div>
            </>
          ) : (
            <Alert
              type="info"
              showIcon
              title={
                storedSession
                  ? '读取历史班主任班级后选择目标班级。'
                  : '登录 upstream 后即可读取历史班主任班级。'
              }
            />
          )}
        </div>
      </Card>
    );
  }

  function renderResultSummary() {
    if (!reconciliationResult) {
      return null;
    }

    return (
      <Descriptions bordered size="small" column={4}>
        <Descriptions.Item label="模式">
          {reconciliationResult.dryRun ? 'Dry-run' : 'Commit'}
        </Descriptions.Item>
        <Descriptions.Item label="写入状态">
          {reconciliationResult.committed ? '已写库' : '未写库'}
        </Descriptions.Item>
        <Descriptions.Item label="需要重新确认">
          {reconciliationResult.requiresReconfirm ? '是' : '否'}
        </Descriptions.Item>
        <Descriptions.Item label="traceId">{reconciliationResult.traceId}</Descriptions.Item>
        <Descriptions.Item label="班级">
          {reconciliationResult.className} / {reconciliationResult.classCode}
        </Descriptions.Item>
        <Descriptions.Item label="目标班核对行数">
          {reconciliationResult.fetchedCount}
        </Descriptions.Item>
        <Descriptions.Item label="自动处理">
          {reconciliationResult.autoAppliedCount}
        </Descriptions.Item>
        <Descriptions.Item label="归属差异">
          {reconciliationResult.differenceCount}
        </Descriptions.Item>
        <Descriptions.Item label="本地裁定">
          {reconciliationResult.suppressedCount}
        </Descriptions.Item>
        <Descriptions.Item label="不可处理">
          {reconciliationResult.unprocessableCount}
        </Descriptions.Item>
        <Descriptions.Item label="需确认">
          {reconciliationResult.confirmationRequiredCount}
        </Descriptions.Item>
        <Descriptions.Item label="token 过期">
          {formatUpstreamSessionDateTime(reconciliationResult.expiresAt)}
        </Descriptions.Item>
        <Descriptions.Item label="新建归属">
          {reconciliationResult.createdMembershipCount}
        </Descriptions.Item>
        <Descriptions.Item label="刷新归属">
          {reconciliationResult.touchedMembershipCount}
        </Descriptions.Item>
        <Descriptions.Item label="结束归属">
          {reconciliationResult.endedMembershipCount}
        </Descriptions.Item>
        <Descriptions.Item label="裁定 +/-">
          +{reconciliationResult.createdDecisionCount} / -{reconciliationResult.endedDecisionCount}
        </Descriptions.Item>
      </Descriptions>
    );
  }

  function renderObservationTable() {
    if (!reconciliationResult) {
      return null;
    }

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Radio.Group
            optionType="button"
            value={resultFilter}
            options={resultFilterOptions}
            onChange={(event) => {
              setResultFilter(event.target.value as ResultFilterKey);
              setResultTablePage(1);
            }}
          />
          <Tag>当前显示：{visibleReconciliationItems.length}</Tag>
        </div>
        {visibleReconciliationItems.length > 0 ? (
          <Table<StudentRosterMembershipReconciliationItem>
            columns={resultColumns}
            dataSource={visibleReconciliationItems}
            expandable={{
              expandedRowRender: renderExpandedObservationDetails,
            }}
            pagination={{
              current: resultTablePage,
              pageSize: resultTablePageSize,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 项`,
              total: visibleReconciliationItems.length,
              onChange: (page, pageSize) => {
                setResultTablePage(page);
                setResultTablePageSize(pageSize);
              },
            }}
            rowKey={getResultRowKey}
            scroll={{ x: 1220 }}
            size="middle"
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

  function renderResultCard() {
    return (
      <Card title="核对结果">
        <div className="flex flex-col gap-5">
          {reconciliationError ? (
            <Alert
              type={reconciliationResult?.requiresReconfirm ? 'warning' : 'error'}
              showIcon
              title={reconciliationError}
            />
          ) : null}
          {commitConfirmations.invalidItems.length > 0 ? (
            <Alert
              type="warning"
              showIcon
              title="存在无法提交的确认项"
              description="后端要求 requiresConfirmation=true 的项必须完整提交；请检查这些项是否缺少 studentId 或确认策略。"
            />
          ) : null}
          {reconciliationResult ? (
            <>
              {renderResultSummary()}
              <div className="flex flex-wrap gap-2">
                <Tag color="gold">需确认：{requiredConfirmationItems.length}</Tag>
                <Tag color="blue">已生成确认：{commitConfirmations.confirmations.length}</Tag>
                <Tag color="purple">结束裁定：{commitEndDecisions.length}</Tag>
              </div>
              {reconciliationResult.requiresReconfirm ? (
                <Alert
                  type="warning"
                  showIcon
                  title="本次 commit 未写库"
                  description="后端重新计算后发现 roster 或本地事实已变化。当前页面已替换为最新结果，请重新确认后再提交。"
                />
              ) : reconciliationResult.committed ? (
                <Alert type="success" showIcon title="本次核对已提交并写库。" />
              ) : (
                <Alert
                  type="info"
                  showIcon
                  title="Dry-run 结果不会写库。确认差异后可提交核对结果。"
                />
              )}
              <div className="flex flex-wrap gap-3">
                <Popconfirm
                  cancelText="取消"
                  description="后端会重新拉取 upstream roster 并重新计算差异；本次只提交确认意图，不提交 dry-run 明细。"
                  okButtonProps={{ loading: isCommitting }}
                  okText="确认提交"
                  title="提交学生名册归属核对？"
                  onConfirm={() => void handleCommit()}
                >
                  <Button danger loading={isCommitting} disabled={!canCommit}>
                    提交核对结果
                  </Button>
                </Popconfirm>
                <Button
                  icon={<ReloadOutlined />}
                  disabled={!selectedClassCode || isRunningAction}
                  onClick={() => void handleDryRun()}
                >
                  重新 dry-run
                </Button>
              </div>
              {renderObservationTable()}
            </>
          ) : (
            <Alert
              type="info"
              showIcon
              title="还没有核对结果"
              description={
                selectedClass
                  ? `已选择 ${selectedClass.name}，点击 Dry-run 核对后展示差异。`
                  : '请先读取班级列表并选择班级。'
              }
            />
          )}
        </div>
      </Card>
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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
        <Alert
          type="error"
          showIcon
          title={pageError ?? '当前登录会话已失效，请重新登录后再试。'}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <DecoratedPageHeader
        description={PAGE_DESCRIPTION}
        icon={<TeamOutlined />}
        title="学生名册归属核对"
      />
      {pageError ? <Alert type="error" showIcon title={pageError} /> : null}
      {renderSessionCard()}
      {renderClassListCard()}
      {renderResultCard()}

      <UpstreamLoginModal
        description={
          pendingAction
            ? `当前操作需要有效的 upstream token。登录成功后，页面会自动继续${getPendingActionLabel(
                pendingAction,
              )}。`
            : '当前流程需要有效的 upstream token。登录成功后即可读取历史班主任班级。'
        }
        form={loginForm}
        hasRememberedCredentials={canUseRememberedCredentials}
        isSubmitting={isSubmittingLogin}
        loginError={loginError}
        okText="登录并继续"
        open={isLoginModalOpen}
        title={
          pendingAction ? `${getPendingActionLabel(pendingAction)}前登录 upstream` : '登录 upstream'
        }
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
