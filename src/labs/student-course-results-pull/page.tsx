// src/labs/student-course-results-pull/page.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DatabaseOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Empty,
  Form,
  Input,
  Select,
  Spin,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  buildDepartmentSelectOptions,
  DepartmentFormItem,
  type DepartmentSelectOption,
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
import { ResponsiveGrid, ResponsiveGridItem } from '@/shared/ui/responsive-layout';

import {
  fetchClassStudentCourseResults,
  fetchCurrentStudentCourseResultsPullAccount,
  isExpiredUpstreamSessionError,
  listLocalClassOptions,
  listLocalDepartmentOptions,
  type LocalClassOption,
  resolveUpstreamErrorMessage,
  type StudentCourseResultRecord,
  type StudentCourseResultsFailure,
  type StudentCourseResultsItem,
  type StudentCourseResultsPullAccount,
  type StudentCourseResultsRefreshMode,
  type StudentCourseResultsResult,
  type StudentCourseResultsSource,
} from './api';
import { studentCourseResultsPullLabMeta } from './meta';

type PullFormValues = {
  allowCacheMissUpstream?: boolean;
  allSchoolYears?: boolean;
  classCode: string;
  departmentId: string;
  schoolYear?: string;
  semester?: string;
  studentNumbersText?: string;
};

type PendingPullRequest = {
  mode: StudentCourseResultsRefreshMode;
  values: PullFormValues;
};

type ResultState = {
  data: StudentCourseResultsResult;
  mode: StudentCourseResultsRefreshMode;
};

const REFRESH_MODE_LABELS: Record<StudentCourseResultsRefreshMode, string> = {
  CACHE_FIRST: '读取缓存',
  REFRESH: '刷新上游',
  UPSTREAM_ONLY: '仅上游验证',
};

const SOURCE_LABELS: Record<StudentCourseResultsSource, string> = {
  CACHE: '本地快照',
  STALE_CACHE: '旧快照',
  UPSTREAM: '本次上游',
};

const SOURCE_COLORS: Record<StudentCourseResultsSource, string> = {
  CACHE: 'blue',
  STALE_CACHE: 'orange',
  UPSTREAM: 'green',
};

const SEMESTER_OPTIONS = [
  { label: '第一学期', value: '1' },
  { label: '第二学期', value: '2' },
];

function getDefaultSchoolYear() {
  const now = new Date();
  const currentYear = now.getFullYear();

  return String(now.getMonth() >= 7 ? currentYear : currentYear - 1);
}

function parseStudentNumbersText(value: string | undefined) {
  return (value ?? '')
    .split(/[\s,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '未返回';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    year: 'numeric',
  });
}

function formatNullableValue(value: boolean | number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-text-secondary">-</span>;
  }

  return String(value);
}

function renderSourceTag(source: StudentCourseResultsSource) {
  return <Tag color={SOURCE_COLORS[source]}>{SOURCE_LABELS[source]}</Tag>;
}

function renderPassTag(value: boolean | null) {
  if (value === true) {
    return <Tag color="green">通过</Tag>;
  }

  if (value === false) {
    return <Tag color="red">未通过</Tag>;
  }

  return <Tag>未返回</Tag>;
}

function buildClassSelectOptions(classes: LocalClassOption[]) {
  return classes
    .filter((item) => item.classCode?.trim())
    .map((item) => ({
      label: `${item.className || item.classCode}（${item.classCode}）`,
      value: item.classCode,
    }));
}

function resolveResultAlertType(result: StudentCourseResultsResult) {
  if (result.failedStudentCount > 0) {
    return 'warning' as const;
  }

  if (result.rowCount === 0) {
    return 'info' as const;
  }

  return 'success' as const;
}

function resolveResultMessage(
  result: StudentCourseResultsResult,
  mode: StudentCourseResultsRefreshMode,
) {
  if (result.failedStudentCount > 0) {
    return 'GraphQL 请求已成功，但部分学生拉取失败；失败学生见下方列表。';
  }

  if (mode === 'CACHE_FIRST' && result.upstreamFetchedStudentCount === 0) {
    return '本次结果来自本地快照，未统计到上游成功拉取学生。';
  }

  if (mode === 'UPSTREAM_ONLY') {
    return '本次仅访问上游，不读写本地快照。';
  }

  return '本次成绩拉取完成，成功返回的上游结果会写入或覆盖本地加密快照。';
}

