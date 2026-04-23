import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';

import { type StoredUpstreamSession, useStoredUpstreamSession } from '@/shared/upstream';

import {
  type CourseScheduleSyncDepartmentOption,
  type CourseScheduleSyncFailure,
  type CourseScheduleSyncItem,
  type CourseScheduleSyncResult,
  type CourseScheduleSyncSemesterOption,
  type DepartmentCurriculumPlanReviewStatus,
  fetchCourseScheduleSyncDepartmentOptions,
  fetchCourseScheduleSyncSemesterOptions,
  isExpiredUpstreamSessionError,
  loginUpstreamSession,
  resolveCourseScheduleSyncErrorMessage,
  syncCourseSchedulesFromUpstreamDepartmentCurriculumPlans,
} from '../api';

type UpstreamLoginFormValues = {
  password: string;
  userId: string;
};

type SyncFormValues = {
  coefficient: string;
  departmentId: string;
  reviewStatus?: DepartmentCurriculumPlanReviewStatus;
  schoolYear: string;
  semester: string;
  teacherId?: string;
};

type SemesterOption = {
  id: number;
  isCurrent: boolean;
  label: string;
  schoolYear: string;
  semester: string;
};

type DepartmentOption = {
  disabled: boolean;
  id: string;
  label: string;
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

function sortSemesterOptions(options: SemesterOption[]) {
  return [...options].sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1;
    }

    if (left.schoolYear !== right.schoolYear) {
      return Number(right.schoolYear) - Number(left.schoolYear);
    }

    return Number(right.semester) - Number(left.semester);
  });
}

function getUniqueSchoolYearOptions(options: SemesterOption[]) {
  const seen = new Set<string>();

  return options.reduce<Array<{ label: string; value: string }>>((result, option) => {
    if (seen.has(option.schoolYear)) {
      return result;
    }

    seen.add(option.schoolYear);
    result.push({
      label: `${option.schoolYear}-${Number(option.schoolYear) + 1} 学年`,
      value: option.schoolYear,
    });
    return result;
  }, []);
}

