// src/features/academic-workload/ui/academic-workload-deduction-summary-page-content.tsx

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { BarChartOutlined, DownloadOutlined, ScheduleOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Select, Skeleton, Switch, Table, Tabs, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  type AcademicSemesterRecord,
  AcademicSemesterSelect,
  VISIBLE_ACADEMIC_SEMESTERS_QUERY_INPUT,
} from '@/entities/academic-semester';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import {
  ACADEMIC_WORKLOAD_DEDUCTION_SUMMARY_ENGAGEMENT_TABS as ENGAGEMENT_TABS,
  ACADEMIC_WORKLOAD_ENGAGEMENT_LABELS,
  ACADEMIC_WORKLOAD_ENGAGEMENT_ORDER,
  type AcademicTeacherEngagementType,
  type AcademicWorkloadEngagementFilter,
  getAcademicWorkloadEngagementLabel,
} from '../application/teacher-engagement';
import {
  formatAcademicWorkloadTeachingClassMultiline,
  splitAcademicWorkloadTeachingClassNames,
} from '../application/teaching-class-format';
import {
  buildTeachingWeekOptions,
  parseAcademicWorkloadIsoDate,
  pickNextSemesterId,
  sortSemesters,
  type TeachingWeekOption,
} from '../application/workload-baseline';
import {
  buildAcademicWorkloadDepartmentSelectOptions,
  DEFAULT_WORKLOAD_DEPARTMENT_ID,
  ensureSelectedAcademicWorkloadDepartmentOption,
} from '../application/workload-department-options';
import { requestAcademicSemesters } from '../infrastructure/academic-workload-api';
import {
  type AcademicWorkloadDeductionDateColumn,
  type AcademicWorkloadDeductionDepartmentSummary,
  type AcademicWorkloadDeductionStaffSummary,
  type AcademicWorkloadDeductionSummaryEnvelope,
  type AcademicWorkloadDeductionSummaryItem,
  type AcademicWorkloadDepartmentOption,
  requestAcademicWorkloadDeductionSummary,
  requestAcademicWorkloadDepartmentOptions,
} from '../infrastructure/academic-workload-deduction-summary-api';
import {
  type AcademicWorkloadDeductionExcelRow,
  exportAcademicWorkloadDeductionExcel,
} from '../infrastructure/academic-workload-deduction-summary-excel-export';

import {
  type MarkableDetailCellPropsGetter,
  useMarkableDetailCells,
} from './markable-detail-cells';
import { TeachingWeekRangeControl } from './teaching-week-range-control';
import { formatTeachingWeekRangeLabel, useTeachingWeekRange } from './teaching-week-range-state';

import './academic-workload-deduction-summary-page-content.css';

type EngagementTabKey = AcademicWorkloadEngagementFilter;

type DateAdjustmentSummary = {
  date: string;
  deductedHundredths: number;
  netHundredths: number;
  reasonLabels: string[];
  repeatedHundredths: number;
};

type AcademicWorkloadDeductionTableRow = {
  dateSummaries: Record<string, DateAdjustmentSummary>;
  detailRowIndex: number;
  item: AcademicWorkloadDeductionSummaryItem;
  key: string;
  sequence: number;
  staffKey: string;
  staffRowIndex: number;
  staffRowSpan: number;
  staffTotalHundredths: number;
  tableSubtotalHundredths: number;
};

export type AcademicWorkloadDeductionSummaryPageContentProps = {
  canSelectWorkloadDepartment?: boolean;
  defaultWorkloadDepartmentId?: string | null;
};

const DEDUCTION_TABLE_BASE_WIDTH = 832;
const DEDUCTION_DATE_COLUMN_WIDTH = 76;
const DEDUCTION_SUMMARY_COLUMN_WIDTH = 80;
const EMPTY_TEXT = '-';
const DEFAULT_DEDUCTION_ENGAGEMENT_TYPE: EngagementTabKey = 'FULL_TIME_TEACHER';
const ACADEMIC_WORKLOAD_DEDUCTION_MARKABLE_DETAIL_CELL_CLASS_NAMES = {
  evenCell: 'academic-workload-deduction-summary-detail-row-even',
  markedCell: 'academic-workload-deduction-summary-detail-cell-marked',
  markableCell: 'academic-workload-deduction-summary-markable-cell',
  markStartCell: 'academic-workload-deduction-summary-mark-start-cell',
  oddCell: 'academic-workload-deduction-summary-detail-row-odd',
};

const DEDUCTION_REASON_LABELS: Record<string, string> = {
  ACTIVITY: '活动',
  EXAM: '考试',
  HOLIDAY: '节假日',
  SPORTS_MEET: '运动会',
  WEEKDAY_SWAP: '调休',
};

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const TEACHER_ENGAGEMENT_TYPE_TAG_COLORS: Record<AcademicTeacherEngagementType, string> = {
  ADMINISTRATIVE_TEACHING: 'purple',
  EXTERNAL_TEACHER: 'orange',
  FULL_TIME_TEACHER: 'green',
  PUBLIC_WELFARE_POST: 'cyan',
};

