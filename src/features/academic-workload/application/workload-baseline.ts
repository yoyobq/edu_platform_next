// src/features/academic-workload/application/workload-baseline.ts
import {
  type AcademicSemesterRecord,
  pickAcademicSemesterId,
  sortAcademicSemestersForDisplay,
} from '@/entities/academic-semester';

export type AcademicWorkloadCalcEffect = 'CANCEL' | 'MAKEUP' | 'NORMAL' | 'SWAP_IN' | 'SWAP_OUT';

export type AcademicWorkloadOccurrenceLike = {
  calcEffect: AcademicWorkloadCalcEffect;
  coefficient: string;
  courseName?: string | null;
  date: string;
  isEffective: boolean;
  periodEnd: number;
  periodStart: number;
  teachingClassName?: string | null;
  weekIndex: number;
};

export type TeachingWeekOption = {
  endDate: string;
  label: string;
  startDate: string;
  value: number;
};

export type AcademicWorkloadTableViewFilter = 'added' | 'all' | 'deducted' | 'effective';

const MILLISECONDS_PER_DAY = 86400000;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

export function parseAcademicWorkloadIsoDate(value: string) {
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

export function sortSemesters(records: AcademicSemesterRecord[]) {
  return sortAcademicSemestersForDisplay(records);
}

export function pickNextSemesterId(
  records: AcademicSemesterRecord[],
  currentSelection: number | null,
) {
  return pickAcademicSemesterId(records, currentSelection);
}

export function buildTeachingWeekOptions(semester: AcademicSemesterRecord | null) {
  if (!semester) {
    return [] as TeachingWeekOption[];
  }

  const firstTeachingWeekStart = startOfWeek(
    parseAcademicWorkloadIsoDate(semester.firstTeachingDate),
  );
  const examWeekStart = startOfWeek(parseAcademicWorkloadIsoDate(semester.examStartDate));
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

export function buildTeachingWeekMonthMarkValues(weeks: readonly TeachingWeekOption[]) {
  if (weeks.length === 0) {
    return [] as number[];
  }

  const firstWeek = weeks[0];
  const lastWeek = weeks.at(-1);

  if (!lastWeek) {
    return [] as number[];
  }

  const firstDate = parseAcademicWorkloadIsoDate(firstWeek.startDate);
  const lastDate = parseAcademicWorkloadIsoDate(lastWeek.endDate);
  const monthMarkValues = new Set<number>();

  for (
    let cursor = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth(), 1));
    cursor.getTime() <= lastDate.getTime();
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    const monthStartWeek = weeks.find((week) => {
      const weekStart = parseAcademicWorkloadIsoDate(week.startDate);
      const weekEnd = parseAcademicWorkloadIsoDate(week.endDate);
      const month = cursor.getUTCMonth();
      const year = cursor.getUTCFullYear();

      return (
        weekStart.getUTCFullYear() === year &&
        weekEnd.getUTCFullYear() === year &&
        weekStart.getUTCMonth() === month &&
        weekEnd.getUTCMonth() === month
      );
    });

    if (monthStartWeek) {
      monthMarkValues.add(monthStartWeek.value);
    }
  }

  return weeks.filter((week) => monthMarkValues.has(week.value)).map((week) => week.value);
}

export function buildTeachingWeekCrossMonthMarkValues(weeks: readonly TeachingWeekOption[]) {
  return weeks
    .filter((week) => {
      const weekStart = parseAcademicWorkloadIsoDate(week.startDate);
      const weekEnd = parseAcademicWorkloadIsoDate(week.endDate);

      return (
        weekStart.getUTCFullYear() !== weekEnd.getUTCFullYear() ||
        weekStart.getUTCMonth() !== weekEnd.getUTCMonth()
      );
    })
    .map((week) => week.value);
}

export function formatTeachingWeekRange(
  startWeek: TeachingWeekOption | null,
  endWeek: TeachingWeekOption | null,
) {
  if (!startWeek || !endWeek) {
    return '整学期';
  }

  return `${startWeek.label} - ${endWeek.label}`;
}

