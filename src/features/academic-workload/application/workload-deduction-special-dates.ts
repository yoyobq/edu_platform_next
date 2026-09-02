// src/features/academic-workload/application/workload-deduction-special-dates.ts

export type AcademicWorkloadDeductionCalendarEventLike = {
  eventDate: string;
  eventType: string;
  originalDate: string | null;
  teachingCalcEffect: string;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export function buildAcademicWorkloadDeductionDateColumns(input: {
  calendarEvents: readonly AcademicWorkloadDeductionCalendarEventLike[];
  deductionDates: readonly string[];
  showSportsMeetDeductions: boolean;
}) {
  const dates = new Set(
    input.deductionDates.map(normalizeText).filter((date): date is string => Boolean(date)),
  );

  input.calendarEvents.forEach((event) => {
    const eventType = normalizeText(event.eventType).toUpperCase();

    if (!input.showSportsMeetDeductions && eventType === 'SPORTS_MEET') {
      return;
    }

    const teachingCalcEffect = normalizeText(event.teachingCalcEffect).toUpperCase();
    const date =
      teachingCalcEffect === 'CANCEL'
        ? normalizeText(event.eventDate)
        : teachingCalcEffect === 'SWAP'
          ? normalizeText(event.originalDate)
          : '';

    if (date) {
      dates.add(date);
    }
  });

  return Array.from(dates).sort((left, right) => left.localeCompare(right));
}
