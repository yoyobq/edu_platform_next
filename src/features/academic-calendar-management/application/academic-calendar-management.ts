import {
  pickAcademicSemesterId,
  sortAcademicSemestersForDisplay,
} from '@/entities/academic-semester';

import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
} from '@/shared/form-normalization';

import type {
  AcademicCalendarEventDayPeriod,
  AcademicCalendarEventRecord,
  AcademicSemesterRecord,
  CalendarEventFormValues,
  CreateAcademicCalendarEventInput,
  CreateAcademicSemesterInput,
  EventFilters,
  ListAcademicCalendarEventsInput,
  SemesterFormValues,
} from './types';

export function normalizeRequiredText(value: string, label: string) {
  return normalizeRequiredTextValue(value, { label });
}

export function normalizeOptionalText(value?: string | null) {
  return normalizeOptionalTextValue(value, 'to_undefined');
}

export function normalizeOptionalDate(value?: string | null) {
  return normalizeOptionalTextValue(value, 'to_undefined');
}

export function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    year: 'numeric',
  });
}

export function getSemesterDisplayName(record: AcademicSemesterRecord) {
  return `${record.name} · ${record.schoolYear}-${record.termNumber}`;
}

export function sortSemesters(records: AcademicSemesterRecord[]) {
  return sortAcademicSemestersForDisplay(records);
}

function getDayPeriodOrder(value: AcademicCalendarEventDayPeriod) {
  switch (value) {
    case 'MORNING':
      return 0;
    case 'AFTERNOON':
      return 1;
    case 'ALL_DAY':
      return 2;
    default:
      return 99;
  }
}

export function sortCalendarEvents(records: AcademicCalendarEventRecord[]) {
  return [...records].sort((left, right) => {
    if (left.eventDate !== right.eventDate) {
      return left.eventDate.localeCompare(right.eventDate);
    }

    if (left.dayPeriod !== right.dayPeriod) {
      return getDayPeriodOrder(left.dayPeriod) - getDayPeriodOrder(right.dayPeriod);
    }

    return left.id - right.id;
  });
}

export function pickNextSemesterId(
  records: AcademicSemesterRecord[],
  currentSelection: number | null,
  preferredSelection?: number | null,
) {
  return pickAcademicSemesterId(records, currentSelection, { preferredSelection });
}

export function buildAcademicCalendarEventQueryInput(
  semesterId: number,
  filters: EventFilters,
): ListAcademicCalendarEventsInput {
  return {
    eventDate: normalizeOptionalDate(filters.eventDate),
    eventType: filters.eventType,
    limit: 500,
    recordStatus: filters.recordStatus,
    semesterId,
  };
}

export function createEmptyEventFilters(): EventFilters {
  return {
    eventDate: undefined,
    eventType: undefined,
    recordStatus: undefined,
  };
}

export function buildDefaultSemesterFormValues(
  now: Pick<Date, 'getFullYear'> = new Date(),
): SemesterFormValues {
  return {
    endDate: '',
    examStartDate: '',
    firstTeachingDate: '',
    isCurrent: false,
    isVisible: true,
    name: '',
    schoolYear: now.getFullYear(),
    sortOrder: 0,
    startDate: '',
    termNumber: 1,
  };
}

export function buildDefaultEventFormValues(
  selectedSemesterId: number | null,
): CalendarEventFormValues {
  return {
    dayPeriod: 'ALL_DAY',
    eventDate: '',
    eventType: 'ACTIVITY',
    originalDate: undefined,
    recordStatus: 'ACTIVE',
    ruleNote: undefined,
    semesterId: selectedSemesterId ?? undefined,
    teachingCalcEffect: 'NO_CHANGE',
    topic: '',
    version: 1,
  };
}

export function normalizeSemesterFormValues(
  values: SemesterFormValues,
): CreateAcademicSemesterInput {
  return {
    endDate: values.endDate,
    examStartDate: values.examStartDate,
    firstTeachingDate: values.firstTeachingDate,
    isCurrent: values.isCurrent,
    isVisible: values.isVisible,
    name: normalizeRequiredText(values.name, '学期名称'),
    schoolYear: values.schoolYear,
    sortOrder: values.sortOrder,
    startDate: values.startDate,
    termNumber: values.termNumber,
  };
}

export function normalizeCalendarEventFormValues(
  values: CalendarEventFormValues,
): CreateAcademicCalendarEventInput {
  const semesterId = values.semesterId;

  if (typeof semesterId !== 'number' || !Number.isInteger(semesterId) || semesterId <= 0) {
    throw new Error('请选择归属学期。');
  }

  return {
    dayPeriod: values.dayPeriod,
    eventDate: values.eventDate,
    eventType: values.eventType,
    originalDate: normalizeOptionalDate(values.originalDate),
    recordStatus: values.recordStatus,
    ruleNote: normalizeOptionalText(values.ruleNote),
    semesterId,
    teachingCalcEffect: values.teachingCalcEffect,
    topic: normalizeRequiredText(values.topic, '事件标题'),
    version: values.version,
  };
}

export function buildEventMutationRefreshPlan(
  currentSelectedSemesterId: number | null,
  savedSemesterId: number,
) {
  if (currentSelectedSemesterId !== savedSemesterId) {
    return {
      nextSelectedSemesterId: savedSemesterId,
      reloadSemesterId: null,
    };
  }

  return {
    nextSelectedSemesterId: currentSelectedSemesterId,
    reloadSemesterId: savedSemesterId,
  };
}
