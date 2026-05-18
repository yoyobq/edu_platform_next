// src/labs/major-sync/page.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SyncOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Popconfirm,
  Select,
  Spin,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  buildUpstreamLoginCredentialsInitialValues,
  canUseRememberedUpstreamLoginCredentials,
  type StoredUpstreamSession,
  type UpstreamLoginFormValues,
  UpstreamLoginModal,
  useUpstreamSession,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import {
  type CurrentMajorSyncAccount,
  dryRunSyncMajorsFromUpstream,
  fetchCurrentMajorSyncAccount,
  fetchMajorSyncDepartmentOptions,
  isExpiredUpstreamSessionError,
  type MajorSyncCommitAction,
  type MajorSyncCommitItem,
  type MajorSyncCommitResult,
  type MajorSyncDepartmentOption,
  type MajorSyncDryRunAction,
  type MajorSyncDryRunItem,
  type MajorSyncDryRunResult,
  resolveMajorSyncErrorMessage,
  syncMajorsFromUpstream,
} from './api';
import { majorSyncLabMeta } from './meta';

type MajorSyncFormValues = {
  departmentId: string;
};

type MajorSyncRunMode = 'dryRun' | 'sync';

type PendingMajorSyncRequest = {
  mode: MajorSyncRunMode;
  values: MajorSyncFormValues;
};

type MajorSyncResult = MajorSyncDryRunResult | MajorSyncCommitResult;
type MajorSyncResultItem = MajorSyncDryRunItem | MajorSyncCommitItem;
type MajorSyncResultAction = MajorSyncDryRunAction | MajorSyncCommitAction;

const ACTION_LABELS: Record<MajorSyncResultAction, string> = {
  CREATE: '待新增',
  CREATED: '已新增',
  UPDATE: '待修正',
  UPDATED: '已修正',
  EXISTS: '已存在',
  SKIPPED_DUPLICATE_UPSTREAM_NAME: '上游重复',
};

