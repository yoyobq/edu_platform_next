// src/features/major-sync/ui/major-sync-page-content.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SyncOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Form, Popconfirm, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  AcademicSemesterPeriodFormItems,
  type AcademicSemesterPeriodOption,
  buildAcademicSemesterPeriodOptions,
  buildAcademicSemesterSchoolYearOptions,
  requestAcademicSemesters,
  resolveAcademicSemesterPeriodValues,
} from '@/entities/academic-semester';
import {
  buildDepartmentSelectOptions,
  DepartmentFormItem,
  type DepartmentSelectOption,
  ensureDepartmentSelectOption,
  resolveDepartmentDefaultId,
} from '@/entities/department';
import {
  buildUpstreamLoginCredentialsInitialValues,
  canUseRememberedUpstreamLoginCredentials,
  formatUpstreamSessionDateTime,
  type StoredUpstreamSession,
  type UpstreamAccountIdentity,
  type UpstreamLoginFormValues,
  UpstreamLoginModal,
  UpstreamSessionControls,
  UpstreamSessionStatusCard,
  useUpstreamSession,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import {
  dryRunSyncMajorsFromUpstream,
  fetchMajorSyncDepartmentOptions,
  isExpiredUpstreamSessionError,
  type MajorSyncCommitAction,
  type MajorSyncCommitItem,
  type MajorSyncCommitResult,
  type MajorSyncDryRunAction,
  type MajorSyncDryRunItem,
  type MajorSyncDryRunResult,
  resolveMajorSyncErrorMessage,
  syncMajorsFromUpstream,
} from '../api';

type MajorSyncFormValues = {
  departmentId: string;
  schoolYear: string;
  semester: string;
};

type MajorSyncRunMode = 'dryRun' | 'sync';

type PendingMajorSyncRequest = {
  mode: MajorSyncRunMode;
  values: MajorSyncFormValues;
};

type MajorSyncResult = MajorSyncDryRunResult | MajorSyncCommitResult;
type MajorSyncResultItem = MajorSyncDryRunItem | MajorSyncCommitItem;
type MajorSyncResultAction = MajorSyncDryRunAction | MajorSyncCommitAction;

type MajorSyncPageContentProps = {
  currentAccount: UpstreamAccountIdentity | null;
  isAuthenticating: boolean;
};

const DEFAULT_DEPARTMENT_ID = 'ORG0302';
const PAGE_DESCRIPTION =
  '预览从 upstream 专业字典同步到本地 org_major 的新增、已存在和重复跳过项。';

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

export function MajorSyncPageContent({
  currentAccount,
  isAuthenticating,
}: MajorSyncPageContentProps) {
  const [form] = Form.useForm<MajorSyncFormValues>();
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [semesterOptionsError, setSemesterOptionsError] = useState<string | null>(null);
  const [departmentOptionsError, setDepartmentOptionsError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [result, setResult] = useState<MajorSyncResult | null>(null);
  const [semesterOptions, setSemesterOptions] = useState<AcademicSemesterPeriodOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentSelectOption[]>([]);
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
  const canUseRememberedCredentials = canUseRememberedUpstreamLoginCredentials({
    rememberedCredentials,
  });
  const selectedDepartmentId = Form.useWatch('departmentId', form);
  const selectedDepartment = useMemo(
    () => departmentOptions.find((department) => department.value === selectedDepartmentId) ?? null,
    [departmentOptions, selectedDepartmentId],
  );
  const schoolYearOptions = useMemo(
    () => buildAcademicSemesterSchoolYearOptions(semesterOptions),
    [semesterOptions],
  );
  const isRunningSync = isPreviewing || isSyncing;

  const clearCurrentSession = useCallback(() => {
    clear();
    setPendingMajorSyncRequest(null);
  }, [clear]);

  const loadOptions = useCallback(async () => {
    setIsLoadingOptions(true);
    setSemesterOptionsError(null);
    setDepartmentOptionsError(null);

    try {
      const [semesterResult, departmentResult] = await Promise.allSettled([
        requestAcademicSemesters({ limit: 500 }),
        fetchMajorSyncDepartmentOptions(),
      ]);
      const nextSemesterOptions =
        semesterResult.status === 'fulfilled'
          ? buildAcademicSemesterPeriodOptions(semesterResult.value)
          : [];
      const nextOptions = ensureDepartmentSelectOption(
        buildDepartmentSelectOptions(
          departmentResult.status === 'fulfilled' ? departmentResult.value : [],
        ),
        { id: DEFAULT_DEPARTMENT_ID },
      );
      const nextSemesterOptionsError =
        semesterResult.status === 'rejected'
          ? semesterResult.reason instanceof Error
            ? semesterResult.reason.message
            : '暂时无法加载学期列表。'
          : null;
      const nextDepartmentOptionsError =
        departmentResult.status === 'rejected'
          ? departmentResult.reason instanceof Error
            ? departmentResult.reason.message
            : '暂时无法加载可选系部。'
          : null;

      setSemesterOptions(nextSemesterOptions);
      setDepartmentOptions(nextOptions);
      setSemesterOptionsError(nextSemesterOptionsError);
      setDepartmentOptionsError(nextDepartmentOptionsError);

      const currentValues = form.getFieldsValue();

      form.setFieldsValue({
        departmentId: resolveDepartmentDefaultId({
          currentDepartmentId: currentValues.departmentId,
          defaultDepartmentId: DEFAULT_DEPARTMENT_ID,
          options: nextOptions,
        }),
        ...resolveAcademicSemesterPeriodValues({
          currentValues,
          options: nextSemesterOptions,
        }),
      });
    } catch (error) {
      const fallbackOptions = ensureDepartmentSelectOption([], { id: DEFAULT_DEPARTMENT_ID });

      setDepartmentOptions(fallbackOptions);
      form.setFieldsValue({
        departmentId: resolveDepartmentDefaultId({
          currentDepartmentId: form.getFieldValue('departmentId') as string | undefined,
          defaultDepartmentId: DEFAULT_DEPARTMENT_ID,
          options: fallbackOptions,
        }),
      });
      setDepartmentOptionsError(error instanceof Error ? error.message : '暂时无法加载可选系部。');
    } finally {
      setIsLoadingOptions(false);
    }
  }, [form]);

  useEffect(() => {
    if (!currentAccount) {
      return;
    }

    setPreviewError(null);
    void loadOptions();
  }, [currentAccount, loadOptions]);

  useEffect(() => {
    if (!keepAliveFailure) {
      return;
    }

    clearCurrentSession();
    setLoginError(keepAliveFailure.message);
    loginForm.setFieldsValue(
      buildUpstreamLoginCredentialsInitialValues({
        fallbackUserId: keepAliveFailure.upstreamLoginId,
        rememberedCredentials,
      }),
    );
    setIsLoginModalOpen(true);
  }, [clearCurrentSession, keepAliveFailure, loginForm, rememberedCredentials]);

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
          schoolYear: values.schoolYear,
          semester: values.semester,
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
    [clearCurrentSession, loginForm, persistSessionFromResult, rememberedCredentials],
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
            rememberedCredentials,
          }),
        );
        return;
      }

      await performMajorSync(storedSession, values, mode);
    },
    [currentAccount, form, loginForm, performMajorSync, rememberedCredentials, storedSession],
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

  if (isAuthenticating) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!currentAccount) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
        <Alert showIcon type="error" message="当前登录会话已失效，请重新登录后再试。" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <DecoratedPageHeader
        description={PAGE_DESCRIPTION}
        icon={<SyncOutlined />}
        title="专业同步"
      />

      <UpstreamSessionStatusCard
        accountDisplayName={currentAccount?.displayName}
        extraItems={[{ label: '访问口径', value: 'ADMIN' }]}
        upstreamExpiresAt={storedSession?.expiresAt}
        upstreamLoginId={storedSession?.upstreamLoginId}
      />

      <Card title="同步参数">
        <div className="flex flex-col gap-4">
          {previewError ? <Alert showIcon type="error" message={previewError} /> : null}
          {semesterOptionsError ? (
            <Alert showIcon type="warning" message={semesterOptionsError} />
          ) : null}
          {departmentOptionsError ? (
            <Alert showIcon type="warning" message={departmentOptionsError} />
          ) : null}

          <Form<MajorSyncFormValues> form={form} layout="vertical" requiredMark={false}>
            <ResponsiveGrid className="gap-4" columns={{ compact: 1, wide: 3 }}>
              <AcademicSemesterPeriodFormItems
                loading={isLoadingOptions}
                schoolYearHelp={semesterOptionsError ?? undefined}
                schoolYearOptions={schoolYearOptions}
                schoolYearValidateStatus={semesterOptionsError ? 'warning' : undefined}
                semesterHelp={
                  semesterOptionsError ? '学期依赖学期列表，请先处理上方提示。' : undefined
                }
                semesterValidateStatus={semesterOptionsError ? 'warning' : undefined}
              />

              <DepartmentFormItem
                disabled={isLoadingOptions}
                emptyText="当前没有可选院系"
                help={
                  selectedDepartment
                    ? `本次将预览 ${selectedDepartment.label} 的 org_major 变更。`
                    : undefined
                }
                label="目标院系"
                loading={isLoadingOptions}
                name="departmentId"
                options={departmentOptions}
                placeholder="选择目标院系"
                required
                validateStatus={departmentOptionsError ? 'warning' : undefined}
              />
            </ResponsiveGrid>

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={isLoadingOptions || isSyncing}
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
                <Button danger disabled={isLoadingOptions || isPreviewing} loading={isSyncing}>
                  执行落库
                </Button>
              </Popconfirm>
              <UpstreamSessionControls
                disabled={isRunningSync}
                onClear={() => {
                  clearCurrentSession();
                  setLoginError(null);
                }}
                onRelogin={() => {
                  setIsLoginModalOpen(true);
                  setLoginError(null);
                  loginForm.setFieldsValue(
                    buildUpstreamLoginCredentialsInitialValues({
                      fallbackUserId: storedSession?.upstreamLoginId,
                      rememberedCredentials,
                    }),
                  );
                }}
              />
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
              <Descriptions.Item label="目标院系">{result.departmentId}</Descriptions.Item>
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
                {formatUpstreamSessionDateTime(result.expiresAt)}
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
            description="选择目标院系并完成 upstream 授权后，这里会展示 dry-run 或正式落库的摘要和专业明细。"
          />
        )}
      </Card>

      <UpstreamLoginModal
        form={loginForm}
        hasRememberedCredentials={canUseRememberedCredentials}
        isSubmitting={isSubmittingLogin}
        loginError={loginError}
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
