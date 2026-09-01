import type { TeachingPlanOccurrence } from '../types';

import type { TeachingPlanCourseProjection } from './teaching-plan-projection';

export type TeachingPlanDeliveryMode = 'OFFLINE' | 'ONLINE';

export type TeachingPlanRowDraft = {
  deliveryMode: TeachingPlanDeliveryMode;
  locationOverride?: string;
};

export type TeachingPlanCourseDraft = {
  rows: Record<string, TeachingPlanRowDraft>;
  version: 3;
};

export type TeachingPlanSheetRow = {
  chapterAndContent: '';
  deliveryMode: TeachingPlanDeliveryMode;
  homework: '';
  location: string;
  occurrence: TeachingPlanOccurrence;
  periodsText: string;
  rowKey: string;
  teachingDate: string;
  teachingHours: number;
};

export function createEmptyTeachingPlanCourseDraft(): TeachingPlanCourseDraft {
  return {
    rows: {},
    version: 3,
  };
}

export function buildTeachingPlanSheetRows(
  course: TeachingPlanCourseProjection,
  draft: TeachingPlanCourseDraft,
): TeachingPlanSheetRow[] {
  return course.months.flatMap((month) =>
    month.dates.flatMap((dateGroup) =>
      dateGroup.occurrences.map((occurrence) => {
        const rowKey = buildTeachingPlanOccurrenceRowKey(occurrence);
        const rowDraft = draft.rows[rowKey];

        return {
          chapterAndContent: '',
          deliveryMode: rowDraft?.deliveryMode ?? 'OFFLINE',
          homework: '',
          location: rowDraft?.locationOverride ?? course.classroomName ?? '',
          occurrence,
          periodsText: formatOccurrencePeriods(occurrence),
          rowKey,
          teachingDate: occurrence.date,
          teachingHours: occurrence.periodEnd - occurrence.periodStart + 1,
        };
      }),
    ),
  );
}

export function buildTeachingPlanOccurrenceRowKey(occurrence: TeachingPlanOccurrence) {
  return [occurrence.date, occurrence.slotId, occurrence.calcEffect].join(':');
}

export function updateTeachingPlanRowDraft(input: {
  draft: TeachingPlanCourseDraft;
  patch: Partial<TeachingPlanRowDraft>;
  rowKey: string;
}): TeachingPlanCourseDraft {
  return {
    ...input.draft,
    rows: {
      ...input.draft.rows,
      [input.rowKey]: {
        ...(input.draft.rows[input.rowKey] ?? createDefaultRowDraft()),
        ...input.patch,
      },
    },
  };
}

export function setTeachingPlanRowLocationOverride(input: {
  draft: TeachingPlanCourseDraft;
  locationOverride?: string;
  rowKey: string;
}): TeachingPlanCourseDraft {
  const current = input.draft.rows[input.rowKey] ?? createDefaultRowDraft();
  const next = { ...current };
  if (typeof input.locationOverride === 'string') {
    next.locationOverride = input.locationOverride;
  } else {
    delete next.locationOverride;
  }

  return {
    ...input.draft,
    rows: {
      ...input.draft.rows,
      [input.rowKey]: next,
    },
  };
}

export function clearTeachingPlanLocationOverrides(
  draft: TeachingPlanCourseDraft,
): TeachingPlanCourseDraft {
  const rows = Object.fromEntries(
    Object.entries(draft.rows).map(([rowKey, row]) => {
      const next = { ...row };
      delete next.locationOverride;
      return [rowKey, next];
    }),
  );

  return { ...draft, rows };
}

export function isTeachingPlanCourseDraft(value: unknown): value is TeachingPlanCourseDraft {
  if (!isRecord(value) || value.version !== 3) {
    return false;
  }
  if (!isRecord(value.rows)) {
    return false;
  }

  return Object.values(value.rows).every(
    (row) =>
      isRecord(row) &&
      (row.deliveryMode === 'ONLINE' || row.deliveryMode === 'OFFLINE') &&
      (typeof row.locationOverride === 'undefined' || typeof row.locationOverride === 'string'),
  );
}

function createDefaultRowDraft(): TeachingPlanRowDraft {
  return { deliveryMode: 'OFFLINE' };
}

function formatOccurrencePeriods(occurrence: TeachingPlanOccurrence) {
  return Array.from(
    { length: occurrence.periodEnd - occurrence.periodStart + 1 },
    (_, index) => occurrence.periodStart + index,
  ).join(',');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
