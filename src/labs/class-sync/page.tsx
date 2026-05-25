// src/labs/class-sync/page.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TableOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Popconfirm,
  Spin,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLoaderData } from 'react-router';

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
  type ClassSyncCommitAction,
  type ClassSyncCommitItem,
  type ClassSyncCommitResult,
  type ClassSyncDryRunAction,
  type ClassSyncDryRunItem,
  type ClassSyncDryRunResult,
  dryRunSyncClassesFromUpstream,
  fetchClassSyncDepartmentOptions,
  isExpiredUpstreamSessionError,
  resolveClassSyncErrorMessage,
  syncClassesFromUpstream,
} from './api';

type ClassSyncFormValues = {
  departmentId: string;
  schoolYear: string;
  semester: string;
};

type ClassSyncRunMode = 'dryRun' | 'sync';

type PendingClassSyncRequest = {
  mode: ClassSyncRunMode;
  values: ClassSyncFormValues;
};

type ClassSyncResult = ClassSyncDryRunResult | ClassSyncCommitResult;
type ClassSyncResultItem = ClassSyncDryRunItem | ClassSyncCommitItem;
type ClassSyncResultAction = ClassSyncDryRunAction | ClassSyncCommitAction;

type ClassSyncResultState = {
  mode: ClassSyncRunMode;
  data: ClassSyncResult;
};

type ClassSyncLabLoaderData = {
  currentAccount: UpstreamAccountIdentity;
} | null;

type ClassSyncPageContentProps = {
  currentAccount: UpstreamAccountIdentity | null;
  isAuthenticating: boolean;
};

const DEFAULT_DEPARTMENT_ID = 'ORG0302';
const PAGE_DESCRIPTION =
  '预览从 upstream 班级列表同步到本地 org_class 的新增、更新、已存在和冲突项。';

const ACTION_LABELS: Record<ClassSyncResultAction, string> = {
  CONFLICT: '冲突',
  CREATE: '待新增',
  CREATED: '已新增',
  EXISTS: '已存在',
  SKIPPED_DUPLICATE_UPSTREAM_CODE: '上游重复',
  SKIPPED_INVALID_UPSTREAM_CODE: '无效 code',
  SKIPPED_INVALID_UPSTREAM_GRADE: '无效年级',
  UPDATE: '待更新',
  UPDATED: '已更新',
};

const ACTION_COLORS: Record<ClassSyncResultAction, string> = {
  CONFLICT: 'red',
  CREATE: 'green',
  CREATED: 'green',
  EXISTS: 'blue',
  SKIPPED_DUPLICATE_UPSTREAM_CODE: 'orange',
  SKIPPED_INVALID_UPSTREAM_CODE: 'orange',
  SKIPPED_INVALID_UPSTREAM_GRADE: 'orange',
  UPDATE: 'gold',
  UPDATED: 'gold',
};
const CLASS_CODE_VISIBLE_LENGTH = 6;

function renderActionTag(action: ClassSyncResultAction) {
  return <Tag color={ACTION_COLORS[action]}>{ACTION_LABELS[action]}</Tag>;
}

function getExpiredSessionMessage(mode: ClassSyncRunMode) {
  if (mode === 'sync') {
    return 'upstream 会话已失效，请重新登录后继续落库。';
  }

  return 'upstream 会话已失效，请重新登录后继续上游班级列表预览。';
}

function getRunModeLabel(mode: ClassSyncRunMode, result: ClassSyncResult) {
  if (mode === 'dryRun') {
    return '上游班级列表 Dry-run';
  }

  return result.dryRun ? 'Dry-run 预览' : '正式落库';
}

function resolveResultMessage(result: ClassSyncResult, mode: ClassSyncRunMode) {
  if (mode === 'dryRun') {
    if (result.conflictCount > 0) {
      return '本次上游班级列表预览存在班级唯一性冲突，需要人工处理。';
    }

    if (result.createdCount === 0 && result.updatedCount === 0 && result.skippedCount === 0) {
      return '本地班级已覆盖上游班级列表本次返回的有效班级；当前接口仅预览，不写库。';
    }

    return '本次上游班级列表仅预览，不会写入 org_class；落库仍使用班级字典同步接口。';
  }

  if (result.dryRun && result.conflictCount > 0) {
    return '本次预览存在班级唯一性冲突，需要人工处理后再落库。';
  }

  if (
    result.dryRun &&
    result.createdCount === 0 &&
    result.updatedCount === 0 &&
    result.skippedCount === 0
  ) {
    return '本地班级已覆盖上游本次返回的有效班级。';
  }

  if (result.dryRun) {
    return '本次仅预览，不会写入 org_class。';
  }

  if (result.conflictCount > 0 || result.skippedCount > 0) {
    return '本次落库已完成；冲突和跳过项未写入。';
  }

  return '本次已完成落库；更新只覆盖 className、gradeYear 和 sortOrder。';
}

