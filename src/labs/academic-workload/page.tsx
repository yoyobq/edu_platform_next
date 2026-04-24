import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Select,
  Skeleton,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLoaderData } from 'react-router';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';

import { academicWorkloadLabAccess } from './access';
import {
  type AcademicStableWorkloadCalcEffect,
  type AcademicStableWorkloadEnvelope,
  type AcademicStableWorkloadOccurrence,
  requestAcademicStableWorkloadOccurrences,
} from './api';
import { academicWorkloadLabMeta } from './meta';

type AcademicWorkloadLabLoaderData = {
  defaultStaffId?: string | null;
  viewerKind?: 'authenticated' | 'internal';
} | null;

type TeachingWeekOption = {
  endDate: string;
  label: string;
  startDate: string;
  value: number;
};

type TableViewFilter = 'added' | 'all' | 'deducted' | 'effective';

const CALC_EFFECT_LABELS: Record<AcademicStableWorkloadCalcEffect, string> = {
  CANCEL: '停课',
  MAKEUP: '补课',
  NORMAL: '正常',
  SWAP_IN: '调入',
  SWAP_OUT: '调出',
};

const DAY_OF_WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000);
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function formatIsoDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const weekday = (date.getUTCDay() + 6) % 7;

  return addDays(date, -weekday);
}

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

function buildTeachingWeekOptions(semester: AcademicSemesterRecord | null) {
  if (!semester) {
    return [] as TeachingWeekOption[];
  }

  const firstTeachingWeekStart = startOfWeek(parseIsoDate(semester.firstTeachingDate));
  const examWeekStart = startOfWeek(parseIsoDate(semester.examStartDate));
  const lastTeachingWeekStart =
    examWeekStart.getTime() > firstTeachingWeekStart.getTime()
      ? addDays(examWeekStart, -7)
      : firstTeachingWeekStart;
  const weeks: TeachingWeekOption[] = [];

  for (
    let cursor = firstTeachingWeekStart, index = 1;
    cursor.getTime() <= lastTeachingWeekStart.getTime();
    cursor = addDays(cursor, 7), index += 1
  ) {
    weeks.push({
      endDate: formatIsoDate(addDays(cursor, 6)),
      label: `第 ${index} 周`,
      startDate: formatIsoDate(cursor),
      value: index,
    });
  }

  return weeks;
}

function normalizeStaffId(value: string) {
  const normalizedValue = value.trim();

  return normalizedValue ? normalizedValue : '';
}

function formatLongDate(value: string) {
  const date = parseIsoDate(value);

  return new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'short',
  }).format(date);
}

function formatTeachingWeekRange(
  startWeek: TeachingWeekOption | null,
  endWeek: TeachingWeekOption | null,
) {
  if (!startWeek || !endWeek) {
    return '整学期';
  }

  return `${startWeek.label} - ${endWeek.label}`;
}

function resolvePeriodCount(item: AcademicStableWorkloadOccurrence) {
  return item.periodEnd - item.periodStart + 1;
}

function resolveOccurrenceHours(item: AcademicStableWorkloadOccurrence) {
  return resolveOccurrenceHourHundredths(item);
}

function resolveOccurrenceHourHundredths(item: AcademicStableWorkloadOccurrence) {
  const normalizedCoefficient = item.coefficient.trim();
  const [integerPartRaw = '0', decimalPartRaw = ''] = normalizedCoefficient.split('.');
  const integerPart = Number(integerPartRaw);
  const decimalPart = Number((decimalPartRaw + '00').slice(0, 2));
  const coefficientHundredths = Number.isFinite(integerPart)
    ? integerPart * 100 + (Number.isFinite(decimalPart) ? decimalPart : 0)
    : 100;

  return resolvePeriodCount(item) * coefficientHundredths;
}

function sumOccurrenceHours(items: AcademicStableWorkloadOccurrence[]) {
  return items.reduce((total, item) => total + resolveOccurrenceHourHundredths(item), 0);
}

function formatHours(valueInHundredths: number) {
  const normalizedValue = valueInHundredths / 100;

  return Number.isInteger(normalizedValue) ? String(normalizedValue) : normalizedValue.toFixed(2);
}

