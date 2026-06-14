// src/features/academic-workload/ui/academic-workload-page-content.tsx
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CarryOutOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Empty,
  Select,
  Skeleton,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';
import {
  isExpiredUpstreamSessionError,
  resolveStaffDirectoryCache,
  resolveStaffDirectoryTeacherStaffId,
  type StaffDirectoryResult,
  StaffDirectoryTeacherAutoComplete,
  type UpstreamAccountIdentity,
  useUpstreamSession,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import {
  type AcademicWorkloadTableViewFilter,
  buildAcademicWorkloadRangeSummary,
  buildTeachingWeekOptions,
  formatHours,
  parseAcademicWorkloadIsoDate,
  pickNextSemesterId,
  resolveOccurrenceHourHundredths,
  resolvePeriodCount,
  sortSemesters,
} from '../application/workload-baseline';
import {
  type AcademicStableWorkloadCalcEffect,
  type AcademicStableWorkloadEnvelope,
  type AcademicStableWorkloadOccurrence,
  requestAcademicStableWorkloadOccurrences,
  requestMyAcademicStableWorkloadOccurrences,
} from '../infrastructure/academic-workload-api';

import { TeachingWeekRangeControl } from './teaching-week-range-control';
import { formatTeachingWeekRangeLabel, useTeachingWeekRange } from './teaching-week-range-state';

import './academic-workload-page-content.css';

export type AcademicWorkloadPageContentProps = {
  canManageWorkload?: boolean;
  defaultStaffId?: string | null;
  upstreamAccount?: UpstreamAccountIdentity | null;
};

const CALC_EFFECT_LABELS: Record<AcademicStableWorkloadCalcEffect, string> = {
  CANCEL: '停课',
  MAKEUP: '补课',
  NORMAL: '正常',
  SWAP_IN: '调入',
  SWAP_OUT: '调出',
};

const WORKLOAD_FORMULA_SYMBOL_STYLE: CSSProperties = {
  color: 'var(--ant-color-primary)',
  fontWeight: 700,
  margin: 0,
};

const DAY_OF_WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function buildMetricCardBodyStyle(isSelected: boolean): CSSProperties {
  return {
    border: isSelected ? '1px solid var(--ant-color-primary)' : '1px solid transparent',
    borderRadius: 'var(--ant-border-radius)',
  };
}

function formatLongDate(value: string) {
  const date = parseAcademicWorkloadIsoDate(value);
  const formattedValue = new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'short',
  }).format(date);

  return formattedValue.replace(/日(?=\S)/, '日 ');
}

function resolveOccurrenceHours(item: AcademicStableWorkloadOccurrence) {
  return resolveOccurrenceHourHundredths(item);
}

function resolveCalcEffectTagColor(effect: AcademicStableWorkloadCalcEffect) {
  if (effect === 'CANCEL' || effect === 'SWAP_OUT') {
    return 'error';
  }

  if (effect === 'MAKEUP' || effect === 'SWAP_IN') {
    return 'processing';
  }

  return 'default';
}

function resolveOccurrenceStatusLabel(item: AcademicStableWorkloadOccurrence) {
  return item.isEffective ? '计入' : '扣减';
}

function formatLogicalWeekdayNotice(item: AcademicStableWorkloadOccurrence) {
  if (item.logicalDayOfWeek === item.physicalDayOfWeek) {
    return null;
  }

  const logicalDayLabel =
    DAY_OF_WEEK_LABELS[item.logicalDayOfWeek - 1] ?? `周${item.logicalDayOfWeek}`;

  return `原${logicalDayLabel}课程`;
}

