import type { TeachingPlanOccurrence } from '../types';

import type { TeachingPlanCourseProjection } from './teaching-plan-projection';

export type TeachingPlanDeliveryMode = 'OFFLINE' | 'ONLINE';

export type TeachingPlanRowDraft = {
  deliveryMode: TeachingPlanDeliveryMode;
  locationOverride?: string;
};

export type TeachingPlanContentRowDraft = {
  chapterAndContent: string;
  homework: string;
  id: string;
};

export type TeachingPlanCourseDraft = {
  contentRows: Array<TeachingPlanContentRowDraft | null>;
  rows: Record<string, TeachingPlanRowDraft>;
  version: 4;
};

export type TeachingPlanFormalRow = {
  deliveryMode: TeachingPlanDeliveryMode;
  location: string;
  occurrence: TeachingPlanOccurrence;
  periodsText: string;
  rowKey: string;
  teachingDate: string;
  teachingHours: number;
};

export type TeachingPlanDisplayRow = {
  contentRow: TeachingPlanContentRowDraft | null;
  formalRow: TeachingPlanFormalRow | null;
  rowKey: string;
};

export function createEmptyTeachingPlanCourseDraft(contentRowCount = 0): TeachingPlanCourseDraft {
  return {
    contentRows: Array.from({ length: contentRowCount }, (_, index) =>
      createEmptyTeachingPlanContentRow(`initial:${index + 1}`),
    ),
    rows: {},
    version: 4,
  };
}

export function createEmptyTeachingPlanContentRow(id = createTeachingPlanContentRowId()) {
  return {
    chapterAndContent: '',
    homework: '',
    id,
  } satisfies TeachingPlanContentRowDraft;
}

