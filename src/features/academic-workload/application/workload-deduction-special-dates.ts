// src/features/academic-workload/application/workload-deduction-special-dates.ts

export type AcademicWorkloadDeductionCalendarEventLike = {
  eventDate: string;
  eventType: string;
  originalDate: string | null;
  teachingCalcEffect: string;
};

export type AcademicWorkloadDeductionDateColumn = {
  date: string;
  isRepeatedTeachingDate: boolean;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export function buildAcademicWorkloadDeductionDateColumns(input: {
  calendarEvents: readonly AcademicWorkloadDeductionCalendarEventLike[];
  deductionDates: readonly string[];
  showSportsMeetDeductions: boolean;
}) {
  const columnsByDate = new Map<string, AcademicWorkloadDeductionDateColumn>();
  const offsetOriginalDates = new Set(
    input.calendarEvents
      .filter((event) => {
        const effect = normalizeText(event.teachingCalcEffect).toUpperCase();

        return effect === 'MAKEUP' || effect === 'SWAP';
      })
      .map((event) => normalizeText(event.originalDate))
      .filter((date): date is string => Boolean(date)),
  );

  const ensureColumn = (date: string, isRepeatedTeachingDate: boolean) => {
    if (!date) {
      return;
    }

    const currentColumn = columnsByDate.get(date);
    columnsByDate.set(date, {
      date,
      isRepeatedTeachingDate:
        isRepeatedTeachingDate || currentColumn?.isRepeatedTeachingDate === true,
    });
  };

  input.deductionDates.forEach((date) => ensureColumn(normalizeText(date), false));

  input.calendarEvents.forEach((event) => {
    const eventType = normalizeText(event.eventType).toUpperCase();

    if (!input.showSportsMeetDeductions && eventType === 'SPORTS_MEET') {
      return;
    }

    const teachingCalcEffect = normalizeText(event.teachingCalcEffect).toUpperCase();
    if (
      teachingCalcEffect === 'CANCEL' &&
      !offsetOriginalDates.has(normalizeText(event.eventDate))
    ) {
      ensureColumn(normalizeText(event.eventDate), false);
    } else if (teachingCalcEffect === 'REPEAT') {
      ensureColumn(normalizeText(event.eventDate), true);
    }
  });

  return Array.from(columnsByDate.values()).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}