export function resolvePeriodCount(item: AcademicWorkloadOccurrenceLike) {
  return item.periodEnd - item.periodStart + 1;
}

export function resolveOccurrenceHourHundredths(item: AcademicWorkloadOccurrenceLike) {
  const normalizedCoefficient = item.coefficient.trim();
  const [integerPartRaw = '0', decimalPartRaw = ''] = normalizedCoefficient.split('.');
  const integerPart = Number(integerPartRaw);
  const decimalPart = Number((decimalPartRaw + '00').slice(0, 2));
  const coefficientHundredths = Number.isFinite(integerPart)
    ? integerPart * 100 + (Number.isFinite(decimalPart) ? decimalPart : 0)
    : 100;

  return resolvePeriodCount(item) * coefficientHundredths;
}

export function sumOccurrenceHours(items: readonly AcademicWorkloadOccurrenceLike[]) {
  return items.reduce((total, item) => total + resolveOccurrenceHourHundredths(item), 0);
}

export function formatHours(valueInHundredths: number) {
  const normalizedValue = valueInHundredths / 100;

  return Number.isInteger(normalizedValue) ? String(normalizedValue) : normalizedValue.toFixed(2);
}

export function sortOccurrences<TItem extends AcademicWorkloadOccurrenceLike>(
  items: readonly TItem[],
) {
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

export function isBaselineOccurrence(item: AcademicWorkloadOccurrenceLike) {
  return (
    item.calcEffect === 'NORMAL' || item.calcEffect === 'CANCEL' || item.calcEffect === 'SWAP_OUT'
  );
}

export function isAddedEffectiveOccurrence(item: AcademicWorkloadOccurrenceLike) {
  return item.isEffective && (item.calcEffect === 'MAKEUP' || item.calcEffect === 'SWAP_IN');
}

export function buildAcademicWorkloadRangeSummary<
  TItem extends AcademicWorkloadOccurrenceLike,
>(input: {
  effectiveRangeEnd: number | null;
  effectiveRangeStart: number | null;
  items: readonly TItem[];
  tableViewFilter: AcademicWorkloadTableViewFilter;
}) {
  const displayedOccurrences = sortOccurrences(
    input.items.filter((item) => {
      if (input.effectiveRangeStart === null || input.effectiveRangeEnd === null) {
        return true;
      }

      return (
        item.weekIndex >= input.effectiveRangeStart && item.weekIndex <= input.effectiveRangeEnd
      );
    }),
  );
  const effectiveRangeOccurrences = displayedOccurrences.filter((item) => item.isEffective);
  const ineffectiveRangeOccurrences = displayedOccurrences.filter((item) => !item.isEffective);
  const addedEffectiveRangeOccurrences = displayedOccurrences.filter(isAddedEffectiveOccurrence);
  const baselineRangeOccurrences = displayedOccurrences.filter(isBaselineOccurrence);
  const tableOccurrences =
    input.tableViewFilter === 'deducted'
      ? ineffectiveRangeOccurrences
      : input.tableViewFilter === 'added'
        ? addedEffectiveRangeOccurrences
        : input.tableViewFilter === 'effective'
          ? effectiveRangeOccurrences
          : displayedOccurrences;
  const baselineRangeHours = sumOccurrenceHours(baselineRangeOccurrences);
  const baselineTeachingWeekCount = new Set(
    baselineRangeOccurrences.map((occurrence) => occurrence.weekIndex),
  ).size;

  return {
    addedEffectiveRangeHours: sumOccurrenceHours(addedEffectiveRangeOccurrences),
    addedEffectiveRangeOccurrences,
    baselineRangeHours,
    baselineRangeOccurrences,
    baselineTeachingWeekCount,
    baselineWeeklyHours:
      baselineTeachingWeekCount > 0 ? baselineRangeHours / baselineTeachingWeekCount : 0,
    displayedOccurrences,
    effectiveRangeHours: sumOccurrenceHours(effectiveRangeOccurrences),
    effectiveRangeOccurrences,
    ineffectiveRangeHours: sumOccurrenceHours(ineffectiveRangeOccurrences),
    ineffectiveRangeOccurrences,
    tableOccurrences,
  };
}
