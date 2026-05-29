// src/features/academic-workload/ui/academic-workload-report-page-content.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChartOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Select, Skeleton, Space, Table, Tabs, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import {
  ACADEMIC_WORKLOAD_ENGAGEMENT_ORDER,
  ACADEMIC_WORKLOAD_REPORT_ENGAGEMENT_TABS,
  type AcademicWorkloadEngagementFilter,
  getAcademicWorkloadEngagementLabel,
} from '../application/teacher-engagement';
import {
  formatAcademicWorkloadTeachingClassMultiline,
  splitAcademicWorkloadTeachingClassNames,
} from '../application/teaching-class-format';
import {
  buildTeachingWeekOptions,
  pickNextSemesterId,
  sortSemesters,
} from '../application/workload-baseline';
import {
  buildAcademicWorkloadDepartmentSelectOptions,
  DEFAULT_WORKLOAD_DEPARTMENT_ID,
  ensureSelectedAcademicWorkloadDepartmentOption,
} from '../application/workload-department-options';
import {
  type AcademicWorkloadDepartmentOption,
  type AcademicWorkloadReportEnvelope,
  type AcademicWorkloadReportItem,
  requestAcademicWorkloadDepartmentOptions,
  requestAcademicWorkloadReport,
} from '../infrastructure/academic-workload-api';
import {
  type AcademicWorkloadReportExcelRow,
  exportAcademicWorkloadReportExcel,
} from '../infrastructure/academic-workload-report-excel-export';

import { useMarkableDetailCells } from './markable-detail-cells';
import { TeachingWeekRangeControl } from './teaching-week-range-control';
import { formatTeachingWeekRangeLabel, useTeachingWeekRange } from './teaching-week-range-state';

import './academic-workload-report-page-content.css';

export type AcademicWorkloadReportPageContentProps = {
  canSelectWorkloadDepartment?: boolean;
  defaultWorkloadDepartmentId?: string | null;
};

type AcademicWorkloadReportTableRow = {
  detailRowIndex: number;
  item: AcademicWorkloadReportItem;
  key: string;
  sequence: number;
  staffRowIndex: number;
  staffRowSpan: number;
  staffTotalHours: number;
};

const EMPTY_TEXT = '-';
const REPORT_TABLE_BASE_WIDTH = 856;
const DEFAULT_REPORT_ENGAGEMENT_TYPE: AcademicWorkloadEngagementFilter = 'FULL_TIME_TEACHER';
const ACADEMIC_WORKLOAD_REPORT_MARKABLE_DETAIL_CELL_CLASS_NAMES = {
  evenCell: 'academic-workload-report-detail-cell-even',
  markedCell: 'academic-workload-report-detail-cell-marked',
  markableCell: 'academic-workload-report-markable-cell',
  markStartCell: 'academic-workload-report-mark-start-cell',
  oddCell: 'academic-workload-report-detail-cell-odd',
};

function compareText(first: string | null | undefined, second: string | null | undefined) {
  return (first || '').localeCompare(second || '', 'zh-Hans-CN');
}

function formatReportText(value: string | number | null | undefined) {
  const normalizedValue = value === null || value === undefined ? '' : String(value).trim();

  return normalizedValue || EMPTY_TEXT;
}

function parseReportNumber(value: string | number | null | undefined) {
  const normalizedValue =
    value === null || value === undefined ? '' : String(value).trim().replaceAll(',', '');

  if (!normalizedValue) {
    return null;
  }

  const numberValue = Number(normalizedValue);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatReportDecimal(value: string | number | null | undefined, fractionDigits: number) {
  const numberValue = parseReportNumber(value);

  return numberValue === null ? formatReportText(value) : numberValue.toFixed(fractionDigits);
}

function formatReportExcelText(value: string | number | null | undefined) {
  const normalizedValue = value === null || value === undefined ? '' : String(value).trim();

  return normalizedValue;
}

function formatTeachingClassExcelValue(value: string) {
  return formatAcademicWorkloadTeachingClassMultiline(value, EMPTY_TEXT);
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
      ACADEMIC_WORKLOAD_ENGAGEMENT_ORDER[first.teacherEngagementType] -
      ACADEMIC_WORKLOAD_ENGAGEMENT_ORDER[second.teacherEngagementType];

    if (engagementOrder !== 0) {
      return engagementOrder;
    }
  }

  const staffIdOrder = compareText(first.staffId, second.staffId);

  if (staffIdOrder !== 0) {
    return staffIdOrder;
  }

  const staffNameOrder = compareText(first.staffName, second.staffName);

  if (staffNameOrder !== 0) {
    return staffNameOrder;
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
  let detailRowIndex = 0;
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

    const staffTotalHours = sortedItems
      .slice(cursor, nextCursor)
      .reduce((total, item) => total + (parseReportNumber(item.hours) ?? 0), 0);

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
        detailRowIndex,
        sequence,
        staffRowIndex: index - cursor,
        staffRowSpan: nextCursor - cursor,
        staffTotalHours,
      });
      detailRowIndex += 1;
    }

    cursor = nextCursor;
  }

  return rows;
}

