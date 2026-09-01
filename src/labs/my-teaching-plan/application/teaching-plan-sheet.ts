import type { TeachingPlanOccurrence } from '../types';

import type { TeachingPlanCourseProjection } from './teaching-plan-projection';

export type TeachingPlanDeliveryMode = 'OFFLINE' | 'ONLINE';

export type TeachingPlanRowDraft = {
  deliveryMode: TeachingPlanDeliveryMode;
  location: string;
};

export type TeachingPlanCourseDraft = {
  initialLocationApplied: boolean;
  rows: Record<string, TeachingPlanRowDraft>;
  version: 2;
};

export type TeachingPlanSheetRow = {
  chapterAndContent: '';
  deliveryMode: TeachingPlanDeliveryMode;
  homework: '';
  location: string;
  occurrence: TeachingPlanOccurrence;
  periodsText: string;
  rowKey: string;
  sourceClassroomName: string | null;
  teachingDate: string;
  teachingHours: number;
};

export function createEmptyTeachingPlanCourseDraft(): TeachingPlanCourseDraft {
  return {
    initialLocationApplied: false,
    rows: {},
    version: 2,
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
        const rowDraft = draft.rows[rowKey] ?? createDefaultRowDraft();

        return {
          chapterAndContent: '',
          deliveryMode: rowDraft.deliveryMode,
          homework: '',
          location: rowDraft.location,
          occurrence,
          periodsText: formatOccurrencePeriods(occurrence),
          rowKey,
          sourceClassroomName: occurrence.classroomName,
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

export function fillEmptyTeachingPlanLocations(input: {
  draft: TeachingPlanCourseDraft;
  location: string;
  markInitialApplied?: boolean;
  rowKeys: readonly string[];
}): { draft: TeachingPlanCourseDraft; filledCount: number } {
  const location = input.location.trim();
  if (!location) {
    return { draft: input.draft, filledCount: 0 };
  }

  let filledCount = 0;
  const rows = { ...input.draft.rows };

  for (const rowKey of input.rowKeys) {
    const row = rows[rowKey] ?? createDefaultRowDraft();
    if (row.location.trim()) {
      continue;
    }

    rows[rowKey] = { ...row, location };
    filledCount += 1;
  }

  return {
    draft: {
      ...input.draft,
      initialLocationApplied:
        input.markInitialApplied === true || input.draft.initialLocationApplied,
      rows,
    },
    filledCount,
  };
}

export function isTeachingPlanCourseDraft(value: unknown): value is TeachingPlanCourseDraft {
  if (
    !isRecord(value) ||
    value.version !== 2 ||
    typeof value.initialLocationApplied !== 'boolean'
  ) {
    return false;
  }
  if (!isRecord(value.rows)) {
    return false;
  }

  return Object.values(value.rows).every(
    (row) =>
      isRecord(row) &&
      (row.deliveryMode === 'ONLINE' || row.deliveryMode === 'OFFLINE') &&
      typeof row.location === 'string',
  );
}

function createDefaultRowDraft(): TeachingPlanRowDraft {
  return { deliveryMode: 'OFFLINE', location: '' };
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
