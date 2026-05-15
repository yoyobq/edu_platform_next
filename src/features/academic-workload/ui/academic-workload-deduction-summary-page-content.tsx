// src/features/academic-workload/ui/academic-workload-deduction-summary-page-content.tsx
import {
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BarChartOutlined, DownloadOutlined, ScheduleOutlined } from '@ant-design/icons';
import type { SliderSingleProps } from 'antd';
import {
  Alert,
  Button,
  Empty,
  Select,
  Skeleton,
  Slider,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
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
  buildTeachingWeekMonthMarkValues,
  buildTeachingWeekOptions,
  formatTeachingWeekRange,
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
import {
  type AcademicWorkloadDeductionDepartmentSummary,
  type AcademicWorkloadDeductionSummaryEnvelope,
  type AcademicWorkloadDeductionSummaryItem,
  type AcademicWorkloadDeductionSummaryTotal,
  type AcademicWorkloadDepartmentOption,
  requestAcademicWorkloadDeductionSummary,
  requestAcademicWorkloadDepartmentOptions,
} from '../infrastructure/academic-workload-deduction-summary-api';
import {
  type AcademicWorkloadDeductionExcelRow,
  exportAcademicWorkloadDeductionExcel,
} from '../infrastructure/academic-workload-deduction-summary-excel-export';

import './academic-workload-deduction-summary-page-content.css';

type EngagementTabKey = AcademicWorkloadEngagementFilter;

type DateAdjustmentSummary = {
  date: string;
  deductedHundredths: number;
  hasHourValue: boolean;
  reasonLabels: string[];
};

type VisibleDeductionReasonDateSummary = {
  date: string;
  deductedHundredths: number;
};

type VisibleDeductionReasonSummary = {
  dateSummaries: VisibleDeductionReasonDateSummary[];
  deductedHundredths: number;
  sourceEventType: string | null;
};

type VisibleDeductionItem = {
  item: AcademicWorkloadDeductionSummaryItem;
  tableSubtotalHundredths: number;
  visibleAddedHundredths: number;
  visibleBaselineHundredths: number;
  visibleDeductedHundredths: number;
  visibleReasonSummaries: VisibleDeductionReasonSummary[];
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

const DEDUCTION_TABLE_BASE_WIDTH = 864;
const DEDUCTION_DATE_COLUMN_WIDTH = 76;
const EMPTY_TEXT = '-';
const SPORTS_MEET_SOURCE_EVENT_TYPE = 'SPORTS_MEET';

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

function formatShortDate(value: string) {
  const [, month, day] = value.split('-');

  if (!month || !day) {
    return value;
  }

  return `${Number(month)}月${Number(day)}日`;
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

function isSportsMeetSource(value: string | null | undefined) {
  return normalizeSourceEventType(value) === SPORTS_MEET_SOURCE_EVENT_TYPE;
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

function ensureDateSummary(
  summaries: Record<string, DateAdjustmentSummary>,
  date: string,
): DateAdjustmentSummary {
  summaries[date] ??= {
    date,
    deductedHundredths: 0,
    hasHourValue: false,
    reasonLabels: [],
  };

  return summaries[date];
}

function addReasonLabel(summary: DateAdjustmentSummary, reasonLabel: string) {
  if (!summary.reasonLabels.includes(reasonLabel)) {
    summary.reasonLabels.push(reasonLabel);
  }
}

function buildVisibleReasonSummaries(
  item: AcademicWorkloadDeductionSummaryItem,
  options: { showSportsMeetDeductions: boolean },
) {
  return item.deductionReasonSummaries
    .filter(
      (reasonSummary) =>
        options.showSportsMeetDeductions || !isSportsMeetSource(reasonSummary.sourceEventType),
    )
    .map<VisibleDeductionReasonSummary>((reasonSummary) => ({
      dateSummaries: reasonSummary.dateSummaries
        .map((dateSummary) => ({
          date: dateSummary.date,
          deductedHundredths: parseHourToHundredths(dateSummary.deductedHours),
        }))
        .filter((dateSummary) => dateSummary.date && dateSummary.deductedHundredths !== 0),
      deductedHundredths: parseHourToHundredths(reasonSummary.deductedHours),
      sourceEventType: reasonSummary.sourceEventType,
    }))
    .filter((reasonSummary) => reasonSummary.deductedHundredths !== 0);
}

function buildDateSummaries(reasonSummaries: VisibleDeductionReasonSummary[]) {
  const summaries: Record<string, DateAdjustmentSummary> = {};

  reasonSummaries.forEach((reasonSummary) => {
    const reasonLabel = formatDeductionReason(reasonSummary.sourceEventType);

    reasonSummary.dateSummaries.forEach((dateSummary) => {
      const summary = ensureDateSummary(summaries, dateSummary.date);

      summary.deductedHundredths += dateSummary.deductedHundredths;
      summary.hasHourValue = true;
      addReasonLabel(summary, reasonLabel);
    });
  });

  return summaries;
}

function buildVisibleDeductionItems(
  items: AcademicWorkloadDeductionSummaryItem[],
  options: { showSportsMeetDeductions: boolean },
): VisibleDeductionItem[] {
  return items.map((item) => {
    const visibleReasonSummaries = buildVisibleReasonSummaries(item, options);
    const visibleDeductedHundredths = visibleReasonSummaries.reduce(
      (total, reasonSummary) => total + reasonSummary.deductedHundredths,
      0,
    );
    const visibleAddedHundredths = parseHourToHundredths(item.addedHours);

    return {
      item,
      tableSubtotalHundredths: visibleDeductedHundredths,
      visibleAddedHundredths,
      visibleBaselineHundredths: parseHourToHundredths(item.baselineHours),
      visibleDeductedHundredths,
      visibleReasonSummaries,
    };
  });
}

function buildVisibleTotal(records: VisibleDeductionItem[]): AcademicWorkloadDeductionSummaryTotal {
  const staffKeys = new Set<string>();
  const totals = records.reduce(
    (summary, record) => {
      staffKeys.add(`${record.item.workloadDepartmentId}::${record.item.staffId}`);
      summary.addedHundredths += record.visibleAddedHundredths;
      summary.baselineHundredths += record.visibleBaselineHundredths;
      summary.deductedHundredths += record.visibleDeductedHundredths;
      return summary;
    },
    {
      addedHundredths: 0,
      baselineHundredths: 0,
      deductedHundredths: 0,
    },
  );

  return {
    addedHours: formatHundredths(totals.addedHundredths),
    baselineHours: formatHundredths(totals.baselineHundredths),
    deductedHours: formatHundredths(totals.deductedHundredths),
    itemCount: records.length,
    staffCount: staffKeys.size,
  };
}

function buildVisibleDepartmentSummaries(
  records: VisibleDeductionItem[],
): AcademicWorkloadDeductionDepartmentSummary[] {
  type DepartmentSummaryAccumulator = {
    addedHundredths: number;
    baselineHundredths: number;
    deductedHundredths: number;
    itemCount: number;
    staffKeys: Set<string>;
    workloadDepartmentId: string;
    workloadDepartmentName: string;
  };

  const summariesByDepartment = new Map<string, DepartmentSummaryAccumulator>();

  records.forEach((record) => {
    const departmentId = record.item.workloadDepartmentId;
    const summary = summariesByDepartment.get(departmentId) ?? {
      addedHundredths: 0,
      baselineHundredths: 0,
      deductedHundredths: 0,
      itemCount: 0,
      staffKeys: new Set<string>(),
      workloadDepartmentId: departmentId,
      workloadDepartmentName: record.item.workloadDepartmentName,
    };

    summary.addedHundredths += record.visibleAddedHundredths;
    summary.baselineHundredths += record.visibleBaselineHundredths;
    summary.deductedHundredths += record.visibleDeductedHundredths;
    summary.itemCount += 1;
    summary.staffKeys.add(`${record.item.workloadDepartmentId}::${record.item.staffId}`);
    summariesByDepartment.set(departmentId, summary);
  });

  return Array.from(summariesByDepartment.values())
    .map((summary) => ({
      addedHours: formatHundredths(summary.addedHundredths),
      baselineHours: formatHundredths(summary.baselineHundredths),
      deductedHours: formatHundredths(summary.deductedHundredths),
      itemCount: summary.itemCount,
      staffCount: summary.staffKeys.size,
      workloadDepartmentId: summary.workloadDepartmentId,
      workloadDepartmentName: summary.workloadDepartmentName,
    }))
    .sort((first, second) =>
      compareText(first.workloadDepartmentName, second.workloadDepartmentName),
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

function sortVisibleDeductionItems(
  records: VisibleDeductionItem[],
  options: { sortByEngagementType: boolean },
) {
  const sortedItems = sortDeductionItems(
    records.map((record) => record.item),
    options,
  );
  const recordsByItem = new Map(records.map((record) => [record.item, record]));

  return sortedItems
    .map((item) => recordsByItem.get(item))
    .filter((record): record is VisibleDeductionItem => Boolean(record));
}

function buildTableRows(items: VisibleDeductionItem[], options: { sortByEngagementType: boolean }) {
  const sortedItems = sortVisibleDeductionItems(items, options);
  const rows: AcademicWorkloadDeductionTableRow[] = [];
  let sequence = 0;
  let itemIndex = 0;

  for (let startIndex = 0; startIndex < sortedItems.length; ) {
    const firstRecord = sortedItems[startIndex];
    const firstItem = firstRecord.item;
    const staffKey = `${firstItem.workloadDepartmentId}::${firstItem.staffId}`;
    const staffItems: VisibleDeductionItem[] = [];
    let cursor = startIndex;

    while (
      cursor < sortedItems.length &&
      `${sortedItems[cursor].item.workloadDepartmentId}::${sortedItems[cursor].item.staffId}` ===
        staffKey
    ) {
      staffItems.push(sortedItems[cursor]);
      cursor += 1;
    }

    sequence += 1;
    const staffTotalHundredths = staffItems.reduce(
      (total, record) => total + record.tableSubtotalHundredths,
      0,
    );

    staffItems.forEach((record, staffRowIndex) => {
      const { item } = record;
      const detailRowIndex = itemIndex;

      rows.push({
        dateSummaries: buildDateSummaries(record.visibleReasonSummaries),
        detailRowIndex,
        item,
        key: [
          item.workloadDepartmentId,
          item.staffId,
          item.teachingClassName,
          item.courseName ?? 'course',
          detailRowIndex,
        ].join('::'),
        sequence,
        staffKey,
        staffRowIndex,
        staffRowSpan: staffItems.length,
        staffTotalHundredths,
        tableSubtotalHundredths: record.tableSubtotalHundredths,
      });
      itemIndex += 1;
    });

    startIndex = cursor;
  }

  return rows;
}

function collectDateColumns(rows: AcademicWorkloadDeductionTableRow[]) {
  const dates = new Set<string>();

  rows.forEach((row) => {
    Object.entries(row.dateSummaries).forEach(([date, summary]) => {
      if (summary.hasHourValue) {
        dates.add(date);
      }
    });
  });

  return Array.from(dates).sort();
}

function getDetailCellClassName(row: AcademicWorkloadDeductionTableRow) {
  return row.detailRowIndex % 2 === 0
    ? 'academic-workload-deduction-summary-detail-cell-even'
    : 'academic-workload-deduction-summary-detail-cell-odd';
}

function getDeductionRowClassName(row: AcademicWorkloadDeductionTableRow) {
  return row.detailRowIndex % 2 === 0
    ? 'academic-workload-deduction-summary-detail-row-even'
    : 'academic-workload-deduction-summary-detail-row-odd';
}

function getDetailCellProps(row: AcademicWorkloadDeductionTableRow) {
  return {
    className: getDetailCellClassName(row),
  };
}

function renderMergedCell(
  children: ReactNode,
  row: AcademicWorkloadDeductionTableRow,
  className?: string,
) {
  return {
    children,
    props: {
      className,
      rowSpan: row.staffRowIndex === 0 ? row.staffRowSpan : 0,
    },
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

function renderDateColumnTitle(value: string, teachingWeeks: readonly TeachingWeekOption[]) {
  const teachingWeek = findTeachingWeekByDate(value, teachingWeeks);

  return (
    <span className="academic-workload-deduction-summary-date-column-title">
      <span>{formatDateColumnMonthDay(value)}</span>
      <span>{teachingWeek ? `第${teachingWeek.value}周` : '第-周'}</span>
      <span>{formatDateColumnWeekday(value)}</span>
    </span>
  );
}

function DateAdjustmentCell({ summary }: { summary: DateAdjustmentSummary | undefined }) {
  if (!summary) {
    return <span className="academic-workload-deduction-summary-empty">0</span>;
  }

  if (!summary.hasHourValue) {
    return <span className="academic-workload-deduction-summary-empty">0</span>;
  }

  return (
    <Tooltip
      title={`${formatFullDate(summary.date)} · 扣课 ${formatDeductedHundredths(
        summary.deductedHundredths,
      )} · ${summary.reasonLabels.join('、') || '未标注原因'}`}
    >
      <span className="academic-workload-deduction-summary-date-hour academic-workload-deduction-summary-total-hour">
        {formatDeductedHundredths(summary.deductedHundredths)}
      </span>
    </Tooltip>
  );
}

function getEngagementTabLabel(key: EngagementTabKey) {
  return getAcademicWorkloadEngagementLabel(key);
}

function getDeductionTableTotalHundredths(rows: AcademicWorkloadDeductionTableRow[]) {
  return rows.reduce(
    (total, row) => (row.staffRowIndex === 0 ? total + row.staffTotalHundredths : total),
    0,
  );
}

function renderDeductionTableSummary(input: {
  columnCount: number;
  label: string;
  rows: AcademicWorkloadDeductionTableRow[];
}) {
  const totalHundredths = getDeductionTableTotalHundredths(input.rows);

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
          <span className="academic-workload-deduction-summary-hour">
            {formatDeductedHundredths(totalHundredths)}
          </span>
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
  dateColumns: string[];
  rows: AcademicWorkloadDeductionTableRow[];
}): AcademicWorkloadDeductionExcelRow[] {
  return input.rows.map((row) => ({
    baselineTeachingWeekCount: row.item.baselineTeachingWeekCount,
    baselineWeeklyHours: formatHourString(row.item.baselineWeeklyHours),
    courseName: row.item.courseName || '未命名课程',
    dateValues: input.dateColumns.map((date) => {
      const summary = row.dateSummaries[date];

      return summary?.hasHourValue ? formatDeductedHundredths(summary.deductedHundredths) : '0';
    }),
    sequence: row.sequence,
    staffId: row.item.staffId,
    staffName: row.item.staffName,
    staffRowIndex: row.staffRowIndex,
    staffRowSpan: row.staffRowSpan,
    staffTotal: formatDeductedHundredths(row.staffTotalHundredths),
    subtotal: formatDeductedHundredths(row.tableSubtotalHundredths),
    teachingClassName: formatTeachingClassExportValue(row.item.teachingClassName),
  }));
}

function buildDeductionExcelFileName(input: { engagementLabel: string; semesterLabel: string }) {
  return `教师扣课汇总-${input.semesterLabel}-${input.engagementLabel}.xlsx`;
}

function buildDeductionColumns(
  dateColumns: string[],
  showTeacherTypeTag: boolean,
  teachingWeeks: readonly TeachingWeekOption[],
) {
  const columns: ColumnsType<AcademicWorkloadDeductionTableRow> = [
    {
      align: 'center',
      key: 'sequence',
      render: (_, row) => renderMergedCell(row.sequence, row),
      title: '序号',
      width: 64,
    },
    {
      align: 'center',
      key: 'staffId',
      render: (_, row) => renderMergedCell(row.item.staffId, row),
      title: '工号',
      width: 76,
    },
    {
      key: 'staffName',
      render: (_, row) =>
        renderMergedCell(
          <span className="academic-workload-deduction-summary-staff">
            <strong>{row.item.staffName}</strong>
            {showTeacherTypeTag ? (
              <Tag color={TEACHER_ENGAGEMENT_TYPE_TAG_COLORS[row.item.teacherEngagementType]}>
                {ACADEMIC_WORKLOAD_ENGAGEMENT_LABELS[row.item.teacherEngagementType]}
              </Tag>
            ) : null}
          </span>,
          row,
        ),
      title: '姓名',
      width: 92,
    },
    {
      dataIndex: ['item', 'teachingClassName'],
      key: 'teachingClassName',
      onCell: getDetailCellProps,
      render: (value: string) => renderTeachingClassName(value),
      title: '任课班级',
      width: 132,
    },
    {
      key: 'course',
      onCell: getDetailCellProps,
      render: (_, row) => (
        <span className="academic-workload-deduction-summary-course">
          <strong>{row.item.courseName || '未命名课程'}</strong>
        </span>
      ),
      title: '课程',
      width: 180,
    },
    {
      align: 'right',
      key: 'baselineWeeklyHours',
      onCell: getDetailCellProps,
      render: (_, row) => renderHourCell(row.item.baselineWeeklyHours),
      title: renderStackedColumnTitle('周课', '时'),
      width: 68,
    },
    {
      align: 'right',
      dataIndex: ['item', 'baselineTeachingWeekCount'],
      key: 'baselineTeachingWeekCount',
      onCell: getDetailCellProps,
      title: renderStackedColumnTitle('上课', '周数'),
      width: 68,
    },
    ...dateColumns.map((date) => ({
      align: 'right' as const,
      key: `date-${date}`,
      onCell: getDetailCellProps,
      render: (_: unknown, row: AcademicWorkloadDeductionTableRow) => (
        <DateAdjustmentCell summary={row.dateSummaries[date]} />
      ),
      title: (
        <Tooltip title={formatFullDate(date)}>{renderDateColumnTitle(date, teachingWeeks)}</Tooltip>
      ),
      width: DEDUCTION_DATE_COLUMN_WIDTH,
    })),
    {
      align: 'right',
      key: 'subtotal',
      onCell: getDetailCellProps,
      render: (_, row) => (
        <span className="academic-workload-deduction-summary-hour">
          {formatDeductedHundredths(row.tableSubtotalHundredths)}
        </span>
      ),
      title: '小计',
      width: 92,
    },
    {
      align: 'right',
      key: 'staffTotal',
      render: (_, row) =>
        renderMergedCell(
          <span className="academic-workload-deduction-summary-hour">
            {formatDeductedHundredths(row.staffTotalHundredths)}
          </span>,
          row,
        ),
      title: '合计',
      width: 92,
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
      dataIndex: 'deductedHours',
      key: 'deductedHours',
      render: (value: string) => renderDeductedHourCell(value),
      title: '扣课',
      width: 108,
    },
    {
      align: 'right',
      dataIndex: 'addedHours',
      key: 'addedHours',
      render: (value: string) => renderHourCell(value),
      title: '补回课时',
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
  const exportStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState<number | null>(null);
  const [selectedWeekEnd, setSelectedWeekEnd] = useState<number | null>(null);
  const [workloadDepartmentId, setWorkloadDepartmentId] = useState(
    isAdminViewer ? DEFAULT_WORKLOAD_DEPARTMENT_ID : scopedDepartmentId,
  );
  const [departmentRecords, setDepartmentRecords] = useState<AcademicWorkloadDepartmentOption[]>(
    [],
  );
  const [activeEngagementType, setActiveEngagementType] = useState<EngagementTabKey>('ALL');
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

  const invalidateSummary = useCallback(() => {
    latestRequestIdRef.current += 1;
    setSummaryEnvelope(null);
    setSummaryError(null);
    setLoadingSummary(false);
  }, []);

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
        const result = sortSemesters(await requestAcademicSemesters({ limit: 500 }));

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
  const isExternalTeacherRangeMode = activeEngagementType === 'EXTERNAL_TEACHER';

  const visibleDeductionItems = useMemo(
    () =>
      buildVisibleDeductionItems(summaryEnvelope?.items ?? [], {
        showSportsMeetDeductions,
      }),
    [showSportsMeetDeductions, summaryEnvelope],
  );
  const visibleSummary = useMemo(
    () => buildVisibleTotal(visibleDeductionItems),
    [visibleDeductionItems],
  );
  const deferredActiveEngagementType = useDeferredValue(activeEngagementType);
  const deferredVisibleDeductionItems = useDeferredValue(visibleDeductionItems);
  const isDeductionRenderPending =
    deferredActiveEngagementType !== activeEngagementType ||
    deferredVisibleDeductionItems !== visibleDeductionItems;
  const visibleDepartmentSummaries = useMemo(
    () => buildVisibleDepartmentSummaries(deferredVisibleDeductionItems),
    [deferredVisibleDeductionItems],
  );
  const deductionRows = useMemo(
    () =>
      buildTableRows(deferredVisibleDeductionItems, {
        sortByEngagementType: deferredActiveEngagementType === 'ALL',
      }),
    [deferredActiveEngagementType, deferredVisibleDeductionItems],
  );
  const deductionDateColumns = useMemo(() => collectDateColumns(deductionRows), [deductionRows]);
  const deductionColumns = useMemo(
    () =>
      buildDeductionColumns(
        deductionDateColumns,
        deferredActiveEngagementType === 'ALL',
        teachingWeeks,
      ),
    [deferredActiveEngagementType, deductionDateColumns, teachingWeeks],
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
    async (nextEngagementType: EngagementTabKey = activeEngagementType) => {
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
          endDate: shouldUseTeachingWeekRange ? selectedEndWeek?.endDate : undefined,
          semesterId: selectedSemesterId,
          startDate: shouldUseTeachingWeekRange ? selectedStartWeek?.startDate : undefined,
          teacherEngagementType: nextEngagementType === 'ALL' ? undefined : nextEngagementType,
          workloadDepartmentId,
        });

        if (latestRequestIdRef.current === requestId) {
          setSummaryEnvelope(result);
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
      selectedEndWeek,
      selectedSemesterId,
      selectedStartWeek,
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
  const canExportDeductionExcel =
    activeEngagementType !== 'ALL' && activeEngagementType !== 'EXTERNAL_TEACHER';
  const semesterLabel = selectedSemester?.name ?? `学期 ${selectedSemesterId}`;
  const selectedDepartmentOption = departmentOptions.find(
    (option) => option.value === workloadDepartmentId,
  );
  const selectedDepartmentLabel =
    selectedDepartmentOption?.label ?? (workloadDepartmentId || '全部归口系');
  const summaryContextLabel = `${formatTeachingWeekRange(
    selectedStartWeek,
    selectedEndWeek,
  )} · ${selectedDepartmentLabel} · ${activeEngagementLabel}`;
  const shouldShowDepartmentSummary = isAdminViewer && visibleDepartmentSummaries.length > 1;

  const handleResetWeekRange = () => {
    invalidateSummary();
    setSelectedWeekStart(teachingWeeks[0]?.value ?? null);
    setSelectedWeekEnd(teachingWeeks.at(-1)?.value ?? null);
  };
  const handleExportDeductionTable = useCallback(async () => {
    if (!canExportDeductionExcel || deductionRows.length === 0 || exportingExcel) {
      return;
    }

    setExportingExcel(true);

    try {
      await exportAcademicWorkloadDeductionExcel({
        dateHeaders: deductionDateColumns.map((date) =>
          formatDateColumnExportTitle(date, teachingWeeks),
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
        summaryTotal: formatDeductedHundredths(getDeductionTableTotalHundredths(deductionRows)),
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
        {semesterError ? <Alert message={semesterError} showIcon type="error" /> : null}
        {departmentError ? <Alert message={departmentError} showIcon type="error" /> : null}

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
                      onChange={setShowSportsMeetDeductions}
                    />
                  </label>
                </div>

                <div className="academic-workload-deduction-summary-metrics academic-workload-deduction-summary-query-metrics">
                  <SummaryMetric label="教师数" value={String(visibleSummary.staffCount)} />
                  <SummaryMetric label="课程数" value={String(visibleSummary.itemCount)} />
                  <SummaryMetric
                    label="扣课"
                    tone="danger"
                    value={formatDeductedHourString(visibleSummary.deductedHours)}
                  />
                </div>
              </section>
            ) : null}

            <div className="academic-workload-deduction-summary-filters">
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
                disabled={!selectedSemesterId}
                loading={loadingSummary}
                onClick={() => {
                  void loadSummary();
                }}
              >
                生成汇总表
              </Button>
            </div>

            {isExternalTeacherRangeMode ? (
              <div className="academic-workload-deduction-summary-week-range">
                <div className="academic-workload-deduction-summary-week-range-header">
                  <div>
                    <span>外聘教师统计周范围</span>
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

                    invalidateSummary();
                    setSelectedWeekStart(nextStart ?? null);
                    setSelectedWeekEnd(nextEnd ?? null);
                  }}
                />

                <div className="academic-workload-deduction-summary-week-range-summary">
                  <div className="academic-workload-deduction-summary-week-boundary">
                    <span>起始</span>
                    <strong>{selectedStartWeek?.label ?? '-'}</strong>
                    <small>{formatWeekDateRange(selectedStartWeek)}</small>
                  </div>
                  <div className="academic-workload-deduction-summary-week-boundary">
                    <span>范围</span>
                    <strong>
                      {selectedTeachingWeekCount !== null
                        ? `已选 ${selectedTeachingWeekCount} 周`
                        : '-'}
                    </strong>
                    <small>{formatTeachingWeekDateSpan(selectedStartWeek, selectedEndWeek)}</small>
                  </div>
                  <div className="academic-workload-deduction-summary-week-boundary">
                    <span>结束</span>
                    <strong>{selectedEndWeek?.label ?? '-'}</strong>
                    <small>{formatWeekDateRange(selectedEndWeek)}</small>
                  </div>
                </div>
              </div>
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

      {summaryError ? <Alert message={summaryError} showIcon type="error" /> : null}

      {loadingSummary ? <Skeleton active paragraph={{ rows: 8 }} /> : null}

      {!loadingSummary && summaryEnvelope ? (
        <div className="academic-workload-deduction-summary-result">
          {!summaryEnvelope.isValid ? (
            <Alert
              message="结果数据异常"
              description={summaryEnvelope.invalidReason ?? '当前条件返回的数据不可用于汇总。'}
              showIcon
              type="error"
            />
          ) : null}

          {!summaryEnvelope.isComplete ? (
            <Alert
              message="结果可能不完整"
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
          ) : deferredVisibleDeductionItems.length === 0 ? (
            <Empty description="当前条件下没有课程记录。" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div className="academic-workload-deduction-summary-table-shell">
              <Table<AcademicWorkloadDeductionTableRow>
                columns={deductionColumns}
                dataSource={deductionRows}
                pagination={false}
                rowClassName={getDeductionRowClassName}
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
                    rows: deductionRows,
                  })
                }
              />
            </div>
          )}
        </div>
      ) : null}

      {!loadingSummary && !summaryEnvelope && selectedSemesterId ? (
        <Alert
          message="选择条件后生成汇总表"
          description="表格将按教师合并工号、姓名和教师合计。"
          showIcon
          type="info"
        />
      ) : null}
    </div>
  );
}
