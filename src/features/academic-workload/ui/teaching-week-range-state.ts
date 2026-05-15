// src/features/academic-workload/ui/teaching-week-range-state.ts
import { useCallback, useMemo, useState } from 'react';
import type { SliderSingleProps } from 'antd';

import {
  buildTeachingWeekMonthMarkValues,
  formatTeachingWeekRange,
  parseAcademicWorkloadIsoDate,
  type TeachingWeekOption,
} from '../application/workload-baseline';

type TeachingWeekRangeSelection = {
  end: number | null;
  start: number | null;
};

function formatShortDate(value: string) {
  const date = parseAcademicWorkloadIsoDate(value);

  return new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatTeachingWeekDateSpan(
  startWeek: TeachingWeekOption | null,
  endWeek: TeachingWeekOption | null,
) {
  if (!startWeek || !endWeek) {
    return '未选择';
  }

  return `${formatShortDate(startWeek.startDate)} - ${formatShortDate(endWeek.endDate)}`;
}

export function formatTeachingWeekDateRange(week: TeachingWeekOption | null) {
  if (!week) {
    return '未选择';
  }

  return `${formatShortDate(week.startDate)} - ${formatShortDate(week.endDate)}`;
}

function resolveSelectedWeekValue(
  requestedValue: number | null,
  fallbackValue: number | null,
  teachingWeeks: readonly TeachingWeekOption[],
) {
  if (requestedValue !== null && teachingWeeks.some((week) => week.value === requestedValue)) {
    return requestedValue;
  }

  return fallbackValue;
}

export function useTeachingWeekRange(
  teachingWeeks: readonly TeachingWeekOption[],
  options: { onRangeChange?: () => void } = {},
) {
  const { onRangeChange } = options;
  const [selection, setSelection] = useState<TeachingWeekRangeSelection>({
    end: null,
    start: null,
  });
  const firstTeachingWeekValue = teachingWeeks[0]?.value ?? null;
  const lastTeachingWeekValue = teachingWeeks.at(-1)?.value ?? null;
  const selectedWeekStart = resolveSelectedWeekValue(
    selection.start,
    firstTeachingWeekValue,
    teachingWeeks,
  );
  const selectedWeekEnd = resolveSelectedWeekValue(
    selection.end,
    lastTeachingWeekValue,
    teachingWeeks,
  );
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
  const selectedTeachingWeekCount =
    effectiveRangeStart !== null && effectiveRangeEnd !== null
      ? effectiveRangeEnd - effectiveRangeStart + 1
      : null;
  const sliderValue: [number, number] | undefined =
    firstTeachingWeekValue !== null && lastTeachingWeekValue !== null
      ? [selectedWeekStart ?? firstTeachingWeekValue, selectedWeekEnd ?? lastTeachingWeekValue]
      : undefined;
  const marks = useMemo<SliderSingleProps['marks']>(() => {
    if (firstTeachingWeekValue === null || lastTeachingWeekValue === null) {
      return undefined;
    }

    return buildTeachingWeekMonthMarkValues(teachingWeeks).reduce<
      NonNullable<SliderSingleProps['marks']>
    >((nextMarks, week) => {
      nextMarks[week] = String(week);
      return nextMarks;
    }, {});
  }, [firstTeachingWeekValue, lastTeachingWeekValue, teachingWeeks]);
  const isFullTeachingWeekRange =
    firstTeachingWeekValue === null ||
    lastTeachingWeekValue === null ||
    (effectiveRangeStart === firstTeachingWeekValue && effectiveRangeEnd === lastTeachingWeekValue);

  const setTeachingWeekRange = useCallback(
    (nextStart: number | null, nextEnd: number | null) => {
      onRangeChange?.();
      setSelection({
        end: nextEnd,
        start: nextStart,
      });
    },
    [onRangeChange],
  );
  const resetTeachingWeekRange = useCallback(() => {
    onRangeChange?.();
    setSelection({
      end: lastTeachingWeekValue,
      start: firstTeachingWeekValue,
    });
  }, [firstTeachingWeekValue, lastTeachingWeekValue, onRangeChange]);

  return {
    effectiveRangeEnd,
    effectiveRangeStart,
    firstTeachingWeekValue,
    isFullTeachingWeekRange,
    lastTeachingWeekValue,
    marks,
    resetTeachingWeekRange,
    selectedEndWeek,
    selectedStartWeek,
    selectedTeachingWeekCount,
    selectedWeekEnd,
    selectedWeekStart,
    setTeachingWeekRange,
    sliderValue,
    teachingWeeks,
  };
}

export type TeachingWeekRangeState = ReturnType<typeof useTeachingWeekRange>;

export function formatTeachingWeekRangeLabel(range: TeachingWeekRangeState) {
  return formatTeachingWeekRange(range.selectedStartWeek, range.selectedEndWeek);
}
