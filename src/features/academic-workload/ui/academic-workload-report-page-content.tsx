// src/features/academic-workload/ui/academic-workload-report-page-content.tsx
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChartOutlined } from '@ant-design/icons';
import type { SliderSingleProps } from 'antd';
import { Alert, Button, Empty, Select, Skeleton, Slider, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import {
  buildTeachingWeekMonthMarkValues,
  buildTeachingWeekOptions,
  formatTeachingWeekRange,
  parseAcademicWorkloadIsoDate,
  pickNextSemesterId,
  sortSemesters,
  type TeachingWeekOption,
} from '../application/workload-baseline';
import {
  type AcademicTeacherEngagementType,
  type AcademicWorkloadDepartmentOption,
  type AcademicWorkloadReportEnvelope,
  type AcademicWorkloadReportItem,
  requestAcademicWorkloadDepartmentOptions,
  requestAcademicWorkloadReport,
} from '../infrastructure/academic-workload-api';

import './academic-workload-report-page-content.css';

export type AcademicWorkloadReportPageContentProps = {
  canSelectWorkloadDepartment?: boolean;
  defaultWorkloadDepartmentId?: string | null;
};

type AcademicWorkloadReportEngagementFilter = 'ALL' | AcademicTeacherEngagementType;

type DepartmentSelectOption = {
  label: string;
  value: string;
};

type AcademicWorkloadReportTableRow = {
  item: AcademicWorkloadReportItem;
  key: string;
  sequence: number;
  staffRowIndex: number;
  staffRowSpan: number;
};

const EMPTY_TEXT = '-';

const TEACHER_ENGAGEMENT_TYPE_LABELS: Record<AcademicTeacherEngagementType, string> = {
  ADMINISTRATIVE_TEACHING: '行政兼课',
  EXTERNAL_TEACHER: '外聘教师',
  FULL_TIME_TEACHER: '专任教师',
  PUBLIC_WELFARE_POST: '公益性岗位',
};

const TEACHER_ENGAGEMENT_TYPE_ORDER: Record<AcademicTeacherEngagementType, number> = {
  FULL_TIME_TEACHER: 1,
  ADMINISTRATIVE_TEACHING: 2,
  PUBLIC_WELFARE_POST: 3,
  EXTERNAL_TEACHER: 4,
};

const TEACHER_ENGAGEMENT_TYPE_OPTIONS: {
  label: string;
  value: AcademicWorkloadReportEngagementFilter;
}[] = [
  { label: '全部教师', value: 'ALL' },
  { label: '专任教师', value: 'FULL_TIME_TEACHER' },
  { label: '行政兼课', value: 'ADMINISTRATIVE_TEACHING' },
  { label: '公益性岗位', value: 'PUBLIC_WELFARE_POST' },
  { label: '外聘教师', value: 'EXTERNAL_TEACHER' },
];

function compareText(first: string | null | undefined, second: string | null | undefined) {
  return (first || '').localeCompare(second || '', 'zh-Hans-CN');
}

function formatShortDate(value: string) {
  const date = parseAcademicWorkloadIsoDate(value);

  return new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatWeekDateRange(week: TeachingWeekOption | null) {
  if (!week) {
    return '未选择';
  }

  return `${formatShortDate(week.startDate)} - ${formatShortDate(week.endDate)}`;
}

function formatTeachingWeekDateSpan(
  startWeek: TeachingWeekOption | null,
  endWeek: TeachingWeekOption | null,
) {
  if (!startWeek || !endWeek) {
    return '未选择';
  }

  return `${formatShortDate(startWeek.startDate)} - ${formatShortDate(endWeek.endDate)}`;
}

function buildDepartmentSelectOptions(records: AcademicWorkloadDepartmentOption[]) {
  const optionsByValue = new Map<string, DepartmentSelectOption>();

  records.forEach((record) => {
    const id = record.id.trim();

    if (!id) {
      return;
    }

    const name = record.departmentName?.trim() || record.shortName?.trim() || id;

    optionsByValue.set(id, {
      label: name,
      value: id,
    });
  });

  return Array.from(optionsByValue.values()).sort((left, right) =>
    left.label.localeCompare(right.label, 'zh-CN'),
  );
}

function ensureSelectedDepartmentOption(input: {
  fallbackLabel: string;
  options: DepartmentSelectOption[];
  selectedDepartmentId: string;
}) {
  if (
    !input.selectedDepartmentId ||
    input.options.some((option) => option.value === input.selectedDepartmentId)
  ) {
    return input.options;
  }

  return [
    {
      label: input.fallbackLabel,
      value: input.selectedDepartmentId,
    },
    ...input.options,
  ];
}

function formatReportText(value: string | number | null | undefined) {
  const normalizedValue = value === null || value === undefined ? '' : String(value).trim();

  return normalizedValue || EMPTY_TEXT;
}

function getReportStaffKey(item: AcademicWorkloadReportItem) {
  return `${item.teacherEngagementType}::${item.staffId}`;
}

function compareReportItems(
  first: AcademicWorkloadReportItem,
  second: AcademicWorkloadReportItem,
  options: { sortByEngagementType: boolean },
) {
  if (options.sortByEngagementType) {
    const engagementOrder =
      TEACHER_ENGAGEMENT_TYPE_ORDER[first.teacherEngagementType] -
      TEACHER_ENGAGEMENT_TYPE_ORDER[second.teacherEngagementType];

    if (engagementOrder !== 0) {
      return engagementOrder;
    }
  }

  const staffNameOrder = compareText(first.staffName, second.staffName);

  if (staffNameOrder !== 0) {
    return staffNameOrder;
  }

  const staffIdOrder = compareText(first.staffId, second.staffId);

  if (staffIdOrder !== 0) {
    return staffIdOrder;
  }

  const teachingClassOrder = compareText(first.teachingClassName, second.teachingClassName);

  if (teachingClassOrder !== 0) {
    return teachingClassOrder;
  }

  return compareText(first.courseName, second.courseName);
}

function buildAcademicWorkloadReportRows(
  items: AcademicWorkloadReportItem[],
  options: { sortByEngagementType: boolean },
) {
  const sortedItems = [...items].sort((first, second) =>
    compareReportItems(first, second, options),
  );
  const rows: AcademicWorkloadReportTableRow[] = [];
  let cursor = 0;
  let sequence = 0;

  while (cursor < sortedItems.length) {
    const firstItem = sortedItems[cursor];
    const staffKey = getReportStaffKey(firstItem);
    let nextCursor = cursor + 1;

    while (
      nextCursor < sortedItems.length &&
      getReportStaffKey(sortedItems[nextCursor]) === staffKey
    ) {
      nextCursor += 1;
    }

    sequence += 1;

    for (let index = cursor; index < nextCursor; index += 1) {
      const item = sortedItems[index];

      rows.push({
        item,
        key: [
          item.teacherEngagementType,
          item.staffId,
          item.sstsTeachingClassId || 'class',
          item.sstsCourseId || 'course',
          index,
        ].join('::'),
        sequence,
        staffRowIndex: index - cursor,
        staffRowSpan: nextCursor - cursor,
      });
    }

    cursor = nextCursor;
  }

  return rows;
}

function renderReportMergedCell(children: ReactNode, row: AcademicWorkloadReportTableRow) {
  return {
    children,
    props: {
      rowSpan: row.staffRowIndex === 0 ? row.staffRowSpan : 0,
    },
  };
}

function renderAcademicWorkloadReportSummary(totalHours: string) {
  return (
    <Table.Summary.Row>
      <Table.Summary.Cell className="academic-workload-report-total-label" colSpan={8} index={0}>
        总课时
      </Table.Summary.Cell>
      <Table.Summary.Cell className="academic-workload-report-total-value" index={8}>
        {formatReportText(totalHours)}
      </Table.Summary.Cell>
    </Table.Summary.Row>
  );
}

export function AcademicWorkloadReportPageContent({
  canSelectWorkloadDepartment: rawCanSelectWorkloadDepartment = false,
  defaultWorkloadDepartmentId = null,
}: AcademicWorkloadReportPageContentProps) {
  const canSelectWorkloadDepartment = Boolean(rawCanSelectWorkloadDepartment);
  const defaultScopedWorkloadDepartmentId = defaultWorkloadDepartmentId?.trim() ?? '';
  const latestRequestIdRef = useRef(0);
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState<number | null>(null);
  const [selectedWeekEnd, setSelectedWeekEnd] = useState<number | null>(null);
  const [workloadDepartmentId, setWorkloadDepartmentId] = useState(
    canSelectWorkloadDepartment ? '' : defaultScopedWorkloadDepartmentId,
  );
  const [departmentRecords, setDepartmentRecords] = useState<AcademicWorkloadDepartmentOption[]>(
    [],
  );
  const [activeEngagementType, setActiveEngagementType] =
    useState<AcademicWorkloadReportEngagementFilter>('ALL');
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportEnvelope, setReportEnvelope] = useState<AcademicWorkloadReportEnvelope | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSemesters() {
      setLoadingSemesters(true);
      setSemesterError(null);

      try {
        const result = sortSemesters(await requestAcademicSemesters({ limit: 500 }));

        if (!cancelled) {
          setSemesters(result);
          setSelectedSemesterId((currentSelection) => pickNextSemesterId(result, currentSelection));
        }
      } catch (error) {
        if (!cancelled) {
          setSemesterError(error instanceof Error ? error.message : '暂时无法加载学期列表。');
        }
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
    let cancelled = false;

    async function loadDepartments() {
      setLoadingDepartments(true);
      setDepartmentError(null);

      try {
        const result = await requestAcademicWorkloadDepartmentOptions();

        if (!cancelled) {
          setDepartmentRecords(result);
        }
      } catch (error) {
        if (!cancelled) {
          setDepartmentError(error instanceof Error ? error.message : '暂时无法加载归口系列表。');
        }
      } finally {
        if (!cancelled) {
          setLoadingDepartments(false);
        }
      }
    }

    void loadDepartments();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canSelectWorkloadDepartment) {
      setWorkloadDepartmentId(defaultScopedWorkloadDepartmentId);
    }
  }, [canSelectWorkloadDepartment, defaultScopedWorkloadDepartmentId]);

  const selectedSemester = useMemo(
    () => semesters.find((semester) => semester.id === selectedSemesterId) ?? null,
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
    latestRequestIdRef.current += 1;
    setReportEnvelope(null);
    setReportError(null);
    setLoadingReport(false);
  }, [
    activeEngagementType,
    selectedSemesterId,
    selectedWeekEnd,
    selectedWeekStart,
    workloadDepartmentId,
  ]);

  const selectedStartWeek = useMemo(
    () => teachingWeeks.find((week) => week.value === selectedWeekStart) ?? null,
    [selectedWeekStart, teachingWeeks],
  );
  const selectedEndWeek = useMemo(
    () => teachingWeeks.find((week) => week.value === selectedWeekEnd) ?? null,
    [selectedWeekEnd, teachingWeeks],
  );
  const firstTeachingWeekValue = teachingWeeks[0]?.value ?? null;
  const lastTeachingWeekValue = teachingWeeks.at(-1)?.value ?? null;
  const weekRangeSliderValue: [number, number] | undefined =
    firstTeachingWeekValue !== null && lastTeachingWeekValue !== null
      ? [selectedWeekStart ?? firstTeachingWeekValue, selectedWeekEnd ?? lastTeachingWeekValue]
      : undefined;
  const weekRangeMarks = useMemo<SliderSingleProps['marks']>(() => {
    if (firstTeachingWeekValue === null || lastTeachingWeekValue === null) {
      return undefined;
    }

    return buildTeachingWeekMonthMarkValues(teachingWeeks).reduce<
      NonNullable<SliderSingleProps['marks']>
    >((marks, week) => {
      marks[week] = String(week);
      return marks;
    }, {});
  }, [firstTeachingWeekValue, lastTeachingWeekValue, teachingWeeks]);
  const selectedTeachingWeekCount =
    selectedWeekStart !== null && selectedWeekEnd !== null
      ? selectedWeekEnd - selectedWeekStart + 1
      : null;
  const departmentOptions = useMemo(() => {
    const baseOptions = buildDepartmentSelectOptions(departmentRecords);

    return ensureSelectedDepartmentOption({
      fallbackLabel: canSelectWorkloadDepartment ? '当前归口系' : '账号归口系',
      options: baseOptions,
      selectedDepartmentId: workloadDepartmentId,
    });
  }, [canSelectWorkloadDepartment, departmentRecords, workloadDepartmentId]);
  const selectedDepartmentLabel =
    departmentOptions.find((option) => option.value === workloadDepartmentId)?.label ??
    (workloadDepartmentId || '全部归口系');
  const activeEngagementLabel =
    activeEngagementType === 'ALL'
      ? '全部教师'
      : TEACHER_ENGAGEMENT_TYPE_LABELS[activeEngagementType];
  const reportRows = useMemo(
    () =>
      buildAcademicWorkloadReportRows(reportEnvelope?.items ?? [], {
        sortByEngagementType: activeEngagementType === 'ALL',
      }),
    [activeEngagementType, reportEnvelope?.items],
  );
  const canLoadReport =
    Boolean(selectedSemesterId) && (canSelectWorkloadDepartment || Boolean(workloadDepartmentId));

  const handleResetWeekRange = () => {
    setSelectedWeekStart(teachingWeeks[0]?.value ?? null);
    setSelectedWeekEnd(teachingWeeks.at(-1)?.value ?? null);
  };

  const loadReport = useCallback(async () => {
    if (!selectedSemesterId) {
      return;
    }

    if (!canSelectWorkloadDepartment && !workloadDepartmentId) {
      setReportError('当前账号缺少工作量归口系，暂时无法生成报表。');
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    setLoadingReport(true);
    setReportError(null);
    setReportEnvelope(null);

    try {
      const result = await requestAcademicWorkloadReport({
        endDate: selectedEndWeek?.endDate,
        semesterId: selectedSemesterId,
        startDate: selectedStartWeek?.startDate,
        teacherEngagementType: activeEngagementType === 'ALL' ? undefined : activeEngagementType,
        workloadDepartmentId,
      });

      if (latestRequestIdRef.current === requestId) {
        setReportEnvelope(result);
      }
    } catch (error) {
      if (latestRequestIdRef.current === requestId) {
        setReportError(error instanceof Error ? error.message : '暂时无法加载教师工作量预报。');
      }
    } finally {
      if (latestRequestIdRef.current === requestId) {
        setLoadingReport(false);
      }
    }
  }, [
    activeEngagementType,
    canSelectWorkloadDepartment,
    selectedEndWeek,
    selectedSemesterId,
    selectedStartWeek,
    workloadDepartmentId,
  ]);

  const columns = useMemo<ColumnsType<AcademicWorkloadReportTableRow>>(
    () => [
      {
        align: 'center',
        key: 'sequence',
        render: (_, row) => renderReportMergedCell(row.sequence, row),
        title: '序号',
        width: 64,
      },
      {
        key: 'staffName',
        render: (_, row) =>
          renderReportMergedCell(
            <span className="academic-workload-report-staff-name">
              {formatReportText(row.item.staffName)}
            </span>,
            row,
          ),
        title: '姓名',
        width: 108,
      },
      {
        dataIndex: ['item', 'teachingClassName'],
        key: 'teachingClassName',
        render: (value: string) => (
          <span className="academic-workload-report-multiline">{formatReportText(value)}</span>
        ),
        title: '任课班级',
        width: 164,
      },
      {
        dataIndex: ['item', 'courseName'],
        key: 'courseName',
        render: (value: string | null) => (
          <span className="academic-workload-report-course">{formatReportText(value)}</span>
        ),
        title: '课程',
        width: 180,
      },
      {
        align: 'right',
        dataIndex: ['item', 'weeklyHours'],
        key: 'weeklyHours',
        render: (value: string) => formatReportText(value),
        title: '周课时',
        width: 84,
      },
      {
        align: 'right',
        dataIndex: ['item', 'weekCount'],
        key: 'weekCount',
        render: (value: number) => formatReportText(value),
        title: '周数',
        width: 72,
      },
      {
        align: 'right',
        dataIndex: ['item', 'coefficient'],
        key: 'coefficient',
        render: (value: string) => formatReportText(value),
        title: '系数',
        width: 76,
      },
      {
        align: 'right',
        dataIndex: ['item', 'hours'],
        key: 'hours',
        render: (value: string) => (
          <span className="academic-workload-report-hour">{formatReportText(value)}</span>
        ),
        title: '课时',
        width: 84,
      },
      {
        align: 'right',
        key: 'totalHours',
        render: () => null,
        title: '总课时',
        width: 96,
      },
    ],
    [],
  );

  return (
    <div className="academic-workload-report-page">
      <DecoratedPageHeader
        description="按归口系、教师类型和教学周范围生成教师工作量预报。"
        icon={<BarChartOutlined />}
        title="工作量预报"
      />

      <section className="academic-workload-report-panel">
        {semesterError ? <Alert message={semesterError} showIcon type="error" /> : null}
        {departmentError ? <Alert message={departmentError} showIcon type="error" /> : null}

        {loadingSemesters ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          <div className="academic-workload-report-query">
            <div className="academic-workload-report-week-range">
              <div className="academic-workload-report-week-range-header">
                <div>
                  <span>教学周范围</span>
                  <strong>{formatTeachingWeekRange(selectedStartWeek, selectedEndWeek)}</strong>
                </div>
                <Button
                  disabled={teachingWeeks.length === 0}
                  size="small"
                  type="link"
                  onClick={handleResetWeekRange}
                >
                  全学期
                </Button>
              </div>

              <Slider
                disabled={!weekRangeSliderValue}
                marks={weekRangeMarks}
                max={lastTeachingWeekValue ?? 1}
                min={firstTeachingWeekValue ?? 1}
                range={{ draggableTrack: true }}
                tooltip={{ formatter: (value) => (value ? `第 ${value} 周` : '') }}
                value={weekRangeSliderValue}
                onChange={(nextValue: number | number[]) => {
                  if (!Array.isArray(nextValue)) {
                    return;
                  }

                  const [nextStart, nextEnd] = nextValue;

                  setSelectedWeekStart(nextStart ?? null);
                  setSelectedWeekEnd(nextEnd ?? null);
                }}
              />

              <div className="academic-workload-report-week-range-summary">
                <div className="academic-workload-report-week-boundary">
                  <span>起始</span>
                  <strong>{selectedStartWeek?.label ?? '-'}</strong>
                  <small>{formatWeekDateRange(selectedStartWeek)}</small>
                </div>
                <div className="academic-workload-report-week-boundary">
                  <span>范围</span>
                  <strong>
                    {selectedTeachingWeekCount !== null
                      ? `已选 ${selectedTeachingWeekCount} 周`
                      : '-'}
                  </strong>
                  <small>{formatTeachingWeekDateSpan(selectedStartWeek, selectedEndWeek)}</small>
                </div>
                <div className="academic-workload-report-week-boundary">
                  <span>结束</span>
                  <strong>{selectedEndWeek?.label ?? '-'}</strong>
                  <small>{formatWeekDateRange(selectedEndWeek)}</small>
                </div>
              </div>
            </div>

            <div className="academic-workload-report-filters">
              <label>
                <span>学期</span>
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

              <label>
                <span>归口系</span>
                <Select
                  allowClear={canSelectWorkloadDepartment}
                  showSearch
                  aria-label="归口系"
                  disabled={!canSelectWorkloadDepartment}
                  loading={loadingDepartments}
                  optionFilterProp="label"
                  options={departmentOptions}
                  placeholder={canSelectWorkloadDepartment ? '全部归口系' : '账号归口系'}
                  value={workloadDepartmentId || undefined}
                  onChange={(value) =>
                    setWorkloadDepartmentId(
                      canSelectWorkloadDepartment
                        ? (value ?? '')
                        : defaultScopedWorkloadDepartmentId,
                    )
                  }
                />
              </label>

              <label>
                <span>教师类型</span>
                <Select<AcademicWorkloadReportEngagementFilter>
                  aria-label="教师类型"
                  options={TEACHER_ENGAGEMENT_TYPE_OPTIONS}
                  value={activeEngagementType}
                  onChange={setActiveEngagementType}
                />
              </label>

              <Button
                icon={<BarChartOutlined />}
                type="primary"
                disabled={!canLoadReport}
                loading={loadingReport}
                onClick={() => {
                  void loadReport();
                }}
              >
                生成预报
              </Button>
            </div>
          </div>
        )}
      </section>

      {reportError ? <Alert message={reportError} showIcon type="error" /> : null}

      {loadingReport ? <Skeleton active paragraph={{ rows: 8 }} /> : null}

      {!loadingReport && reportEnvelope ? (
        <section className="academic-workload-report-result">
          <div className="academic-workload-report-header">
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                当前预报
              </Typography.Title>
              <Typography.Text type="secondary">
                {formatTeachingWeekRange(selectedStartWeek, selectedEndWeek)} ·{' '}
                {selectedDepartmentLabel} · {activeEngagementLabel}
              </Typography.Text>
            </div>
            <div className="academic-workload-report-metrics">
              <div>
                <span>教师数</span>
                <strong>{reportEnvelope.total.staffCount}</strong>
              </div>
              <div>
                <span>课程行</span>
                <strong>{reportEnvelope.total.itemCount}</strong>
              </div>
              <div>
                <span>总课时</span>
                <strong>{formatReportText(reportEnvelope.total.hours)}</strong>
              </div>
            </div>
          </div>

          {!reportEnvelope.isValid ? (
            <Alert
              message="预报数据异常"
              description={reportEnvelope.invalidReason ?? '当前条件返回的数据未通过完整性校验。'}
              showIcon
              type="error"
            />
          ) : null}

          {!reportEnvelope.isComplete ? (
            <Alert
              message="预报可能不完整"
              description={reportEnvelope.truncationReason ?? '当前结果被截断，请谨慎使用。'}
              showIcon
              type="warning"
            />
          ) : null}

          {reportRows.length === 0 ? (
            <Empty
              description="当前条件下没有工作量预报数据。"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div className="academic-workload-report-table-shell">
              <Table<AcademicWorkloadReportTableRow>
                columns={columns}
                dataSource={reportRows}
                pagination={false}
                rowKey={(row) => row.key}
                scroll={{ x: 928 }}
                size="small"
                tableLayout="fixed"
                summary={() => renderAcademicWorkloadReportSummary(reportEnvelope.total.hours)}
              />
            </div>
          )}
        </section>
      ) : null}

      {!loadingReport && !reportEnvelope && selectedSemesterId ? (
        <Alert
          message="选择条件后生成工作量预报"
          description="预报按教师合并序号和姓名，表尾总课时使用后端合计。"
          showIcon
          type="info"
        />
      ) : null}
    </div>
  );
}
