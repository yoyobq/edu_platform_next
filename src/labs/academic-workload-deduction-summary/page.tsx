// src/labs/academic-workload-deduction-summary/page.tsx
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChartOutlined, CarryOutOutlined, ReloadOutlined } from '@ant-design/icons';
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
import { useLoaderData } from 'react-router';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import {
  type AcademicTeacherEngagementType,
  type AcademicWorkloadDeductionDepartmentSummary,
  type AcademicWorkloadDeductionSummaryEnvelope,
  type AcademicWorkloadDeductionSummaryItem,
  type AcademicWorkloadDeductionSummaryTotal,
  type AcademicWorkloadDepartmentOption,
  requestAcademicWorkloadDeductionSummary,
  requestAcademicWorkloadDepartmentOptions,
} from './api';
import { academicWorkloadDeductionSummaryLabMeta } from './meta';

import './page.css';

type EngagementTabKey = 'ALL' | AcademicTeacherEngagementType;

type TeachingWeekOption = {
  endDate: string;
  label: string;
  startDate: string;
  value: number;
};

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

type DepartmentSelectOption = {
  label: string;
  value: string;
};

type AcademicWorkloadDeductionSummaryLabLoaderData = {
  defaultDepartmentId: string | null;
  viewerRole: 'admin' | 'department';
};

const DEFAULT_WORKLOAD_DEPARTMENT_ID = 'ORG0302';
const DEDUCTION_TABLE_BASE_WIDTH = 864;
const DEDUCTION_DATE_COLUMN_WIDTH = 76;
const EMPTY_TEXT = '-';
const MILLISECONDS_PER_DAY = 86400000;
const SPORTS_MEET_SOURCE_EVENT_TYPE = 'SPORTS_MEET';

const DEDUCTION_REASON_LABELS: Record<string, string> = {
  ACTIVITY: '活动',
  EXAM: '考试',
  HOLIDAY: '节假日',
  SPORTS_MEET: '运动会',
  WEEKDAY_SWAP: '调休',
};

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const TEACHER_ENGAGEMENT_TYPE_LABELS: Record<AcademicTeacherEngagementType, string> = {
  ADMINISTRATIVE_TEACHING: '行政兼课',
  EXTERNAL_TEACHER: '外聘教师',
  FULL_TIME_TEACHER: '专任教师',
  PUBLIC_WELFARE_POST: '公益性岗位',
};

const TEACHER_ENGAGEMENT_TYPE_TAG_COLORS: Record<AcademicTeacherEngagementType, string> = {
  ADMINISTRATIVE_TEACHING: 'purple',
  EXTERNAL_TEACHER: 'orange',
  FULL_TIME_TEACHER: 'green',
  PUBLIC_WELFARE_POST: 'cyan',
};

const TEACHER_ENGAGEMENT_TYPE_ORDER: Record<AcademicTeacherEngagementType, number> = {
  FULL_TIME_TEACHER: 1,
  ADMINISTRATIVE_TEACHING: 2,
  PUBLIC_WELFARE_POST: 3,
  EXTERNAL_TEACHER: 4,
};

const ENGAGEMENT_TABS: { key: EngagementTabKey; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'FULL_TIME_TEACHER', label: '专任教师' },
  { key: 'ADMINISTRATIVE_TEACHING', label: '行政兼课' },
  { key: 'PUBLIC_WELFARE_POST', label: '公益性岗位' },
  { key: 'EXTERNAL_TEACHER', label: '外聘教师' },
];

function compareText(first: string | null | undefined, second: string | null | undefined) {
  return (first || '').localeCompare(second || '', 'zh-Hans-CN');
}

function sortSemesters(records: AcademicSemesterRecord[]) {
  return [...records].sort((first, second) => {
    if (first.isCurrent !== second.isCurrent) {
      return first.isCurrent ? -1 : 1;
    }

    if (first.schoolYear !== second.schoolYear) {
      return second.schoolYear - first.schoolYear;
    }

    if (first.termNumber !== second.termNumber) {
      return second.termNumber - first.termNumber;
    }

    return second.id - first.id;
  });
}

function pickDefaultSemesterId(records: AcademicSemesterRecord[], currentValue: number | null) {
  if (currentValue !== null && records.some((record) => record.id === currentValue)) {
    return currentValue;
  }

  return records.find((record) => record.isCurrent)?.id ?? records[0]?.id ?? null;
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
    ...input.options,
    {
      label: input.fallbackLabel,
      value: input.selectedDepartmentId,
    },
  ];
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
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

