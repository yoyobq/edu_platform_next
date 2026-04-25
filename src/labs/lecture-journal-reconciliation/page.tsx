import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Skeleton,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLoaderData } from 'react-router';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';
import { type StoredUpstreamSession, useUpstreamSession } from '@/entities/upstream-session';

import { lectureJournalReconciliationLabAccess } from './access';
import {
  fetchLectureJournalReconciliation,
  fetchTeacherDirectory,
  isExpiredUpstreamSessionError,
  type LectureJournalReconciliationItem,
  type LectureJournalReconciliationResult,
  type MissingLectureJournalItem,
  resolveUpstreamErrorMessage,
  type TeacherDirectoryEntry,
  type TeacherDirectoryResult,
  type UnmatchedLectureJournalPlanItem,
} from './api';
import { lectureJournalReconciliationLabMeta } from './meta';

type LectureJournalReconciliationLabLoaderData = {
  defaultDepartmentId?: string | null;
  defaultStaffId?: string | null;
  upstreamAccount?: {
    accountId: number;
    displayName: string;
  } | null;
  viewerKind?: 'authenticated' | 'internal';
} | null;

type UpstreamLoginFormValues = {
  password: string;
  userId: string;
};

type PendingAction = 'directory' | 'query' | null;

const DAY_OF_WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function sortSemesters(records: AcademicSemesterRecord[]) {
  return [...records].sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1;
    }

    if (left.schoolYear !== right.schoolYear) {
      return right.schoolYear - left.schoolYear;
    }

    if (left.termNumber !== right.termNumber) {
      return right.termNumber - left.termNumber;
    }

    return right.id - left.id;
  });
}

function pickNextSemesterId(records: AcademicSemesterRecord[], currentSelection: number | null) {
  if (currentSelection !== null && records.some((record) => record.id === currentSelection)) {
    return currentSelection;
  }

  return records.find((record) => record.isCurrent)?.id ?? records[0]?.id ?? null;
}

function normalizeOptionalString(value: string) {
  const normalizedValue = value.trim();

  return normalizedValue ? normalizedValue : '';
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
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatTeachingDate(value: string | null | undefined) {
  if (!value) {
    return '待识别';
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
    weekday: 'short',
  }).format(date);
}

function resolveStatusColor(status: LectureJournalReconciliationItem['status']) {
  if (status === 'FILLED') {
    return 'success';
  }

  if (status === 'MISSING') {
    return 'warning';
  }

  return 'default';
}

function resolveStatusLabel(status: LectureJournalReconciliationItem['status']) {
  if (status === 'FILLED') {
    return '已填写';
  }

  if (status === 'MISSING') {
    return '疑似未填';
  }

  return '无法对账';
}

function buildTeacherOptionLabel(teacher: TeacherDirectoryEntry) {
  const normalizedCode = teacher.code.trim();

  return normalizedCode ? `${teacher.name} (${normalizedCode})` : teacher.name;
}

function buildItemKey(item: {
  lecturePlanDetailId: string | null;
  lecturePlanId: string | null;
  matchKey?: string | null;
  reason?: string | null;
}) {
  return [
    item.lecturePlanDetailId || 'detail',
    item.lecturePlanId || 'plan',
    item.matchKey || 'match',
    item.reason || 'reason',
  ].join('-');
}

async function requestTeacherDirectoryWithSession(session: StoredUpstreamSession) {
  return fetchTeacherDirectory({
    sessionToken: session.upstreamSessionToken,
  });
}

