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
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`请输入${label}。`);
  }

  return normalizedValue;
}

export function normalizeOptionalText(value?: string | null) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

export function normalizeOptionalDate(value?: string | null) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
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
  if (preferredSelection && records.some((record) => record.id === preferredSelection)) {
    return preferredSelection;
  }

  if (currentSelection && records.some((record) => record.id === currentSelection)) {
    return currentSelection;
  }

  return records[0]?.id ?? null;
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
    name: '',
    schoolYear: now.getFullYear(),
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
    name: normalizeRequiredText(values.name, '学期名称'),
    schoolYear: values.schoolYear,
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
