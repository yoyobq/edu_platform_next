// src/features/academic-workload/ui/external-teacher-compensation-page-content.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChartOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Select, Skeleton, Table, Tabs, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  type AcademicSemesterRecord,
  AcademicSemesterSelect,
  VISIBLE_ACADEMIC_SEMESTERS_QUERY_INPUT,
} from '@/entities/academic-semester';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import { compareExternalTeacherCompensationActualHours } from '../application/external-teacher-compensation';
import { splitAcademicWorkloadTeachingClassNames } from '../application/teaching-class-format';
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
  type AcademicAdjustedWorkloadReportEnvelope,
  type AcademicAdjustedWorkloadReportItem,
  type AcademicTeacherEngagementType,
  type AcademicWorkloadDepartmentOption,
  requestAcademicAdjustedWorkloadReport,
  requestAcademicWorkloadDepartmentOptions,
} from '../infrastructure/external-teacher-compensation-api';
import {
  exportExternalTeacherCompensationExcel,
  type ExternalTeacherCompensationExcelRow,
} from '../infrastructure/external-teacher-compensation-excel-export';

import { useMarkableDetailCells } from './markable-detail-cells';
import { TeachingWeekRangeControl } from './teaching-week-range-control';
import {
  formatTeachingWeekDateSpan,
  type TeachingWeekRangeState,
  useTeachingWeekRange,
} from './teaching-week-range-state';

import './external-teacher-compensation-page-content.css';