function compareText(first: string | null | undefined, second: string | null | undefined) {
  return (first || '').localeCompare(second || '', 'zh-Hans-CN');
}

function parseHourToHundredths(value: string | null | undefined) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.round(numericValue * 100);
}

function formatHundredths(value: number) {
  const sign = value < 0 ? '-' : '';
  const absoluteValue = Math.abs(value);
  const roundedTenths = Math.round(absoluteValue / 10);
  const integerPart = Math.floor(roundedTenths / 10);
  const decimalPart = roundedTenths % 10;

  if (decimalPart === 0) {
    return `${sign}${integerPart}`;
  }

  return `${sign}${integerPart}.${decimalPart}`;
}

function formatHourString(value: string | null | undefined) {
  return formatHundredths(parseHourToHundredths(value));
}

function formatDeductedHundredths(value: number) {
  const absoluteValue = Math.abs(value);

  return absoluteValue === 0 ? '0' : `-${formatHundredths(absoluteValue)}`;
}

function formatDeductedHourString(value: string | null | undefined) {
  return formatDeductedHundredths(parseHourToHundredths(value));
}

function normalizeSourceEventType(value: string | null | undefined) {
  const normalizedValue = value?.trim().toUpperCase();

  return normalizedValue || null;
}

function formatDeductionReason(value: string | null | undefined) {
  const normalizedValue = normalizeSourceEventType(value);

  if (!normalizedValue) {
    return '未标注原因';
  }

  return DEDUCTION_REASON_LABELS[normalizedValue] ?? normalizedValue;
}

function formatDateColumnMonthDay(value: string) {
  const [, month, day] = value.split('-');

  if (!month || !day) {
    return value;
  }

  return `${Number(month)}月${Number(day)}日`;
}

function formatDateColumnWeekday(value: string) {
  const weekday = WEEKDAY_LABELS[parseAcademicWorkloadIsoDate(value).getUTCDay()];

  return weekday ? `周${weekday}` : '周-';
}

function findTeachingWeekByDate(value: string, teachingWeeks: readonly TeachingWeekOption[]) {
  return teachingWeeks.find((week) => week.startDate <= value && value <= week.endDate) ?? null;
}