function formatNullableValue(value: number | string | null | undefined) {
  return value ?? <span className="text-text-secondary">-</span>;
}

function renderClassCodeValue(value: string | null | undefined) {
  const classCode = value?.trim();

  if (!classCode) {
    return formatNullableValue(null);
  }

  const preview =
    classCode.length > CLASS_CODE_VISIBLE_LENGTH
      ? `${classCode.slice(0, CLASS_CODE_VISIBLE_LENGTH)}...`
      : classCode;

  return (
    <Tooltip title={classCode}>
      <span>{preview}</span>
    </Tooltip>
  );
}

function isPreviewResult(result: ClassSyncResult): result is ClassSyncDryRunResult {
  return 'previewedCount' in result;
}

const baseResultColumns: ColumnsType<ClassSyncResultItem> = [
  {
    dataIndex: 'action',
    key: 'action',
    render: (action: ClassSyncResultAction) => renderActionTag(action),
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
    dataIndex: 'classCode',
    key: 'classCode',
    render: (classCode: string | null) => renderClassCodeValue(classCode),
    title: 'class_code',
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

const upstreamClassListResultColumns: ColumnsType<ClassSyncResultItem> = [
  ...baseResultColumns.slice(0, 5),
  {
    dataIndex: 'majorName',
    key: 'majorName',
    render: (majorName: string | null | undefined) => formatNullableValue(majorName),
    title: '上游专业名',
    width: 220,
  },
  ...baseResultColumns.slice(5),
];

export function ClassSyncLabPage() {
  const loaderData = useLoaderData() as ClassSyncLabLoaderData;

  return (
    <ClassSyncPageContent
      currentAccount={loaderData?.currentAccount ?? null}
      isAuthenticating={false}
    />
  );
}

export function ClassSyncPageContent({
  currentAccount,
  isAuthenticating,
}: ClassSyncPageContentProps) {
  const [form] = Form.useForm<ClassSyncFormValues>();
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [semesterOptionsError, setSemesterOptionsError] = useState<string | null>(null);
  const [departmentOptionsError, setDepartmentOptionsError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [resultState, setResultState] = useState<ClassSyncResultState | null>(null);
  const [semesterOptions, setSemesterOptions] = useState<AcademicSemesterPeriodOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentSelectOption[]>([]);
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
  const result = resultState?.data ?? null;
  const resultMode = resultState?.mode ?? null;
  const resultColumns = useMemo(
    () => (resultMode === 'dryRun' ? upstreamClassListResultColumns : baseResultColumns),
    [resultMode],
  );
  const isRunningSync = isPreviewing || isSyncing;

  const clearCurrentSession = useCallback(() => {
    clear();
    setPendingClassSyncRequest(null);
  }, [clear]);

  const loadOptions = useCallback(async () => {
    setIsLoadingOptions(true);
    setSemesterOptionsError(null);
    setDepartmentOptionsError(null);

    try {
      const [semesterResult, departmentResult] = await Promise.allSettled([
        requestAcademicSemesters({ limit: 500 }),
        fetchClassSyncDepartmentOptions(),
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

  const performClassSync = useCallback(
    async (session: StoredUpstreamSession, values: ClassSyncFormValues, mode: ClassSyncRunMode) => {
      const isDryRun = mode === 'dryRun';

      if (isDryRun) {
        setIsPreviewing(true);
      } else {
        setIsSyncing(true);
      }

      setPreviewError(null);
      setResultState(null);
      setPendingClassSyncRequest(null);

      try {
        const input = {
          departmentId: values.departmentId,
          schoolYear: values.schoolYear,
          semester: values.semester,
          upstreamSessionToken: session.upstreamSessionToken,
        };
        const syncResult = isDryRun
          ? await dryRunSyncClassesFromUpstream(input)
          : await syncClassesFromUpstream(input);

        persistSessionFromResult(session, syncResult);
        setResultState({
          data: syncResult,
          mode,
        });
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          clearCurrentSession();
          setPendingClassSyncRequest({ mode, values });
          setLoginError(getExpiredSessionMessage(mode));
          setIsLoginModalOpen(true);
          loginForm.setFieldsValue(
            buildUpstreamLoginCredentialsInitialValues({
              fallbackUserId: session.upstreamLoginId,
              rememberedCredentials,
            }),
          );
          return;
        }

        setPreviewError(resolveClassSyncErrorMessage(error));
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
    async (mode: ClassSyncRunMode) => {
      const values = await form.validateFields();

      setPreviewError(null);
      setLoginError(null);

      if (!currentAccount) {
        setPreviewError('当前登录会话尚未恢复，请稍后重试。');
        return;
      }

      if (!storedSession) {
        setPendingClassSyncRequest({ mode, values });
        setIsLoginModalOpen(true);
        loginForm.setFieldsValue(
          buildUpstreamLoginCredentialsInitialValues({
            rememberedCredentials,
          }),
        );
        return;
      }

      await performClassSync(storedSession, values, mode);
    },
    [currentAccount, form, loginForm, performClassSync, rememberedCredentials, storedSession],
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
        const nextPendingRequest = pendingClassSyncRequest;

        setPendingClassSyncRequest(null);
        setIsLoginModalOpen(false);
        loginForm.resetFields();

        if (nextPendingRequest) {
          await performClassSync(
            nextStoredSession,
            nextPendingRequest.values,
            nextPendingRequest.mode,
          );
        }
      } catch (error) {
        setLoginError(resolveClassSyncErrorMessage(error));
      } finally {
        setIsSubmittingLogin(false);
      }
    },
    [currentAccount, loginForm, loginUpstream, pendingClassSyncRequest, performClassSync],
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
        icon={<TableOutlined />}
        title="班级同步"
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

          <Form<ClassSyncFormValues> form={form} layout="vertical" requiredMark={false}>
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
                    ? `本次将同步 ${selectedDepartment.label} 的 org_class 变更。`
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
                description="后端会重新拉取 upstream 班级字典，并创建或更新本地 org_class。"
                okButtonProps={{ loading: isSyncing }}
                okText="确认落库"
                title="确认执行班级同步？"
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
                {resultMode ? getRunModeLabel(resultMode, result) : '未知'}
              </Descriptions.Item>
              <Descriptions.Item label="目标院系">{result.departmentId}</Descriptions.Item>
              <Descriptions.Item label="fetchedCount">{result.fetchedCount}</Descriptions.Item>
              {isPreviewResult(result) ? (
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
              <Descriptions.Item label="conflictCount">{result.conflictCount}</Descriptions.Item>
              <Descriptions.Item label="skippedCount">{result.skippedCount}</Descriptions.Item>
              <Descriptions.Item label="items">{result.items.length}</Descriptions.Item>
              <Descriptions.Item label="续签 token 过期时间">
                {formatUpstreamSessionDateTime(result.expiresAt)}
              </Descriptions.Item>
            </Descriptions>

            <Alert
              showIcon
              type={
                result.conflictCount > 0 || result.skippedCount > 0
                  ? 'warning'
                  : result.dryRun
                    ? 'info'
                    : 'success'
              }
              message={resolveResultMessage(result, resultMode ?? 'dryRun')}
            />

            <Table<ClassSyncResultItem>
              columns={resultColumns}
              dataSource={result.items}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              rowKey={(record, index) =>
                `${record.action}:${record.departmentId}:${record.classId ?? 'invalid'}:${
                  record.classCode ?? 'no-code'
                }:${record.className}:${index ?? 0}`
              }
              scroll={{ x: resultMode === 'dryRun' ? 1780 : 1540 }}
              size="small"
            />
          </div>
        ) : (
          <Alert
            showIcon
            type="info"
            message="还没有同步结果"
            description="选择目标院系并完成 upstream 授权后，这里会展示班级 dry-run 或正式落库的摘要和明细。"
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
          setPendingClassSyncRequest(null);
          setLoginError(null);
        }}
        onFinish={handleLoginFinish}
      />
    </div>
  );
}
