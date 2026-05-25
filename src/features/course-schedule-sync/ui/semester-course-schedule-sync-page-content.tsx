import { useCallback, useEffect, useMemo, useState } from 'react';
import { SyncOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Form, Input, Popconfirm, Select, Spin } from 'antd';

import {
  AcademicSemesterPeriodFormItems,
  type AcademicSemesterPeriodOption,
  buildAcademicSemesterPeriodOptions,
  buildAcademicSemesterSchoolYearOptions,
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
  type UpstreamLoginFormValues,
  UpstreamLoginModal,
  useUpstreamSession,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import {
  type CourseScheduleSyncResult,
  type DepartmentCurriculumPlanReviewStatus,
  dryRunSyncCourseSchedulesFromUpstreamDepartmentCurriculumPlans,
  fetchCourseScheduleSyncDepartmentOptions,
  fetchCourseScheduleSyncSemesterOptions,
  isExpiredUpstreamSessionError,
  resolveCourseScheduleSyncErrorMessage,
  syncCourseSchedulesFromUpstreamDepartmentCurriculumPlans,
} from '../api';

type SyncFormValues = {
  departmentId: string;
  reviewStatus?: DepartmentCurriculumPlanReviewStatus;
  schoolYear: string;
  semester: string;
  teacherId?: string;
};

type SyncRunMode = 'dryRun' | 'sync';

type PendingSyncRequest = {
  mode: SyncRunMode;
  values: SyncFormValues;
};

type SemesterCourseScheduleSyncCurrentAccount = {
  accountId: number;
  displayName: string;
};

type SemesterCourseScheduleSyncPageContentProps = {
  currentAccount: SemesterCourseScheduleSyncCurrentAccount | null;
  isAuthenticating: boolean;
};

const REVIEW_STATUS_OPTIONS: Array<{
  label: string;
  value: DepartmentCurriculumPlanReviewStatus;
}> = [
  { label: '未录入', value: 'UNRECORDED' },
  { label: '待提交', value: 'PENDING_SUBMIT' },
  { label: '审核中', value: 'UNDER_REVIEW' },
  { label: '审核通过', value: 'APPROVED' },
  { label: '审核不通过', value: 'REJECTED' },
];

const DEFAULT_DEPARTMENT_ID = 'ORG0302';

function formatOptionalCount(value: number | undefined) {
  return typeof value === 'number' ? value : '未返回';
}

function resolveResultSemanticMessage(result: CourseScheduleSyncResult) {
  if (result.dryRun) {
    return '本次仅预览，不写入课程表。created 项的 scheduleId 会为空，updated 项返回既有 scheduleId。';
  }

  return result.failedCount > 0
    ? '本次落库存在失败计数，但 GraphQL 请求整体成功。'
    : '本次已完成落库，未返回失败计数。';
}

export function SemesterCourseScheduleSyncPageContent({
  currentAccount,
  isAuthenticating,
}: SemesterCourseScheduleSyncPageContentProps) {
  const [syncForm] = Form.useForm<SyncFormValues>();
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [semesterOptionsError, setSemesterOptionsError] = useState<string | null>(null);
  const [departmentOptionsError, setDepartmentOptionsError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [result, setResult] = useState<CourseScheduleSyncResult | null>(null);
  const [semesterOptions, setSemesterOptions] = useState<AcademicSemesterPeriodOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentSelectOption[]>([]);
  const [pendingSyncRequest, setPendingSyncRequest] = useState<PendingSyncRequest | null>(null);
  const {
    clear,
    clearRememberedCredentials,
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
  const selectedDepartmentId = Form.useWatch('departmentId', syncForm);
  const selectedDepartment = useMemo(
    () => departmentOptions.find((department) => department.value === selectedDepartmentId) ?? null,
    [departmentOptions, selectedDepartmentId],
  );

  const clearCurrentSession = useCallback(() => {
    clear();
    setPendingSyncRequest(null);
  }, [clear]);

  const performSync = useCallback(
    async (session: StoredUpstreamSession, values: SyncFormValues, mode: SyncRunMode) => {
      const isDryRun = mode === 'dryRun';

      if (isDryRun) {
        setIsPreviewing(true);
      } else {
        setIsSyncing(true);
      }

      setSyncError(null);
      setResult(null);
      setPendingSyncRequest(null);

      try {
        const input = {
          departmentId: values.departmentId,
          reviewStatus: values.reviewStatus,
          schoolYear: values.schoolYear,
          semester: values.semester,
          teacherId: values.teacherId,
          upstreamSessionToken: session.upstreamSessionToken,
        };
        const syncResult = isDryRun
          ? await dryRunSyncCourseSchedulesFromUpstreamDepartmentCurriculumPlans(input)
          : await syncCourseSchedulesFromUpstreamDepartmentCurriculumPlans(input);

        persistSessionFromResult(session, syncResult);
        setResult(syncResult);
        setPendingSyncRequest(null);
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          clearCurrentSession();
          setPendingSyncRequest({ mode, values });
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

        setResult(null);
        setSyncError(resolveCourseScheduleSyncErrorMessage(error));
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
    async (mode: SyncRunMode) => {
      const values = await syncForm.validateFields();

      setSyncError(null);
      setLoginError(null);

      if (!currentAccount) {
        setSyncError('当前登录会话尚未恢复，请稍后重试。');
        return;
      }

      if (!storedSession) {
        setPendingSyncRequest({ mode, values });
        setIsLoginModalOpen(true);
        loginForm.setFieldsValue(
          buildUpstreamLoginCredentialsInitialValues({
            rememberedCredentials,
          }),
        );
        return;
      }

      await performSync(storedSession, values, mode);
    },
    [currentAccount, loginForm, performSync, rememberedCredentials, storedSession, syncForm],
  );

  useEffect(() => {
    if (!isAuthenticating && !currentAccount) {
      setPageError('当前登录会话已失效，请重新登录后再试。');
      return;
    }

    setPageError(null);
  }, [currentAccount, isAuthenticating]);

  useEffect(() => {
    let isCancelled = false;

    async function bootstrapOptions() {
      setIsLoadingOptions(true);
      setSemesterOptionsError(null);
      setDepartmentOptionsError(null);

      try {
        const [semesterResult, departmentResult] = await Promise.allSettled([
          fetchCourseScheduleSyncSemesterOptions(),
          fetchCourseScheduleSyncDepartmentOptions(),
        ]);

        if (isCancelled) {
          return;
        }

        const nextSemesterOptions =
          semesterResult.status === 'fulfilled'
            ? buildAcademicSemesterPeriodOptions(semesterResult.value)
            : [];
        const fetchedDepartmentOptions =
          departmentResult.status === 'fulfilled'
            ? buildDepartmentSelectOptions(departmentResult.value)
            : [];
        const nextDepartmentOptions = ensureDepartmentSelectOption(fetchedDepartmentOptions, {
          id: DEFAULT_DEPARTMENT_ID,
        });
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
              : '暂时无法加载院系列表。'
            : null;

        setSemesterOptions(nextSemesterOptions);
        setDepartmentOptions(nextDepartmentOptions);
        setSemesterOptionsError(nextSemesterOptionsError);
        setDepartmentOptionsError(nextDepartmentOptionsError);

        const currentValues = syncForm.getFieldsValue();
        syncForm.setFieldsValue({
          departmentId: resolveDepartmentDefaultId({
            currentDepartmentId: currentValues.departmentId,
            defaultDepartmentId: DEFAULT_DEPARTMENT_ID,
            options: nextDepartmentOptions,
          }),
          reviewStatus: currentValues.reviewStatus,
          ...resolveAcademicSemesterPeriodValues({
            currentValues,
            options: nextSemesterOptions,
          }),
          teacherId: currentValues.teacherId,
        });
      } finally {
        if (!isCancelled) {
          setIsLoadingOptions(false);
        }
      }
    }

    void bootstrapOptions();

    return () => {
      isCancelled = true;
    };
  }, [syncForm]);

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
        const nextPendingSyncRequest = pendingSyncRequest;

        setPendingSyncRequest(null);
        setIsLoginModalOpen(false);
        loginForm.resetFields();

        if (nextPendingSyncRequest) {
          await performSync(
            nextStoredSession,
            nextPendingSyncRequest.values,
            nextPendingSyncRequest.mode,
          );
        }
      } catch (error) {
        setLoginError(resolveCourseScheduleSyncErrorMessage(error, 'login'));
      } finally {
        setIsSubmittingLogin(false);
      }
    },
    [currentAccount, loginForm, loginUpstream, pendingSyncRequest, performSync],
  );

  if (isAuthenticating) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const schoolYearOptions = buildAcademicSemesterSchoolYearOptions(semesterOptions);

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
        description="按学年、学期和院系拉取教学计划并同步课程表到后台"
        icon={<SyncOutlined />}
        title="学期课表同步"
      />

      <Card title="同步参数">
        {syncError ? (
          <div className="mb-4">
            <Alert
              showIcon
              type={syncError.includes('academic semester') ? 'warning' : 'error'}
              message={syncError}
            />
          </div>
        ) : null}

        <Form form={syncForm} layout="vertical">
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
                departmentOptionsError ??
                (selectedDepartment
                  ? `本次将同步 ${selectedDepartment.label} 的学期课表。`
                  : undefined)
              }
              label="目标院系"
              loading={isLoadingOptions}
              name="departmentId"
              options={departmentOptions}
              placeholder="选择目标院系"
              required
              validateStatus={departmentOptionsError ? 'warning' : undefined}
            />

            <Form.Item label="教师 ID" name="teacherId">
              <Input placeholder="可选，仅同步指定教师" />
            </Form.Item>

            <Form.Item label="审核状态" name="reviewStatus">
              <Select allowClear options={REVIEW_STATUS_OPTIONS} placeholder="可选，不筛选则留空" />
            </Form.Item>
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
              description="后端会重新拉取 upstream 教学计划，并创建或更新本地课程表。"
              okButtonProps={{ loading: isSyncing }}
              okText="确认落库"
              title="确认执行学期课表同步？"
              onConfirm={() => void handleRunSync('sync')}
            >
              <Button danger disabled={isLoadingOptions || isPreviewing} loading={isSyncing}>
                执行落库
              </Button>
            </Popconfirm>
          </div>
        </Form>
      </Card>

      <Card title="同步结果">
        {result ? (
          <div className="flex flex-col gap-6">
            <Descriptions bordered size="small" column={3}>
              <Descriptions.Item label="运行模式">
                {result.dryRun ? 'Dry-run 预览' : '正式落库'}
              </Descriptions.Item>
              <Descriptions.Item label="semesterId">{result.semesterId}</Descriptions.Item>
              <Descriptions.Item label="fetchedCount">{result.fetchedCount}</Descriptions.Item>
              {result.dryRun ? (
                <Descriptions.Item label="previewedCount">
                  {formatOptionalCount(result.previewedCount)}
                </Descriptions.Item>
              ) : (
                <Descriptions.Item label="importedCount">
                  {formatOptionalCount(result.importedCount)}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="createdCount">{result.createdCount}</Descriptions.Item>
              <Descriptions.Item label="updatedCount">{result.updatedCount}</Descriptions.Item>
              <Descriptions.Item label="failedCount">{result.failedCount}</Descriptions.Item>
              {result.expiresAt ? (
                <Descriptions.Item label="续签 token 过期时间">
                  {formatUpstreamSessionDateTime(result.expiresAt)}
                </Descriptions.Item>
              ) : null}
            </Descriptions>

            <Alert
              showIcon
              type={result.dryRun ? 'info' : result.failedCount > 0 ? 'warning' : 'success'}
              message={resolveResultSemanticMessage(result)}
            />

            <div className="flex flex-col gap-3">
              <pre className="overflow-x-auto rounded-xl border border-line-default bg-bg-layout p-4 text-sm leading-6 text-text">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <Alert
            showIcon
            type="warning"
            message="还没有同步结果"
            description="填写参数并预览同步或执行落库后，这里会展示同步摘要和原始响应。"
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
          setPendingSyncRequest(null);
          setLoginError(null);
        }}
        onFinish={handleLoginFinish}
      />
    </div>
  );
}