function buildTeachingWeekMonthMarkValues(weeks: readonly TeachingWeekOption[]) {
  if (weeks.length === 0) {
    return [] as number[];
  }

  const firstWeek = weeks[0];
  const lastWeek = weeks.at(-1);

  if (!lastWeek) {
    return [] as number[];
  }

  const firstDate = parseIsoDate(firstWeek.startDate);
  const lastDate = parseIsoDate(lastWeek.endDate);
  const monthMarkValues = new Set([firstWeek.value]);

  for (
    let cursor = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth(), 1));
    cursor.getTime() <= lastDate.getTime();
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    const monthStartWeek = weeks.find((week) => {
      const weekStart = parseIsoDate(week.startDate);
      const weekEnd = parseIsoDate(week.endDate);

      return weekStart.getTime() <= cursor.getTime() && cursor.getTime() <= weekEnd.getTime();
    });

    if (monthStartWeek) {
      monthMarkValues.add(monthStartWeek.value);
    }
  }

  return weeks.filter((week) => monthMarkValues.has(week.value)).map((week) => week.value);
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

function formatTeachingWeekRange(
  startWeek: TeachingWeekOption | null,
  endWeek: TeachingWeekOption | null,
) {
  if (!startWeek || !endWeek) {
    return '未选择教学周';
  }

  return `${startWeek.label} - ${endWeek.label}`;
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
  const weekday = WEEKDAY_LABELS[parseIsoDate(value).getUTCDay()];

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
        TEACHER_ENGAGEMENT_TYPE_ORDER[first.teacherEngagementType] -
        TEACHER_ENGAGEMENT_TYPE_ORDER[second.teacherEngagementType];

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
    ? 'academic-workload-lab-detail-cell-even'
    : 'academic-workload-lab-detail-cell-odd';
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
  return <span className="academic-workload-lab-hour">{formatHourString(value)}</span>;
}

function renderDeductedHourCell(value: string | null | undefined) {
  return <span className="academic-workload-lab-hour">{formatDeductedHourString(value)}</span>;
}

function renderTeachingClassName(value: string) {
  const teachingClassNames = value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (teachingClassNames.length === 0) {
    return <span className="academic-workload-lab-class-name">{EMPTY_TEXT}</span>;
  }

  return (
    <span className="academic-workload-lab-class-name">
      {teachingClassNames.map((teachingClassName) => (
        <span className="academic-workload-lab-class-name-item" key={teachingClassName}>
          {teachingClassName}
        </span>
      ))}
    </span>
  );
}

function renderStackedColumnTitle(firstLine: string, secondLine: string) {
  return (
    <span className="academic-workload-lab-column-title-stacked">
      <span>{firstLine}</span>
      <span>{secondLine}</span>
    </span>
  );
}

function renderDateColumnTitle(value: string, teachingWeeks: readonly TeachingWeekOption[]) {
  const teachingWeek = findTeachingWeekByDate(value, teachingWeeks);

  return (
    <span className="academic-workload-lab-date-column-title">
      <span>{formatDateColumnMonthDay(value)}</span>
      <span>{teachingWeek ? `第${teachingWeek.value}周` : '第-周'}</span>
      <span>{formatDateColumnWeekday(value)}</span>
    </span>
  );
}