function formatDateTime(value: string | null) {
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

function formatFailureDetails(value: unknown) {
  if (value === null || value === undefined) {
    return '未返回 details';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [result, setResult] = useState<CourseScheduleSyncResult | null>(null);
  const [semesterOptions, setSemesterOptions] = useState<SemesterOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);
  const [pendingSyncValues, setPendingSyncValues] = useState<SyncFormValues | null>(null);
  const { clearSession, loginAndStoreSession, persistSession, storedSession } =
    useStoredUpstreamSession({
      account: currentAccount,
    });

  const clearCurrentSession = useCallback(() => {
    clearSession();
    setPendingSyncValues(null);
  }, [clearSession]);

  const performSync = useCallback(
    async (session: StoredUpstreamSession, values: SyncFormValues) => {
      setIsSyncing(true);
      setSyncError(null);
      setResult(null);
      setPendingSyncValues(null);

      try {
        const syncResult = await syncCourseSchedulesFromUpstreamDepartmentCurriculumPlans({
          coefficient: values.coefficient,
          departmentId: values.departmentId,
          reviewStatus: values.reviewStatus,
          schoolYear: values.schoolYear,
          semester: values.semester,
          teacherId: values.teacherId,
          upstreamSessionToken: session.upstreamSessionToken,
        });

        persistSession(session, {
          expiresAt: syncResult.expiresAt,
          upstreamSessionToken: syncResult.upstreamSessionToken,
        });
        setResult(syncResult);
        setPendingSyncValues(null);
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          clearCurrentSession();
          setPendingSyncValues(values);
          setLoginError('upstream 会话已失效，请重新登录后继续同步。');
          setIsLoginModalOpen(true);
          loginForm.setFieldsValue({
            password: '',
            userId: session.upstreamLoginId ?? '',
          });
          return;
        }

        setResult(null);
        setSyncError(resolveCourseScheduleSyncErrorMessage(error));
      } finally {
        setIsSyncing(false);
      }
    },
    [clearCurrentSession, loginForm, persistSession],
  );

  const handleRunSync = useCallback(async () => {
    const values = await syncForm.validateFields();

    setSyncError(null);
    setLoginError(null);

    if (!currentAccount) {
      setSyncError('当前登录会话尚未恢复，请稍后重试。');
      return;
    }

    if (!storedSession) {
      setPendingSyncValues(values);
      setIsLoginModalOpen(true);
      loginForm.setFieldsValue({
        password: '',
        userId: '',
      });
      return;
    }

    await performSync(storedSession, values);
  }, [currentAccount, loginForm, performSync, storedSession, syncForm]);

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

      try {
        const [semesters, departments] = await Promise.all([
          fetchCourseScheduleSyncSemesterOptions(),
          fetchCourseScheduleSyncDepartmentOptions(),
        ]);

        if (isCancelled) {
          return;
        }

        const nextSemesterOptions = sortSemesterOptions(
          semesters.map((semester: CourseScheduleSyncSemesterOption) => ({
            id: semester.id,
            isCurrent: semester.isCurrent,
            label: `${semester.schoolYear}-${semester.schoolYear + 1} 学年第${semester.termNumber}学期`,
            schoolYear: String(semester.schoolYear),
            semester: String(semester.termNumber),
          })),
        );
        const nextDepartmentOptions = departments
          .filter((department: CourseScheduleSyncDepartmentOption) => department.id !== '')
          .map((department: CourseScheduleSyncDepartmentOption) => ({
            disabled: !department.isEnabled,
            id: department.id,
            label: `${department.departmentName}${department.shortName ? ` (${department.shortName})` : ''}`,
          }));

        setSemesterOptions(nextSemesterOptions);
        setDepartmentOptions(nextDepartmentOptions);

        const currentValues = syncForm.getFieldsValue();
        const preferredSemester = nextSemesterOptions[0];
        const preferredDepartment = nextDepartmentOptions.find(
          (department) => !department.disabled,
        );

        syncForm.setFieldsValue({
          coefficient: currentValues.coefficient || '1.00',
          departmentId: currentValues.departmentId || preferredDepartment?.id,
          reviewStatus: currentValues.reviewStatus,
          schoolYear: currentValues.schoolYear || preferredSemester?.schoolYear,
          semester: currentValues.semester || preferredSemester?.semester,
          teacherId: currentValues.teacherId,
        });
      } catch {
        if (isCancelled) {
          return;
        }

        setSyncError('暂时无法加载学期或院系列表，请稍后重试。');
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
        const nextStoredSession = await loginAndStoreSession({
          login: loginUpstreamSession,
          password: values.password,
          userId: values.userId,
        });
        const nextPendingSyncValues = pendingSyncValues;

        setPendingSyncValues(null);
        setIsLoginModalOpen(false);
        loginForm.resetFields();

        if (nextPendingSyncValues) {
          await performSync(nextStoredSession, nextPendingSyncValues);
        }
      } catch (error) {
        setLoginError(resolveCourseScheduleSyncErrorMessage(error));
      } finally {
        setIsSubmittingLogin(false);
      }
    },
    [currentAccount, loginAndStoreSession, loginForm, pendingSyncValues, performSync],
  );

  const syncItemsColumns = [
    {
      dataIndex: 'action',
      key: 'action',
      title: '动作',
      render: (value: string) => <Tag color={value === 'created' ? 'green' : 'blue'}>{value}</Tag>,
    },
    {
      dataIndex: 'scheduleId',
      key: 'scheduleId',
      title: '课程表 ID',
    },
    {
      dataIndex: 'sstsCourseId',
      key: 'sstsCourseId',
      title: '上游课程 ID',
    },
    {
      dataIndex: 'sstsTeachingClassId',
      key: 'sstsTeachingClassId',
      title: '上游教学班 ID',
    },
  ];

  const syncFailuresColumns = [
    {
      dataIndex: 'code',
      key: 'code',
      title: '错误码',
    },
    {
      dataIndex: 'message',
      key: 'message',
      title: '说明',
    },
    {
      dataIndex: 'sstsCourseId',
      key: 'sstsCourseId',
      title: '上游课程 ID',
    },
    {
      dataIndex: 'sstsTeachingClassId',
      key: 'sstsTeachingClassId',
      title: '上游教学班 ID',
    },
  ];

  if (isAuthenticating) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const schoolYearOptions = getUniqueSchoolYearOptions(semesterOptions);

  if (pageError) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
        <Alert showIcon type="error" message={pageError} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Typography.Title level={3} style={{ margin: 0 }}>
              学期课表同步
            </Typography.Title>
            <Typography.Paragraph style={{ margin: 0 }} type="secondary">
              通过当前账号绑定的 upstream
              会话，按学年、学期和院系拉取教学计划并同步课程表。每次同步成功后，前端会覆盖本地旧
              token；若接口部分成功，失败明细会单独展示。
            </Typography.Paragraph>
          </div>

          <Alert
            showIcon
            type="info"
            message="当前链路"
            description="先通过 loginUpstreamSession 建立 upstream 会话，再用返回的 upstreamSessionToken 触发同步。每次同步成功后，前端都要覆盖本地旧 token。该接口可能部分成功，failedCount 大于 0 不代表整次请求失败。"
          />

          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="当前账号">
              {currentAccount?.displayName || '未恢复'}
            </Descriptions.Item>
            <Descriptions.Item label="能力归属">教务管理</Descriptions.Item>
            <Descriptions.Item label="upstream token 过期时间">
              {formatDateTime(storedSession?.expiresAt ?? null)}
            </Descriptions.Item>
            <Descriptions.Item label="upstream 登录名">
              {storedSession?.upstreamLoginId || '未保存'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </Card>

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

        <Form form={syncForm} layout="vertical" initialValues={{ coefficient: '1.00' }}>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Form.Item
              label="学年"
              name="schoolYear"
              rules={[{ required: true, message: '请选择学年' }]}
            >
              <Select
                loading={isLoadingOptions}
                optionFilterProp="label"
                options={schoolYearOptions}
                placeholder="选择学年"
                showSearch
              />
            </Form.Item>

            <Form.Item
              label="学期"
              name="semester"
              rules={[{ required: true, message: '请选择学期' }]}
            >
              <Select
                loading={isLoadingOptions}
                options={[
                  { label: '第 1 学期', value: '1' },
                  { label: '第 2 学期', value: '2' },
                ]}
                placeholder="选择学期"
              />
            </Form.Item>

            <Form.Item
              label="院系"
              name="departmentId"
              rules={[{ required: true, message: '请选择院系' }]}
            >
              <Select
                loading={isLoadingOptions}
                optionFilterProp="label"
                options={departmentOptions.map((option) => ({
                  disabled: option.disabled,
                  label: option.label,
                  value: option.id,
                }))}
                placeholder="选择院系"
                showSearch
              />
            </Form.Item>

            <Form.Item label="教师 ID" name="teacherId">
              <Input placeholder="可选，仅同步指定教师" />
            </Form.Item>

            <Form.Item label="审核状态" name="reviewStatus">
              <Select allowClear options={REVIEW_STATUS_OPTIONS} placeholder="可选，不筛选则留空" />
            </Form.Item>

            <Form.Item label="系数" name="coefficient">
              <Input placeholder="默认 1.00" />
            </Form.Item>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button loading={isSyncing} onClick={() => void handleRunSync()} type="primary">
              触发同步
            </Button>
            <Button
              onClick={() => {
                clearCurrentSession();
                setLoginError(null);
              }}
            >
              清理 upstream token
            </Button>
            <Button
              onClick={() => {
                setIsLoginModalOpen(true);
                setLoginError(null);
                loginForm.setFieldsValue({
                  password: '',
                  userId: storedSession?.upstreamLoginId ?? '',
                });
              }}
            >
              重新登录 upstream
            </Button>
          </div>
        </Form>
      </Card>

      <Card title="同步结果">
        {result ? (
          <div className="flex flex-col gap-6">
            <Descriptions bordered size="small" column={3}>
              <Descriptions.Item label="semesterId">{result.semesterId}</Descriptions.Item>
              <Descriptions.Item label="fetchedCount">{result.fetchedCount}</Descriptions.Item>
              <Descriptions.Item label="importedCount">{result.importedCount}</Descriptions.Item>
              <Descriptions.Item label="createdCount">{result.createdCount}</Descriptions.Item>
              <Descriptions.Item label="updatedCount">{result.updatedCount}</Descriptions.Item>
              <Descriptions.Item label="failedCount">{result.failedCount}</Descriptions.Item>
              <Descriptions.Item label="续签 token 过期时间">
                {formatDateTime(result.expiresAt)}
              </Descriptions.Item>
              <Descriptions.Item label="部分成功语义" span={2}>
                {result.failedCount > 0
                  ? '本次请求存在失败明细，但 GraphQL 请求整体成功。'
                  : '本次请求未返回失败明细。'}
              </Descriptions.Item>
            </Descriptions>

            <div className="flex flex-col gap-3">
              <Typography.Title level={5} style={{ margin: 0 }}>
                成功明细 items
              </Typography.Title>
              <Table<CourseScheduleSyncItem>
                columns={syncItemsColumns}
                dataSource={result.items}
                pagination={false}
                rowKey={(record) => `${record.scheduleId}-${record.sstsTeachingClassId || 'none'}`}
                size="small"
              />
            </div>

            <div className="flex flex-col gap-3">
              <Typography.Title level={5} style={{ margin: 0 }}>
                失败明细 failures
              </Typography.Title>
              <Table<CourseScheduleSyncFailure>
                columns={syncFailuresColumns}
                dataSource={result.failures}
                locale={{ emptyText: '当前没有失败明细' }}
                pagination={false}
                expandable={{
                  expandedRowRender: (record) => (
                    <div className="flex flex-col gap-3 py-1">
                      <Descriptions bordered size="small" column={2}>
                        <Descriptions.Item label="错误码">{record.code}</Descriptions.Item>
                        <Descriptions.Item label="说明">{record.message}</Descriptions.Item>
                        <Descriptions.Item label="上游课程 ID">
                          {record.sstsCourseId || '未返回'}
                        </Descriptions.Item>
                        <Descriptions.Item label="上游教学班 ID">
                          {record.sstsTeachingClassId || '未返回'}
                        </Descriptions.Item>
                        <Descriptions.Item label="details" span={2}>
                          <pre className="overflow-x-auto rounded-xl border border-line-default bg-bg-layout p-4 text-sm leading-6 text-text">
                            {formatFailureDetails(record.details)}
                          </pre>
                        </Descriptions.Item>
                      </Descriptions>
                    </div>
                  ),
                  rowExpandable: (record) =>
                    record.details !== null && record.details !== undefined,
                }}
                rowKey={(record) =>
                  `${record.code}-${record.sstsTeachingClassId || 'none'}-${record.sstsCourseId || 'none'}`
                }
                size="small"
              />
            </div>

            <div className="flex flex-col gap-3">
              <Typography.Title level={5} style={{ margin: 0 }}>
                原始响应
              </Typography.Title>
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
            description="填写参数并触发同步后，这里会展示同步摘要、成功明细、失败明细和原始响应。"
          />
        )}
      </Card>

      <Modal
        destroyOnHidden
        footer={null}
        onCancel={() => {
          setIsLoginModalOpen(false);
          setPendingSyncValues(null);
        }}
        open={isLoginModalOpen}
        title="登录 upstream"
      >
        <div className="flex flex-col gap-4">
          {loginError ? <Alert showIcon message={loginError} type="error" /> : null}

          <Form
            form={loginForm}
            layout="vertical"
            onFinish={(values) => void handleLoginFinish(values)}
          >
            <Form.Item
              label="上游账号"
              name="userId"
              rules={[{ required: true, message: '请输入上游账号' }]}
            >
              <Input autoComplete="username" placeholder="输入上游账号" />
            </Form.Item>

            <Form.Item
              label="上游密码"
              name="password"
              rules={[{ required: true, message: '请输入上游密码' }]}
            >
              <Input.Password autoComplete="current-password" placeholder="输入上游密码" />
            </Form.Item>

            <div className="flex justify-end gap-3">
              <Button onClick={() => setIsLoginModalOpen(false)}>取消</Button>
              <Button htmlType="submit" loading={isSubmittingLogin} type="primary">
                登录并继续
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
    </div>
  );
}