export type ExternalTeacherCompensationPageContentProps = {
  canSelectWorkloadDepartment?: boolean;
  defaultWorkloadDepartmentId?: string | null;
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

type CompensationRangeTab = {
  endWeek: number | null;
  key: string;
  label: string;
  startWeek: number | null;
};

type CompensationWeekRequestRange = {
  isFullTeachingWeekRange: boolean;
  selectedWeekEnd: number | null;
  selectedWeekStart: number | null;
};

const EMPTY_TEXT = '-';
const REPORT_TABLE_BASE_WIDTH = 976;
const EXPORT_STATUS_RESET_DELAY_MS = 1800;
const EXPORT_ACTUAL_HOURS_VALIDATION_PREVIEW_COUNT = 3;
const FULL_SEMESTER_TAB_KEY = 'semester';
const CUSTOM_RANGE_TAB_KEY = 'custom';
const EXTERNAL_TEACHER_COMPENSATION_MARKABLE_DETAIL_CELL_CLASS_NAMES = {
  evenCell: 'external-teacher-compensation-detail-cell-even',
  markedCell: 'external-teacher-compensation-detail-cell-marked',
  markableCell: 'external-teacher-compensation-markable-cell',
  markStartCell: 'external-teacher-compensation-mark-start-cell',
  oddCell: 'external-teacher-compensation-detail-cell-odd',
};

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

function compareText(first: string | null | undefined, second: string | null | undefined) {
  return TEXT_COLLATOR.compare(first || '', second || '');
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

function resolveWeekScopeLabel(range: TeachingWeekRangeState) {
  if (range.isFullTeachingWeekRange) {
    return '整学期';
  }

  if (!range.selectedStartWeek) {
    return '未选择';
  }
  if (!range.selectedEndWeek || range.selectedStartWeek.value === range.selectedEndWeek.value) {
    return range.selectedStartWeek.label;
  }

  return `${range.selectedStartWeek.label} - ${range.selectedEndWeek.label}`;
}

function buildCompensationMonthTabs(teachingWeeks: readonly TeachingWeekOption[]) {
  const groups = new Map<string, { label: string; weeks: TeachingWeekOption[]; year: number }>();

  teachingWeeks.forEach((week) => {
    const startDate = parseAcademicWorkloadIsoDate(week.startDate);
    const year = startDate.getUTCFullYear();
    const month = startDate.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const group = groups.get(key) ?? {
      label: `${month}月`,
      weeks: [],
      year,
    };

    group.weeks.push(week);
    groups.set(key, group);
  });

  const years = new Set(Array.from(groups.values()).map((group) => group.year));

  return Array.from(groups.entries()).map<CompensationRangeTab>(([key, group]) => ({
    endWeek: group.weeks.at(-1)?.value ?? null,
    key,
    label: years.size > 1 ? `${group.year}年${group.label}` : group.label,
    startWeek: group.weeks[0]?.value ?? null,
  }));
}

function resolveRangeTabKey(input: {
  isFullTeachingWeekRange: boolean;
  selectedWeekEnd: number | null;
  selectedWeekStart: number | null;
  tabs: readonly CompensationRangeTab[];
}) {
  if (input.isFullTeachingWeekRange) {
    return FULL_SEMESTER_TAB_KEY;
  }

  return (
    input.tabs.find(
      (tab) => tab.startWeek === input.selectedWeekStart && tab.endWeek === input.selectedWeekEnd,
    )?.key ?? CUSTOM_RANGE_TAB_KEY
  );
}

function resolveCurrentMonthRangeTab(tabs: readonly CompensationRangeTab[]) {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return tabs.find((tab) => tab.key === currentMonthKey) ?? null;
}

function resolveWeekRequestInput(input: CompensationWeekRequestRange) {
  if (input.isFullTeachingWeekRange) {
    return {};
  }

  if (input.selectedWeekStart === null || input.selectedWeekEnd === null) {
    throw new Error('请选择教学周范围。');
  }

  if (input.selectedWeekStart === input.selectedWeekEnd) {
    return {
      startWeekIndex: input.selectedWeekStart,
    };
  }

  return {
    endWeekIndex: input.selectedWeekEnd,
    startWeekIndex: input.selectedWeekStart,
  };
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
        key: item.rowKey,
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

function getMergedCellProps(row: ReportTableRow) {
  return {
    rowSpan: row.staffRowIndex === 0 ? row.staffRowSpan : 0,
  };
}

function renderTeachingClassName(value: string) {
  const teachingClassNames = splitAcademicWorkloadTeachingClassNames(value);

  if (teachingClassNames.length === 0) {
    return <span className="external-teacher-compensation-multiline">{EMPTY_TEXT}</span>;
  }

  return (
    <Tooltip title={value}>
      <span className="external-teacher-compensation-class-name">
        {teachingClassNames.map((teachingClassName, index) => (
          <span
            className="external-teacher-compensation-class-name-item"
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
      ? 'external-teacher-compensation-hour'
      : numberValue > 0
        ? 'external-teacher-compensation-hour external-teacher-compensation-hour-plus'
        : 'external-teacher-compensation-hour external-teacher-compensation-hour-minus';

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
        className="external-teacher-compensation-total-label"
        colSpan={9}
        index={0}
      >
        总实际课时
      </Table.Summary.Cell>
      <Table.Summary.Cell className="external-teacher-compensation-total-value" index={9}>
        {formatCompactDecimal(totalActualHours)}
      </Table.Summary.Cell>
    </Table.Summary.Row>
  );
}

function buildReportRowLabel(row: ReportTableRow) {
  return [
    formatReportText(row.item.staffName),
    formatReportText(row.item.teachingClassName),
    formatReportText(row.item.courseName),
  ].join(' / ');
}

function buildActualHoursValidationError(rows: ReportTableRow[]) {
  const issues = rows
    .map((row) => ({
      comparison: compareExternalTeacherCompensationActualHours(row.item),
      row,
    }))
    .filter(({ comparison }) => comparison.status !== 'matched');

  if (issues.length === 0) {
    return null;
  }

  const previewText = issues
    .slice(0, EXPORT_ACTUAL_HOURS_VALIDATION_PREVIEW_COUNT)
    .map(({ comparison, row }) => {
      const rowLabel = buildReportRowLabel(row);

      if (comparison.status === 'invalid') {
        return `${rowLabel} 的 actualHours 或公式字段不是有效数字`;
      }

      return `${rowLabel} 后端 ${formatReportDecimal(
        comparison.backendActualHours,
        2,
      )}，公式 ${formatReportDecimal(comparison.calculatedActualHours, 2)}`;
    })
    .join('；');
  const remainingCount = issues.length - EXPORT_ACTUAL_HOURS_VALIDATION_PREVIEW_COUNT;
  const remainingText = remainingCount > 0 ? `；另有 ${remainingCount} 行` : '';

  return `导出已阻断：实际课时与公式计算结果不一致。${previewText}${remainingText}。`;
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
      className={`external-teacher-compensation-metric external-teacher-compensation-metric-${tone}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ExternalTeacherCompensationPageContent({
  canSelectWorkloadDepartment: rawCanSelectWorkloadDepartment = false,
  defaultWorkloadDepartmentId = null,
}: ExternalTeacherCompensationPageContentProps) {
  const canSelectWorkloadDepartment = Boolean(rawCanSelectWorkloadDepartment);
  const defaultScopedWorkloadDepartmentId = defaultWorkloadDepartmentId?.trim() ?? '';
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
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportEnvelope, setReportEnvelope] =
    useState<AcademicAdjustedWorkloadReportEnvelope | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportStatus, setExportStatus] = useState<'exported' | 'failed' | 'idle'>('idle');
  const [rangeInitializedSemesterId, setRangeInitializedSemesterId] = useState<number | null>(null);
  const { clearMarkedDetailRows, getMarkableDetailCellProps } =
    useMarkableDetailCells<ReportTableRow>(
      EXTERNAL_TEACHER_COMPENSATION_MARKABLE_DETAIL_CELL_CLASS_NAMES,
    );

  const invalidateReport = useCallback(() => {
    latestRequestIdRef.current += 1;
    setExportStatus('idle');
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
        const result = sortSemesters(
          await requestAcademicSemesters(VISIBLE_ACADEMIC_SEMESTERS_QUERY_INPUT),
        );

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
  const {
    firstTeachingWeekValue: rangeFirstTeachingWeekValue,
    lastTeachingWeekValue: rangeLastTeachingWeekValue,
    setTeachingWeekRange,
  } = teachingWeekRange;
  const compensationMonthTabs = useMemo(
    () => buildCompensationMonthTabs(teachingWeeks),
    [teachingWeeks],
  );
  const activeRangeTabKey = resolveRangeTabKey({
    isFullTeachingWeekRange: teachingWeekRange.isFullTeachingWeekRange,
    selectedWeekEnd: teachingWeekRange.selectedWeekEnd,
    selectedWeekStart: teachingWeekRange.selectedWeekStart,
    tabs: compensationMonthTabs,
  });
  const rangeTabItems = useMemo(
    () => [
      {
        key: FULL_SEMESTER_TAB_KEY,
        label: '整学期',
      },
      ...compensationMonthTabs.map((tab) => ({
        key: tab.key,
        label: tab.label,
      })),
      ...(activeRangeTabKey === CUSTOM_RANGE_TAB_KEY
        ? [
            {
              key: CUSTOM_RANGE_TAB_KEY,
              label: '自定义',
            },
          ]
        : []),
    ],
    [activeRangeTabKey, compensationMonthTabs],
  );
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
  const semesterLabel =
    selectedSemester?.name ?? (selectedSemesterId ? `学期 ${selectedSemesterId}` : '未选择学期');
  const weekScopeLabel = resolveWeekScopeLabel(teachingWeekRange);
  const reportRows = useMemo(
    () => buildReportRows(reportEnvelope?.items ?? []),
    [reportEnvelope?.items],
  );
  const canLoadReportWithRange = useCallback(
    (range: CompensationWeekRequestRange, options: { requireInitializedRange: boolean }) =>
      Boolean(selectedSemesterId) &&
      (!options.requireInitializedRange || rangeInitializedSemesterId === selectedSemesterId) &&
      (canSelectWorkloadDepartment || Boolean(workloadDepartmentId)) &&
      range.selectedWeekStart !== null &&
      range.selectedWeekEnd !== null,
    [
      canSelectWorkloadDepartment,
      rangeInitializedSemesterId,
      selectedSemesterId,
      workloadDepartmentId,
    ],
  );
  const currentWeekRequestRange = useMemo<CompensationWeekRequestRange>(
    () => ({
      isFullTeachingWeekRange: teachingWeekRange.isFullTeachingWeekRange,
      selectedWeekEnd: teachingWeekRange.selectedWeekEnd,
      selectedWeekStart: teachingWeekRange.selectedWeekStart,
    }),
    [
      teachingWeekRange.isFullTeachingWeekRange,
      teachingWeekRange.selectedWeekEnd,
      teachingWeekRange.selectedWeekStart,
    ],
  );
  const canLoadReport = canLoadReportWithRange(currentWeekRequestRange, {
    requireInitializedRange: true,
  });

  const loadReport = useCallback(
    async (overrideRange?: CompensationWeekRequestRange) => {
      const requestRange = overrideRange ?? currentWeekRequestRange;

      if (!selectedSemesterId) {
        return;
      }

      if (!canSelectWorkloadDepartment && !workloadDepartmentId) {
        setReportError('当前账号缺少工作量归口系，暂时无法生成报表。');
        return;
      }

      if (
        !canLoadReportWithRange(requestRange, {
          requireInitializedRange: !overrideRange,
        })
      ) {
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
          ...resolveWeekRequestInput(requestRange),
        });

        if (latestRequestIdRef.current === requestId) {
          setReportEnvelope(result);
        }
      } catch (error) {
        if (latestRequestIdRef.current === requestId) {
          setReportError(error instanceof Error ? error.message : '暂时无法加载外聘兼课金结算表。');
        }
      } finally {
        if (latestRequestIdRef.current === requestId) {
          setLoadingReport(false);
        }
      }
    },
    [
      canLoadReportWithRange,
      canSelectWorkloadDepartment,
      currentWeekRequestRange,
      selectedSemesterId,
      workloadDepartmentId,
    ],
  );

  useEffect(() => {
    if (!selectedSemesterId) {
      setRangeInitializedSemesterId(null);
      return;
    }

    if (rangeInitializedSemesterId === selectedSemesterId) {
      return;
    }

    if (teachingWeeks.length === 0) {
      setRangeInitializedSemesterId(selectedSemesterId);
      return;
    }

    const currentMonthTab = resolveCurrentMonthRangeTab(compensationMonthTabs);
    const nextStartWeek = currentMonthTab?.startWeek ?? rangeFirstTeachingWeekValue;
    const nextEndWeek = currentMonthTab?.endWeek ?? rangeLastTeachingWeekValue;

    if (nextStartWeek === null || nextEndWeek === null) {
      setRangeInitializedSemesterId(selectedSemesterId);
      return;
    }

    setTeachingWeekRange(nextStartWeek, nextEndWeek);
    setRangeInitializedSemesterId(selectedSemesterId);
  }, [
    compensationMonthTabs,
    rangeInitializedSemesterId,
    selectedSemesterId,
    rangeFirstTeachingWeekValue,
    rangeLastTeachingWeekValue,
    setTeachingWeekRange,
    teachingWeeks.length,
  ]);

  useEffect(() => {
    if (hasAutoLoadedReportRef.current || !canLoadReport || loadingSemesters) {
      return;
    }

    hasAutoLoadedReportRef.current = true;
    void loadReport();
  }, [canLoadReport, loadReport, loadingSemesters]);

  const handleRangeTabChange = (nextKey: string) => {
    if (nextKey === CUSTOM_RANGE_TAB_KEY) {
      return;
    }

    const nextRange =
      nextKey === FULL_SEMESTER_TAB_KEY
        ? {
            isFullTeachingWeekRange: true,
            selectedWeekEnd: rangeLastTeachingWeekValue,
            selectedWeekStart: rangeFirstTeachingWeekValue,
          }
        : (() => {
            const monthTab = compensationMonthTabs.find((tab) => tab.key === nextKey);

            return monthTab
              ? {
                  isFullTeachingWeekRange: false,
                  selectedWeekEnd: monthTab.endWeek,
                  selectedWeekStart: monthTab.startWeek,
                }
              : null;
          })();

    if (!nextRange || nextRange.selectedWeekStart === null || nextRange.selectedWeekEnd === null) {
      return;
    }

    setTeachingWeekRange(nextRange.selectedWeekStart, nextRange.selectedWeekEnd);

    if (
      !canLoadReportWithRange(nextRange, {
        requireInitializedRange: false,
      })
    ) {
      return;
    }

    void loadReport(nextRange);
  };

  const handleExportReportTable = useCallback(async () => {
    if (!reportEnvelope || reportRows.length === 0 || exportingExcel) {
      return;
    }

    setReportError(null);

    const actualHoursValidationError = buildActualHoursValidationError(reportRows);

    if (actualHoursValidationError) {
      setReportError(actualHoursValidationError);
      setTemporaryExportStatus('failed');
      return;
    }

    setExportingExcel(true);

    try {
      await exportExternalTeacherCompensationExcel({
        dateRange:
          teachingWeekRange.selectedStartWeek && teachingWeekRange.selectedEndWeek
            ? {
                endDate: teachingWeekRange.selectedEndWeek.endDate,
                startDate: teachingWeekRange.selectedStartWeek.startDate,
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
    } catch (error) {
      setReportError(error instanceof Error ? error.message : '暂时无法导出外聘兼课金结算表。');
      setTemporaryExportStatus('failed');
    } finally {
      setExportingExcel(false);
    }
  }, [
    exportingExcel,
    reportEnvelope,
    reportRows,
    selectedDepartmentLabel,
    selectedSemester,
    semesterLabel,
    setTemporaryExportStatus,
    teachingWeekRange.selectedEndWeek,
    teachingWeekRange.selectedStartWeek,
    weekScopeLabel,
  ]);
  const exportButtonLabel =
    exportStatus === 'exported' ? '已导出' : exportStatus === 'failed' ? '导出失败' : '导出 Excel';

  const columns = useMemo<ColumnsType<ReportTableRow>>(
    () => [
      {
        align: 'center',
        key: 'sequence',
        onCell: getMergedCellProps,
        render: (_, row) => row.sequence,
        title: '序号',
        width: 64,
      },
      {
        key: 'staffName',
        onCell: getMergedCellProps,
        render: (_, row) => (
          <Tooltip title={formatReportText(row.item.staffId)}>
            <span className="external-teacher-compensation-staff-name">
              {formatReportText(row.item.staffName)}
            </span>
          </Tooltip>
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
        onCell: (row) => getMarkableDetailCellProps(row),
        render: (_, row) => (
          <span className="external-teacher-compensation-course">
            {formatReportText(row.item.courseName)}
          </span>
        ),
        title: '任课科目',
        width: 168,
      },
      {
        align: 'right',
        key: 'weeklyHours',
        onCell: (row) => getMarkableDetailCellProps(row),
        render: (_, row) => formatReportText(row.item.weeklyHours),
        title: '周学时',
        width: 68,
      },
      {
        align: 'right',
        key: 'weekCount',
        onCell: (row) => getMarkableDetailCellProps(row),
        render: (_, row) => formatReportText(row.item.weekCount),
        title: '周数',
        width: 68,
      },
      {
        align: 'right',
        key: 'adjustmentHours',
        onCell: (row) => getMarkableDetailCellProps(row),
        render: (_, row) => renderAdjustmentValue(row.item),
        title: '增删课',
        width: 78,
      },
      {
        align: 'right',
        key: 'coefficient',
        onCell: (row) => getMarkableDetailCellProps(row),
        render: (_, row) => formatCompactDecimal(row.item.coefficient),
        title: '系数',
        width: 68,
      },
      {
        align: 'right',
        key: 'actualHours',
        onCell: (row) => getMarkableDetailCellProps(row),
        render: (_, row) => (
          <span className="external-teacher-compensation-hour external-teacher-compensation-hour-primary">
            {formatCompactDecimal(row.item.actualHours)}
          </span>
        ),
        title: '实际课时',
        width: 88,
      },
      {
        align: 'right',
        key: 'staffTotalActualHours',
        onCell: getMergedCellProps,
        render: (_, row) => (
          <span className="external-teacher-compensation-total-value">
            {formatCompactDecimal(row.staffTotalActualHours)}
          </span>
        ),
        title: '总实际课时',
        width: 112,
      },
    ],
    [getMarkableDetailCellProps],
  );

  return (
    <div className="external-teacher-compensation-page">
      <DecoratedPageHeader
        description="查看外聘教师在所选学期和教学周范围内的兼课课时，可直接导出结算表。"
        icon={<FileTextOutlined />}
        title="兼职教师兼课金结算表"
      />

      <section className="external-teacher-compensation-panel">
        {semesterError ? <Alert title={semesterError} showIcon type="error" /> : null}
        {departmentError ? <Alert title={departmentError} showIcon type="error" /> : null}

        {loadingSemesters ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          <div className="external-teacher-compensation-query">
            {reportEnvelope ? (
              <section className="external-teacher-compensation-overview">
                <div className="external-teacher-compensation-summary-heading">
                  <div>
                    <h2>当前报表</h2>
                    <p>
                      {weekScopeLabel} · {selectedDepartmentLabel} ·{' '}
                      {EXTERNAL_TEACHER_ENGAGEMENT_LABEL}
                    </p>
                  </div>
                </div>

                <div className="external-teacher-compensation-metrics external-teacher-compensation-query-metrics">
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

            <div className="external-teacher-compensation-filters">
              <label>
                <span>学期</span>
                <AcademicSemesterSelect
                  aria-label="学期"
                  placeholder="选择学期"
                  records={semesters}
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

              <div className="external-teacher-compensation-actions">
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
            </div>

            <TeachingWeekRangeControl
              range={teachingWeekRange}
              rangeDescription={
                teachingWeekRange.isFullTeachingWeekRange
                  ? '按整学期统计'
                  : teachingWeekRange.selectedWeekStart === teachingWeekRange.selectedWeekEnd
                    ? '按单周统计'
                    : formatTeachingWeekDateSpan(
                        teachingWeekRange.selectedStartWeek,
                        teachingWeekRange.selectedEndWeek,
                      )
              }
              resetDisabled={
                teachingWeekRange.teachingWeeks.length === 0 ||
                teachingWeekRange.isFullTeachingWeekRange
              }
              valueLabel={weekScopeLabel}
            />
          </div>
        )}
      </section>

      {selectedSemesterId && rangeTabItems.length > 1 ? (
        <div className="external-teacher-compensation-range-tabs">
          <Tabs
            activeKey={activeRangeTabKey}
            items={rangeTabItems}
            tabBarExtraContent={{
              right: (
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
              ),
            }}
            onChange={handleRangeTabChange}
          />
        </div>
      ) : null}

      {reportError ? <Alert title={reportError} showIcon type="error" /> : null}

      {loadingReport ? <Skeleton active paragraph={{ rows: 8 }} /> : null}

      {!loadingReport && reportEnvelope ? (
        <div className="external-teacher-compensation-result">
          {!reportEnvelope.isValid ? (
            <Alert
              title="报表数据异常"
              description={reportEnvelope.invalidReason ?? '当前条件返回的数据未通过完整性校验。'}
              showIcon
              type="error"
            />
          ) : null}

          {!reportEnvelope.isComplete ? (
            <Alert
              title="报表可能不完整"
              description={reportEnvelope.truncationReason ?? '当前结果被截断，请谨慎使用。'}
              showIcon
              type="warning"
            />
          ) : null}

          {reportRows.length === 0 ? (
            <Empty
              description="当前条件下没有外聘兼课金数据。"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div className="external-teacher-compensation-table-section">
              <div className="external-teacher-compensation-table-shell">
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
            </div>
          )}
        </div>
      ) : null}

      {!loadingReport && !reportEnvelope && selectedSemesterId ? (
        <Alert
          title="选择条件后生成外聘兼课金结算表"
          description="可按学期和教学周范围查看外聘教师兼课课时，确认后直接导出结算表。"
          showIcon
          type="info"
        />
      ) : null}
    </div>
  );
}
