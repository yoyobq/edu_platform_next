import {
  createEmptyTeachingPlanCourseDraft,
  isTeachingPlanCourseDraft,
  type TeachingPlanCourseDraft,
} from '../application/teaching-plan-sheet';

const STORAGE_PREFIX = 'my-teaching-plan:course-draft:v3';
export const TEACHING_PLAN_DRAFT_TTL_HOURS = 24;

const TEACHING_PLAN_DRAFT_TTL_MS = TEACHING_PLAN_DRAFT_TTL_HOURS * 60 * 60 * 1_000;

type StoredTeachingPlanCourseDraft = {
  draft: TeachingPlanCourseDraft;
  expiresAt: number;
  version: 3;
};

type LegacyTeachingPlanCourseDraft = {
  initialLocationApplied: boolean;
  rows: Record<string, { deliveryMode: 'OFFLINE' | 'ONLINE'; location: string }>;
  version: 2;
};

type LegacyStoredTeachingPlanCourseDraft = {
  draft: LegacyTeachingPlanCourseDraft;
  expiresAt: number;
  version: 2;
};

export function buildTeachingPlanDraftStorageKey(input: {
  currentAccountId: number;
  scheduleId: number;
  semesterId: number;
  targetStaffId: string;
}) {
  return [
    STORAGE_PREFIX,
    input.currentAccountId,
    input.targetStaffId,
    input.semesterId,
    input.scheduleId,
  ].join(':');
}

export function readTeachingPlanCourseDraft(storageKey: string): TeachingPlanCourseDraft {
  if (typeof window === 'undefined') {
    return createEmptyTeachingPlanCourseDraft();
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return createEmptyTeachingPlanCourseDraft();
    }

    const parsed: unknown = JSON.parse(raw);
    if (
      !isStoredTeachingPlanCourseDraft(parsed) &&
      !isLegacyStoredTeachingPlanCourseDraft(parsed)
    ) {
      window.localStorage.removeItem(storageKey);
      return createEmptyTeachingPlanCourseDraft();
    }
    if (parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(storageKey);
      return createEmptyTeachingPlanCourseDraft();
    }

    if (isLegacyStoredTeachingPlanCourseDraft(parsed)) {
      const migrated = migrateLegacyDraft(parsed.draft);
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ draft: migrated, expiresAt: parsed.expiresAt, version: 3 }),
      );
      return migrated;
    }

    return parsed.draft;
  } catch {
    return createEmptyTeachingPlanCourseDraft();
  }
}

export function writeTeachingPlanCourseDraft(storageKey: string, draft: TeachingPlanCourseDraft) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const storedDraft: StoredTeachingPlanCourseDraft = {
      draft,
      expiresAt: Date.now() + TEACHING_PLAN_DRAFT_TTL_MS,
      version: 3,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(storedDraft));
  } catch {
    // 本地存储不可用时仍保留当前 React 会话内的编辑结果。
  }
}

function isStoredTeachingPlanCourseDraft(value: unknown): value is StoredTeachingPlanCourseDraft {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 3 &&
    typeof value.expiresAt === 'number' &&
    Number.isFinite(value.expiresAt) &&
    isTeachingPlanCourseDraft(value.draft)
  );
}

function isLegacyStoredTeachingPlanCourseDraft(
  value: unknown,
): value is LegacyStoredTeachingPlanCourseDraft {
  if (!isRecord(value) || value.version !== 2 || !isRecord(value.draft)) {
    return false;
  }
  const draft = value.draft;
  if (
    draft.version !== 2 ||
    typeof draft.initialLocationApplied !== 'boolean' ||
    !isRecord(draft.rows) ||
    typeof value.expiresAt !== 'number' ||
    !Number.isFinite(value.expiresAt)
  ) {
    return false;
  }

  return Object.values(draft.rows).every(
    (row) =>
      isRecord(row) &&
      (row.deliveryMode === 'ONLINE' || row.deliveryMode === 'OFFLINE') &&
      typeof row.location === 'string',
  );
}

function migrateLegacyDraft(draft: LegacyTeachingPlanCourseDraft): TeachingPlanCourseDraft {
  return {
    rows: Object.fromEntries(
      Object.entries(draft.rows).map(([rowKey, row]) => [
        rowKey,
        {
          deliveryMode: row.deliveryMode,
          ...(row.location ? { locationOverride: row.location } : {}),
        },
      ]),
    ),
    version: 3,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