export function buildTeachingPlanFormalRows(
  course: TeachingPlanCourseProjection,
  draft: TeachingPlanCourseDraft,
): TeachingPlanFormalRow[] {
  return course.months.flatMap((month) =>
    month.dates.flatMap((dateGroup) =>
      dateGroup.occurrences.map((occurrence) => {
        const rowKey = buildTeachingPlanOccurrenceRowKey(occurrence);
        const rowDraft = draft.rows[rowKey];

        return {
          deliveryMode: rowDraft?.deliveryMode ?? 'OFFLINE',
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

export function buildTeachingPlanDisplayRows(input: {
  contentRows: readonly (TeachingPlanContentRowDraft | null)[];
  formalRows: readonly TeachingPlanFormalRow[];
}): TeachingPlanDisplayRow[] {
  return Array.from(
    { length: Math.max(input.contentRows.length, input.formalRows.length) },
    (_, index) => {
      const contentRow = input.contentRows[index] ?? null;
      const formalRow = input.formalRows[index] ?? null;
      return {
        contentRow,
        formalRow,
        rowKey: `display:${index}:${formalRow?.rowKey ?? 'extended'}`,
      };
    },
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

export function updateTeachingPlanContentRow(input: {
  contentRowId: string;
  draft: TeachingPlanCourseDraft;
  patch: Partial<Pick<TeachingPlanContentRowDraft, 'chapterAndContent' | 'homework'>>;
}): TeachingPlanCourseDraft {
  return {
    ...input.draft,
    contentRows: input.draft.contentRows.map((row) =>
      row?.id === input.contentRowId ? { ...row, ...input.patch } : row,
    ),
  };
}

export function ensureTeachingPlanContentRowAtIndex(input: {
  draft: TeachingPlanCourseDraft;
  index: number;
}): TeachingPlanCourseDraft {
  if (input.index < 0 || input.draft.contentRows[input.index]) {
    return input.draft;
  }
  const contentRows = [...input.draft.contentRows];
  while (contentRows.length <= input.index) {
    contentRows.push(null);
  }
  contentRows[input.index] = createEmptyTeachingPlanContentRow();
  return { ...input.draft, contentRows };
}

export function appendTeachingPlanContentRow(
  draft: TeachingPlanCourseDraft,
): TeachingPlanCourseDraft {
  return {
    ...draft,
    contentRows: [...draft.contentRows, createEmptyTeachingPlanContentRow()],
  };
}

export function deleteTeachingPlanContentRow(input: {
  contentRowId: string;
  draft: TeachingPlanCourseDraft;
}): TeachingPlanCourseDraft {
  return {
    ...input.draft,
    contentRows: trimTrailingEmptyContentSlots(
      input.draft.contentRows.filter((row) => row?.id !== input.contentRowId),
    ),
  };
}

export function insertTeachingPlanContentRow(input: {
  contentRow: TeachingPlanContentRowDraft;
  draft: TeachingPlanCourseDraft;
  index: number;
}): TeachingPlanCourseDraft {
  if (input.draft.contentRows.some((row) => row?.id === input.contentRow.id)) {
    return input.draft;
  }
  const contentRows = [...input.draft.contentRows];
  contentRows.splice(Math.min(Math.max(input.index, 0), contentRows.length), 0, input.contentRow);
  return { ...input.draft, contentRows };
}

export function moveTeachingPlanContentRowToEmptySlot(input: {
  draft: TeachingPlanCourseDraft;
  fromIndex: number;
  toIndex: number;
}): TeachingPlanCourseDraft {
  if (
    input.fromIndex < 0 ||
    input.fromIndex >= input.draft.contentRows.length ||
    input.toIndex < 0 ||
    input.draft.contentRows[input.toIndex]
  ) {
    return input.draft;
  }
  const moved = input.draft.contentRows[input.fromIndex];
  if (!moved) {
    return input.draft;
  }
  const contentRows = [...input.draft.contentRows];
  while (contentRows.length <= input.toIndex) {
    contentRows.push(null);
  }
  contentRows[input.fromIndex] = null;
  contentRows[input.toIndex] = moved;
  return { ...input.draft, contentRows: trimTrailingEmptyContentSlots(contentRows) };
}

export function moveTeachingPlanContentRow(input: {
  draft: TeachingPlanCourseDraft;
  fromIndex: number;
  toIndex: number;
}): TeachingPlanCourseDraft {
  if (
    input.fromIndex === input.toIndex ||
    input.fromIndex < 0 ||
    input.fromIndex >= input.draft.contentRows.length ||
    input.toIndex < 0 ||
    input.toIndex >= input.draft.contentRows.length
  ) {
    return input.draft;
  }
  const contentRows = [...input.draft.contentRows];
  const [moved] = contentRows.splice(input.fromIndex, 1);
  if (!moved) {
    return input.draft;
  }
  contentRows.splice(input.toIndex, 0, moved);
  return { ...input.draft, contentRows };
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
  if (!isRecord(value) || value.version !== 4 || !isRecord(value.rows)) {
    return false;
  }
  if (!Array.isArray(value.contentRows)) {
    return false;
  }
  const contentRowIds = new Set<string>();
  const validContentRows = value.contentRows.every((row) => {
    if (row === null) {
      return true;
    }
    if (
      !isRecord(row) ||
      typeof row.id !== 'string' ||
      !row.id.trim() ||
      typeof row.chapterAndContent !== 'string' ||
      typeof row.homework !== 'string' ||
      contentRowIds.has(row.id)
    ) {
      return false;
    }
    contentRowIds.add(row.id);
    return true;
  });
  return (
    validContentRows &&
    Object.values(value.rows).every(
      (row) =>
        isRecord(row) &&
        (row.deliveryMode === 'ONLINE' || row.deliveryMode === 'OFFLINE') &&
        (typeof row.locationOverride === 'undefined' || typeof row.locationOverride === 'string'),
    )
  );
}

function createDefaultRowDraft(): TeachingPlanRowDraft {
  return { deliveryMode: 'OFFLINE' };
}

function createTeachingPlanContentRowId() {
  return `content:${globalThis.crypto.randomUUID()}`;
}

function trimTrailingEmptyContentSlots(contentRows: Array<TeachingPlanContentRowDraft | null>) {
  const nextRows = [...contentRows];
  while (nextRows.at(-1) === null) {
    nextRows.pop();
  }
  return nextRows;
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