const courseResultColumns: ColumnsType<StudentCourseResultRecord> = [
  {
    dataIndex: 'schoolYear',
    key: 'schoolYear',
    title: '学年',
    width: 100,
  },
  {
    dataIndex: 'semester',
    key: 'semester',
    render: (semester: string | null) => formatNullableValue(semester),
    title: '学期',
    width: 90,
  },
  {
    dataIndex: 'courseName',
    key: 'courseName',
    render: (courseName: string | null) => formatNullableValue(courseName),
    title: '课程',
    width: 260,
  },
  {
    dataIndex: 'teacherName',
    key: 'teacherName',
    render: (teacherName: string | null) => formatNullableValue(teacherName),
    title: '教师',
    width: 140,
  },
  {
    dataIndex: 'totalScore',
    key: 'totalScore',
    render: (totalScore: number | string | null) => formatNullableValue(totalScore),
    title: '总评',
    width: 100,
  },
  {
    dataIndex: 'isPass',
    key: 'isPass',
    render: (isPass: boolean | null) => renderPassTag(isPass),
    title: '是否通过',
    width: 110,
  },
  {
    dataIndex: 'courseNature',
    key: 'courseNature',
    render: (courseNature: string | null) => formatNullableValue(courseNature),
    title: '课程性质',
    width: 140,
  },
  {
    dataIndex: 'attendExamType',
    key: 'attendExamType',
    render: (attendExamType: string | null) => formatNullableValue(attendExamType),
    title: '考试类型',
    width: 140,
  },
  {
    dataIndex: 'periodicFinalTotalScore',
    key: 'periodicFinalTotalScore',
    render: (score: number | string | null) => formatNullableValue(score),
    title: '期末总评',
    width: 120,
  },
];

const failureColumns: ColumnsType<StudentCourseResultsFailure> = [
  {
    dataIndex: 'studentNumber',
    key: 'studentNumber',
    title: '学号',
    width: 160,
  },
  {
    dataIndex: 'studentName',
    key: 'studentName',
    render: (studentName: string | null) => formatNullableValue(studentName),
    title: '姓名',
    width: 140,
  },
  {
    dataIndex: 'code',
    key: 'code',
    render: (code: string) => <Tag color="red">{code}</Tag>,
    title: '错误码',
    width: 180,
  },
  {
    dataIndex: 'message',
    key: 'message',
    title: '失败原因',
  },
];

function renderCourseResultsTable(record: StudentCourseResultsItem) {
  if (record.results.length === 0) {
    return <Empty description="该学生没有返回课程成绩行" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Table<StudentCourseResultRecord>
      columns={courseResultColumns}
      dataSource={record.results}
      pagination={record.results.length > 10 ? { pageSize: 10, showSizeChanger: true } : false}
      rowKey={(row, index) =>
        `${record.studentNumber}:${row.schoolYear ?? 'year'}:${row.semester ?? 'semester'}:${
          row.courseId ?? row.courseName ?? 'course'
        }:${index ?? 0}`
      }
      scroll={{ x: 1300 }}
      size="small"
    />
  );
}