const ACTION_COLORS: Record<MajorSyncResultAction, string> = {
  CREATE: 'green',
  CREATED: 'green',
  UPDATE: 'gold',
  UPDATED: 'gold',
  EXISTS: 'blue',
  SKIPPED_DUPLICATE_UPSTREAM_NAME: 'orange',
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '未返回';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getViewerRoleLabel(account: CurrentMajorSyncAccount | null) {
  if (!account) {
    return '未恢复';
  }

  return account.viewerRole === 'admin' ? 'ADMIN' : '学工行政';
}

function renderActionTag(action: MajorSyncResultAction) {
  return <Tag color={ACTION_COLORS[action]}>{ACTION_LABELS[action]}</Tag>;
}

function resolveResultMessage(result: MajorSyncResult) {
  if (
    result.dryRun &&
    result.createdCount === 0 &&
    result.updatedCount === 0 &&
    result.skippedCount === 0
  ) {
    return '本地专业及派生字段已覆盖上游本次返回的有效专业名。';
  }

  if (result.dryRun) {
    return '本次仅预览，不会写入 org_major。';
  }

  if (result.createdCount === 0 && result.updatedCount === 0 && result.skippedCount === 0) {
    return '本次落库完成，本地专业无需新增或修正。';
  }

  return '本次已完成落库；majorName 未被修改，upstream annualMajorId 未写入本地。';
}

function formatNullableValue(value: number | string | null) {
  return value ?? <span className="text-text-secondary">-</span>;
}

function isDryRunResult(result: MajorSyncResult): result is MajorSyncDryRunResult {
  return result.dryRun;
}

const resultColumns: ColumnsType<MajorSyncResultItem> = [
  {
    dataIndex: 'action',
    key: 'action',
    render: (action: MajorSyncResultAction) => renderActionTag(action),
    title: '动作',
    width: 140,
  },
  {
    dataIndex: 'majorName',
    key: 'majorName',
    title: '上游专业名',
    width: 260,
  },
  {
    dataIndex: 'shortName',
    key: 'shortName',
    render: (shortName: string | null) => formatNullableValue(shortName),
    title: '专业简称',
    width: 220,
  },
  {
    dataIndex: 'trainingYears',
    key: 'trainingYears',
    render: (trainingYears: number | null) => formatNullableValue(trainingYears),
    title: '学制',
    width: 110,
  },
  {
    dataIndex: 'trainingLevel',
    key: 'trainingLevel',
    render: (trainingLevel: string | null) => formatNullableValue(trainingLevel),
    title: '培养目标',
    width: 140,
  },
  {
    dataIndex: 'majorId',
    key: 'majorId',
    render: (majorId: string | null) => formatNullableValue(majorId),
    title: '本地专业 ID',
    width: 220,
  },
  {
    dataIndex: 'departmentId',
    key: 'departmentId',
    title: '系部 ID',
    width: 180,
  },
];

export function MajorSyncLabPage() {
  const [form] = Form.useForm<MajorSyncFormValues>();
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const [currentAccount, setCurrentAccount] = useState<CurrentMajorSyncAccount | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [departmentOptionsError, setDepartmentOptionsError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [result, setResult] = useState<MajorSyncResult | null>(null);
  const [departmentOptions, setDepartmentOptions] = useState<MajorSyncDepartmentOption[]>([]);
  const [pendingMajorSyncRequest, setPendingMajorSyncRequest] =
    useState<PendingMajorSyncRequest | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
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
  });
  const lockedUpstreamLoginUserId =
    currentAccount?.viewerRole === 'studentAffairsOfficer' ? currentAccount.staffId : null;
  const canUseRememberedCredentials = canUseRememberedUpstreamLoginCredentials({
    lockedUserId: lockedUpstreamLoginUserId,
    rememberedCredentials,
  });
  const hasNoDepartmentOptions =
    !isLoadingDepartments && !departmentOptionsError && departmentOptions.length === 0;
  const selectedDepartmentId = Form.useWatch('departmentId', form);
  const selectedDepartment = useMemo(
    () => departmentOptions.find((department) => department.id === selectedDepartmentId) ?? null,
    [departmentOptions, selectedDepartmentId],
  );
  const isRunningSync = isPreviewing || isSyncing;

  const clearCurrentSession = useCallback(() => {
    clear();
    setPendingMajorSyncRequest(null);
  }, [clear]);

  const loadDepartments = useCallback(
    async (account: CurrentMajorSyncAccount) => {
      setIsLoadingDepartments(true);
      setDepartmentOptionsError(null);

      try {
        const nextOptions = await fetchMajorSyncDepartmentOptions({
          accountId: account.accountId,
          viewerRole: account.viewerRole,
        });

        setDepartmentOptions(nextOptions);

        const currentDepartmentId = form.getFieldValue('departmentId') as string | undefined;
        const preferredDepartment =
          nextOptions.find((department) => department.id === currentDepartmentId) ?? nextOptions[0];

        form.setFieldsValue({
          departmentId: preferredDepartment?.id,
        });
      } catch (error) {
        setDepartmentOptions([]);
        setDepartmentOptionsError(
          error instanceof Error ? error.message : '暂时无法加载可选系部。',
        );
      } finally {
        setIsLoadingDepartments(false);
      }
    },
    [form],
  );

  useEffect(() => {
    let isCancelled = false;

    async function bootstrapPage() {
      setIsLoadingAccount(true);
      setPageError(null);
      setPreviewError(null);

      try {
        const account = await fetchCurrentMajorSyncAccount();

        if (isCancelled) {
          return;
        }

        setCurrentAccount(account);
        setIsLoadingAccount(false);
        await loadDepartments(account);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setCurrentAccount(null);
        setPageError(error instanceof Error ? error.message : '暂时无法确认当前登录账号。');
        setIsLoadingAccount(false);
      }
    }

    void bootstrapPage();

    return () => {
      isCancelled = true;
    };
  }, [loadDepartments]);

  useEffect(() => {
    if (!keepAliveFailure) {
      return;
    }

    clearCurrentSession();
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

  const performMajorSync = useCallback(
    async (session: StoredUpstreamSession, values: MajorSyncFormValues, mode: MajorSyncRunMode) => {
      const isDryRun = mode === 'dryRun';

      if (isDryRun) {
        setIsPreviewing(true);
      } else {
        setIsSyncing(true);
      }

      setPreviewError(null);
      setResult(null);
      setPendingMajorSyncRequest(null);

      try {
        const input = {
          departmentId: values.departmentId,
          upstreamSessionToken: session.upstreamSessionToken,
        };
        const syncResult = isDryRun
          ? await dryRunSyncMajorsFromUpstream(input)
          : await syncMajorsFromUpstream(input);

        persistSessionFromResult(session, syncResult);
        setResult(syncResult);
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          clearCurrentSession();
          setPendingMajorSyncRequest({ mode, values });
          setLoginError(
            isDryRun
              ? 'upstream 会话已失效，请重新登录后继续预览。'
              : 'upstream 会话已失效，请重新登录后继续落库。',
          );
          setIsLoginModalOpen(true);
          loginForm.setFieldsValue(
            buildUpstreamLoginCredentialsInitialValues({
              fallbackUserId: session.upstreamLoginId,
              lockedUserId: lockedUpstreamLoginUserId,
              rememberedCredentials,
            }),
          );
          return;
        }

        setPreviewError(resolveMajorSyncErrorMessage(error));
      } finally {
        if (isDryRun) {
          setIsPreviewing(false);
        } else {
          setIsSyncing(false);
        }
      }
    },
    [
      clearCurrentSession,
      lockedUpstreamLoginUserId,
      loginForm,
      persistSessionFromResult,
      rememberedCredentials,
    ],
  );

  const handleRunSync = useCallback(
    async (mode: MajorSyncRunMode) => {
      const values = await form.validateFields();

      setPreviewError(null);
      setLoginError(null);

      if (!currentAccount) {
        setPreviewError('当前登录会话尚未恢复，请稍后重试。');
        return;
      }

      if (!storedSession) {
        setPendingMajorSyncRequest({ mode, values });
        setIsLoginModalOpen(true);
        loginForm.setFieldsValue(
          buildUpstreamLoginCredentialsInitialValues({
            lockedUserId: lockedUpstreamLoginUserId,
            rememberedCredentials,
          }),
        );
        return;
      }

      await performMajorSync(storedSession, values, mode);
    },
    [
      currentAccount,
      form,
      lockedUpstreamLoginUserId,
      loginForm,
      performMajorSync,
      rememberedCredentials,
      storedSession,
    ],
  );

  const handleLoginFinish = useCallback(
    async (values: UpstreamLoginFormValues) => {
      if (!currentAccount) {
        setLoginError('当前登录账号尚未就绪，请稍后再试。');
        return;
      }

      setIsSubmittingLogin(true);
      setLoginError(null);

      try {
        const nextStoredSession = await loginUpstream(values);
        const nextPendingRequest = pendingMajorSyncRequest;

        setPendingMajorSyncRequest(null);
        setIsLoginModalOpen(false);
        loginForm.resetFields();

        if (nextPendingRequest) {
          await performMajorSync(
            nextStoredSession,
            nextPendingRequest.values,
            nextPendingRequest.mode,
          );
        }
      } catch (error) {
        setLoginError(resolveMajorSyncErrorMessage(error));
      } finally {
        setIsSubmittingLogin(false);
      }
    },
    [currentAccount, loginForm, loginUpstream, pendingMajorSyncRequest, performMajorSync],
  );

  if (isLoadingAccount) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
        <Alert showIcon type="error" message={pageError} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <DecoratedPageHeader
        description={majorSyncLabMeta.purpose}
        icon={<SyncOutlined />}
        title="专业同步"
      />

      <Card title="当前状态">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="当前账号">
            {currentAccount?.displayName || '未恢复'}
          </Descriptions.Item>
          <Descriptions.Item label="访问口径">
            {getViewerRoleLabel(currentAccount)}
          </Descriptions.Item>
          <Descriptions.Item label="upstream 登录名">
            {storedSession?.upstreamLoginId || '未保存'}
          </Descriptions.Item>
          <Descriptions.Item label="upstream token 过期时间">
            {formatDateTime(storedSession?.expiresAt)}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="预览参数">
        <div className="flex flex-col gap-4">
          {previewError ? <Alert showIcon type="error" message={previewError} /> : null}
          {departmentOptionsError ? (
            <Alert showIcon type="warning" message={departmentOptionsError} />
          ) : null}
          {hasNoDepartmentOptions ? (
            <Alert showIcon type="warning" message="当前账号没有可用于专业同步的系部范围。" />
          ) : null}

          <Form<MajorSyncFormValues> form={form} layout="vertical" requiredMark={false}>
            <Form.Item
              help={
                selectedDepartment
                  ? `本次将预览 ${selectedDepartment.label} 的 org_major 变更。`
                  : undefined
              }
              label="目标系"
              name="departmentId"
              rules={[{ required: true, message: '请选择目标系' }]}
              validateStatus={
                departmentOptionsError || hasNoDepartmentOptions ? 'warning' : undefined
              }
            >
              <Select
                disabled={isLoadingDepartments || departmentOptions.length === 0}
                loading={isLoadingDepartments}
                notFoundContent={hasNoDepartmentOptions ? '当前没有可选系部' : undefined}
                optionFilterProp="label"
                options={departmentOptions.map((department) => ({
                  label: department.label,
                  value: department.id,
                }))}
                placeholder="选择目标系"
                showSearch
              />
            </Form.Item>

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={hasNoDepartmentOptions || isSyncing}
                loading={isPreviewing}
                onClick={() => void handleRunSync('dryRun')}
                type="primary"
              >
                预览同步
              </Button>
              <Popconfirm
                cancelText="取消"
                description="后端会重新拉取 upstream 专业列表，并创建或修正本地 org_major 派生字段。"
                okButtonProps={{ loading: isSyncing }}
                okText="确认落库"
                title="确认执行专业同步？"
                onConfirm={() => void handleRunSync('sync')}
              >
                <Button
                  danger
                  disabled={hasNoDepartmentOptions || isPreviewing}
                  loading={isSyncing}
                >
                  执行落库
                </Button>
              </Popconfirm>
              <Button
                disabled={isRunningSync}
                onClick={() => {
                  clearCurrentSession();
                  setLoginError(null);
                }}
              >
                清理 upstream token
              </Button>
              <Button
                disabled={isRunningSync}
                onClick={() => {
                  setIsLoginModalOpen(true);
                  setLoginError(null);
                  loginForm.setFieldsValue(
                    buildUpstreamLoginCredentialsInitialValues({
                      fallbackUserId: storedSession?.upstreamLoginId,
                      lockedUserId: lockedUpstreamLoginUserId,
                      rememberedCredentials,
                    }),
                  );
                }}
              >
                重新登录 upstream
              </Button>
            </div>
          </Form>
        </div>
      </Card>

      <Card title="同步结果">
        {result ? (
          <div className="flex flex-col gap-6">
            <Descriptions bordered size="small" column={3}>
              <Descriptions.Item label="运行模式">
                {result.dryRun ? 'Dry-run 预览' : '正式落库'}
              </Descriptions.Item>
              <Descriptions.Item label="目标系">{result.departmentId}</Descriptions.Item>
              <Descriptions.Item label="fetchedCount">{result.fetchedCount}</Descriptions.Item>
              {isDryRunResult(result) ? (
                <Descriptions.Item label="previewedCount">
                  {result.previewedCount}
                </Descriptions.Item>
              ) : (
                <Descriptions.Item label="processedCount">
                  {result.processedCount}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="createdCount">{result.createdCount}</Descriptions.Item>
              <Descriptions.Item label="updatedCount">{result.updatedCount}</Descriptions.Item>
              <Descriptions.Item label="existsCount">{result.existsCount}</Descriptions.Item>
              <Descriptions.Item label="skippedCount">{result.skippedCount}</Descriptions.Item>
              <Descriptions.Item label="items">{result.items.length}</Descriptions.Item>
              <Descriptions.Item label="续签 token 过期时间">
                {formatDateTime(result.expiresAt)}
              </Descriptions.Item>
            </Descriptions>

            <Alert
              showIcon
              type={result.skippedCount > 0 ? 'warning' : result.dryRun ? 'info' : 'success'}
              message={resolveResultMessage(result)}
            />

            <Table<MajorSyncResultItem>
              columns={resultColumns}
              dataSource={result.items}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              rowKey={(record, index) =>
                `${record.action}:${record.departmentId}:${record.majorName}:${
                  record.majorId ?? 'new'
                }:${index ?? 0}`
              }
              scroll={{ x: 1280 }}
              size="small"
            />
          </div>
        ) : (
          <Alert
            showIcon
            type="info"
            message="还没有同步结果"
            description="选择目标系并完成 upstream 授权后，这里会展示 dry-run 或正式落库的摘要和专业明细。"
          />
        )}
      </Card>

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
          setPendingMajorSyncRequest(null);
          setLoginError(null);
        }}
        onFinish={handleLoginFinish}
      />
    </div>
  );
}