export function LectureJournalReconciliationLabPage() {
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const loaderData = useLoaderData() as LectureJournalReconciliationLabLoaderData;
  const {
    clear,
    login: loginUpstream,
    persistRollingSession,
    session: storedSession,
  } = useUpstreamSession({
    account: loaderData?.upstreamAccount ?? null,
  });
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState(loaderData?.defaultDepartmentId ?? '');
  const [staffId, setStaffId] = useState(loaderData?.defaultStaffId ?? '');
  const [directoryResult, setDirectoryResult] = useState<TeacherDirectoryResult | null>(null);
  const [reconciliationResult, setReconciliationResult] =
    useState<LectureJournalReconciliationResult | null>(null);
  const [isLoadingSemesters, setIsLoadingSemesters] = useState(true);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [isLoadingReconciliation, setIsLoadingReconciliation] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const clearCurrentSession = useCallback(() => {
    clear();
    setDirectoryResult(null);
  }, [clear]);

  const openLoginModal = useCallback(() => {
    setLoginError(null);
    loginForm.setFieldsValue({
      password: '',
      userId: storedSession?.upstreamLoginId ?? '',
    });
    setIsLoginModalOpen(true);
  }, [loginForm, storedSession?.upstreamLoginId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSemesters() {
      setIsLoadingSemesters(true);
      setSemesterError(null);

      try {
        const result = sortSemesters(await requestAcademicSemesters({ limit: 500 }));

        if (cancelled) {
          return;
        }

        setSemesters(result);
        setSelectedSemesterId((currentSelection) => pickNextSemesterId(result, currentSelection));
      } catch (error) {
        if (!cancelled) {
          setSemesterError(error instanceof Error ? error.message : '暂时无法加载学期列表。');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSemesters(false);
        }
      }
    }

    void loadSemesters();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!departmentId && loaderData?.defaultDepartmentId) {
      setDepartmentId(loaderData.defaultDepartmentId);
    }
  }, [departmentId, loaderData?.defaultDepartmentId]);

  useEffect(() => {
    if (!staffId && loaderData?.defaultStaffId) {
      setStaffId(loaderData.defaultStaffId);
    }
  }, [loaderData?.defaultStaffId, staffId]);

  const selectedSemester = semesters.find((record) => record.id === selectedSemesterId) ?? null;
  const normalizedDepartmentId = normalizeOptionalString(departmentId);
  const normalizedStaffId = normalizeOptionalString(staffId);
  const hasFilterPairMismatch = Boolean(normalizedDepartmentId) !== Boolean(normalizedStaffId);
  const teacherOptions = (directoryResult?.teachers ?? []).map((teacher) => ({
    label: buildTeacherOptionLabel(teacher),
    value: teacher.value,
  }));
  const selectedTeacherOption = (directoryResult?.teachers ?? []).find(
    (teacher) => teacher.value === normalizedStaffId,
  );
  const selectedTeacherLabel = selectedTeacherOption?.name || normalizedStaffId || '全体教师';
  const reconciliationBaseCount =
    (reconciliationResult?.filledCount ?? 0) + (reconciliationResult?.missingCount ?? 0);
  const fillRate =
    reconciliationBaseCount > 0
      ? `${Math.round(((reconciliationResult?.filledCount ?? 0) / reconciliationBaseCount) * 100)}%`
      : '无可对账课次';

  const itemColumns: ColumnsType<LectureJournalReconciliationItem> = [
    {
      key: 'status',
      render: (_, record) => (
        <Tag color={resolveStatusColor(record.status)}>{resolveStatusLabel(record.status)}</Tag>
      ),
      title: '状态',
      width: 110,
    },
    {
      key: 'time',
      render: (_, record) => (
        <div className="flex min-w-32 flex-col gap-1">
          <Typography.Text>{formatTeachingDate(record.teachingDate)}</Typography.Text>
          <Typography.Text type="secondary">
            {record.weekNumber ? `第 ${record.weekNumber} 周` : '周次待识别'}
          </Typography.Text>
          <Typography.Text type="secondary">
            {record.dayOfWeek
              ? DAY_OF_WEEK_LABELS[record.dayOfWeek - 1] || `周${record.dayOfWeek}`
              : '星期待识别'}
          </Typography.Text>
        </div>
      ),
      title: '时间',
      width: 150,
    },
    {
      key: 'course',
      render: (_, record) => (
        <div className="flex min-w-48 flex-col gap-1">
          <Typography.Text strong>{record.courseName || '未命名课程'}</Typography.Text>
          <Typography.Text type="secondary">
            {record.teachingClassName || '教学班待识别'}
          </Typography.Text>
          <Typography.Text type="secondary">
            {record.teacherName || record.teacherId || '教师待识别'}
          </Typography.Text>
        </div>
      ),
      title: '课程信息',
    },
    {
      key: 'plan',
      render: (_, record) => (
        <div className="flex min-w-44 flex-col gap-1">
          <Typography.Text>
            {record.sectionName || record.sectionId || '节次待识别'}
          </Typography.Text>
          <Typography.Text type="secondary">
            {record.lessonHours !== null ? `${record.lessonHours} 课时` : '课时待识别'}
          </Typography.Text>
          <Typography.Text type="secondary">{record.matchKey || '匹配键待构造'}</Typography.Text>
        </div>
      ),
      title: '计划侧',
      width: 220,
    },
    {
      key: 'journal',
      render: (_, record) => (
        <div className="flex min-w-52 flex-col gap-1">
          {record.journal ? (
            <>
              <Typography.Text>
                {record.journal.statusName || record.journal.statusCode || '已匹配日志'}
              </Typography.Text>
              <Typography.Text type="secondary">
                {record.journal.courseContent || '日志课程内容为空'}
              </Typography.Text>
              <Typography.Text type="secondary">
                {record.journal.homeworkAssignment || '日志作业为空'}
              </Typography.Text>
            </>
          ) : (
            <Typography.Text type="secondary">
              {record.status === 'MISSING'
                ? '未找到对应教学日志。'
                : record.reason || '当前计划项无法参与对账。'}
            </Typography.Text>
          )}
        </div>
      ),
      title: '日志侧',
    },
  ];

  const missingColumns: ColumnsType<MissingLectureJournalItem> = [
    {
      key: 'time',
      render: (_, record) => (
        <div className="flex min-w-32 flex-col gap-1">
          <Typography.Text>{formatTeachingDate(record.teachingDate)}</Typography.Text>
          <Typography.Text type="secondary">第 {record.weekNumber} 周</Typography.Text>
          <Typography.Text type="secondary">
            {DAY_OF_WEEK_LABELS[record.dayOfWeek - 1] || `周${record.dayOfWeek}`}
          </Typography.Text>
        </div>
      ),
      title: '时间',
      width: 150,
    },
    {
      key: 'course',
      render: (_, record) => (
        <div className="flex min-w-48 flex-col gap-1">
          <Typography.Text strong>{record.courseName || '未命名课程'}</Typography.Text>
          <Typography.Text type="secondary">
            {record.teachingClassName || '教学班待识别'}
          </Typography.Text>
          <Typography.Text type="secondary">
            {record.teacherName || record.teacherId || '教师待识别'}
          </Typography.Text>
        </div>
      ),
      title: '课程信息',
    },
    {
      key: 'plan',
      render: (_, record) => (
        <div className="flex min-w-44 flex-col gap-1">
          <Typography.Text>{record.sectionName || record.sectionId}</Typography.Text>
          <Typography.Text type="secondary">{record.lessonHours} 课时</Typography.Text>
          <Typography.Text type="secondary">{record.matchKey}</Typography.Text>
        </div>
      ),
      title: '计划侧',
      width: 220,
    },
  ];

  const unmatchedColumns: ColumnsType<UnmatchedLectureJournalPlanItem> = [
    {
      dataIndex: 'reason',
      key: 'reason',
      render: (value: string) => <Typography.Text>{value}</Typography.Text>,
      title: '无法对账原因',
    },
    {
      key: 'ids',
      render: (_, record) => (
        <div className="flex min-w-40 flex-col gap-1">
          <Typography.Text type="secondary">计划：{record.lecturePlanId || '缺失'}</Typography.Text>
          <Typography.Text type="secondary">
            详情：{record.lecturePlanDetailId || '缺失'}
          </Typography.Text>
          <Typography.Text type="secondary">
            教学班：{record.teachingClassId || '缺失'}
          </Typography.Text>
        </div>
      ),
      title: '原始标识',
      width: 240,
    },
  ];

  async function runDirectoryAction(sessionOverride?: StoredUpstreamSession) {
    const session = sessionOverride ?? storedSession;

    if (!session) {
      setPendingAction('directory');
      setLoginError(null);
      setIsLoginModalOpen(true);
      return;
    }

    setIsLoadingDirectory(true);
    setDirectoryError(null);

    try {
      const result = await requestTeacherDirectoryWithSession(session);

      persistRollingSession(session, {
        expiresAt: result.expiresAt,
        upstreamSessionToken: result.upstreamSessionToken,
      });
      setDirectoryResult(result);
    } catch (error) {
      if (isExpiredUpstreamSessionError(error)) {
        clearCurrentSession();
        setPendingAction('directory');
        setLoginError('upstream 会话已失效，请重新登录后继续。');
        openLoginModal();
        return;
      }

      setDirectoryError(resolveUpstreamErrorMessage(error, '暂时无法加载教师字典。'));
    } finally {
      setIsLoadingDirectory(false);
    }
  }

  async function runQueryAction(sessionOverride?: StoredUpstreamSession) {
    const session = sessionOverride ?? storedSession;

    if (!session) {
      setPendingAction('query');
      setLoginError(null);
      setIsLoginModalOpen(true);
      return;
    }

    if (!selectedSemester) {
      return;
    }

    setIsLoadingReconciliation(true);
    setQueryError(null);

    try {
      const result = await fetchLectureJournalReconciliation({
        departmentId: normalizedDepartmentId || undefined,
        schoolYear: String(selectedSemester.schoolYear),
        semester: String(selectedSemester.termNumber),
        sessionToken: session.upstreamSessionToken,
        staffId: normalizedStaffId || undefined,
      });

      persistRollingSession(session, {
        expiresAt: result.expiresAt,
        upstreamSessionToken: result.upstreamSessionToken,
      });
      setReconciliationResult(result);
    } catch (error) {
      if (isExpiredUpstreamSessionError(error)) {
        clearCurrentSession();
        setPendingAction('query');
        setLoginError('upstream 会话已失效，请重新登录后继续。');
        openLoginModal();
        return;
      }

      setQueryError(resolveUpstreamErrorMessage(error, '暂时无法加载教学日志对账结果。'));
    } finally {
      setIsLoadingReconciliation(false);
    }
  }

  async function handleLogin(values: UpstreamLoginFormValues) {
    if (!loaderData?.upstreamAccount) {
      setLoginError('当前登录账号尚未就绪，请稍后再试。');
      return;
    }

    setIsSubmittingLogin(true);
    setLoginError(null);

    try {
      const nextSession = await loginUpstream(values);

      setIsLoginModalOpen(false);
      const nextPendingAction = pendingAction;

      setPendingAction(null);
      loginForm.resetFields();

      if (nextPendingAction === 'directory') {
        await runDirectoryAction(nextSession);
      }

      if (nextPendingAction === 'query') {
        await runQueryAction(nextSession);
      }
    } catch (error) {
      setLoginError(resolveUpstreamErrorMessage(error, '暂时无法建立 upstream 会话。'));
    } finally {
      setIsSubmittingLogin(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Typography.Title level={3} style={{ margin: 0 }}>
          教学日志填写对账
        </Typography.Title>
        <Typography.Paragraph style={{ margin: 0 }} type="secondary">
          基于上游教学计划详情和教学日志，统计指定学年学期内每个课次的填写状态。优先用于查看某位教师在某学期的已填、疑似未填和无法对账课次。
        </Typography.Paragraph>
      </div>

      <Alert
        description="查询时只要求学期。若要按教师过滤，departmentId 和 staffId 必须同时传入；两者都留空则按整学期全量对账。"
        message="接口口径"
        showIcon
        type="info"
      />

      <Card>
        <div className="flex flex-col gap-4">
          {!storedSession ? (
            <Alert
              action={
                <Button
                  size="small"
                  type="primary"
                  onClick={() => {
                    setPendingAction(null);
                    openLoginModal();
                  }}
                >
                  登录上游
                </Button>
              }
              description="当前页面依赖上游 sessionToken。可以直接在此登录，或复用同账号已有的上游会话。"
              message="尚未建立 upstream 会话"
              showIcon
              type="warning"
            />
          ) : (
            <Descriptions column={3} size="small">
              <Descriptions.Item label="上游登录 ID">
                {storedSession.upstreamLoginId || '未记录'}
              </Descriptions.Item>
              <Descriptions.Item label="会话过期时间">
                {formatDateTime(storedSession.expiresAt)}
              </Descriptions.Item>
              <Descriptions.Item label="当前视图身份">
                {loaderData?.viewerKind ?? 'unknown'}
              </Descriptions.Item>
            </Descriptions>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-2">
              <Typography.Text strong>学期</Typography.Text>
              {isLoadingSemesters ? (
                <Skeleton.Button active block />
              ) : (
                <Select
                  options={semesters.map((semester) => ({
                    label: `${semester.name}${semester.isCurrent ? ' · 当前' : ''}`,
                    value: semester.id,
                  }))}
                  placeholder="请选择学期"
                  value={selectedSemesterId ?? undefined}
                  onChange={(value) => setSelectedSemesterId(value)}
                />
              )}
            </label>

            <label className="flex flex-col gap-2">
              <Typography.Text strong>departmentId</Typography.Text>
              <Input
                placeholder={loaderData?.defaultDepartmentId || '例如 ORG0302'}
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-2">
              <Typography.Text strong>教师 staffId</Typography.Text>
              <AutoComplete
                options={teacherOptions}
                placeholder={loaderData?.defaultStaffId || '先加载教师字典，或直接输入 staffId'}
                value={staffId}
                onChange={setStaffId}
                filterOption={(inputValue, option) =>
                  String(option?.label || '')
                    .toLowerCase()
                    .includes(inputValue.trim().toLowerCase()) ||
                  String(option?.value || '')
                    .toLowerCase()
                    .includes(inputValue.trim().toLowerCase())
                }
              />
            </label>

            <div className="flex flex-col gap-2">
              <Typography.Text strong>当前筛选</Typography.Text>
              <Card size="small">
                <div className="flex flex-col gap-1">
                  <Typography.Text>{selectedSemester?.name || '未选择学期'}</Typography.Text>
                  <Typography.Text type="secondary">{selectedTeacherLabel}</Typography.Text>
                  <Typography.Text type="secondary">
                    {normalizedDepartmentId || '未指定系部'}
                  </Typography.Text>
                </div>
              </Card>
            </div>
          </div>

          {semesterError ? <Alert message={semesterError} showIcon type="error" /> : null}
          {directoryError ? <Alert message={directoryError} showIcon type="error" /> : null}
          {hasFilterPairMismatch ? (
            <Alert
              message="按教师过滤时，departmentId 和 staffId 需要同时填写。"
              showIcon
              type="warning"
            />
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              loading={isLoadingDirectory}
              onClick={() => {
                void runDirectoryAction();
              }}
            >
              加载教师字典
            </Button>
            <Button
              type="primary"
              disabled={!selectedSemester || hasFilterPairMismatch}
              loading={isLoadingReconciliation}
              onClick={() => {
                void runQueryAction();
              }}
            >
              查询对账
            </Button>
            <Button
              disabled={!normalizedDepartmentId && !normalizedStaffId}
              onClick={() => {
                setDepartmentId(loaderData?.defaultDepartmentId ?? '');
                setStaffId(loaderData?.defaultStaffId ?? '');
              }}
            >
              恢复默认筛选
            </Button>
            <Button
              disabled={!storedSession}
              onClick={() => {
                clearCurrentSession();
              }}
            >
              清除 upstream 会话
            </Button>
            <Button
              disabled={!storedSession}
              onClick={() => {
                setPendingAction(null);
                openLoginModal();
              }}
            >
              重新登录 upstream
            </Button>
          </div>
        </div>
      </Card>

      {queryError ? <Alert message={queryError} showIcon type="error" /> : null}

      {isLoadingReconciliation ? <Skeleton active paragraph={{ rows: 8 }} /> : null}

      {!isLoadingReconciliation && reconciliationResult ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Card size="small">
              <div className="flex flex-col gap-1">
                <Typography.Text type="secondary">已填写</Typography.Text>
                <Typography.Title level={3} style={{ color: '#389e0d', margin: 0 }}>
                  {reconciliationResult.filledCount}
                </Typography.Title>
              </div>
            </Card>
            <Card size="small">
              <div className="flex flex-col gap-1">
                <Typography.Text type="secondary">疑似未填</Typography.Text>
                <Typography.Title level={3} style={{ color: '#d48806', margin: 0 }}>
                  {reconciliationResult.missingCount}
                </Typography.Title>
              </div>
            </Card>
            <Card size="small">
              <div className="flex flex-col gap-1">
                <Typography.Text type="secondary">无法对账</Typography.Text>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {reconciliationResult.unmatchedPlanItemCount}
                </Typography.Title>
              </div>
            </Card>
            <Card size="small">
              <div className="flex flex-col gap-1">
                <Typography.Text type="secondary">计划</Typography.Text>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {reconciliationResult.planCount}
                </Typography.Title>
                <Typography.Text type="secondary">
                  详情 {reconciliationResult.planDetailCount}
                </Typography.Text>
              </div>
            </Card>
            <Card size="small">
              <div className="flex flex-col gap-1">
                <Typography.Text type="secondary">教学日志</Typography.Text>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {reconciliationResult.journalCount}
                </Typography.Title>
              </div>
            </Card>
            <Card size="small">
              <div className="flex flex-col gap-1">
                <Typography.Text type="secondary">填写率</Typography.Text>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {fillRate}
                </Typography.Title>
                <Typography.Text type="secondary">不含无法对账项</Typography.Text>
              </div>
            </Card>
          </div>

          <Card size="small">
            <Descriptions column={3} size="small">
              <Descriptions.Item label="学期">
                {selectedSemester?.name || '未选择'}
              </Descriptions.Item>
              <Descriptions.Item label="教师">{selectedTeacherLabel}</Descriptions.Item>
              <Descriptions.Item label="departmentId">
                {normalizedDepartmentId || '未指定'}
              </Descriptions.Item>
              <Descriptions.Item label="返回条数">
                完整 {reconciliationResult.items.length} / 未填{' '}
                {reconciliationResult.missingItems.length}
              </Descriptions.Item>
              <Descriptions.Item label="会话续期">
                {formatDateTime(reconciliationResult.expiresAt)}
              </Descriptions.Item>
              <Descriptions.Item label="对账顺序">按时间升序</Descriptions.Item>
            </Descriptions>
          </Card>

          <Tabs
            items={[
              {
                key: 'items',
                label: `完整对账 (${reconciliationResult.items.length})`,
                children:
                  reconciliationResult.items.length === 0 ? (
                    <Empty
                      description="当前查询没有返回任何可展示课次。"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <Table<LectureJournalReconciliationItem>
                      columns={itemColumns}
                      dataSource={reconciliationResult.items}
                      pagination={{ pageSize: 20, showSizeChanger: true }}
                      rowKey={(record) => buildItemKey(record)}
                      scroll={{ x: 1240 }}
                    />
                  ),
              },
              {
                key: 'missing',
                label: `疑似未填 (${reconciliationResult.missingItems.length})`,
                children:
                  reconciliationResult.missingItems.length === 0 ? (
                    <Empty
                      description="当前查询没有疑似未填课次。"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <Table<MissingLectureJournalItem>
                      columns={missingColumns}
                      dataSource={reconciliationResult.missingItems}
                      pagination={{ pageSize: 20, showSizeChanger: true }}
                      rowKey={(record) => buildItemKey(record)}
                      scroll={{ x: 1080 }}
                    />
                  ),
              },
              {
                key: 'unmatched',
                label: `无法对账 (${reconciliationResult.unmatchedPlanItems.length})`,
                children:
                  reconciliationResult.unmatchedPlanItems.length === 0 ? (
                    <Empty
                      description="当前查询没有无法对账的计划项。"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <Table<UnmatchedLectureJournalPlanItem>
                      columns={unmatchedColumns}
                      dataSource={reconciliationResult.unmatchedPlanItems}
                      pagination={{ pageSize: 20, showSizeChanger: true }}
                      rowKey={(record) => buildItemKey(record)}
                      scroll={{ x: 960 }}
                    />
                  ),
              },
            ]}
          />
        </div>
      ) : null}

      {!isLoadingReconciliation && !reconciliationResult && selectedSemester ? (
        <Alert
          description="完成学期和教师筛选后点击“查询对账”，页面会返回完整课次列表、疑似未填列表和无法对账计划项。"
          message="准备完成"
          showIcon
          type="success"
        />
      ) : null}

      <Card size="small">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Lab meta">
            {lectureJournalReconciliationLabMeta.purpose}
          </Descriptions.Item>
          <Descriptions.Item label="访问范围">
            {lectureJournalReconciliationLabAccess.allowedAccessLevels.join(' / ')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Modal
        destroyOnHidden
        footer={null}
        open={isLoginModalOpen}
        title="登录 upstream"
        onCancel={() => {
          setIsLoginModalOpen(false);
          setPendingAction(null);
          setLoginError(null);
        }}
      >
        <div className="flex flex-col gap-4">
          {loginError ? <Alert message={loginError} showIcon type="error" /> : null}
          <Form<UpstreamLoginFormValues>
            form={loginForm}
            layout="vertical"
            onFinish={(values) => {
              void handleLogin(values);
            }}
          >
            <Form.Item
              label="上游账号"
              name="userId"
              rules={[{ required: true, message: '请输入上游账号' }]}
            >
              <Input autoComplete="username" placeholder="请输入上游账号" />
            </Form.Item>
            <Form.Item
              label="上游密码"
              name="password"
              rules={[{ required: true, message: '请输入上游密码' }]}
            >
              <Input.Password autoComplete="current-password" placeholder="请输入上游密码" />
            </Form.Item>

            <div className="flex justify-end gap-3">
              <Button
                onClick={() => {
                  setIsLoginModalOpen(false);
                }}
              >
                取消
              </Button>
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