export function StudentCourseResultsPullLabPage() {
  const [form] = Form.useForm<PullFormValues>();
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const [currentAccount, setCurrentAccount] = useState<StudentCourseResultsPullAccount | null>(
    null,
  );
  const [isLoadingCurrentAccount, setIsLoadingCurrentAccount] = useState(true);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [runningMode, setRunningMode] = useState<StudentCourseResultsRefreshMode | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [classOptionsError, setClassOptionsError] = useState<string | null>(null);
  const [departmentOptionsError, setDepartmentOptionsError] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [classes, setClasses] = useState<LocalClassOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentSelectOption[]>([]);
  const [pendingPullRequest, setPendingPullRequest] = useState<PendingPullRequest | null>(null);
  const [resultState, setResultState] = useState<ResultState | null>(null);
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
  const classOptions = useMemo(() => buildClassSelectOptions(classes), [classes]);
  const isAllSchoolYears = Form.useWatch('allSchoolYears', form) === true;
  const selectedDepartmentId = Form.useWatch('departmentId', form);
  const selectedClassCode = Form.useWatch('classCode', form);
  const selectedDepartment = useMemo(
    () => departmentOptions.find((item) => item.value === selectedDepartmentId) ?? null,
    [departmentOptions, selectedDepartmentId],
  );
  const selectedClass = useMemo(
    () => classes.find((item) => item.classCode === selectedClassCode) ?? null,
    [classes, selectedClassCode],
  );
  const canUseRememberedCredentials = canUseRememberedUpstreamLoginCredentials({
    rememberedCredentials,
  });
  const result = resultState?.data ?? null;
  const resultMode = resultState?.mode ?? null;
  const isRunning = runningMode !== null;

  const resultItemColumns = useMemo<ColumnsType<StudentCourseResultsItem>>(
    () => [
      {
        dataIndex: 'studentNumber',
        key: 'studentNumber',
        title: '学号',
        width: 160,
      },
      {
        dataIndex: 'studentName',
        key: 'studentName',
        render: (studentName: string | null) => formatNullableValue(studentName),
        title: '姓名',
        width: 140,
      },
      {
        dataIndex: 'source',
        key: 'source',
        render: (source: StudentCourseResultsSource) => renderSourceTag(source),
        title: '来源',
        width: 130,
      },
      {
        dataIndex: 'fetchedAt',
        key: 'fetchedAt',
        render: (fetchedAt: string | null) => formatDateTime(fetchedAt),
        title: '抓取时间',
        width: 190,
      },
      {
        key: 'resultCount',
        render: (_, record) => record.results.length,
        title: '成绩行',
        width: 100,
      },
    ],
    [],
  );

  const clearCurrentSession = useCallback(() => {
    clear();
    setPendingPullRequest(null);
  }, [clear]);

  const loadDepartments = useCallback(async () => {
    setIsLoadingDepartments(true);
    setDepartmentOptionsError(null);

    try {
      const departments = await listLocalDepartmentOptions();
      const nextDepartmentOptions = buildDepartmentSelectOptions(departments);
      const currentDepartmentId = form.getFieldValue('departmentId') as string | undefined;
      const nextDepartmentId = nextDepartmentOptions.some(
        (item) => item.value === currentDepartmentId,
      )
        ? currentDepartmentId
        : nextDepartmentOptions[0]?.value;

      setDepartmentOptions(nextDepartmentOptions);
      form.setFieldsValue({
        departmentId: nextDepartmentId,
      });
    } catch (error) {
      setDepartmentOptions([]);
      setClasses([]);
      setDepartmentOptionsError(error instanceof Error ? error.message : '暂时无法加载系部列表。');
    } finally {
      setIsLoadingDepartments(false);
    }
  }, [form]);

  const loadClasses = useCallback(
    async (departmentId: string | undefined) => {
      if (!departmentId) {
        setClasses([]);
        form.setFieldsValue({
          classCode: undefined,
        });
        return;
      }

      setIsLoadingClasses(true);
      setClassOptionsError(null);

      try {
        const nextClasses = await listLocalClassOptions({
          departmentId,
        });

        setClasses(nextClasses);

        const currentClassCode = form.getFieldValue('classCode') as string | undefined;
        const nextClassCode = nextClasses.some((item) => item.classCode === currentClassCode)
          ? currentClassCode
          : nextClasses.find((item) => item.classCode?.trim())?.classCode;

        form.setFieldsValue({
          classCode: nextClassCode,
        });
      } catch (error) {
        setClasses([]);
        setClassOptionsError(error instanceof Error ? error.message : '暂时无法加载本地班级列表。');
      } finally {
        setIsLoadingClasses(false);
      }
    },
    [form],
  );

  const performPull = useCallback(
    async (
      session: StoredUpstreamSession | null,
      values: PullFormValues,
      mode: StudentCourseResultsRefreshMode,
    ) => {
      const studentNumbers = parseStudentNumbersText(values.studentNumbersText);
      const shouldSendSession = mode !== 'CACHE_FIRST' || values.allowCacheMissUpstream === true;

      setRunningMode(mode);
      setPullError(null);
      setResultState(null);
      setPendingPullRequest(null);

      try {
        const nextResult = await fetchClassStudentCourseResults({
          classCode: values.classCode,
          refreshMode: mode,
          schoolYear: values.allSchoolYears ? undefined : values.schoolYear,
          semester: values.semester,
          sessionToken: shouldSendSession ? session?.upstreamSessionToken : null,
          studentNumbers,
        });

        if (session) {
          persistSessionFromResult(session, nextResult);
        }

        setResultState({
          data: nextResult,
          mode,
        });
      } catch (error) {
        if (session && isExpiredUpstreamSessionError(error)) {
          clearCurrentSession();
          setPendingPullRequest({ mode, values });
          setLoginError('upstream 会话已失效，请重新登录后继续拉取成绩。');
          setIsLoginModalOpen(true);
          loginForm.setFieldsValue(
            buildUpstreamLoginCredentialsInitialValues({
              fallbackUserId: session.upstreamLoginId,
              rememberedCredentials,
            }),
          );
          return;
        }

        setPullError(resolveUpstreamErrorMessage(error, '暂时无法拉取学生课程成绩。'));
      } finally {
        setRunningMode(null);
      }
    },
    [clearCurrentSession, loginForm, persistSessionFromResult, rememberedCredentials],
  );

  const handleRunPull = useCallback(
    async (mode: StudentCourseResultsRefreshMode) => {
      const values = await form.validateFields();
      const requiresUpstreamSession =
        mode !== 'CACHE_FIRST' || values.allowCacheMissUpstream === true;

      setPullError(null);
      setLoginError(null);

      if (!currentAccount) {
        setPullError('当前登录会话尚未恢复，请稍后重试。');
        return;
      }

      if (requiresUpstreamSession && !storedSession) {
        setPendingPullRequest({ mode, values });
        setIsLoginModalOpen(true);
        loginForm.setFieldsValue(
          buildUpstreamLoginCredentialsInitialValues({
            rememberedCredentials,
          }),
        );
        return;
      }

      await performPull(storedSession, values, mode);
    },
    [currentAccount, form, loginForm, performPull, rememberedCredentials, storedSession],
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
        const nextPendingRequest = pendingPullRequest;

        setPendingPullRequest(null);
        setIsLoginModalOpen(false);
        loginForm.resetFields();

        if (nextPendingRequest) {
          await performPull(nextStoredSession, nextPendingRequest.values, nextPendingRequest.mode);
        }
      } catch (error) {
        setLoginError(resolveUpstreamErrorMessage(error, '暂时无法登录 upstream。'));
      } finally {
        setIsSubmittingLogin(false);
      }
    },
    [currentAccount, loginForm, loginUpstream, pendingPullRequest, performPull],
  );

  useEffect(() => {
    let isCancelled = false;

    async function bootstrapCurrentAccount() {
      setIsLoadingCurrentAccount(true);
      setPageError(null);

      try {
        const account = await fetchCurrentStudentCourseResultsPullAccount();

        if (isCancelled) {
          return;
        }

        setCurrentAccount(account);
        setIsLoadingCurrentAccount(false);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setCurrentAccount(null);
        setPageError(resolveUpstreamErrorMessage(error, '暂时无法确认当前登录账号。'));
        setIsLoadingCurrentAccount(false);
      }
    }

    void bootstrapCurrentAccount();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentAccount) {
      return;
    }

    void loadDepartments();
  }, [currentAccount, loadDepartments]);

  useEffect(() => {
    if (!currentAccount || isLoadingDepartments) {
      return;
    }

    void loadClasses(selectedDepartmentId);
  }, [currentAccount, isLoadingDepartments, loadClasses, selectedDepartmentId]);

  useEffect(() => {
    if (!keepAliveFailure) {
      return;
    }

    clearCurrentSession();
    setLoginError(keepAliveFailure.message);
    setIsLoginModalOpen(true);
    loginForm.setFieldsValue(
      buildUpstreamLoginCredentialsInitialValues({
        fallbackUserId: keepAliveFailure.upstreamLoginId,
        rememberedCredentials,
      }),
    );
  }, [clearCurrentSession, keepAliveFailure, loginForm, rememberedCredentials]);

  if (isLoadingCurrentAccount) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (pageError || !currentAccount) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
        <Alert
          showIcon
          type="error"
          title={pageError ?? '当前登录会话已失效，请重新登录后再试。'}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <DecoratedPageHeader
        badge={<Tag>{studentCourseResultsPullLabMeta.name}</Tag>}
        description="按本地班级 classCode 读取学生课程成绩；可限定学年，也可不限定学年全量拉取。"
        icon={<FileSearchOutlined />}
        title="学生课程成绩拉取"
      />

      <Card title="拉取参数">
        <div className="flex flex-col gap-4">
          {pullError ? <Alert showIcon type="error" title={pullError} /> : null}
          {departmentOptionsError ? (
            <Alert showIcon type="warning" title={departmentOptionsError} />
          ) : null}
          {classOptionsError ? <Alert showIcon type="warning" title={classOptionsError} /> : null}

          <Form<PullFormValues>
            form={form}
            initialValues={{
              allowCacheMissUpstream: false,
              allSchoolYears: false,
              schoolYear: getDefaultSchoolYear(),
            }}
            layout="vertical"
            requiredMark={false}
          >
            <ResponsiveGrid className="gap-4" columns={{ compact: 1, regular: 2, wide: 3 }}>
              <DepartmentFormItem
                disabled={isLoadingDepartments || isLoadingClasses || isRunning}
                emptyText="当前没有可选系部"
                help={
                  selectedDepartment
                    ? `班级列表将只显示 ${selectedDepartment.label} 下的本地班级。`
                    : '先选择系部，再选择本地班级。'
                }
                label="系部"
                loading={isLoadingDepartments}
                name="departmentId"
                options={departmentOptions}
                placeholder="选择系部"
                required
                validateStatus={departmentOptionsError ? 'warning' : undefined}
              />

              <Form.Item
                extra={
                  selectedClass
                    ? `成绩接口会传 ${selectedClass.classCode}，不会传本地 id ${selectedClass.id}。`
                    : '成绩查询使用 org_class.class_code。'
                }
                label="本地班级"
                name="classCode"
                rules={[{ required: true, message: '请选择本地班级' }]}
              >
                <Select
                  disabled={!selectedDepartmentId || isLoadingDepartments}
                  loading={isLoadingClasses}
                  optionFilterProp="label"
                  options={classOptions}
                  placeholder="选择班级"
                  showSearch
                />
              </Form.Item>

              <Form.Item
                extra={
                  isAllSchoolYears
                    ? '当前请求不会传 schoolYear，后端按班级全量拉取。'
                    : '默认限定单个学年，降低上游请求范围。'
                }
                label="学年"
                name="schoolYear"
                rules={[
                  { required: !isAllSchoolYears, message: '请输入学年' },
                  { pattern: /^\d{4}$/, message: '学年应为 4 位年份，例如 2024' },
                ]}
              >
                <Input disabled={isAllSchoolYears} placeholder="例如 2024" />
              </Form.Item>

              <Form.Item
                extra="勾选后请求不传 schoolYear。"
                label="学年范围"
                name="allSchoolYears"
                valuePropName="checked"
              >
                <Checkbox>不限定学年，按班级全量拉取</Checkbox>
              </Form.Item>

              <Form.Item extra="不选则返回整学年。" label="学期" name="semester">
                <Select allowClear options={SEMESTER_OPTIONS} placeholder="整学年" />
              </Form.Item>

              <ResponsiveGridItem span={{ compact: 'full', regular: 'full', wide: 2 }}>
                <Form.Item
                  extra="可选。用空格、逗号或换行分隔；不填则处理该班全部本地学生。"
                  label="指定学号"
                  name="studentNumbersText"
                >
                  <Input.TextArea
                    autoSize={{ maxRows: 4, minRows: 2 }}
                    placeholder={'219010401\n219010402'}
                  />
                </Form.Item>
              </ResponsiveGridItem>

              <Form.Item
                extra="默认关闭时，读取缓存不会访问上游。"
                label="缓存缺失处理"
                name="allowCacheMissUpstream"
                valuePropName="checked"
              >
                <Checkbox>缓存缺失时使用 upstream 会话补拉</Checkbox>
              </Form.Item>
            </ResponsiveGrid>

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={isRunning || isLoadingClasses || isLoadingDepartments}
                icon={<DatabaseOutlined />}
                loading={runningMode === 'CACHE_FIRST'}
                onClick={() => void handleRunPull('CACHE_FIRST')}
              >
                读取缓存
              </Button>
              <Button
                disabled={isRunning || isLoadingClasses || isLoadingDepartments}
                icon={<ReloadOutlined />}
                loading={runningMode === 'REFRESH'}
                onClick={() => void handleRunPull('REFRESH')}
                type="primary"
              >
                刷新上游
              </Button>
              <Button
                disabled={isRunning || isLoadingClasses || isLoadingDepartments}
                icon={<SyncOutlined />}
                loading={runningMode === 'UPSTREAM_ONLY'}
                onClick={() => void handleRunPull('UPSTREAM_ONLY')}
              >
                仅上游验证
              </Button>
              <Button
                disabled={isLoadingClasses || isLoadingDepartments || isRunning}
                onClick={() => void loadClasses(selectedDepartmentId)}
              >
                重载班级
              </Button>
              <Button
                disabled={isLoadingClasses || isLoadingDepartments || isRunning}
                onClick={() => void loadDepartments()}
              >
                重载系部
              </Button>
            </div>
          </Form>
        </div>
      </Card>

      <Card title="拉取结果">
        {result && resultMode ? (
          <div className="flex flex-col gap-6">
            <Descriptions bordered column={3} size="small">
              <Descriptions.Item label="运行模式">
                {REFRESH_MODE_LABELS[resultMode]}
              </Descriptions.Item>
              <Descriptions.Item label="班级">
                {result.className ? `${result.className}（${result.classCode}）` : result.classCode}
              </Descriptions.Item>
              <Descriptions.Item label="目标学生">{result.studentCount}</Descriptions.Item>
              <Descriptions.Item label="成绩行">{result.rowCount}</Descriptions.Item>
              <Descriptions.Item label="失败学生">{result.failedStudentCount}</Descriptions.Item>
              <Descriptions.Item label="缓存命中">{result.cacheHitStudentCount}</Descriptions.Item>
              <Descriptions.Item label="上游成功">
                {result.upstreamFetchedStudentCount}
              </Descriptions.Item>
              <Descriptions.Item label="会话策略">
                {formatNullableValue(result.sessionStrategy)}
              </Descriptions.Item>
              <Descriptions.Item label="token 过期时间">
                {formatUpstreamSessionDateTime(result.expiresAt)}
              </Descriptions.Item>
              <Descriptions.Item label="滚动 token">
                {result.upstreamSessionToken ? '本次已更新本地 upstream 会话' : '未返回'}
              </Descriptions.Item>
            </Descriptions>

            <Alert
              showIcon
              type={resolveResultAlertType(result)}
              title={resolveResultMessage(result, resultMode)}
            />

            <Table<StudentCourseResultsItem>
              columns={resultItemColumns}
              dataSource={result.items}
              expandable={{
                expandedRowRender: renderCourseResultsTable,
                rowExpandable: (record) => record.results.length > 0,
              }}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              rowKey={(record, index) =>
                `${record.studentNumber}:${record.source}:${record.fetchedAt ?? 'no-time'}:${
                  index ?? 0
                }`
              }
              scroll={{ x: 760 }}
              size="small"
            />
          </div>
        ) : (
          <Alert
            showIcon
            description="选择班级和学年后，可以先读取缓存；需要强制更新时再登录 upstream 并刷新。"
            title="还没有拉取结果"
            type="info"
          />
        )}
      </Card>

      <Card title="失败学生">
        {result?.failures.length ? (
          <Table<StudentCourseResultsFailure>
            columns={failureColumns}
            dataSource={result.failures}
            pagination={
              result.failures.length > 10 ? { pageSize: 10, showSizeChanger: true } : false
            }
            rowKey={(record, index) => `${record.studentNumber}:${record.code}:${index ?? 0}`}
            scroll={{ x: 760 }}
            size="small"
          />
        ) : (
          <Alert
            showIcon
            type={result ? 'success' : 'info'}
            title={result ? '本次没有失败学生' : '拉取后这里会展示 failures 明细'}
          />
        )}
      </Card>

      <UpstreamLoginModal
        description="刷新上游、仅上游验证，或缓存缺失时自动补拉，需要临时登录智慧校园。"
        form={loginForm}
        hasRememberedCredentials={canUseRememberedCredentials}
        isSubmitting={isSubmittingLogin}
        loginError={loginError}
        okText="授权并拉取"
        open={isLoginModalOpen}
        title="需要登录上游"
        onCancel={() => {
          setIsLoginModalOpen(false);
          setPendingPullRequest(null);
          setLoginError(null);
        }}
        onClearRememberedCredentials={clearRememberedCredentials}
        onFinish={handleLoginFinish}
      />
    </div>
  );
}