export function AcademicWorkloadPageContent({
  canManageWorkload: rawCanManageWorkload = false,
  defaultStaffId = null,
  upstreamAccount = null,
}: AcademicWorkloadPageContentProps) {
  const canManageWorkload = Boolean(rawCanManageWorkload);
  const isSelfServiceViewer = !canManageWorkload;
  const latestOccurrenceRequestIdRef = useRef(0);
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState(defaultStaffId ?? '');
  const [tableViewFilter, setTableViewFilter] = useState<AcademicWorkloadTableViewFilter>('all');
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingOccurrences, setLoadingOccurrences] = useState(false);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [workloadError, setWorkloadError] = useState<string | null>(null);
  const [occurrenceEnvelope, setOccurrenceEnvelope] =
    useState<AcademicStableWorkloadEnvelope | null>(null);
  const {
    clear: clearUpstreamSession,
    persistSessionFromResult,
    session: storedSession,
  } = useUpstreamSession({
    account: upstreamAccount,
  });
  const storedSessionDirectoryKey = storedSession
    ? [
        storedSession.accountId,
        storedSession.upstreamLoginId || 'unknown',
        storedSession.upstreamSessionToken,
      ].join(':')
    : 'none';
  const storedSessionRef = useRef(storedSession);
  const [staffDirectoryResult, setStaffDirectoryResult] = useState<StaffDirectoryResult | null>(
    null,
  );
  const [staffDirectoryError, setStaffDirectoryError] = useState<string | null>(null);
  const [staffDirectoryLoading, setStaffDirectoryLoading] = useState(false);
  const { cacheStatus: staffDirectoryCacheStatus, teachers: staffDirectoryTeachers = [] } =
    staffDirectoryResult ?? {};
  const staffDirectoryUnavailableContent =
    staffDirectoryError ??
    (staffDirectoryCacheStatus === 'MISS' ? '教师目录未缓存，可手动输入' : undefined);

  const normalizedStaffId = resolveStaffDirectoryTeacherStaffId(staffId, staffDirectoryTeachers);

  useEffect(() => {
    let cancelled = false;

    async function loadSemesters() {
      setLoadingSemesters(true);
      setSemesterError(null);

      try {
        const result = sortSemesters(await requestAcademicSemesters({ limit: 500 }));

        if (cancelled) {
          return;
        }

        setSemesters(result);
        setSelectedSemesterId((currentSelection) => pickNextSemesterId(result, currentSelection));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSemesterError(error instanceof Error ? error.message : '暂时无法加载学期列表。');
      } finally {
        if (!cancelled) {
          setLoadingSemesters(false);
        }
      }
    }

    void loadSemesters();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!staffId && defaultStaffId) {
      setStaffId(defaultStaffId);
    }
  }, [defaultStaffId, staffId]);

  useEffect(() => {
    storedSessionRef.current = storedSession;
  }, [storedSessionDirectoryKey, storedSession]);

  useEffect(() => {
    if (!canManageWorkload) {
      setStaffDirectoryResult(null);
      setStaffDirectoryError(null);
      setStaffDirectoryLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function loadStaffDirectory() {
      setStaffDirectoryLoading(true);
      setStaffDirectoryError(null);

      try {
        const outcome = await resolveStaffDirectoryCache({
          canPopulate: true,
          persistSessionFromResult,
          session: storedSessionRef.current,
        });

        if (!cancelled) {
          setStaffDirectoryResult(outcome.directory);
        }
      } catch (error) {
        if (!cancelled) {
          if (isExpiredUpstreamSessionError(error)) {
            clearUpstreamSession();
          }

          setStaffDirectoryError(error instanceof Error ? error.message : '暂时无法加载教师目录。');
        }
      } finally {
        if (!cancelled) {
          setStaffDirectoryLoading(false);
        }
      }
    }

    void loadStaffDirectory();

    return () => {
      cancelled = true;
    };
  }, [
    canManageWorkload,
    clearUpstreamSession,
    persistSessionFromResult,
    storedSessionDirectoryKey,
  ]);

  const selectedSemester = useMemo(
    () => semesters.find((record) => record.id === selectedSemesterId) ?? null,
    [selectedSemesterId, semesters],
  );

  const teachingWeeks = useMemo(
    () => buildTeachingWeekOptions(selectedSemester),
    [selectedSemester],
  );
  const teachingWeekRange = useTeachingWeekRange(teachingWeeks);

  useEffect(() => {
    latestOccurrenceRequestIdRef.current += 1;
    setOccurrenceEnvelope(null);
    setTableViewFilter('all');
    setWorkloadError(null);
    setLoadingOccurrences(false);
  }, [canManageWorkload, normalizedStaffId, selectedSemesterId]);

  const { effectiveRangeEnd, effectiveRangeStart } = teachingWeekRange;

  const workloadRangeSummary = useMemo(
    () =>
      buildAcademicWorkloadRangeSummary({
        effectiveRangeEnd,
        effectiveRangeStart,
        items: occurrenceEnvelope?.items ?? [],
        tableViewFilter,
      }),
    [effectiveRangeEnd, effectiveRangeStart, occurrenceEnvelope?.items, tableViewFilter],
  );
  const {
    addedEffectiveRangeHours,
    addedEffectiveRangeOccurrences,
    baselineRangeHours,
    baselineTeachingWeekCount,
    baselineWeeklyHours,
    displayedOccurrences,
    effectiveRangeHours,
    effectiveRangeOccurrences,
    ineffectiveRangeHours,
    ineffectiveRangeOccurrences,
    tableOccurrences,
  } = workloadRangeSummary;

  const ineffectiveRangeCount = ineffectiveRangeOccurrences.length;
  const isFullTeachingWeekRange = teachingWeekRange.isFullTeachingWeekRange;
  const workloadFormulaTitle = isFullTeachingWeekRange ? '整学期' : '当前范围';
  const workloadStaffName = occurrenceEnvelope?.items[0]?.staffName || normalizedStaffId;
  const handleCalculate = useCallback(async () => {
    if (!selectedSemesterId || (canManageWorkload && !normalizedStaffId)) {
      return;
    }

    const requestId = latestOccurrenceRequestIdRef.current + 1;
    latestOccurrenceRequestIdRef.current = requestId;
    setLoadingOccurrences(true);
    setWorkloadError(null);

    try {
      const result = canManageWorkload
        ? await requestAcademicStableWorkloadOccurrences({
            semesterId: selectedSemesterId,
            staffId: normalizedStaffId,
          })
        : await requestMyAcademicStableWorkloadOccurrences({
            semesterId: selectedSemesterId,
          });

      if (latestOccurrenceRequestIdRef.current === requestId) {
        setOccurrenceEnvelope(result);
      }
    } catch (error) {
      if (latestOccurrenceRequestIdRef.current === requestId) {
        setWorkloadError(error instanceof Error ? error.message : '暂时无法加载教师工作量。');
      }
    } finally {
      if (latestOccurrenceRequestIdRef.current === requestId) {
        setLoadingOccurrences(false);
      }
    }
  }, [canManageWorkload, normalizedStaffId, selectedSemesterId]);

  const columns = useMemo<ColumnsType<AcademicStableWorkloadOccurrence>>(
    () => [
      {
        dataIndex: 'date',
        key: 'date',
        render: (_, record) => {
          const logicalWeekdayNotice = formatLogicalWeekdayNotice(record);

          return (
            <div className="flex min-w-30 flex-col gap-1">
              <Typography.Text>{formatLongDate(record.date)}</Typography.Text>
              {logicalWeekdayNotice ? (
                <Typography.Text type="warning">{logicalWeekdayNotice}</Typography.Text>
              ) : null}
            </div>
          );
        },
        title: '日期',
        width: 150,
      },
      {
        dataIndex: 'weekIndex',
        key: 'weekIndex',
        render: (value: number) => <Tag color="blue">第 {value} 周</Tag>,
        title: '教学周',
        width: 96,
      },
      {
        dataIndex: 'courseName',
        key: 'course',
        render: (_, record) => (
          <div className="flex min-w-44 flex-col gap-1">
            <Typography.Text strong>{record.courseName || '未命名课程'}</Typography.Text>
            <Typography.Text type="secondary">{record.teachingClassName}</Typography.Text>
            {record.classroomName ? (
              <Typography.Text type="secondary">{record.classroomName}</Typography.Text>
            ) : null}
          </div>
        ),
        title: '课程与教学班',
      },
      {
        key: 'hours',
        render: (_, record) => (
          <div className="flex min-w-42 flex-col gap-1">
            <Typography.Text>
              第 {record.periodStart}-{record.periodEnd} 节
            </Typography.Text>
            <span className="academic-workload-hours-formula">
              {resolvePeriodCount(record)} 节 x {record.coefficient} ={' '}
              {formatHours(resolveOccurrenceHours(record))} 课时
            </span>
          </div>
        ),
        title: '折算',
        width: 188,
      },
      {
        key: 'status',
        render: (_, record) => (
          <div className="flex min-w-32 flex-col gap-2">
            <Tag color={record.isEffective ? 'success' : 'default'}>
              {resolveOccurrenceStatusLabel(record)}
            </Tag>
            <Tag color={resolveCalcEffectTagColor(record.calcEffect)}>
              {CALC_EFFECT_LABELS[record.calcEffect]}
            </Tag>
          </div>
        ),
        title: '计课状态',
        width: 136,
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <DecoratedPageHeader
        description="按学期查看教师计划课时、扣课与补课/调入明细，并按教学周范围核对应计课时。"
        icon={<CarryOutOutlined />}
        title="工作量明细"
      />

      {loadingSemesters ? (
        <div className="academic-workload-query-card">
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      ) : (
        <div className="academic-workload-query-card">
          {semesterError ? <Alert title={semesterError} showIcon type="error" /> : null}

          <div className="academic-workload-query-layout">
            <TeachingWeekRangeControl range={teachingWeekRange} variant="card" />

            <div className="academic-workload-query-main">
              <div className="academic-workload-query-fields">
                <label className="academic-workload-field">
                  <Select
                    aria-label="学期"
                    options={semesters.map((semester) => ({
                      label: `${semester.name}${semester.isCurrent ? ' · 当前' : ''}`,
                      value: semester.id,
                    }))}
                    placeholder="选择学期"
                    value={selectedSemesterId ?? undefined}
                    onChange={(value) => setSelectedSemesterId(value)}
                  />
                </label>

                <label className="academic-workload-field">
                  <StaffDirectoryTeacherAutoComplete
                    aria-label="教师"
                    disabled={isSelfServiceViewer}
                    directoryUnavailableContent={staffDirectoryUnavailableContent}
                    loading={staffDirectoryLoading}
                    popupMatchSelectWidth={240}
                    placeholder={isSelfServiceViewer ? '当前登录教师' : 'ID 或姓名'}
                    teachers={staffDirectoryTeachers}
                    value={staffId}
                    onChange={setStaffId}
                    onInputKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void handleCalculate();
                      }
                    }}
                  />
                </label>
              </div>

              <div className="academic-workload-query-actions">
                <Button
                  block
                  type="primary"
                  disabled={!selectedSemesterId || (canManageWorkload && !normalizedStaffId)}
                  loading={loadingOccurrences}
                  onClick={() => {
                    void handleCalculate();
                  }}
                >
                  计算工作量
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {workloadError ? <Alert title={workloadError} showIcon type="error" /> : null}

      {loadingOccurrences ? <Skeleton active paragraph={{ rows: 6 }} /> : null}

      {!loadingOccurrences && occurrenceEnvelope ? (
        <div className="flex flex-col gap-6">
          {!occurrenceEnvelope.isValid ? (
            <Alert
              title="结果数据异常"
              description={
                occurrenceEnvelope.invalidReason ?? '当前条件返回的数据未通过完整性校验。'
              }
              showIcon
              type="error"
            />
          ) : null}

          {!occurrenceEnvelope.isComplete ? (
            <Alert
              title="结果可能不完整"
              description={
                occurrenceEnvelope.truncationReason ??
                '当前条件返回的数据未覆盖完整范围，请谨慎使用汇总值。'
              }
              showIcon
              type="warning"
            />
          ) : null}

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {workloadFormulaTitle}
                </Typography.Title>
                <Tag color="blue">{workloadStaffName}</Tag>
              </div>
              <Typography.Text type="secondary">
                {formatTeachingWeekRangeLabel(teachingWeekRange)}
              </Typography.Text>

              <ResponsiveGrid
                className="items-stretch gap-3"
                columns={{
                  compact: 1,
                  wide: 'minmax(160px, 1fr) auto minmax(160px, 1fr) auto minmax(160px, 1fr) auto minmax(160px, 1fr)',
                }}
              >
                <Card size="small">
                  <div className="academic-workload-metric-content">
                    <Typography.Text type="secondary">排课基线课时</Typography.Text>
                    <Typography.Title level={2} style={{ margin: 0 }}>
                      {formatHours(baselineRangeHours)}
                    </Typography.Title>
                    <Typography.Text type="secondary">
                      周课时 {formatHours(baselineWeeklyHours)} × 周数 {baselineTeachingWeekCount} ={' '}
                      {formatHours(baselineRangeHours)}
                    </Typography.Text>
                  </div>
                </Card>

                <div className="self-center px-1 text-center">
                  <Typography.Title level={2} style={WORKLOAD_FORMULA_SYMBOL_STYLE}>
                    + (
                  </Typography.Title>
                </div>

                <Card
                  hoverable
                  size="small"
                  styles={{
                    body: buildMetricCardBodyStyle(tableViewFilter === 'added'),
                  }}
                  onClick={() => setTableViewFilter('added')}
                >
                  <div className="academic-workload-metric-content">
                    <Tooltip title="周末上课、调课调入（MAKEUP / SWAP_IN）">
                      <Typography.Text type="secondary">补课/调入课时</Typography.Text>
                    </Tooltip>
                    <Typography.Title level={2} style={{ margin: 0 }}>
                      {formatHours(addedEffectiveRangeHours)}
                    </Typography.Title>
                    <Typography.Text type="secondary">
                      新增应计明细 {addedEffectiveRangeOccurrences.length} 条
                    </Typography.Text>
                  </div>
                </Card>

                <div className="self-center px-1 text-center">
                  <Typography.Title level={2} style={WORKLOAD_FORMULA_SYMBOL_STYLE}>
                    -
                  </Typography.Title>
                </div>

                <Card
                  hoverable
                  size="small"
                  styles={{
                    body: buildMetricCardBodyStyle(tableViewFilter === 'deducted'),
                  }}
                  onClick={() => setTableViewFilter('deducted')}
                >
                  <div className="academic-workload-metric-content">
                    <Tooltip title="国定假期、校园活动停课、调课调出（CANCEL/SWAP_OUT）">
                      <Typography.Text type="secondary">扣课课时</Typography.Text>
                    </Tooltip>
                    <Typography.Title level={2} style={{ margin: 0 }}>
                      <span className="academic-workload-metric-danger">
                        {formatHours(ineffectiveRangeHours)}
                      </span>
                    </Typography.Title>
                    <Typography.Text type="secondary">
                      扣课明细 {ineffectiveRangeCount} 条
                    </Typography.Text>
                  </div>
                </Card>

                <div className="self-center px-1 text-center">
                  <Typography.Title level={2} style={WORKLOAD_FORMULA_SYMBOL_STYLE}>
                    ) =
                  </Typography.Title>
                </div>

                <Card
                  hoverable
                  size="small"
                  styles={{
                    body: buildMetricCardBodyStyle(tableViewFilter === 'effective'),
                  }}
                  onClick={() => setTableViewFilter('effective')}
                >
                  <div className="academic-workload-metric-content">
                    <Tooltip title="当前计划合约下计入应计的课时">
                      <Typography.Text type="secondary">应计课时</Typography.Text>
                    </Tooltip>
                    <Typography.Title level={2} style={{ margin: 0 }}>
                      {formatHours(effectiveRangeHours)}
                    </Typography.Title>
                    <Typography.Text type="secondary">
                      应计明细 {effectiveRangeOccurrences.length} 条
                    </Typography.Text>
                  </div>
                </Card>
              </ResponsiveGrid>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <Button
                type={tableViewFilter === 'all' ? 'primary' : 'default'}
                onClick={() => setTableViewFilter('all')}
              >
                全部明细 {displayedOccurrences.length} 条
              </Button>
              <Button
                type={tableViewFilter === 'deducted' ? 'primary' : 'default'}
                onClick={() => setTableViewFilter('deducted')}
              >
                扣课课时 {ineffectiveRangeOccurrences.length} 条
              </Button>
              <Button
                type={tableViewFilter === 'added' ? 'primary' : 'default'}
                onClick={() => setTableViewFilter('added')}
              >
                补课/调入 {addedEffectiveRangeOccurrences.length} 条
              </Button>
              <Button
                type={tableViewFilter === 'effective' ? 'primary' : 'default'}
                onClick={() => setTableViewFilter('effective')}
              >
                应计课时 {effectiveRangeOccurrences.length} 条
              </Button>
            </div>

            {tableOccurrences.length === 0 ? (
              <Empty
                description={
                  occurrenceEnvelope.items.length === 0
                    ? '当前教师在该学期没有工作量明细。'
                    : '当前筛选条件下没有命中任何明细。'
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Table<AcademicStableWorkloadOccurrence>
                columns={columns}
                dataSource={tableOccurrences}
                pagination={{ pageSize: 20, showSizeChanger: true }}
                rowKey={(record) =>
                  `${record.staffId}-${record.scheduleId}-${record.slotId}-${record.date}-${record.calcEffect}`
                }
                scroll={{ x: 900 }}
              />
            )}
          </div>
        </div>
      ) : null}

      {!loadingOccurrences &&
      !occurrenceEnvelope &&
      (isSelfServiceViewer || normalizedStaffId) &&
      selectedSemesterId ? (
        <Alert
          title="准备完成"
          description="点击“计算工作量”后，将展示当前条件下的工作量明细与汇总。"
          showIcon
          type="success"
        />
      ) : null}
    </div>
  );
}
