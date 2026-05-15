// src/labs/academic-adjusted-workload-report/page.tsx
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChartOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import type { SliderSingleProps } from 'antd';
import { Alert, Button, Empty, Select, Skeleton, Slider, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLoaderData } from 'react-router';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import {
  type AcademicAdjustedWorkloadReportEnvelope,
  type AcademicAdjustedWorkloadReportItem,
  type AcademicTeacherEngagementType,
  type AcademicWorkloadDepartmentOption,
  requestAcademicAdjustedWorkloadReport,
  requestAcademicWorkloadDepartmentOptions,
} from './api';
import {
  exportExternalTeacherCompensationExcel,
  type ExternalTeacherCompensationExcelRow,
} from './excel-export';

import './page.css';

type AcademicAdjustedWorkloadReportLoaderData = {
  canSelectWorkloadDepartment?: boolean;
  defaultWorkloadDepartmentId?: string | null;
};

type TeachingWeekOption = {
  endDate: string;
  label: string;
  startDate: string;
  value: number;
};

type DepartmentSelectOption = {
  label: string;
  value: string;
};

type ReportTableRow = {
  detailRowIndex: number;
  item: AcademicAdjustedWorkloadReportItem;
  key: string;
  sequence: number;
  staffRowIndex: number;
  staffRowSpan: number;
  staffTotalActualHours: number;
};

const DEFAULT_WORKLOAD_DEPARTMENT_ID = 'ORG0302';
const EMPTY_TEXT = '-';
const REPORT_TABLE_BASE_WIDTH = 976;
const EXPORT_STATUS_RESET_DELAY_MS = 1800;
const MILLISECONDS_PER_DAY = 86400000;

const ENGAGEMENT_LABELS: Record<AcademicTeacherEngagementType, string> = {
  ADMINISTRATIVE_TEACHING: '行政兼课',
  EXTERNAL_TEACHER: '外聘教师',
  FULL_TIME_TEACHER: '专任教师',
  PUBLIC_WELFARE_POST: '公益性岗位',
};

const EXTERNAL_TEACHER_ENGAGEMENT_TYPE: AcademicTeacherEngagementType = 'EXTERNAL_TEACHER';
const EXTERNAL_TEACHER_ENGAGEMENT_LABEL = ENGAGEMENT_LABELS[EXTERNAL_TEACHER_ENGAGEMENT_TYPE];

const TEXT_COLLATOR = new Intl.Collator('zh-Hans-CN', {
  numeric: true,
  sensitivity: 'base',
});

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

function compareText(first: string | null | undefined, second: string | null | undefined) {
  return TEXT_COLLATOR.compare(first || '', second || '');
}

function formatShortDate(value: string) {
  const date = parseIsoDate(value);

  return new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  }).format(date);
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

function formatCompactDecimal(value: string | number | null | undefined) {
  const numberValue = parseReportNumber(value);

  if (numberValue === null) {
    return formatReportText(value);
  }

  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(1);
}

function formatSignedCompactDecimal(value: string | number | null | undefined) {
  const numberValue = parseReportNumber(value);

  if (numberValue === null) {
    return formatReportText(value);
  }

  const formattedValue = formatCompactDecimal(Math.abs(numberValue));

  if (numberValue > 0) {
    return `+${formattedValue}`;
  }

  if (numberValue < 0) {
    return `-${formattedValue}`;
  }

  return formattedValue;
}