function sortOccurrences(items: AcademicStableWorkloadOccurrence[]) {
  return [...items].sort((left, right) => {
    if (left.weekIndex !== right.weekIndex) {
      return left.weekIndex - right.weekIndex;
    }

    if (left.date !== right.date) {
      return left.date.localeCompare(right.date, 'zh-CN');
    }

    if (left.periodStart !== right.periodStart) {
      return left.periodStart - right.periodStart;
    }

    if (left.periodEnd !== right.periodEnd) {
      return left.periodEnd - right.periodEnd;
    }

    return `${left.courseName}-${left.teachingClassName}`.localeCompare(
      `${right.courseName}-${right.teachingClassName}`,
      'zh-CN',
    );
  });
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
  return item.isEffective ? '计入应计' : '不计入应计';
}

function isBaselineOccurrence(item: AcademicStableWorkloadOccurrence) {
  return (
    item.calcEffect === 'NORMAL' || item.calcEffect === 'CANCEL' || item.calcEffect === 'SWAP_OUT'
  );
}

function isAddedEffectiveOccurrence(item: AcademicStableWorkloadOccurrence) {
  return item.isEffective && (item.calcEffect === 'MAKEUP' || item.calcEffect === 'SWAP_IN');
}

export function AcademicWorkloadLabPage() {
  const loaderData = useLoaderData() as AcademicWorkloadLabLoaderData;
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState(loaderData?.defaultStaffId ?? '');
  const [selectedWeekStart, setSelectedWeekStart] = useState<number | null>(null);
  const [selectedWeekEnd, setSelectedWeekEnd] = useState<number | null>(null);
  const [tableViewFilter, setTableViewFilter] = useState<TableViewFilter>('all');
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingOccurrences, setLoadingOccurrences] = useState(false);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [workloadError, setWorkloadError] = useState<string | null>(null);
  const [occurrenceEnvelope, setOccurrenceEnvelope] =
    useState<AcademicStableWorkloadEnvelope | null>(null);

  const normalizedStaffId = normalizeStaffId(staffId);

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
    if (!staffId && loaderData?.defaultStaffId) {
      setStaffId(loaderData.defaultStaffId);
    }
  }, [loaderData?.defaultStaffId, staffId]);

  const selectedSemester = useMemo(
    () => semesters.find((record) => record.id === selectedSemesterId) ?? null,
    [selectedSemesterId, semesters],
  );

  const teachingWeeks = useMemo(
    () => buildTeachingWeekOptions(selectedSemester),
    [selectedSemester],
  );

  useEffect(() => {
    const firstWeek = teachingWeeks[0]?.value ?? null;
    const lastWeek = teachingWeeks.at(-1)?.value ?? null;

    setSelectedWeekStart((currentValue) => {
      if (currentValue !== null && teachingWeeks.some((week) => week.value === currentValue)) {
        return currentValue;
      }

      return firstWeek;
    });
    setSelectedWeekEnd((currentValue) => {
      if (currentValue !== null && teachingWeeks.some((week) => week.value === currentValue)) {
        return currentValue;
      }

      return lastWeek;
    });
  }, [teachingWeeks]);

  useEffect(() => {
    setOccurrenceEnvelope(null);
    setTableViewFilter('all');
    setWorkloadError(null);
  }, [normalizedStaffId, selectedSemesterId]);

  const selectedStartWeek = useMemo(
    () => teachingWeeks.find((week) => week.value === selectedWeekStart) ?? null,
    [selectedWeekStart, teachingWeeks],
  );
  const selectedEndWeek = useMemo(
    () => teachingWeeks.find((week) => week.value === selectedWeekEnd) ?? null,
    [selectedWeekEnd, teachingWeeks],
  );

  const effectiveRangeStart = selectedWeekStart ?? selectedEndWeek?.value ?? null;
  const effectiveRangeEnd = selectedWeekEnd ?? selectedWeekStart ?? null;

  const displayedOccurrences = useMemo(() => {
    if (!occurrenceEnvelope) {
      return [] as AcademicStableWorkloadOccurrence[];
    }

    return sortOccurrences(
      occurrenceEnvelope.items.filter((item) => {
        if (effectiveRangeStart === null || effectiveRangeEnd === null) {
          return true;
        }

        return item.weekIndex >= effectiveRangeStart && item.weekIndex <= effectiveRangeEnd;
      }),
    );
  }, [effectiveRangeEnd, effectiveRangeStart, occurrenceEnvelope]);
  const effectiveRangeOccurrences = useMemo(
    () => displayedOccurrences.filter((item) => item.isEffective),
    [displayedOccurrences],
  );
  const ineffectiveRangeOccurrences = useMemo(
    () => displayedOccurrences.filter((item) => !item.isEffective),
    [displayedOccurrences],
  );
  const addedEffectiveRangeOccurrences = useMemo(
    () => displayedOccurrences.filter(isAddedEffectiveOccurrence),
    [displayedOccurrences],
  );

  const rangeHours = useMemo(
    () => sumOccurrenceHours(effectiveRangeOccurrences),
    [effectiveRangeOccurrences],
  );
  const ineffectiveRangeHours = useMemo(
    () => sumOccurrenceHours(ineffectiveRangeOccurrences),
    [ineffectiveRangeOccurrences],
  );
  const addedEffectiveRangeHours = useMemo(
    () => sumOccurrenceHours(addedEffectiveRangeOccurrences),
    [addedEffectiveRangeOccurrences],
  );
  const baselineRangeOccurrences = useMemo(
    () => displayedOccurrences.filter(isBaselineOccurrence),
    [displayedOccurrences],
  );
  const baselineRangeHours = useMemo(
    () => sumOccurrenceHours(baselineRangeOccurrences),
    [baselineRangeOccurrences],
  );
  const tableOccurrences = useMemo(() => {
    if (tableViewFilter === 'deducted') {
      return ineffectiveRangeOccurrences;
    }
    if (tableViewFilter === 'added') {
      return addedEffectiveRangeOccurrences;
    }
    if (tableViewFilter === 'effective') {
      return effectiveRangeOccurrences;
    }
    return displayedOccurrences;
  }, [
    addedEffectiveRangeOccurrences,
    displayedOccurrences,
    effectiveRangeOccurrences,
    ineffectiveRangeOccurrences,
    tableViewFilter,
  ]);

  const ineffectiveRangeCount = ineffectiveRangeOccurrences.length;
  const firstTeachingWeekValue = teachingWeeks[0]?.value ?? null;
  const lastTeachingWeekValue = teachingWeeks.at(-1)?.value ?? null;
  const isFullTeachingWeekRange =
    firstTeachingWeekValue === null ||
    lastTeachingWeekValue === null ||
    (effectiveRangeStart === firstTeachingWeekValue && effectiveRangeEnd === lastTeachingWeekValue);
  const workloadFormulaTitle = isFullTeachingWeekRange ? '整学期' : '当前范围';
  const workloadStaffName = occurrenceEnvelope?.items[0]?.staffName || normalizedStaffId;
  const baselineTeachingWeekCount = new Set(
    baselineRangeOccurrences.map((occurrence) => occurrence.weekIndex),
  ).size;
  const baselineWeeklyHours =
    baselineTeachingWeekCount > 0 ? baselineRangeHours / baselineTeachingWeekCount : 0;

  const handleCalculate = useCallback(async () => {
    if (!selectedSemesterId || !normalizedStaffId) {
      return;
    }

    setLoadingOccurrences(true);
    setWorkloadError(null);

    try {
      const result = await requestAcademicStableWorkloadOccurrences({
        semesterId: selectedSemesterId,
        staffId: normalizedStaffId,
      });

      setOccurrenceEnvelope(result);
    } catch (error) {
      setWorkloadError(error instanceof Error ? error.message : '暂时无法加载教师工作量。');
    } finally {
      setLoadingOccurrences(false);
    }
  }, [normalizedStaffId, selectedSemesterId]);

  const handleResetRange = useCallback(() => {
    setSelectedWeekStart(teachingWeeks[0]?.value ?? null);
    setSelectedWeekEnd(teachingWeeks.at(-1)?.value ?? null);
  }, [teachingWeeks]);

  const columns = useMemo<ColumnsType<AcademicStableWorkloadOccurrence>>(
    () => [
      {
        dataIndex: 'date',
        key: 'date',
        render: (_, record) => (
          <div className="flex min-w-30 flex-col gap-1">
            <Typography.Text>{formatLongDate(record.date)}</Typography.Text>
            <Typography.Text type="secondary">
              {DAY_OF_WEEK_LABELS[record.logicalDayOfWeek - 1] ?? `周${record.logicalDayOfWeek}`}
            </Typography.Text>
          </div>
        ),
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
          <div className="flex min-w-52 flex-col gap-1">
            <Typography.Text strong>{record.courseName || '未命名课程'}</Typography.Text>
            <Typography.Text type="secondary">{record.teachingClassName}</Typography.Text>
            <Typography.Text type="secondary">
              {record.classroomName || '未标注教室'}
              {record.courseCategory ? ` · ${record.courseCategory}` : ''}
            </Typography.Text>
          </div>
        ),
        title: '课程与教学班',
      },
      {
        key: 'hours',
        render: (_, record) => (
          <div className="flex min-w-28 flex-col gap-1">
            <Typography.Text>
              第 {record.periodStart}-{record.periodEnd} 节
            </Typography.Text>
            <Typography.Text type="secondary">
              {resolvePeriodCount(record)} 节 x {record.coefficient}
            </Typography.Text>
            <Typography.Text strong>
              {formatHours(resolveOccurrenceHours(record))} 课时
            </Typography.Text>
          </div>
        ),
        title: '折算',
        width: 156,
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
      {
        key: 'trace',
        render: (_, record) => (
          <div className="flex min-w-40 flex-col gap-1">
            <Typography.Text type="secondary">
              逻辑星期：
              {DAY_OF_WEEK_LABELS[record.logicalDayOfWeek - 1] ?? `周${record.logicalDayOfWeek}`}
            </Typography.Text>
            <Typography.Text type="secondary">
              物理星期：
              {DAY_OF_WEEK_LABELS[record.physicalDayOfWeek - 1] ?? `周${record.physicalDayOfWeek}`}
            </Typography.Text>
            <Typography.Text type="secondary">
              键：schedule {record.scheduleId} / slot {record.slotId}
            </Typography.Text>
          </div>
        ),
        title: '对账键',
        width: 180,
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Typography.Title level={3} style={{ margin: 0 }}>
          教师学期工作量
        </Typography.Title>
        <Typography.Paragraph style={{ margin: 0 }} type="secondary">
          按学期拉取教师 occurrence
          明细，前端仅在同一批明细上切换教学周范围并重算。当前页面里的“实际工作量” 指 current
          planned contract 下 isEffective=true 的实际课时，不代表 executed workload。
        </Typography.Paragraph>
      </div>

      <Alert
        message="口径说明"
        description="明细和汇总都只基于 occurrence baseline；学期总课时与区间课时都按 有效明细 x 节次数 x 系数 计算。"
        showIcon
        type="info"
      />

      <Card>
        {loadingSemesters ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <div className="flex flex-col gap-4">
            {semesterError ? <Alert message={semesterError} showIcon type="error" /> : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-2">
                <Typography.Text strong>学期</Typography.Text>
                <Select
                  options={semesters.map((semester) => ({
                    label: `${semester.name}${semester.isCurrent ? ' · 当前' : ''}`,
                    value: semester.id,
                  }))}
                  placeholder="请选择学期"
                  value={selectedSemesterId ?? undefined}
                  onChange={(value) => setSelectedSemesterId(value)}
                />
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>教师 staffId</Typography.Text>
                <Input
                  placeholder="例如 T20250017"
                  value={staffId}
                  onChange={(event) => setStaffId(event.target.value)}
                  onPressEnter={() => {
                    void handleCalculate();
                  }}
                />
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>起始教学周</Typography.Text>
                <Select
                  options={teachingWeeks.map((week) => ({ label: week.label, value: week.value }))}
                  placeholder="起始周"
                  value={selectedWeekStart ?? undefined}
                  onChange={(value) => {
                    setSelectedWeekStart(value);
                    setSelectedWeekEnd((currentValue) =>
                      currentValue !== null && currentValue >= value ? currentValue : value,
                    );
                  }}
                />
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>结束教学周</Typography.Text>
                <Select
                  options={teachingWeeks.map((week) => ({ label: week.label, value: week.value }))}
                  placeholder="结束周"
                  value={selectedWeekEnd ?? undefined}
                  onChange={(value) => {
                    setSelectedWeekEnd(value);
                    setSelectedWeekStart((currentValue) =>
                      currentValue !== null && currentValue <= value ? currentValue : value,
                    );
                  }}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="primary"
                disabled={!selectedSemesterId || !normalizedStaffId}
                loading={loadingOccurrences}
                onClick={() => {
                  void handleCalculate();
                }}
              >
                计算学期工作量
              </Button>
              <Button disabled={teachingWeeks.length === 0} onClick={handleResetRange}>
                恢复全学期周范围
              </Button>
            </div>
          </div>
        )}
      </Card>

      {workloadError ? <Alert message={workloadError} showIcon type="error" /> : null}

      {loadingOccurrences ? <Skeleton active paragraph={{ rows: 6 }} /> : null}

      {!loadingOccurrences && occurrenceEnvelope ? (
        <div className="flex flex-col gap-6">
          {!occurrenceEnvelope.isValid ? (
            <Alert
              message="后端返回 invalid envelope"
              description={
                occurrenceEnvelope.invalidReason ?? '当前过滤条件对应的数据存在 source corruption。'
              }
              showIcon
              type="error"
            />
          ) : null}

          {!occurrenceEnvelope.isComplete ? (
            <Alert
              message="结果不是完整窗口"
              description={
                occurrenceEnvelope.truncationReason ??
                '当前结果被后端标记为不完整，请谨慎使用汇总值。'
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
                {formatTeachingWeekRange(selectedStartWeek, selectedEndWeek)}
              </Typography.Text>

              <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(160px,1fr)_auto_minmax(160px,1fr)_auto_minmax(160px,1fr)_auto_minmax(160px,1fr)]">
                <Card size="small">
                  <div className="flex flex-col gap-1">
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
                  <Typography.Title
                    level={2}
                    style={{ color: '#1677ff', fontWeight: 700, margin: 0 }}
                  >
                    - (
                  </Typography.Title>
                </div>

                <Card
                  hoverable
                  size="small"
                  styles={{
                    body: {
                      border:
                        tableViewFilter === 'deducted'
                          ? '1px solid #1677ff'
                          : '1px solid transparent',
                      borderRadius: 8,
                    },
                  }}
                  onClick={() => setTableViewFilter('deducted')}
                >
                  <div className="flex flex-col gap-1">
                    <Tooltip title="国定假期、校园活动停课、调课调出（CANCEL/SWAP_OUT）">
                      <Typography.Text type="secondary">扣课课时</Typography.Text>
                    </Tooltip>
                    <Typography.Title level={2} style={{ margin: 0 }}>
                      {formatHours(ineffectiveRangeHours)}
                    </Typography.Title>
                    <Typography.Text type="secondary">
                      扣课明细 {ineffectiveRangeCount} 条
                    </Typography.Text>
                  </div>
                </Card>

                <div className="self-center px-1 text-center">
                  <Typography.Title
                    level={2}
                    style={{ color: '#1677ff', fontWeight: 700, margin: 0 }}
                  >
                    -
                  </Typography.Title>
                </div>

                <Card
                  hoverable
                  size="small"
                  styles={{
                    body: {
                      border:
                        tableViewFilter === 'added' ? '1px solid #1677ff' : '1px solid transparent',
                      borderRadius: 8,
                    },
                  }}
                  onClick={() => setTableViewFilter('added')}
                >
                  <div className="flex flex-col gap-1">
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
                  <Typography.Title
                    level={2}
                    style={{ color: '#1677ff', fontWeight: 700, margin: 0 }}
                  >
                    ) =
                  </Typography.Title>
                </div>

                <Card
                  hoverable
                  size="small"
                  styles={{
                    body: {
                      border:
                        tableViewFilter === 'effective'
                          ? '1px solid #1677ff'
                          : '1px solid transparent',
                      borderRadius: 8,
                    },
                  }}
                  onClick={() => setTableViewFilter('effective')}
                >
                  <div className="flex flex-col gap-1">
                    <Tooltip title="isEffective == true">
                      <Typography.Text type="secondary">实际课时</Typography.Text>
                    </Tooltip>
                    <Typography.Title level={2} style={{ margin: 0 }}>
                      {formatHours(rangeHours)}
                    </Typography.Title>
                    <Typography.Text type="secondary">
                      有效明细 {effectiveRangeOccurrences.length} 条
                    </Typography.Text>
                  </div>
                </Card>
              </div>
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
                实际课时 {effectiveRangeOccurrences.length} 条
              </Button>
            </div>

            {tableOccurrences.length === 0 ? (
              <Empty
                description={
                  occurrenceEnvelope.items.length === 0
                    ? '当前教师在该学期没有返回任何 occurrence 明细。'
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
                scroll={{ x: 1080 }}
              />
            )}
          </div>
        </div>
      ) : null}

      {!loadingOccurrences && !occurrenceEnvelope && normalizedStaffId && selectedSemesterId ? (
        <Alert
          message="准备完成"
          description="点击“计算学期工作量”后，将按教师与学期读取整学期 occurrence 明细，再在前端对当前教学周范围做重算。"
          showIcon
          type="success"
        />
      ) : null}

      <Card size="small">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Lab meta">{academicWorkloadLabMeta.purpose}</Descriptions.Item>
          <Descriptions.Item label="访问范围">
            {academicWorkloadLabAccess.allowedAccessLevels.join(' / ')}
          </Descriptions.Item>
          <Descriptions.Item label="当前视图身份">
            {loaderData?.viewerKind ?? 'unknown'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
