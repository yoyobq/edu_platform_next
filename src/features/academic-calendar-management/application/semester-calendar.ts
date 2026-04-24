import type { AcademicCalendarEventRecord, AcademicSemesterRecord } from './types';

export type SemesterWeekDay = {
  date: Date;
  dateKey: string;
  isExamPeriod: boolean;
  isExamStart: boolean;
  isFirstTeachingDate: boolean;
  isToday: boolean;
  isOutsideSemester: boolean;
  isSemesterEnd: boolean;
  isSemesterStart: boolean;
};

export type SemesterWeek = {
  days: SemesterWeekDay[];
  endDate: string;
  hasToday: boolean;
  key: string;
  label: string;
  weekNumber: number | null;
  startDate: string;
};

export type SemesterMonthSpan = {
  key: string;
  label: string;
  span: number;
  startIndex: number;
};

export type LatestRequestSequence = {
  begin: () => number;
  invalidate: () => number;
  isLatest: (sequence: number) => boolean;
};

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function createLatestRequestSequence(): LatestRequestSequence {
  let currentSequence = 0;

  return {
    begin() {
      currentSequence += 1;

      return currentSequence;
    },
    invalidate() {
      currentSequence += 1;

      return currentSequence;
    },
    isLatest(sequence: number) {
      return sequence === currentSequence;
    },
  };
}

export function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

export function formatIsoDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(value: string) {
  const date = parseIsoDate(value);

  return new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'short',
  }).format(date);
}

export function formatMonthDay(value: string) {
  const date = parseIsoDate(value);
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');

  return `${month}-${day}`;
}

export function formatWeekday(value: string) {
  const date = parseIsoDate(value);

  return WEEKDAY_LABELS[(date.getUTCDay() + 6) % 7];
}

export function isAdjustedTeachingEvent(event: AcademicCalendarEventRecord) {
  return (
    event.originalDate !== null &&
    (event.eventType === 'HOLIDAY_MAKEUP' ||
      event.eventType === 'WEEKDAY_SWAP' ||
      event.teachingCalcEffect === 'MAKEUP' ||
      event.teachingCalcEffect === 'SWAP')
  );
}

export function resolveEventDisplayTopic(event: AcademicCalendarEventRecord) {
  if (isAdjustedTeachingEvent(event) && event.originalDate) {
    return `调 ${formatMonthDay(event.originalDate)} 课(${formatWeekday(event.originalDate)})`;
  }

  return event.topic;
}

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 86400000);
}

function startOfWeek(date: Date) {
  const weekday = (date.getUTCDay() + 6) % 7;

  return addDays(date, -weekday);
}

function endOfWeek(date: Date) {
  const weekday = (date.getUTCDay() + 6) % 7;

  return addDays(date, 6 - weekday);
}

function isSameIsoDate(left: Date, right: Date) {
  return formatIsoDate(left) === formatIsoDate(right);
}

function isDateWithinRange(date: Date, start: Date, end: Date) {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

export function buildSemesterWeeks(
  semester: AcademicSemesterRecord,
  options: { today?: Date } = {},
): SemesterWeek[] {
  const semesterStart = parseIsoDate(semester.startDate);
  const semesterEnd = parseIsoDate(semester.endDate);
  const examStart = parseIsoDate(semester.examStartDate);
  const examWeekEnd = endOfWeek(examStart);
  const firstTeachingDate = parseIsoDate(semester.firstTeachingDate);
  const firstWeekStart = startOfWeek(semesterStart);
  const firstTeachingWeekStart = startOfWeek(firstTeachingDate);
  const lastWeekEnd = endOfWeek(semesterEnd);
  const todaySource = options.today ?? new Date();
  const todayUtc = new Date(
    Date.UTC(todaySource.getFullYear(), todaySource.getMonth(), todaySource.getDate()),
  );
  const weeks: SemesterWeek[] = [];

  for (
    let cursor = firstWeekStart, index = 1;
    cursor.getTime() <= lastWeekEnd.getTime();
    cursor = addDays(cursor, 7), index += 1
  ) {
    const weekEnd = addDays(cursor, 6);
    const days: SemesterWeekDay[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const currentDate = addDays(cursor, dayIndex);

      days.push({
        date: currentDate,
        dateKey: formatIsoDate(currentDate),
        isExamPeriod:
          isDateWithinRange(currentDate, examStart, examWeekEnd) && !isWeekendDate(currentDate),
        isExamStart: isSameIsoDate(currentDate, examStart),
        isFirstTeachingDate: isSameIsoDate(currentDate, firstTeachingDate),
        isToday: isSameIsoDate(currentDate, todayUtc),
        isOutsideSemester: !isDateWithinRange(currentDate, semesterStart, semesterEnd),
        isSemesterEnd: isSameIsoDate(currentDate, semesterEnd),
        isSemesterStart: isSameIsoDate(currentDate, semesterStart),
      });
    }

    weeks.push({
      days,
      endDate: formatIsoDate(weekEnd),
      hasToday: isDateWithinRange(todayUtc, cursor, weekEnd),
      key: formatIsoDate(cursor),
      label: `第 ${index} 周`,
      startDate: formatIsoDate(cursor),
      weekNumber:
        cursor.getTime() < firstTeachingWeekStart.getTime()
          ? null
          : Math.floor((cursor.getTime() - firstTeachingWeekStart.getTime()) / (7 * 86400000)) + 1,
    });
  }

  return weeks;
}

export function buildEventBuckets(events: AcademicCalendarEventRecord[]) {
  const buckets = new Map<string, AcademicCalendarEventRecord[]>();

  for (const event of events) {
    const current = buckets.get(event.eventDate) ?? [];
    current.push(event);
    buckets.set(event.eventDate, current);
  }

  return buckets;
}

function resolveWeekMonth(week: SemesterWeek) {
  const representativeDay = week.days.find((day) => !day.isOutsideSemester) ?? week.days[0];
  const year = representativeDay.date.getUTCFullYear();
  const month = representativeDay.date.getUTCMonth() + 1;

  return {
    key: `${year}-${String(month).padStart(2, '0')}`,
    label: `${month}月`,
  };
}

export function buildWeekMonthSpans(weeks: SemesterWeek[]): SemesterMonthSpan[] {
  const spans: SemesterMonthSpan[] = [];

  for (const [index, week] of weeks.entries()) {
    const weekMonth = resolveWeekMonth(week);
    const currentSpan = spans.at(-1);

    if (currentSpan?.key === weekMonth.key) {
      currentSpan.span += 1;
    } else {
      spans.push({
        key: weekMonth.key,
        label: weekMonth.label,
        span: 1,
        startIndex: index,
      });
    }
  }

  return spans;
}

export function countTeachingWeeks(weeks: SemesterWeek[]) {
  const firstExamWeekIndex = weeks.findIndex((week) =>
    week.days.some((day) => day.isExamStart || day.isExamPeriod),
  );
  const teachingWeeks = firstExamWeekIndex === -1 ? weeks : weeks.slice(0, firstExamWeekIndex);

  return teachingWeeks.filter((week) => week.weekNumber !== null).length;
}

export function isWeekendDate(date: Date) {
  const weekday = date.getUTCDay();

  return weekday === 0 || weekday === 6;
}

export function shouldHighlightCurrentWeekDay(day: SemesterWeekDay) {
  return !day.isOutsideSemester && !isWeekendDate(day.date);
}