function splitTeachingClassNames(value: string | null | undefined) {
  return (value ?? '')
    .split(/[，,、;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

function resolveWeekScopeLabel(input: {
  endWeek: TeachingWeekOption | null;
  isFullTeachingWeekRange: boolean;
  startWeek: TeachingWeekOption | null;
}) {
  if (input.isFullTeachingWeekRange) {
    return '整学期';
  }

  if (!input.startWeek) {
    return '未选择';
  }
  if (!input.endWeek || input.startWeek.value === input.endWeek.value) {
    return input.startWeek.label;
  }

  return `${input.startWeek.label} - ${input.endWeek.label}`;
}

function resolveSelectedTeachingWeekCount(input: {
  endWeekIndex: number | null;
  isFullTeachingWeekRange: boolean;
  startWeekIndex: number | null;
  teachingWeekCount: number;
}) {
  if (input.isFullTeachingWeekRange) {
    return input.teachingWeekCount || null;
  }

  return input.startWeekIndex !== null && input.endWeekIndex !== null
    ? input.endWeekIndex - input.startWeekIndex + 1
    : null;
}

function compareReportItems(
  first: AcademicAdjustedWorkloadReportItem,
  second: AcademicAdjustedWorkloadReportItem,
) {
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

function getReportStaffKey(item: AcademicAdjustedWorkloadReportItem) {
  return `${item.teacherEngagementType}::${item.staffId}`;
}

function buildReportRows(items: AcademicAdjustedWorkloadReportItem[]) {
  const sortedItems = [...items].sort(compareReportItems);
  const rows: ReportTableRow[] = [];
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

    const staffTotalActualHours = sortedItems
      .slice(cursor, nextCursor)
      .reduce((total, item) => total + (parseReportNumber(item.actualHours) ?? 0), 0);

    for (let index = cursor; index < nextCursor; index += 1) {
      const item = sortedItems[index];

      rows.push({
        detailRowIndex,
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
        staffTotalActualHours,
      });
      detailRowIndex += 1;
    }

    cursor = nextCursor;
  }

  return rows;
}

function renderMergedCell(children: ReactNode, row: ReportTableRow) {
  return {
    children,
    props: {
      rowSpan: row.staffRowIndex === 0 ? row.staffRowSpan : 0,
    },
  };
}

function getDetailCellClassName(row: ReportTableRow) {
  return row.detailRowIndex % 2 === 0
    ? 'academic-adjusted-workload-report-detail-cell-even'
    : 'academic-adjusted-workload-report-detail-cell-odd';
}

function getMarkedDetailCellClassName(row: ReportTableRow, markedRowKeys: ReadonlySet<string>) {
  return [
    getDetailCellClassName(row),
    markedRowKeys.has(row.key) ? 'academic-adjusted-workload-report-detail-cell-marked' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function renderTeachingClassName(value: string) {
  const teachingClassNames = splitTeachingClassNames(value);

  if (teachingClassNames.length === 0) {
    return <span className="academic-adjusted-workload-report-multiline">{EMPTY_TEXT}</span>;
  }

  return (
    <Tooltip title={value}>
      <span className="academic-adjusted-workload-report-class-name">
        {teachingClassNames.map((teachingClassName, index) => (
          <span
            className="academic-adjusted-workload-report-class-name-item"
            key={`${teachingClassName}-${index}`}
          >
            {teachingClassName}
          </span>
        ))}
      </span>
    </Tooltip>
  );
}

function renderAdjustmentValue(item: AcademicAdjustedWorkloadReportItem) {
  const numberValue = parseReportNumber(item.adjustmentHours);
  const valueClassName =
    numberValue === null || numberValue === 0
      ? 'academic-adjusted-workload-report-hour'
      : numberValue > 0
        ? 'academic-adjusted-workload-report-hour academic-adjusted-workload-report-hour-plus'
        : 'academic-adjusted-workload-report-hour academic-adjusted-workload-report-hour-minus';

  return (
    <Tooltip
      title={`扣课 ${formatReportDecimal(item.deductedHours, 2)} / 补课 ${formatReportDecimal(
        item.addedHours,
        2,
      )}`}
    >
      <span className={valueClassName}>{formatSignedCompactDecimal(item.adjustmentHours)}</span>
    </Tooltip>
  );
}

function renderReportSummary(totalActualHours: string) {
  return (
    <Table.Summary.Row>
      <Table.Summary.Cell
        className="academic-adjusted-workload-report-total-label"
        colSpan={9}
        index={0}
      >
        总实际课时
      </Table.Summary.Cell>
      <Table.Summary.Cell className="academic-adjusted-workload-report-total-value" index={9}>
        {formatCompactDecimal(totalActualHours)}
      </Table.Summary.Cell>
    </Table.Summary.Row>
  );
}

function buildExternalTeacherCompensationExcelRows(
  rows: ReportTableRow[],
): ExternalTeacherCompensationExcelRow[] {
  return rows.map((row) => ({
    actualHours: formatReportExcelText(row.item.actualHours),
    adjustmentHours: formatReportExcelText(row.item.adjustmentHours),
    coefficient: formatReportExcelText(row.item.coefficient),
    courseName: formatReportExcelText(row.item.courseName),
    sequence: row.sequence,
    staffName: formatReportExcelText(row.item.staffName),
    staffRowIndex: row.staffRowIndex,
    staffRowSpan: row.staffRowSpan,
    teachingClassName: formatReportExcelText(row.item.teachingClassName),
    weekCount: row.item.weekCount,
    weeklyHours: formatReportExcelText(row.item.weeklyHours),
  }));
}

function buildExternalTeacherCompensationExcelFileName(input: {
  departmentLabel: string;
  semesterLabel: string;
  weekScopeLabel: string;
}) {
  return `兼职教师兼课金结算表-${input.semesterLabel}-${input.departmentLabel}-${input.weekScopeLabel}.xlsx`;
}

function ReportMetric({
  label,
  tone = 'default',
  value,
}: {
  label: string;
  tone?: 'default' | 'danger' | 'primary';
  value: string;
}) {
  return (
    <div
      className={`academic-adjusted-workload-report-metric academic-adjusted-workload-report-metric-${tone}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function AcademicAdjustedWorkloadReportLabPage() {
  const loaderData =
    (useLoaderData() as AcademicAdjustedWorkloadReportLoaderData | null | undefined) ?? {};
  const canSelectWorkloadDepartment = Boolean(loaderData.canSelectWorkloadDepartment);
  const defaultScopedWorkloadDepartmentId = loaderData.defaultWorkloadDepartmentId?.trim() ?? '';
  const initialWorkloadDepartmentId = canSelectWorkloadDepartment
    ? DEFAULT_WORKLOAD_DEPARTMENT_ID
    : defaultScopedWorkloadDepartmentId;
  const latestRequestIdRef = useRef(0);
  const hasAutoLoadedReportRef = useRef(false);
  const exportStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [departmentRecords, setDepartmentRecords] = useState<AcademicWorkloadDepartmentOption[]>(
    [],
  );
  const [workloadDepartmentId, setWorkloadDepartmentId] = useState(initialWorkloadDepartmentId);
  const [selectedWeekStart, setSelectedWeekStart] = useState<number | null>(null);
  const [selectedWeekEnd, setSelectedWeekEnd] = useState<number | null>(null);
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportEnvelope, setReportEnvelope] =
    useState<AcademicAdjustedWorkloadReportEnvelope | null>(null);
  const [markedDetailRowKeys, setMarkedDetailRowKeys] = useState<Set<string>>(() => new Set());
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportStatus, setExportStatus] = useState<'exported' | 'failed' | 'idle'>('idle');

  const invalidateReport = useCallback(() => {
    latestRequestIdRef.current += 1;
    setExportStatus('idle');
    setMarkedDetailRowKeys(new Set());
    setReportEnvelope(null);
    setReportError(null);
    setLoadingReport(false);
  }, []);

  const setTemporaryExportStatus = useCallback((status: 'exported' | 'failed') => {
    setExportStatus(status);

    if (exportStatusTimerRef.current) {
      clearTimeout(exportStatusTimerRef.current);
    }

    exportStatusTimerRef.current = setTimeout(() => {
      setExportStatus('idle');
      exportStatusTimerRef.current = null;
    }, EXPORT_STATUS_RESET_DELAY_MS);
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
  const isFullTeachingWeekRange =
    selectedWeekStart !== null &&
    selectedWeekEnd !== null &&
    selectedWeekStart === firstTeachingWeekValue &&
    selectedWeekEnd === lastTeachingWeekValue;
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
  const selectedTeachingWeekCount = resolveSelectedTeachingWeekCount({
    endWeekIndex: selectedWeekEnd,
    isFullTeachingWeekRange,
    startWeekIndex: selectedWeekStart,
    teachingWeekCount: teachingWeeks.length,
  });
  const departmentOptions = useMemo(() => {
    const baseOptions = buildDepartmentSelectOptions(departmentRecords);

    return ensureSelectedDepartmentOption({
      fallbackLabel: canSelectWorkloadDepartment ? '默认归口系' : '当前归口系',
      options: baseOptions,
      selectedDepartmentId: workloadDepartmentId,
    });
  }, [canSelectWorkloadDepartment, departmentRecords, workloadDepartmentId]);
  const selectedDepartmentLabel =
    departmentOptions.find((option) => option.value === workloadDepartmentId)?.label ??
    (workloadDepartmentId || '全部归口系');
  const semesterLabel =
    selectedSemester?.name ?? (selectedSemesterId ? `学期 ${selectedSemesterId}` : '未选择学期');
  const weekScopeLabel = resolveWeekScopeLabel({
    endWeek: selectedEndWeek,
    isFullTeachingWeekRange,
    startWeek: selectedStartWeek,
  });
  const reportRows = useMemo(
    () => buildReportRows(reportEnvelope?.items ?? []),
    [reportEnvelope?.items],
  );
  const canLoadReport =
    Boolean(selectedSemesterId) &&
    (canSelectWorkloadDepartment || Boolean(workloadDepartmentId)) &&
    selectedWeekStart !== null &&
    selectedWeekEnd !== null;

  const resolveWeekRequestInput = useCallback(() => {
    if (isFullTeachingWeekRange) {
      return {};
    }

    if (selectedWeekStart === null || selectedWeekEnd === null) {
      throw new Error('请选择教学周范围。');
    }

    if (selectedWeekStart === selectedWeekEnd) {
      return {
        startWeekIndex: selectedWeekStart,
      };
    }

    return {
      endWeekIndex: selectedWeekEnd,
      startWeekIndex: selectedWeekStart,
    };
  }, [isFullTeachingWeekRange, selectedWeekEnd, selectedWeekStart]);

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
      const result = await requestAcademicAdjustedWorkloadReport({
        semesterId: selectedSemesterId,
        teacherEngagementType: EXTERNAL_TEACHER_ENGAGEMENT_TYPE,
        workloadDepartmentId,
        ...resolveWeekRequestInput(),
      });

      if (latestRequestIdRef.current === requestId) {
        setReportEnvelope(result);
      }
    } catch (error) {
      if (latestRequestIdRef.current === requestId) {
        setReportError(
          error instanceof Error ? error.message : '暂时无法加载教师调整后工作量报表。',
        );
      }
    } finally {
      if (latestRequestIdRef.current === requestId) {
        setLoadingReport(false);
      }
    }
  }, [
    canSelectWorkloadDepartment,
    resolveWeekRequestInput,
    selectedSemesterId,
    workloadDepartmentId,
  ]);

  useEffect(() => {
    if (hasAutoLoadedReportRef.current || !canLoadReport || loadingSemesters) {
      return;
    }

    hasAutoLoadedReportRef.current = true;
    void loadReport();
  }, [canLoadReport, loadReport, loadingSemesters]);

  const handleResetWeekRange = () => {
    invalidateReport();
    setSelectedWeekStart(teachingWeeks[0]?.value ?? null);
    setSelectedWeekEnd(teachingWeeks.at(-1)?.value ?? null);
  };

  const toggleDetailMark = useCallback((rowKey: string) => {
    setMarkedDetailRowKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      if (nextKeys.has(rowKey)) {
        nextKeys.delete(rowKey);
      } else {
        nextKeys.add(rowKey);
      }

      return nextKeys;
    });
  }, []);
  const getMarkableDetailCellProps = useCallback(
    (row: ReportTableRow, options: { isMarkStart?: boolean } = {}) => ({
      className: [
        getMarkedDetailCellClassName(row, markedDetailRowKeys),
        'academic-adjusted-workload-report-markable-cell',
        options.isMarkStart ? 'academic-adjusted-workload-report-mark-start-cell' : '',
      ]
        .filter(Boolean)
        .join(' '),
      onClick: () => toggleDetailMark(row.key),
    }),
    [markedDetailRowKeys, toggleDetailMark],
  );
  const handleExportReportTable = useCallback(async () => {
    if (!reportEnvelope || reportRows.length === 0 || exportingExcel) {
      return;
    }

    setExportingExcel(true);

    try {
      await exportExternalTeacherCompensationExcel({
        dateRange:
          selectedStartWeek && selectedEndWeek
            ? {
                endDate: selectedEndWeek.endDate,
                startDate: selectedStartWeek.startDate,
              }
            : null,
        departmentName: selectedDepartmentLabel,
        fileName: buildExternalTeacherCompensationExcelFileName({
          departmentLabel: selectedDepartmentLabel,
          semesterLabel,
          weekScopeLabel,
        }),
        rows: buildExternalTeacherCompensationExcelRows(reportRows),
        schoolYear: selectedSemester?.schoolYear ?? null,
        summaryLabel: '合       计',
        summaryTotalActualHours: reportEnvelope.total.actualHours,
        termNumber: selectedSemester?.termNumber ?? null,
      });
      setTemporaryExportStatus('exported');
    } catch {
      setTemporaryExportStatus('failed');
    } finally {
      setExportingExcel(false);
    }
  }, [
    exportingExcel,
    reportEnvelope,
    reportRows,
    selectedDepartmentLabel,
    selectedEndWeek,
    selectedSemester,
    selectedStartWeek,
    semesterLabel,
    setTemporaryExportStatus,
    weekScopeLabel,
  ]);
  const exportButtonLabel =
    exportStatus === 'exported' ? '已导出' : exportStatus === 'failed' ? '导出失败' : '导出 Excel';

  const columns = useMemo<ColumnsType<ReportTableRow>>(
    () => [
      {
        align: 'center',
        key: 'sequence',
        render: (_, row) => renderMergedCell(row.sequence, row),
        title: '序号',
        width: 64,
      },
      {
        key: 'staffName',
        render: (_, row) =>
          renderMergedCell(
            <Tooltip title={formatReportText(row.item.staffId)}>
              <span className="academic-adjusted-workload-report-staff-name">
                {formatReportText(row.item.staffName)}
              </span>
            </Tooltip>,
            row,
          ),
        title: '姓名',
        width: 92,
      },
      {
        key: 'teachingClassName',
        onCell: (row) => getMarkableDetailCellProps(row, { isMarkStart: true }),
        render: (_, row) => renderTeachingClassName(row.item.teachingClassName),
        title: '任课班级',
        width: 132,
      },
      {
        key: 'courseName',
        onCell: getMarkableDetailCellProps,
        render: (_, row) => (
          <span className="academic-adjusted-workload-report-course">
            {formatReportText(row.item.courseName)}
          </span>
        ),
        title: '任课科目',
        width: 168,
      },
      {
        align: 'right',
        key: 'weeklyHours',
        onCell: getMarkableDetailCellProps,
        render: (_, row) => formatReportText(row.item.weeklyHours),
        title: '周学时',
        width: 68,
      },
      {
        align: 'right',
        key: 'weekCount',
        onCell: getMarkableDetailCellProps,
        render: (_, row) => formatReportText(row.item.weekCount),
        title: '周数',
        width: 68,
      },
      {
        align: 'right',
        key: 'adjustmentHours',
        onCell: getMarkableDetailCellProps,
        render: (_, row) => renderAdjustmentValue(row.item),
        title: '增删课',
        width: 78,
      },
      {
        align: 'right',
        key: 'coefficient',
        onCell: getMarkableDetailCellProps,
        render: (_, row) => formatCompactDecimal(row.item.coefficient),
        title: '系数',
        width: 68,
      },
      {
        align: 'right',
        key: 'actualHours',
        onCell: getMarkableDetailCellProps,
        render: (_, row) => (
          <span className="academic-adjusted-workload-report-hour academic-adjusted-workload-report-hour-primary">
            {formatCompactDecimal(row.item.actualHours)}
          </span>
        ),
        title: '实际课时',
        width: 88,
      },
      {
        align: 'right',
        key: 'staffTotalActualHours',
        render: (_, row) =>
          renderMergedCell(
            <span className="academic-adjusted-workload-report-total-value">
              {formatCompactDecimal(row.staffTotalActualHours)}
            </span>,
            row,
          ),
        title: '总实际课时',
        width: 112,
      },
    ],
    [getMarkableDetailCellProps],
  );

  return (
    <div className="academic-adjusted-workload-report-page">
      <DecoratedPageHeader
        description="按学期课表预算口径与 occurrence 增删课生成预算课时、增删课和实际课时。"
        icon={<FileTextOutlined />}
        title="兼职教师兼课金结算表"
      />

      <section className="academic-adjusted-workload-report-panel">
        {semesterError ? <Alert message={semesterError} showIcon type="error" /> : null}
        {departmentError ? <Alert message={departmentError} showIcon type="error" /> : null}

        {loadingSemesters ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          <div className="academic-adjusted-workload-report-query">
            {reportEnvelope ? (
              <section className="academic-adjusted-workload-report-overview">
                <div className="academic-adjusted-workload-report-summary-heading">
                  <div>
                    <h2>当前报表</h2>
                    <p>
                      {weekScopeLabel} · {selectedDepartmentLabel} ·{' '}
                      {EXTERNAL_TEACHER_ENGAGEMENT_LABEL}
                    </p>
                  </div>
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
                </div>

                <div className="academic-adjusted-workload-report-metrics academic-adjusted-workload-report-query-metrics">
                  <ReportMetric label="教师数" value={String(reportEnvelope.total.staffCount)} />
                  <ReportMetric label="课程行" value={String(reportEnvelope.total.itemCount)} />
                  <ReportMetric
                    label="预算课时"
                    value={formatReportDecimal(reportEnvelope.total.budgetHours, 2)}
                  />
                  <ReportMetric
                    label="增删课"
                    tone="danger"
                    value={formatSignedCompactDecimal(reportEnvelope.total.adjustmentHours)}
                  />
                  <ReportMetric
                    label="实际课时"
                    tone="primary"
                    value={formatCompactDecimal(reportEnvelope.total.actualHours)}
                  />
                </div>
              </section>
            ) : null}

            <div className="academic-adjusted-workload-report-filters">
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
                  onChange={(value) => {
                    invalidateReport();
                    setSelectedSemesterId(value);
                  }}
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
                disabled={!canLoadReport}
                icon={<BarChartOutlined />}
                type="primary"
                loading={loadingReport}
                onClick={() => {
                  void loadReport();
                }}
              >
                生成报表
              </Button>
            </div>

            <div className="academic-adjusted-workload-report-week-range">
              <div className="academic-adjusted-workload-report-week-range-header">
                <div>
                  <span>教学周范围</span>
                  <strong>{weekScopeLabel}</strong>
                </div>
                <Button
                  disabled={teachingWeeks.length === 0 || isFullTeachingWeekRange}
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

                  invalidateReport();
                  setSelectedWeekStart(nextStart ?? null);
                  setSelectedWeekEnd(nextEnd ?? null);
                }}
              />

              <div className="academic-adjusted-workload-report-week-range-summary">
                <div className="academic-adjusted-workload-report-week-boundary">
                  <span>起始</span>
                  <strong>{selectedStartWeek?.label ?? '-'}</strong>
                  <small>{formatWeekDateRange(selectedStartWeek)}</small>
                </div>
                <div className="academic-adjusted-workload-report-week-boundary">
                  <span>范围</span>
                  <strong>
                    {selectedTeachingWeekCount !== null
                      ? `已选 ${selectedTeachingWeekCount} 周`
                      : '-'}
                  </strong>
                  <small>
                    {isFullTeachingWeekRange
                      ? '不传周范围，后端按整学期统计'
                      : selectedWeekStart === selectedWeekEnd
                        ? '只传 startWeekIndex，后端按单周处理'
                        : formatTeachingWeekDateSpan(selectedStartWeek, selectedEndWeek)}
                  </small>
                </div>
                <div className="academic-adjusted-workload-report-week-boundary">
                  <span>结束</span>
                  <strong>{selectedEndWeek?.label ?? '-'}</strong>
                  <small>{formatWeekDateRange(selectedEndWeek)}</small>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {reportError ? <Alert message={reportError} showIcon type="error" /> : null}

      {loadingReport ? <Skeleton active paragraph={{ rows: 8 }} /> : null}

      {!loadingReport && reportEnvelope ? (
        <div className="academic-adjusted-workload-report-result">
          {!reportEnvelope.isValid ? (
            <Alert
              message="报表数据异常"
              description={reportEnvelope.invalidReason ?? '当前条件返回的数据未通过完整性校验。'}
              showIcon
              type="error"
            />
          ) : null}

          {!reportEnvelope.isComplete ? (
            <Alert
              message="报表可能不完整"
              description={reportEnvelope.truncationReason ?? '当前结果被截断，请谨慎使用。'}
              showIcon
              type="warning"
            />
          ) : null}

          {reportRows.length === 0 ? (
            <Empty
              description="当前条件下没有调整后工作量报表数据。"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div className="academic-adjusted-workload-report-table-shell">
              <Table<ReportTableRow>
                columns={columns}
                dataSource={reportRows}
                pagination={false}
                rowKey={(row) => row.key}
                scroll={{ x: REPORT_TABLE_BASE_WIDTH }}
                size="small"
                tableLayout="fixed"
                summary={() => renderReportSummary(reportEnvelope.total.actualHours)}
              />
            </div>
          )}
        </div>
      ) : null}

      {!loadingReport && !reportEnvelope && selectedSemesterId ? (
        <Alert
          message="选择条件后生成调整后工作量报表"
          description="周学时、周数、预算课时按课表预算口径；增删课按 occurrence 真源；实际课时为预算课时加 planned 增删课。"
          showIcon
          type="info"
        />
      ) : null}
    </div>
  );
}