function formatFullDate(value: string) {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${year}年${Number(month)}月${Number(day)}日`;
}

function buildDateSummaries(item: AcademicWorkloadDeductionSummaryItem) {
  return Object.fromEntries(
    item.dateAdjustments.map((adjustment) => [
      adjustment.date,
      {
        date: adjustment.date,
        deductedHundredths: parseHourToHundredths(adjustment.residualDeductedHours),
        netHundredths: parseHourToHundredths(adjustment.netAdjustmentHours),
        reasonLabels: adjustment.deductionSourceEventTypes.map(formatDeductionReason),
        repeatedHundredths: parseHourToHundredths(adjustment.repeatedHours),
      } satisfies DateAdjustmentSummary,
    ]),
  );
}

function sortDeductionItems(
  items: AcademicWorkloadDeductionSummaryItem[],
  options: { sortByEngagementType: boolean },
) {
  return [...items].sort((first, second) => {
    const departmentNameOrder = compareText(
      first.workloadDepartmentName,
      second.workloadDepartmentName,
    );

    if (departmentNameOrder !== 0) {
      return departmentNameOrder;
    }

    const departmentIdOrder = compareText(first.workloadDepartmentId, second.workloadDepartmentId);

    if (departmentIdOrder !== 0) {
      return departmentIdOrder;
    }

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
  });
}

function buildTableRows(
  items: AcademicWorkloadDeductionSummaryItem[],
  staffSummaries: AcademicWorkloadDeductionStaffSummary[],
  options: { sortByEngagementType: boolean },
) {
  const sortedItems = sortDeductionItems(items, options);
  const staffSummariesByKey = new Map(
    staffSummaries.map((summary) => [
      `${summary.workloadDepartmentId}::${summary.staffId}`,
      summary,
    ]),
  );
  const rows: AcademicWorkloadDeductionTableRow[] = [];
  let sequence = 0;
  let itemIndex = 0;

  for (let startIndex = 0; startIndex < sortedItems.length; ) {
    const firstItem = sortedItems[startIndex];
    const staffKey = `${firstItem.workloadDepartmentId}::${firstItem.staffId}`;
    const staffItems: AcademicWorkloadDeductionSummaryItem[] = [];
    let cursor = startIndex;

    while (
      cursor < sortedItems.length &&
      `${sortedItems[cursor].workloadDepartmentId}::${sortedItems[cursor].staffId}` === staffKey
    ) {
      staffItems.push(sortedItems[cursor]);
      cursor += 1;
    }

    sequence += 1;
    const staffTotalHundredths = parseHourToHundredths(
      staffSummariesByKey.get(staffKey)?.netAdjustmentHours,
    );

    staffItems.forEach((item, staffRowIndex) => {
      const detailRowIndex = itemIndex;

      rows.push({
        dateSummaries: buildDateSummaries(item),
        detailRowIndex,
        item,
        key: item.rowKey,
        sequence,
        staffKey,
        staffRowIndex,
        staffRowSpan: staffItems.length,
        staffTotalHundredths,
        tableSubtotalHundredths: parseHourToHundredths(item.netAdjustmentHours),
      });
      itemIndex += 1;
    });

    startIndex = cursor;
  }

  return rows;
}

function getMergedCellProps(row: AcademicWorkloadDeductionTableRow) {
  return {
    rowSpan: row.staffRowIndex === 0 ? row.staffRowSpan : 0,
  };
}

function renderHourCell(value: string | null | undefined) {
  return (
    <span className="academic-workload-deduction-summary-hour">{formatHourString(value)}</span>
  );
}

function renderDeductedHourCell(value: string | null | undefined) {
  return (
    <span className="academic-workload-deduction-summary-hour">
      {formatDeductedHourString(value)}
    </span>
  );
}

function renderTeachingClassName(value: string) {
  const teachingClassNames = splitAcademicWorkloadTeachingClassNames(value);

  if (teachingClassNames.length === 0) {
    return <span className="academic-workload-deduction-summary-class-name">{EMPTY_TEXT}</span>;
  }

  return (
    <Tooltip title={value}>
      <span className="academic-workload-deduction-summary-class-name">
        {teachingClassNames.map((teachingClassName, index) => (
          <span
            className="academic-workload-deduction-summary-class-name-item"
            key={`${teachingClassName}-${index}`}
          >
            {teachingClassName}
          </span>
        ))}
      </span>
    </Tooltip>
  );
}

function renderStackedColumnTitle(firstLine: string, secondLine: string) {
  return (
    <span className="academic-workload-deduction-summary-column-title-stacked">
      <span>{firstLine}</span>
      <span>{secondLine}</span>
    </span>
  );
}

function renderDateColumnTitle(
  column: AcademicWorkloadDeductionDateColumn,
  teachingWeeks: readonly TeachingWeekOption[],
) {
  const teachingWeek = findTeachingWeekByDate(column.date, teachingWeeks);
  const className = column.isRepeatedTeachingDate
    ? 'academic-workload-deduction-summary-date-column-title academic-workload-deduction-summary-repeat-date-column-title'
    : 'academic-workload-deduction-summary-date-column-title';

  return (
    <span className={className}>
      <span>{formatDateColumnMonthDay(column.date)}</span>
      <span>{teachingWeek ? `第${teachingWeek.value}周` : '第-周'}</span>
      <span>{formatDateColumnWeekday(column.date)}</span>
    </span>
  );
}

function getDateAdjustmentNetHundredths(summary: DateAdjustmentSummary) {
  return summary.netHundredths;
}

function getSignedHourClassName(value: number) {
  if (value > 0) {
    return 'academic-workload-deduction-summary-adjustment-positive';
  }

  if (value < 0) {
    return 'academic-workload-deduction-summary-adjustment-negative';
  }

  return '';
}

function renderSignedHour(value: number) {
  return (
    <span
      className={`academic-workload-deduction-summary-hour ${getSignedHourClassName(value)}`.trim()}
    >
      {formatHundredths(value)}
    </span>
  );
}

function DateAdjustmentCell({ summary }: { summary: DateAdjustmentSummary | undefined }) {
  if (!summary) {
    return <span className="academic-workload-deduction-summary-empty">0</span>;
  }

  const netHundredths = getDateAdjustmentNetHundredths(summary);
  const tooltipParts = [formatFullDate(summary.date)];

  if (summary.repeatedHundredths !== 0) {
    tooltipParts.push(`重复教学 ${formatHundredths(summary.repeatedHundredths)}`);
  }

  if (summary.deductedHundredths !== 0) {
    tooltipParts.push(
      `扣课 ${formatDeductedHundredths(summary.deductedHundredths)}`,
      summary.reasonLabels.join('、') || '未标注原因',
    );
  }

  return (
    <Tooltip title={tooltipParts.join(' · ')}>
      <span
        className={`academic-workload-deduction-summary-date-hour ${getSignedHourClassName(
          netHundredths,
        )}`.trim()}
      >
        {formatHundredths(netHundredths)}
      </span>
    </Tooltip>
  );
}

function getEngagementTabLabel(key: EngagementTabKey) {
  return getAcademicWorkloadEngagementLabel(key);
}

function renderDeductionTableSummary(input: {
  columnCount: number;
  label: string;
  totalHours: string;
}) {
  const totalHundredths = parseHourToHundredths(input.totalHours);

  return (
    <Table.Summary>
      <Table.Summary.Row className="academic-workload-deduction-summary-total-row">
        <Table.Summary.Cell
          align="center"
          className="academic-workload-deduction-summary-total-label"
          colSpan={input.columnCount - 1}
          index={0}
        >
          {input.label}
        </Table.Summary.Cell>
        <Table.Summary.Cell
          align="right"
          className="academic-workload-deduction-summary-total-value"
          index={input.columnCount - 1}
        >
          {renderSignedHour(totalHundredths)}
        </Table.Summary.Cell>
      </Table.Summary.Row>
    </Table.Summary>
  );
}

function formatTeachingClassExportValue(value: string) {
  return formatAcademicWorkloadTeachingClassMultiline(value, EMPTY_TEXT);
}

function formatDateColumnExportTitle(value: string, teachingWeeks: readonly TeachingWeekOption[]) {
  const teachingWeek = findTeachingWeekByDate(value, teachingWeeks);

  return [
    formatDateColumnMonthDay(value),
    teachingWeek ? `第${teachingWeek.value}周` : '第-周',
    formatDateColumnWeekday(value),
  ].join('\n');
}

function buildDeductionTableExcelRows(input: {
  dateColumns: AcademicWorkloadDeductionDateColumn[];
  rows: AcademicWorkloadDeductionTableRow[];
}): AcademicWorkloadDeductionExcelRow[] {
  return input.rows.map((row) => ({
    baselineTeachingWeekCount: row.item.baselineTeachingWeekCount,
    baselineWeeklyHours: formatHourString(row.item.baselineWeeklyHours),
    courseName: row.item.courseName || '未命名课程',
    dateValues: input.dateColumns.map((column) => {
      const summary = row.dateSummaries[column.date];

      return summary ? formatHundredths(getDateAdjustmentNetHundredths(summary)) : '0';
    }),
    sequence: row.sequence,
    staffId: row.item.staffId,
    staffName: row.item.staffName,
    staffRowIndex: row.staffRowIndex,
    staffRowSpan: row.staffRowSpan,
    staffTotal: formatHundredths(row.staffTotalHundredths),
    subtotal: formatHundredths(row.tableSubtotalHundredths),
    teachingClassName: formatTeachingClassExportValue(row.item.teachingClassName),
  }));
}

function buildDeductionExcelFileName(input: { engagementLabel: string; semesterLabel: string }) {
  return `教师扣课汇总-${input.semesterLabel}-${input.engagementLabel}.xlsx`;
}

function buildDeductionColumns(
  dateColumns: AcademicWorkloadDeductionDateColumn[],
  showTeacherTypeTag: boolean,
  teachingWeeks: readonly TeachingWeekOption[],
  getMarkableDetailCellProps: MarkableDetailCellPropsGetter<AcademicWorkloadDeductionTableRow>,
) {
  const columns: ColumnsType<AcademicWorkloadDeductionTableRow> = [
    {
      align: 'center',
      key: 'sequence',
      onCell: getMergedCellProps,
      render: (_, row) => row.sequence,
      title: '序号',
      width: 64,
    },
    {
      align: 'center',
      key: 'staffId',
      onCell: getMergedCellProps,
      render: (_, row) => row.item.staffId,
      title: '工号',
      width: 76,
    },
    {
      key: 'staffName',
      onCell: getMergedCellProps,
      render: (_, row) => (
        <span className="academic-workload-deduction-summary-staff">
          <strong>{row.item.staffName}</strong>
          {showTeacherTypeTag ? (
            <Tag color={TEACHER_ENGAGEMENT_TYPE_TAG_COLORS[row.item.teacherEngagementType]}>
              {ACADEMIC_WORKLOAD_ENGAGEMENT_LABELS[row.item.teacherEngagementType]}
            </Tag>
          ) : null}
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
      key: 'course',
      onCell: (row) => getMarkableDetailCellProps(row),
      render: (_, row) => (
        <span className="academic-workload-deduction-summary-course">
          <strong>{row.item.courseName || '未命名课程'}</strong>
        </span>
      ),
      title: '课程',
      width: 172,
    },
    {
      align: 'right',
      key: 'baselineWeeklyHours',
      onCell: (row) => getMarkableDetailCellProps(row),
      render: (_, row) => renderHourCell(row.item.baselineWeeklyHours),
      title: renderStackedColumnTitle('周课', '时'),
      width: 68,
    },
    {
      align: 'right',
      dataIndex: ['item', 'baselineTeachingWeekCount'],
      key: 'baselineTeachingWeekCount',
      onCell: (row) => getMarkableDetailCellProps(row),
      title: renderStackedColumnTitle('上课', '周数'),
      width: 68,
    },
    ...dateColumns.map((column) => ({
      align: 'right' as const,
      key: `date-${column.date}`,
      onCell: (row: AcademicWorkloadDeductionTableRow) => getMarkableDetailCellProps(row),
      render: (_: unknown, row: AcademicWorkloadDeductionTableRow) => (
        <DateAdjustmentCell summary={row.dateSummaries[column.date]} />
      ),
      title: (
        <Tooltip
          title={`${formatFullDate(column.date)}${
            column.isRepeatedTeachingDate ? ' · 重复教学日' : ''
          }`}
        >
          {renderDateColumnTitle(column, teachingWeeks)}
        </Tooltip>
      ),
      width: DEDUCTION_DATE_COLUMN_WIDTH,
    })),
    {
      align: 'right',
      key: 'subtotal',
      onCell: (row) => getMarkableDetailCellProps(row),
      render: (_, row) => renderSignedHour(row.tableSubtotalHundredths),
      title: '小计',
      width: DEDUCTION_SUMMARY_COLUMN_WIDTH,
    },
    {
      align: 'right',
      key: 'staffTotal',
      onCell: getMergedCellProps,
      render: (_, row) => renderSignedHour(row.staffTotalHundredths),
      title: '合计',
      width: DEDUCTION_SUMMARY_COLUMN_WIDTH,
    },
  ];

  return columns;
}

function buildDepartmentSummaryColumns() {
  const columns: ColumnsType<AcademicWorkloadDeductionDepartmentSummary> = [
    {
      key: 'department',
      render: (_, record) => (
        <span className="academic-workload-deduction-summary-department-name">
          <strong>{record.workloadDepartmentName || record.workloadDepartmentId}</strong>
          <small>{record.workloadDepartmentId}</small>
        </span>
      ),
      title: '归口系',
    },
    {
      align: 'right',
      dataIndex: 'staffCount',
      key: 'staffCount',
      title: '教师数',
      width: 92,
    },
    {
      align: 'right',
      dataIndex: 'itemCount',
      key: 'itemCount',
      title: '课程数',
      width: 92,
    },
    {
      align: 'right',
      dataIndex: 'residualDeductedHours',
      key: 'residualDeductedHours',
      render: (value: string) => renderDeductedHourCell(value),
      title: '扣课',
      width: 108,
    },
    {
      align: 'right',
      dataIndex: 'repeatedHours',
      key: 'repeatedHours',
      render: (value: string) => renderHourCell(value),
      title: '增加课时',
      width: 108,
    },
  ];

  return columns;
}

function SummaryMetric({
  label,
  tone = 'default',
  value,
}: {
  label: string;
  tone?: 'danger' | 'default' | 'success';
  value: string;
}) {
  return (
    <div
      className={`academic-workload-deduction-summary-metric academic-workload-deduction-summary-metric-${tone}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function AcademicWorkloadDeductionSummaryPageContent({
  canSelectWorkloadDepartment: rawCanSelectWorkloadDepartment = false,
  defaultWorkloadDepartmentId = null,
}: AcademicWorkloadDeductionSummaryPageContentProps) {
  const isAdminViewer = Boolean(rawCanSelectWorkloadDepartment);
  const scopedDepartmentId = defaultWorkloadDepartmentId?.trim() || '';
  const latestRequestIdRef = useRef(0);
  const hasAutoLoadedSummaryRef = useRef(false);
  const exportStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [workloadDepartmentId, setWorkloadDepartmentId] = useState(
    isAdminViewer ? DEFAULT_WORKLOAD_DEPARTMENT_ID : scopedDepartmentId,
  );
  const [departmentRecords, setDepartmentRecords] = useState<AcademicWorkloadDepartmentOption[]>(
    [],
  );
  const [activeEngagementType, setActiveEngagementType] = useState<EngagementTabKey>(
    DEFAULT_DEDUCTION_ENGAGEMENT_TYPE,
  );
  const [showSportsMeetDeductions, setShowSportsMeetDeductions] = useState(true);
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportStatus, setExportStatus] = useState<'exported' | 'failed' | 'idle'>('idle');
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryEnvelope, setSummaryEnvelope] =
    useState<AcademicWorkloadDeductionSummaryEnvelope | null>(null);
  const { clearMarkedDetailRows, getMarkableDetailCellProps } =
    useMarkableDetailCells<AcademicWorkloadDeductionTableRow>(
      ACADEMIC_WORKLOAD_DEDUCTION_MARKABLE_DETAIL_CELL_CLASS_NAMES,
    );

  const invalidateSummary = useCallback(() => {
    latestRequestIdRef.current += 1;
    clearMarkedDetailRows();
    setSummaryEnvelope(null);
    setSummaryError(null);
    setLoadingSummary(false);
  }, [clearMarkedDetailRows]);

  const setTemporaryExportStatus = useCallback((status: 'exported' | 'failed') => {
    setExportStatus(status);

    if (exportStatusTimerRef.current) {
      clearTimeout(exportStatusTimerRef.current);
    }

    exportStatusTimerRef.current = setTimeout(() => {
      setExportStatus('idle');
      exportStatusTimerRef.current = null;
    }, 1600);
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
        const result = sortSemesters(
          await requestAcademicSemesters(VISIBLE_ACADEMIC_SEMESTERS_QUERY_INPUT),
        );

        if (cancelled) {
          return;
        }

        setSemesters(result);
        setSelectedSemesterId((currentValue) => pickNextSemesterId(result, currentValue));
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
    invalidateSummary();
  }, [invalidateSummary, selectedSemesterId]);

  useEffect(() => {
    if (isAdminViewer) {
      return;
    }

    if (workloadDepartmentId !== scopedDepartmentId) {
      invalidateSummary();
      setWorkloadDepartmentId(scopedDepartmentId);
    }
  }, [invalidateSummary, isAdminViewer, scopedDepartmentId, workloadDepartmentId]);

  const selectedSemester = useMemo(
    () => semesters.find((semester) => semester.id === selectedSemesterId) ?? null,
    [selectedSemesterId, semesters],
  );

  const teachingWeeks = useMemo(
    () => buildTeachingWeekOptions(selectedSemester),
    [selectedSemester],
  );
  const teachingWeekRange = useTeachingWeekRange(teachingWeeks, {
    onRangeChange: invalidateSummary,
  });
  const isExternalTeacherRangeMode = activeEngagementType === 'EXTERNAL_TEACHER';

  const deferredActiveEngagementType = useDeferredValue(activeEngagementType);
  const deferredSummaryEnvelope = useDeferredValue(summaryEnvelope);
  const isDeductionRenderPending =
    deferredActiveEngagementType !== activeEngagementType ||
    deferredSummaryEnvelope !== summaryEnvelope;
  const visibleDepartmentSummaries = deferredSummaryEnvelope?.departmentSummaries ?? [];
  const deductionRows = useMemo(
    () =>
      buildTableRows(
        deferredSummaryEnvelope?.items ?? [],
        deferredSummaryEnvelope?.staffSummaries ?? [],
        {
          sortByEngagementType: deferredActiveEngagementType === 'ALL',
        },
      ),
    [deferredActiveEngagementType, deferredSummaryEnvelope],
  );
  const deductionDateColumns = useMemo(
    () => deferredSummaryEnvelope?.dateColumns ?? [],
    [deferredSummaryEnvelope],
  );
  const deductionTotalHours = deferredSummaryEnvelope?.total.netAdjustmentHours ?? '0';
  const deductionColumns = useMemo(
    () =>
      buildDeductionColumns(
        deductionDateColumns,
        deferredActiveEngagementType === 'ALL',
        teachingWeeks,
        getMarkableDetailCellProps,
      ),
    [deferredActiveEngagementType, deductionDateColumns, getMarkableDetailCellProps, teachingWeeks],
  );
  const deductionSummaryLabel = `${getEngagementTabLabel(deferredActiveEngagementType)}小计`;

  const departmentOptions = useMemo(() => {
    const baseOptions = buildAcademicWorkloadDepartmentSelectOptions(departmentRecords);

    return ensureSelectedAcademicWorkloadDepartmentOption({
      fallbackLabel: isAdminViewer ? '默认归口系' : '当前归口系',
      options: baseOptions,
      selectedDepartmentId: workloadDepartmentId,
    });
  }, [departmentRecords, isAdminViewer, workloadDepartmentId]);

  const departmentSummaryColumns = useMemo(() => buildDepartmentSummaryColumns(), []);

  const tabItems = useMemo(
    () =>
      ENGAGEMENT_TABS.filter((item) => !item.hidden).map((item) => ({
        key: item.key,
        label: item.label,
      })),
    [],
  );

  const loadSummary = useCallback(
    async (
      nextEngagementType: EngagementTabKey = activeEngagementType,
      includeSportsMeetDeductions = showSportsMeetDeductions,
    ) => {
      if (!selectedSemesterId) {
        return;
      }

      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      setLoadingSummary(true);
      setSummaryError(null);
      setSummaryEnvelope(null);

      try {
        const shouldUseTeachingWeekRange = nextEngagementType === 'EXTERNAL_TEACHER';
        const result = await requestAcademicWorkloadDeductionSummary({
          endDate: shouldUseTeachingWeekRange
            ? teachingWeekRange.selectedEndWeek?.endDate
            : undefined,
          includeSportsMeetDeductions,
          semesterId: selectedSemesterId,
          startDate: shouldUseTeachingWeekRange
            ? teachingWeekRange.selectedStartWeek?.startDate
            : undefined,
          teacherEngagementType: nextEngagementType === 'ALL' ? undefined : nextEngagementType,
          workloadDepartmentId,
        });

        if (latestRequestIdRef.current === requestId) {
          setSummaryEnvelope(result.summary);
        }
      } catch (error) {
        if (latestRequestIdRef.current === requestId) {
          setSummaryError(error instanceof Error ? error.message : '暂时无法加载教师扣课汇总。');
        }
      } finally {
        if (latestRequestIdRef.current === requestId) {
          setLoadingSummary(false);
        }
      }
    },
    [
      activeEngagementType,
      selectedSemesterId,
      showSportsMeetDeductions,
      teachingWeekRange.selectedEndWeek,
      teachingWeekRange.selectedStartWeek,
      workloadDepartmentId,
    ],
  );

  const handleEngagementTypeChange = (nextKey: string) => {
    const nextEngagementType = nextKey as EngagementTabKey;

    setActiveEngagementType(nextEngagementType);

    if (selectedSemesterId && (summaryEnvelope || loadingSummary)) {
      void loadSummary(nextEngagementType);
    }
  };

  const activeEngagementLabel = getEngagementTabLabel(activeEngagementType);
  const canExportDeductionExcel = activeEngagementType !== 'EXTERNAL_TEACHER';
  const canLoadSummary =
    Boolean(selectedSemesterId) && (isAdminViewer || Boolean(workloadDepartmentId));
  const semesterLabel = selectedSemester?.name ?? `学期 ${selectedSemesterId}`;
  const selectedDepartmentOption = departmentOptions.find(
    (option) => option.value === workloadDepartmentId,
  );
  const selectedDepartmentLabel =
    selectedDepartmentOption?.label ?? (workloadDepartmentId || '全部归口系');
  const summaryContextLabel = `${formatTeachingWeekRangeLabel(
    teachingWeekRange,
  )} · ${selectedDepartmentLabel} · ${activeEngagementLabel}`;
  const shouldShowDepartmentSummary = isAdminViewer && visibleDepartmentSummaries.length > 1;

  useEffect(() => {
    if (hasAutoLoadedSummaryRef.current || !canLoadSummary || loadingSemesters) {
      return;
    }

    hasAutoLoadedSummaryRef.current = true;
    void loadSummary();
  }, [canLoadSummary, loadSummary, loadingSemesters]);

  const handleExportDeductionTable = useCallback(async () => {
    if (!canExportDeductionExcel || deductionRows.length === 0 || exportingExcel) {
      return;
    }

    setExportingExcel(true);

    try {
      await exportAcademicWorkloadDeductionExcel({
        dateHeaders: deductionDateColumns.map((column) =>
          formatDateColumnExportTitle(column.date, teachingWeeks),
        ),
        departmentName: selectedDepartmentLabel,
        fileName: buildDeductionExcelFileName({
          engagementLabel: activeEngagementLabel,
          semesterLabel,
        }),
        rows: buildDeductionTableExcelRows({
          dateColumns: deductionDateColumns,
          rows: deductionRows,
        }),
        schoolYear: selectedSemester?.schoolYear ?? null,
        sheetName: activeEngagementLabel,
        summaryLabel: deductionSummaryLabel,
        summaryTotal: formatHourString(deductionTotalHours),
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
    canExportDeductionExcel,
    deductionDateColumns,
    deductionRows,
    deductionSummaryLabel,
    deductionTotalHours,
    exportingExcel,
    selectedDepartmentLabel,
    selectedSemester,
    semesterLabel,
    setTemporaryExportStatus,
    teachingWeeks,
  ]);
  const exportButtonLabel =
    exportStatus === 'exported' ? '已导出' : exportStatus === 'failed' ? '导出失败' : '导出 Excel';

  return (
    <div className="academic-workload-deduction-summary-page">
      <DecoratedPageHeader
        description="按归口系、教师类型和教学周范围汇总教师扣课课时。"
        icon={<ScheduleOutlined />}
        title="教师节假日扣课时统计表"
      />

      <section className="academic-workload-deduction-summary-panel">
        {semesterError ? <Alert title={semesterError} showIcon type="error" /> : null}
        {departmentError ? <Alert title={departmentError} showIcon type="error" /> : null}

        {loadingSemesters ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          <div className="academic-workload-deduction-summary-query">
            {summaryEnvelope ? (
              <section className="academic-workload-deduction-summary-overview">
                <div className="academic-workload-deduction-summary-summary-heading">
                  <div>
                    <h2>当前汇总</h2>
                    <p>{summaryContextLabel}</p>
                  </div>
                  <label className="academic-workload-deduction-summary-summary-option">
                    <span>计入运动会扣课</span>
                    <Switch
                      checked={showSportsMeetDeductions}
                      size="small"
                      onChange={(checked) => {
                        setShowSportsMeetDeductions(checked);
                        void loadSummary(activeEngagementType, checked);
                      }}
                    />
                  </label>
                </div>

                <div className="academic-workload-deduction-summary-metrics academic-workload-deduction-summary-query-metrics">
                  <SummaryMetric label="教师数" value={String(summaryEnvelope.total.staffCount)} />
                  <SummaryMetric label="课程数" value={String(summaryEnvelope.total.itemCount)} />
                  <SummaryMetric
                    label="扣课"
                    tone="danger"
                    value={formatDeductedHourString(summaryEnvelope.total.residualDeductedHours)}
                  />
                </div>
              </section>
            ) : null}

            <div className="academic-workload-deduction-summary-filters">
              <label>
                <span>学期</span>
                <AcademicSemesterSelect
                  aria-label="学期"
                  placeholder="选择学期"
                  records={semesters}
                  value={selectedSemesterId ?? undefined}
                  onChange={(value) => setSelectedSemesterId(value)}
                />
              </label>

              <label>
                <span>归口系</span>
                <Select
                  allowClear={isAdminViewer}
                  showSearch
                  aria-label="归口系"
                  disabled={!isAdminViewer}
                  loading={loadingDepartments}
                  optionFilterProp="label"
                  options={departmentOptions}
                  placeholder={isAdminViewer ? '按名称筛选' : '当前账号归口系'}
                  value={workloadDepartmentId || undefined}
                  onChange={(value) => {
                    invalidateSummary();
                    setWorkloadDepartmentId(isAdminViewer ? (value ?? '') : scopedDepartmentId);
                  }}
                />
              </label>

              <Button
                icon={<BarChartOutlined />}
                type="primary"
                disabled={!canLoadSummary}
                loading={loadingSummary}
                onClick={() => {
                  void loadSummary();
                }}
              >
                生成汇总表
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
        tabBarExtraContent={
          canExportDeductionExcel
            ? {
                right: (
                  <Button
                    disabled={
                      !summaryEnvelope || isDeductionRenderPending || deductionRows.length === 0
                    }
                    icon={<DownloadOutlined />}
                    loading={exportingExcel}
                    size="small"
                    onClick={() => {
                      void handleExportDeductionTable();
                    }}
                  >
                    {exportButtonLabel}
                  </Button>
                ),
              }
            : undefined
        }
        onChange={handleEngagementTypeChange}
      />

      {summaryError ? <Alert title={summaryError} showIcon type="error" /> : null}

      {loadingSummary ? <Skeleton active paragraph={{ rows: 8 }} /> : null}

      {!loadingSummary && summaryEnvelope ? (
        <div className="academic-workload-deduction-summary-result">
          {!summaryEnvelope.isValid ? (
            <Alert
              title="结果数据异常"
              description={summaryEnvelope.invalidReason ?? '当前条件返回的数据不可用于汇总。'}
              showIcon
              type="error"
            />
          ) : null}

          {!summaryEnvelope.isComplete ? (
            <Alert
              title="结果可能不完整"
              description={summaryEnvelope.truncationReason ?? '当前结果被截断，请谨慎使用。'}
              showIcon
              type="warning"
            />
          ) : null}

          {!isDeductionRenderPending && shouldShowDepartmentSummary ? (
            <section className="academic-workload-deduction-summary-soft-card">
              <details>
                <summary>
                  <span>归口系小计</span>
                  <small>{visibleDepartmentSummaries.length} 个归口系</small>
                </summary>
                <div className="academic-workload-deduction-summary-soft-card-body">
                  <div className="academic-workload-deduction-summary-table-shell">
                    <Table<AcademicWorkloadDeductionDepartmentSummary>
                      columns={departmentSummaryColumns}
                      dataSource={visibleDepartmentSummaries}
                      pagination={false}
                      rowKey={(record) => record.workloadDepartmentId}
                      scroll={{ x: 720 }}
                      size="small"
                      tableLayout="fixed"
                    />
                  </div>
                </div>
              </details>
            </section>
          ) : null}

          {isDeductionRenderPending ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <div className="academic-workload-deduction-summary-table-shell">
              <Table<AcademicWorkloadDeductionTableRow>
                columns={deductionColumns}
                dataSource={deductionRows}
                locale={{
                  emptyText: (
                    <Empty
                      description="当前条件下没有课程记录。"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ),
                }}
                pagination={false}
                rowKey={(row) => row.key}
                scroll={{
                  x:
                    DEDUCTION_TABLE_BASE_WIDTH +
                    deductionDateColumns.length * DEDUCTION_DATE_COLUMN_WIDTH,
                }}
                size="small"
                tableLayout="fixed"
                summary={() =>
                  renderDeductionTableSummary({
                    columnCount: deductionColumns.length,
                    label: deductionSummaryLabel,
                    totalHours: deductionTotalHours,
                  })
                }
              />
            </div>
          )}
        </div>
      ) : null}

      {!loadingSummary && !summaryEnvelope && selectedSemesterId ? (
        <Alert
          title="选择条件后生成汇总表"
          description="表格将按教师合并工号、姓名和教师合计。"
          showIcon
          type="info"
        />
      ) : null}
    </div>
  );
}