function getReportMergedCellProps(row: AcademicWorkloadReportTableRow) {
  return {
    rowSpan: row.staffRowIndex === 0 ? row.staffRowSpan : 0,
  };
}

function renderTeachingClassName(value: string) {
  const teachingClassNames = splitAcademicWorkloadTeachingClassNames(value);

  if (teachingClassNames.length === 0) {
    return <span className="academic-workload-report-class-name">{EMPTY_TEXT}</span>;
  }

  return (
    <Tooltip title={value}>
      <span className="academic-workload-report-class-name">
        {teachingClassNames.map((teachingClassName, index) => (
          <span
            className="academic-workload-report-class-name-item"
            key={`${teachingClassName}-${index}`}
          >
            {teachingClassName}
          </span>
        ))}
      </span>
    </Tooltip>
  );
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

function buildReportTableExcelRows(
  rows: AcademicWorkloadReportTableRow[],
): AcademicWorkloadReportExcelRow[] {
  return rows.map((row) => ({
    coefficient: formatReportDecimal(row.item.coefficient, 1),
    courseName: formatReportExcelText(row.item.courseName),
    hours: formatReportDecimal(row.item.hours, 2),
    sequence: row.sequence,
    staffName: formatReportExcelText(row.item.staffName),
    staffRowIndex: row.staffRowIndex,
    staffRowSpan: row.staffRowSpan,
    staffTotal: formatReportDecimal(row.staffTotalHours, 2),
    teachingClassName: formatTeachingClassExcelValue(row.item.teachingClassName),
    weekCount: row.item.weekCount,
    weeklyHours: formatReportExcelText(row.item.weeklyHours),
  }));
}

function buildReportExcelFileName(input: { engagementLabel: string; semesterLabel: string }) {
  return `教师工作量预报-${input.semesterLabel}-${input.engagementLabel}.xlsx`;
}

function ReportMetric({
  label,
  tone = 'default',
  value,
}: {
  label: string;
  tone?: 'default' | 'primary';
  value: string;
}) {
  return (
    <div className={`academic-workload-report-metric academic-workload-report-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function AcademicWorkloadReportPageContent({
  canSelectWorkloadDepartment: rawCanSelectWorkloadDepartment = false,
  defaultWorkloadDepartmentId = null,
}: AcademicWorkloadReportPageContentProps) {
  const canSelectWorkloadDepartment = Boolean(rawCanSelectWorkloadDepartment);
  const defaultScopedWorkloadDepartmentId = defaultWorkloadDepartmentId?.trim() ?? '';
  const initialWorkloadDepartmentId = canSelectWorkloadDepartment
    ? DEFAULT_WORKLOAD_DEPARTMENT_ID
    : defaultScopedWorkloadDepartmentId;
  const latestRequestIdRef = useRef(0);
  const hasAutoLoadedReportRef = useRef(false);
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [workloadDepartmentId, setWorkloadDepartmentId] = useState(initialWorkloadDepartmentId);
  const [departmentRecords, setDepartmentRecords] = useState<AcademicWorkloadDepartmentOption[]>(
    [],
  );
  const [activeEngagementType, setActiveEngagementType] =
    useState<AcademicWorkloadEngagementFilter>(DEFAULT_REPORT_ENGAGEMENT_TYPE);
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportEnvelope, setReportEnvelope] = useState<AcademicWorkloadReportEnvelope | null>(null);
  const exportStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportStatus, setExportStatus] = useState<'exported' | 'failed' | 'idle'>('idle');
  const { clearMarkedDetailRows, getMarkableDetailCellProps } =
    useMarkableDetailCells<AcademicWorkloadReportTableRow>(
      ACADEMIC_WORKLOAD_REPORT_MARKABLE_DETAIL_CELL_CLASS_NAMES,
    );

  const invalidateReport = useCallback(() => {
    latestRequestIdRef.current += 1;
    clearMarkedDetailRows();
    setReportEnvelope(null);
    setReportError(null);
    setLoadingReport(false);
  }, [clearMarkedDetailRows]);

  const setTemporaryExportStatus = useCallback((status: 'exported' | 'failed') => {
    setExportStatus(status);

    if (exportStatusTimerRef.current) {
      clearTimeout(exportStatusTimerRef.current);
    }

    exportStatusTimerRef.current = setTimeout(() => {
      setExportStatus('idle');
      exportStatusTimerRef.current = null;
    }, 1800);
  }, []);

  useEffect(
    () => () => {
      if (exportStatusTimerRef.current) {
        clearTimeout(exportStatusTimerRef.current);
      }
    },
    [],
  );

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
      if (workloadDepartmentId !== defaultScopedWorkloadDepartmentId) {
        invalidateReport();
      }

      setWorkloadDepartmentId(defaultScopedWorkloadDepartmentId);
    }
  }, [
    canSelectWorkloadDepartment,
    defaultScopedWorkloadDepartmentId,
    invalidateReport,
    workloadDepartmentId,
  ]);

  const selectedSemester = useMemo(
    () => semesters.find((semester) => semester.id === selectedSemesterId) ?? null,
    [selectedSemesterId, semesters],
  );
  const teachingWeeks = useMemo(
    () => buildTeachingWeekOptions(selectedSemester),
    [selectedSemester],
  );
  const teachingWeekRange = useTeachingWeekRange(teachingWeeks, {
    onRangeChange: invalidateReport,
  });

  useEffect(() => {
    invalidateReport();
  }, [invalidateReport, selectedSemesterId]);

  const isExternalTeacherRangeMode = activeEngagementType === 'EXTERNAL_TEACHER';
  const departmentOptions = useMemo(() => {
    const baseOptions = buildAcademicWorkloadDepartmentSelectOptions(departmentRecords);

    return ensureSelectedAcademicWorkloadDepartmentOption({
      fallbackLabel: canSelectWorkloadDepartment ? '默认归口系' : '当前归口系',
      options: baseOptions,
      selectedDepartmentId: workloadDepartmentId,
    });
  }, [canSelectWorkloadDepartment, departmentRecords, workloadDepartmentId]);
  const selectedDepartmentLabel =
    departmentOptions.find((option) => option.value === workloadDepartmentId)?.label ??
    (workloadDepartmentId || '全部归口系');
  const activeEngagementLabel = getAcademicWorkloadEngagementLabel(activeEngagementType);
  const semesterLabel = selectedSemester?.name ?? `学期 ${selectedSemesterId}`;
  const reportRows = useMemo(
    () =>
      buildAcademicWorkloadReportRows(reportEnvelope?.items ?? [], {
        sortByEngagementType: activeEngagementType === 'ALL',
      }),
    [activeEngagementType, reportEnvelope?.items],
  );
  const reportTotalHours = reportEnvelope
    ? formatReportDecimal(reportEnvelope.total.hours, 2)
    : EMPTY_TEXT;
  const canExportReportExcel = activeEngagementType !== 'ALL';
  const canLoadReport =
    Boolean(selectedSemesterId) && (canSelectWorkloadDepartment || Boolean(workloadDepartmentId));
  const tabItems = useMemo(
    () =>
      ACADEMIC_WORKLOAD_REPORT_ENGAGEMENT_TABS.map((item) => ({
        key: item.key,
        label: item.label,
      })),
    [],
  );

  const loadReport = useCallback(
    async (nextEngagementType: AcademicWorkloadEngagementFilter = activeEngagementType) => {
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
        const shouldUseTeachingWeekRange = nextEngagementType === 'EXTERNAL_TEACHER';
        const result = await requestAcademicWorkloadReport({
          endDate: shouldUseTeachingWeekRange
            ? teachingWeekRange.selectedEndWeek?.endDate
            : undefined,
          semesterId: selectedSemesterId,
          startDate: shouldUseTeachingWeekRange
            ? teachingWeekRange.selectedStartWeek?.startDate
            : undefined,
          teacherEngagementType: nextEngagementType === 'ALL' ? undefined : nextEngagementType,
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
    },
    [
      activeEngagementType,
      canSelectWorkloadDepartment,
      selectedSemesterId,
      teachingWeekRange.selectedEndWeek,
      teachingWeekRange.selectedStartWeek,
      workloadDepartmentId,
    ],
  );

  useEffect(() => {
    if (hasAutoLoadedReportRef.current || !canLoadReport || loadingSemesters) {
      return;
    }

    hasAutoLoadedReportRef.current = true;
    void loadReport();
  }, [canLoadReport, loadReport, loadingSemesters]);

  const handleEngagementTypeChange = (nextKey: string) => {
    const nextEngagementType = nextKey as AcademicWorkloadEngagementFilter;

    setExportStatus('idle');
    setActiveEngagementType(nextEngagementType);

    if (selectedSemesterId && (reportEnvelope || loadingReport)) {
      void loadReport(nextEngagementType);
    }
  };

  const handleExportReportTable = useCallback(async () => {
    if (!canExportReportExcel || !reportEnvelope || reportRows.length === 0 || exportingExcel) {
      return;
    }

    setExportingExcel(true);

    try {
      await exportAcademicWorkloadReportExcel({
        departmentName: selectedDepartmentLabel,
        fileName: buildReportExcelFileName({
          engagementLabel: activeEngagementLabel,
          semesterLabel,
        }),
        rows: buildReportTableExcelRows(reportRows),
        schoolYear: selectedSemester?.schoolYear ?? null,
        sheetName: activeEngagementLabel,
        summaryLabel: `${activeEngagementLabel}小计`,
        summaryTotal: reportTotalHours,
        termNumber: selectedSemester?.termNumber ?? null,
      });
      setTemporaryExportStatus('exported');
    } catch {
      setTemporaryExportStatus('failed');
    } finally {
      setExportingExcel(false);
    }
  }, [
    activeEngagementLabel,
    canExportReportExcel,
    exportingExcel,
    reportEnvelope,
    reportRows,
    reportTotalHours,
    selectedDepartmentLabel,
    selectedSemester,
    semesterLabel,
    setTemporaryExportStatus,
  ]);
  const exportButtonLabel =
    exportStatus === 'exported' ? '已导出' : exportStatus === 'failed' ? '导出失败' : '导出 Excel';

  const columns = useMemo<ColumnsType<AcademicWorkloadReportTableRow>>(
    () => [
      {
        align: 'center',
        key: 'sequence',
        onCell: getReportMergedCellProps,
        render: (_, row) => row.sequence,
        title: '序号',
        width: 64,
      },
      {
        key: 'staffName',
        onCell: getReportMergedCellProps,
        render: (_, row) => (
          <span className="academic-workload-report-staff-name">
            {formatReportText(row.item.staffName)}
          </span>
        ),
        title: '姓名',
        width: 92,
      },
      {
        dataIndex: ['item', 'teachingClassName'],
        key: 'teachingClassName',
        onCell: (row) => getMarkableDetailCellProps(row, { isMarkStart: true }),
        render: (value: string) => renderTeachingClassName(value),
        title: '任课班级',
        width: 132,
      },
      {
        dataIndex: ['item', 'courseName'],
        key: 'courseName',
        onCell: (row) => getMarkableDetailCellProps(row),
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
        onCell: (row) => getMarkableDetailCellProps(row),
        render: (value: string) => formatReportText(value),
        title: '周课时',
        width: 68,
      },
      {
        align: 'right',
        dataIndex: ['item', 'weekCount'],
        key: 'weekCount',
        onCell: (row) => getMarkableDetailCellProps(row),
        render: (value: number) => formatReportText(value),
        title: '周数',
        width: 68,
      },
      {
        align: 'right',
        dataIndex: ['item', 'coefficient'],
        key: 'coefficient',
        onCell: (row) => getMarkableDetailCellProps(row),
        render: (value: string) => formatReportDecimal(value, 1),
        title: '系数',
        width: 68,
      },
      {
        align: 'right',
        dataIndex: ['item', 'hours'],
        key: 'hours',
        onCell: (row) => getMarkableDetailCellProps(row),
        render: (value: string) => (
          <span className="academic-workload-report-hour">{formatReportDecimal(value, 2)}</span>
        ),
        title: '课时',
        width: 92,
      },
      {
        align: 'right',
        key: 'totalHours',
        onCell: getReportMergedCellProps,
        render: (_, row) => (
          <span className="academic-workload-report-total-value">
            {formatReportDecimal(row.staffTotalHours, 2)}
          </span>
        ),
        title: '总课时',
        width: 92,
      },
    ],
    [getMarkableDetailCellProps],
  );

  return (
    <div className="academic-workload-report-page">
      <DecoratedPageHeader
        description="按归口系、教师类型和教学周范围生成教师工作量预报。"
        icon={<FileTextOutlined />}
        title="教师工作量预报统计表"
      />

      <section className="academic-workload-report-panel">
        {semesterError ? <Alert title={semesterError} showIcon type="error" /> : null}
        {departmentError ? <Alert title={departmentError} showIcon type="error" /> : null}

        {loadingSemesters ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          <div className="academic-workload-report-query">
            {reportEnvelope ? (
              <section className="academic-workload-report-overview">
                <div className="academic-workload-report-summary-heading">
                  <div>
                    <h2>当前预报</h2>
                    <p>
                      {formatTeachingWeekRangeLabel(teachingWeekRange)} · {selectedDepartmentLabel}{' '}
                      · {activeEngagementLabel}
                    </p>
                  </div>
                </div>

                <div className="academic-workload-report-metrics academic-workload-report-query-metrics">
                  <ReportMetric label="教师数" value={String(reportEnvelope.total.staffCount)} />
                  <ReportMetric label="课程行" value={String(reportEnvelope.total.itemCount)} />
                  <ReportMetric label="总课时" tone="primary" value={reportTotalHours} />
                </div>
              </section>
            ) : null}

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
                  placeholder={canSelectWorkloadDepartment ? '按名称筛选' : '当前账号归口系'}
                  value={workloadDepartmentId || undefined}
                  onChange={(value) => {
                    invalidateReport();
                    setWorkloadDepartmentId(
                      canSelectWorkloadDepartment
                        ? (value ?? '')
                        : defaultScopedWorkloadDepartmentId,
                    );
                  }}
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

            {isExternalTeacherRangeMode ? (
              <TeachingWeekRangeControl
                range={teachingWeekRange}
                title="外聘教师统计周范围"
                valueLabel={formatTeachingWeekRangeLabel(teachingWeekRange)}
              />
            ) : null}
          </div>
        )}
      </section>

      <Tabs
        activeKey={activeEngagementType}
        items={tabItems}
        tabBarExtraContent={{
          right: canExportReportExcel ? (
            <Space size={8}>
              <Button
                disabled={!reportEnvelope || loadingReport || reportRows.length === 0}
                icon={<DownloadOutlined />}
                loading={exportingExcel}
                size="small"
                onClick={() => {
                  void handleExportReportTable();
                }}
              >
                {exportButtonLabel}
              </Button>
            </Space>
          ) : null,
        }}
        onChange={handleEngagementTypeChange}
      />

      {reportError ? <Alert title={reportError} showIcon type="error" /> : null}

      {loadingReport ? <Skeleton active paragraph={{ rows: 8 }} /> : null}

      {!loadingReport && reportEnvelope ? (
        <div className="academic-workload-report-result">
          {!reportEnvelope.isValid ? (
            <Alert
              title="预报数据异常"
              description={reportEnvelope.invalidReason ?? '当前条件返回的数据未通过完整性校验。'}
              showIcon
              type="error"
            />
          ) : null}

          {!reportEnvelope.isComplete ? (
            <Alert
              title="预报可能不完整"
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
                scroll={{ x: REPORT_TABLE_BASE_WIDTH }}
                size="small"
                tableLayout="fixed"
                summary={() => renderAcademicWorkloadReportSummary(reportTotalHours)}
              />
            </div>
          )}
        </div>
      ) : null}

      {!loadingReport && !reportEnvelope && selectedSemesterId ? (
        <Alert
          title="选择条件后生成工作量预报"
          description="预报按教师合并序号、姓名和总课时，表尾总课时使用后端合计。"
          showIcon
          type="info"
        />
      ) : null}
    </div>
  );
}
