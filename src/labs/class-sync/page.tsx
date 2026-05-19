// src/labs/class-sync/page.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TableOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Form, Select, Spin, Table, Tag } from 'antd';
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
  type ClassSyncDepartmentOption,
  type ClassSyncDryRunAction,
  type ClassSyncDryRunItem,
  type ClassSyncDryRunResult,
  type CurrentClassSyncAccount,
  dryRunSyncClassesFromUpstream,
  fetchClassSyncDepartmentOptions,
  fetchCurrentClassSyncAccount,
  isExpiredUpstreamSessionError,
  resolveClassSyncErrorMessage,
} from './api';
import { classSyncLabMeta } from './meta';

type ClassSyncFormValues = {
  departmentId: string;
};

type PendingClassSyncRequest = {
  values: ClassSyncFormValues;
};

const ACTION_LABELS: Record<ClassSyncDryRunAction, string> = {
  CONFLICT: '冲突',
  CREATE: '待新增',
  EXISTS: '已存在',
  SKIPPED_DUPLICATE_UPSTREAM_CODE: '上游重复',
  SKIPPED_INVALID_UPSTREAM_CODE: '无效 code',
  UPDATE: '待更新',
};

const ACTION_COLORS: Record<ClassSyncDryRunAction, string> = {
  CONFLICT: 'red',
  CREATE: 'green',
  EXISTS: 'blue',
  SKIPPED_DUPLICATE_UPSTREAM_CODE: 'orange',
  SKIPPED_INVALID_UPSTREAM_CODE: 'orange',
  UPDATE: 'gold',
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

function getViewerRoleLabel(account: CurrentClassSyncAccount | null) {
  if (!account) {
    return '未恢复';
  }

  return account.viewerRole === 'admin' ? 'ADMIN' : '学工行政';
}

function renderActionTag(action: ClassSyncDryRunAction) {
  return <Tag color={ACTION_COLORS[action]}>{ACTION_LABELS[action]}</Tag>;
}

function resolveResultMessage(result: ClassSyncDryRunResult) {
  if (result.conflictCount > 0) {
    return '本次预览存在班级唯一性冲突，需要人工处理后再落库。';
  }

  if (result.createdCount === 0 && result.updatedCount === 0 && result.skippedCount === 0) {
    return '本地班级已覆盖上游本次返回的有效班级。';
  }

  return '本次仅预览，不会写入 org_class。';
}

function formatNullableValue(value: number | string | null) {
  return value ?? <span className="text-text-secondary">-</span>;
}

const resultColumns: ColumnsType<ClassSyncDryRunItem> = [
  {
    dataIndex: 'action',
    key: 'action',
    render: (action: ClassSyncDryRunAction) => renderActionTag(action),
    title: '动作',
    width: 150,
  },
  {
    dataIndex: 'classId',
    key: 'classId',
    render: (classId: string | null) => formatNullableValue(classId),
    title: '班级 ID',
    width: 140,
  },
  {
    dataIndex: 'className',
    key: 'className',
    title: '班级名称',
    width: 220,
  },
  {
    dataIndex: 'majorId',
    key: 'majorId',
    render: (majorId: string | null) => formatNullableValue(majorId),
    title: '专业 ID',
    width: 140,
  },
  {
    dataIndex: 'gradeYear',
    key: 'gradeYear',
    render: (gradeYear: number | null) => formatNullableValue(gradeYear),
    title: '入学年份',
    width: 120,
  },
  {
    dataIndex: 'sortOrder',
    key: 'sortOrder',
    render: (sortOrder: number | null) => formatNullableValue(sortOrder),
    title: '排序值',
    width: 110,
  },
  {
    dataIndex: 'conflictReason',
    key: 'conflictReason',
    render: (conflictReason: string | null) => formatNullableValue(conflictReason),
    title: '冲突/跳过原因',
    width: 280,
  },
  {
    dataIndex: 'departmentId',
    key: 'departmentId',
    title: '系部 ID',
    width: 180,
  },
];

export function ClassSyncLabPage() {
  const [form] = Form.useForm<ClassSyncFormValues>();
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const [currentAccount, setCurrentAccount] = useState<CurrentClassSyncAccount | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [departmentOptionsError, setDepartmentOptionsError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [result, setResult] = useState<ClassSyncDryRunResult | null>(null);
  const [departmentOptions, setDepartmentOptions] = useState<ClassSyncDepartmentOption[]>([]);
  const [pendingClassSyncRequest, setPendingClassSyncRequest] =
    useState<PendingClassSyncRequest | null>(null);
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

  const clearCurrentSession = useCallback(() => {
    clear();
    setPendingClassSyncRequest(null);
  }, [clear]);

  const loadDepartments = useCallback(
    async (account: CurrentClassSyncAccount) => {
      setIsLoadingDepartments(true);
      setDepartmentOptionsError(null);

      try {
        const nextOptions = await fetchClassSyncDepartmentOptions({
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
        const account = await fetchCurrentClassSyncAccount();

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

  const performDryRun = useCallback(
    async (session: StoredUpstreamSession, values: ClassSyncFormValues) => {
      setIsPreviewing(true);
      setPreviewError(null);
      setResult(null);
      setPendingClassSyncRequest(null);

      try {
        const dryRunResult = await dryRunSyncClassesFromUpstream({
          departmentId: values.departmentId,
          upstreamSessionToken: session.upstreamSessionToken,
        });

        persistSessionFromResult(session, dryRunResult);
        setResult(dryRunResult);
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          clearCurrentSession();
          setPendingClassSyncRequest({ values });
          setLoginError('upstream 会话已失效，请重新登录后继续预览。');
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

        setPreviewError(resolveClassSyncErrorMessage(error));
      } finally {
        setIsPreviewing(false);
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

  const handlePreview = useCallback(async () => {
    const values = await form.validateFields();

    setPreviewError(null);
    setLoginError(null);

    if (!currentAccount) {
      setPreviewError('当前登录会话尚未恢复，请稍后重试。');
      return;
    }

    if (!storedSession) {
      setPendingClassSyncRequest({ values });
      setIsLoginModalOpen(true);
      loginForm.setFieldsValue(
        buildUpstreamLoginCredentialsInitialValues({
          lockedUserId: lockedUpstreamLoginUserId,
          rememberedCredentials,
        }),
      );
      return;
    }

    await performDryRun(storedSession, values);
  }, [
    currentAccount,
    form,
    lockedUpstreamLoginUserId,
    loginForm,
    performDryRun,
    rememberedCredentials,
    storedSession,
  ]);

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
        const nextPendingRequest = pendingClassSyncRequest;

        setPendingClassSyncRequest(null);
        setIsLoginModalOpen(false);
        loginForm.resetFields();

        if (nextPendingRequest) {
          await performDryRun(nextStoredSession, nextPendingRequest.values);
        }
      } catch (error) {
        setLoginError(resolveClassSyncErrorMessage(error));
      } finally {
        setIsSubmittingLogin(false);
      }
    },
    [currentAccount, loginForm, loginUpstream, pendingClassSyncRequest, performDryRun],
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
        description={classSyncLabMeta.purpose}
        icon={<TableOutlined />}
        title="班级同步"
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
            <Alert showIcon type="warning" message="当前账号没有可用于班级同步的系部范围。" />
          ) : null}

          <Form<ClassSyncFormValues> form={form} layout="vertical" requiredMark={false}>
            <Form.Item
              help={
                selectedDepartment
                  ? `本次将预览 ${selectedDepartment.label} 的 org_class 变更。`
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
                disabled={hasNoDepartmentOptions}
                loading={isPreviewing}
                onClick={() => void handlePreview()}
                type="primary"
              >
                预览同步
              </Button>
              <Button
                disabled={isPreviewing}
                onClick={() => {
                  clearCurrentSession();
                  setLoginError(null);
                }}
              >
                清理 upstream token
              </Button>
              <Button
                disabled={isPreviewing}
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

      <Card title="预览结果">
        {result ? (
          <div className="flex flex-col gap-6">
            <Descriptions bordered size="small" column={3}>
              <Descriptions.Item label="运行模式">
                {result.dryRun ? 'Dry-run 预览' : '未知'}
              </Descriptions.Item>
              <Descriptions.Item label="目标系">{result.departmentId}</Descriptions.Item>
              <Descriptions.Item label="fetchedCount">{result.fetchedCount}</Descriptions.Item>
              <Descriptions.Item label="previewedCount">{result.previewedCount}</Descriptions.Item>
              <Descriptions.Item label="createdCount">{result.createdCount}</Descriptions.Item>
              <Descriptions.Item label="updatedCount">{result.updatedCount}</Descriptions.Item>
              <Descriptions.Item label="existsCount">{result.existsCount}</Descriptions.Item>
              <Descriptions.Item label="conflictCount">{result.conflictCount}</Descriptions.Item>
              <Descriptions.Item label="skippedCount">{result.skippedCount}</Descriptions.Item>
              <Descriptions.Item label="items">{result.items.length}</Descriptions.Item>
              <Descriptions.Item label="续签 token 过期时间">
                {formatDateTime(result.expiresAt)}
              </Descriptions.Item>
            </Descriptions>

            <Alert
              showIcon
              type={result.conflictCount > 0 || result.skippedCount > 0 ? 'warning' : 'info'}
              message={resolveResultMessage(result)}
            />

            <Table<ClassSyncDryRunItem>
              columns={resultColumns}
              dataSource={result.items}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              rowKey={(record, index) =>
                `${record.action}:${record.departmentId}:${record.classId ?? 'invalid'}:${
                  record.className
                }:${index ?? 0}`
              }
              scroll={{ x: 1400 }}
              size="small"
            />
          </div>
        ) : (
          <Alert
            showIcon
            type="info"
            message="还没有预览结果"
            description="选择目标系并完成 upstream 授权后，这里会展示班级 dry-run 摘要和明细。"
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
          setPendingClassSyncRequest(null);
          setLoginError(null);
        }}
        onFinish={handleLoginFinish}
      />
    </div>
  );
}