function DateAdjustmentCell({ summary }: { summary: DateAdjustmentSummary | undefined }) {
  if (!summary) {
    return <span className="academic-workload-lab-empty">0</span>;
  }

  if (!summary.hasHourValue) {
    return <span className="academic-workload-lab-empty">0</span>;
  }

  return (
    <Tooltip
      title={`${formatFullDate(summary.date)} · 扣课 ${formatDeductedHundredths(
        summary.deductedHundredths,
      )} · ${summary.reasonLabels.join('、') || '未标注原因'}`}
    >
      <span className="academic-workload-lab-date-hour academic-workload-lab-total-hour">
        {formatDeductedHundredths(summary.deductedHundredths)}
      </span>
    </Tooltip>
  );
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
          <span className="academic-workload-lab-staff">
            <strong>{row.item.staffName}</strong>
            {showTeacherTypeTag ? (
              <Tag color={TEACHER_ENGAGEMENT_TYPE_TAG_COLORS[row.item.teacherEngagementType]}>
                {TEACHER_ENGAGEMENT_TYPE_LABELS[row.item.teacherEngagementType]}
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
      title: renderStackedColumnTitle('任课', '班级'),
      width: 132,
    },
    {
      key: 'course',
      onCell: getDetailCellProps,
      render: (_, row) => (
        <span className="academic-workload-lab-course">
          <strong>{row.item.courseName || '未命名课程'}</strong>
        </span>
      ),
      title: '课程',
      width: 180,
    },
    {
      align: 'center',
      key: 'baselineWeeklyHours',
      onCell: getDetailCellProps,
      render: (_, row) => renderHourCell(row.item.baselineWeeklyHours),
      title: renderStackedColumnTitle('周课', '时'),
      width: 68,
    },
    {
      align: 'center',
      dataIndex: ['item', 'baselineTeachingWeekCount'],
      key: 'baselineTeachingWeekCount',
      onCell: getDetailCellProps,
      title: renderStackedColumnTitle('上课', '周数'),
      width: 68,
    },
    ...dateColumns.map((date) => ({
      align: 'center' as const,
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
      align: 'center',
      key: 'subtotal',
      onCell: getDetailCellProps,
      render: (_, row) => (
        <span className="academic-workload-lab-hour">
          {formatDeductedHundredths(row.tableSubtotalHundredths)}
        </span>
      ),
      title: '小计',
      width: 92,
    },
    {
      align: 'center',
      key: 'staffTotal',
      render: (_, row) =>
        renderMergedCell(
          <span className="academic-workload-lab-hour">
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
        <span className="academic-workload-lab-department-name">
          <strong>{record.workloadDepartmentName || record.workloadDepartmentId}</strong>
          <small>{record.workloadDepartmentId}</small>
        </span>
      ),
      title: '归口系',
    },
    {
      align: 'center',
      dataIndex: 'staffCount',
      key: 'staffCount',
      title: '教师数',
      width: 92,
    },
    {
      align: 'center',
      dataIndex: 'itemCount',
      key: 'itemCount',
      title: '明细行',
      width: 92,
    },
    {
      align: 'center',
      dataIndex: 'deductedHours',
      key: 'deductedHours',
      render: (value: string) => renderDeductedHourCell(value),
      title: '原始扣课',
      width: 108,
    },
    {
      align: 'center',
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
    <div className={`academic-workload-lab-metric academic-workload-lab-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function AcademicWorkloadDeductionSummaryLabPage() {
  const loaderData = useLoaderData() as AcademicWorkloadDeductionSummaryLabLoaderData | null;
  const isAdminViewer = loaderData?.viewerRole === 'admin';
  const scopedDepartmentId = loaderData?.defaultDepartmentId?.trim() || '';
  const latestRequestIdRef = useRef(0);
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
        setSelectedSemesterId((currentValue) => pickDefaultSemesterId(result, currentValue));
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
  const visibleDepartmentSummaries = useMemo(
    () => buildVisibleDepartmentSummaries(visibleDeductionItems),
    [visibleDeductionItems],
  );
  const deductionRows = useMemo(
    () =>
      buildTableRows(visibleDeductionItems, {
        sortByEngagementType: activeEngagementType === 'ALL',
      }),
    [activeEngagementType, visibleDeductionItems],
  );
  const deductionDateColumns = useMemo(() => collectDateColumns(deductionRows), [deductionRows]);

  const departmentOptions = useMemo(() => {
    const baseOptions = buildDepartmentSelectOptions(departmentRecords);

    return ensureSelectedDepartmentOption({
      fallbackLabel: isAdminViewer ? '默认归口系' : '当前归口系',
      options: baseOptions,
      selectedDepartmentId: workloadDepartmentId,
    });
  }, [departmentRecords, isAdminViewer, workloadDepartmentId]);

  const departmentSummaryColumns = useMemo(() => buildDepartmentSummaryColumns(), []);

  const tabItems = useMemo(
    () =>
      ENGAGEMENT_TABS.map((item) => ({
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

  const selectedScopeLabel = isExternalTeacherRangeMode
    ? `${formatTeachingWeekRange(selectedStartWeek, selectedEndWeek)} · ${formatTeachingWeekDateSpan(
        selectedStartWeek,
        selectedEndWeek,
      )}`
    : '整学期';
  const shouldShowDepartmentSummary = isAdminViewer && visibleDepartmentSummaries.length > 1;

  const handleResetWeekRange = () => {
    invalidateSummary();
    setSelectedWeekStart(teachingWeeks[0]?.value ?? null);
    setSelectedWeekEnd(teachingWeeks.at(-1)?.value ?? null);
  };

  return (
    <div className="academic-workload-lab-page">
      <DecoratedPageHeader
        badge={<Tag color="gold">Labs</Tag>}
        description={academicWorkloadDeductionSummaryLabMeta.purpose}
        icon={<CarryOutOutlined />}
        title="教师扣课汇总"
      />

      <section className="academic-workload-lab-panel">
        {semesterError ? <Alert message={semesterError} showIcon type="error" /> : null}
        {departmentError ? <Alert message={departmentError} showIcon type="error" /> : null}

        {loadingSemesters ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          <div className="academic-workload-lab-query">
            <div className="academic-workload-lab-filters">
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

              <div className="academic-workload-lab-option">
                <span>显示运动会扣课</span>
                <Switch
                  checked={showSportsMeetDeductions}
                  size="small"
                  onChange={setShowSportsMeetDeductions}
                />
              </div>

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
              <div className="academic-workload-lab-week-range">
                <div className="academic-workload-lab-week-range-header">
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

                <div className="academic-workload-lab-week-range-summary">
                  <div className="academic-workload-lab-week-boundary">
                    <span>起始</span>
                    <strong>{selectedStartWeek?.label ?? '-'}</strong>
                    <small>{formatWeekDateRange(selectedStartWeek)}</small>
                  </div>
                  <div className="academic-workload-lab-week-boundary">
                    <span>范围</span>
                    <strong>
                      {selectedTeachingWeekCount !== null
                        ? `已选 ${selectedTeachingWeekCount} 周`
                        : '-'}
                    </strong>
                    <small>{formatTeachingWeekDateSpan(selectedStartWeek, selectedEndWeek)}</small>
                  </div>
                  <div className="academic-workload-lab-week-boundary">
                    <span>结束</span>
                    <strong>{selectedEndWeek?.label ?? '-'}</strong>
                    <small>{formatWeekDateRange(selectedEndWeek)}</small>
                  </div>
                </div>
              </div>
            ) : (
              <div className="academic-workload-lab-semester-scope">
                <span>统计范围</span>
                <strong>整学期</strong>
                <small>{selectedSemester?.name ?? '当前选择学期'}</small>
              </div>
            )}
          </div>
        )}
      </section>

      <Tabs
        activeKey={activeEngagementType}
        items={tabItems}
        onChange={handleEngagementTypeChange}
      />

      {summaryError ? <Alert message={summaryError} showIcon type="error" /> : null}

      {loadingSummary ? <Skeleton active paragraph={{ rows: 8 }} /> : null}

      {!loadingSummary && summaryEnvelope ? (
        <div className="academic-workload-lab-result">
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

          <section className="academic-workload-lab-summary">
            <div className="academic-workload-lab-summary-heading">
              <div>
                <h2>当前汇总</h2>
                <p>
                  {selectedSemester?.name ?? `学期 ${selectedSemesterId}`} ·{' '}
                  {ENGAGEMENT_TABS.find((item) => item.key === activeEngagementType)?.label} ·{' '}
                  {selectedScopeLabel}
                </p>
              </div>
              <Button
                icon={<ReloadOutlined />}
                loading={loadingSummary}
                onClick={() => {
                  void loadSummary();
                }}
              >
                刷新
              </Button>
            </div>

            <div className="academic-workload-lab-metrics">
              <SummaryMetric label="教师数" value={String(visibleSummary.staffCount)} />
              <SummaryMetric label="明细行" value={String(visibleSummary.itemCount)} />
              <SummaryMetric
                label="原始扣课"
                tone="danger"
                value={formatDeductedHourString(visibleSummary.deductedHours)}
              />
              <SummaryMetric
                label="补回课时"
                tone="success"
                value={formatHourString(visibleSummary.addedHours)}
              />
            </div>
          </section>

          {shouldShowDepartmentSummary ? (
            <section className="academic-workload-lab-soft-card">
              <details>
                <summary>
                  <span>归口系小计</span>
                  <small>{visibleDepartmentSummaries.length} 个归口系</small>
                </summary>
                <div className="academic-workload-lab-soft-card-body">
                  <div className="academic-workload-lab-table-shell">
                    <Table<AcademicWorkloadDeductionDepartmentSummary>
                      columns={departmentSummaryColumns}
                      dataSource={visibleDepartmentSummaries}
                      pagination={false}
                      rowKey={(record) => record.workloadDepartmentId}
                      scroll={{ x: 720 }}
                      size="small"
                    />
                  </div>
                </div>
              </details>
            </section>
          ) : null}

          {visibleDeductionItems.length === 0 ? (
            <Empty description="当前条件下没有课程记录。" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div className="academic-workload-lab-table-shell">
              <Table<AcademicWorkloadDeductionTableRow>
                columns={buildDeductionColumns(
                  deductionDateColumns,
                  activeEngagementType === 'ALL',
                  teachingWeeks,
                )}
                dataSource={deductionRows}
                pagination={false}
                rowKey={(row) => row.key}
                scroll={{
                  x:
                    DEDUCTION_TABLE_BASE_WIDTH +
                    deductionDateColumns.length * DEDUCTION_DATE_COLUMN_WIDTH,
                }}
                size="small"
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
