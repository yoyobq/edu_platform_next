import {
  createEmptyTeachingPlanCourseDraft,
  isTeachingPlanCourseDraft,
  type TeachingPlanCourseDraft,
} from '../application/teaching-plan-sheet';

const STORAGE_PREFIX = 'my-teaching-plan:course-draft:v4';
export const TEACHING_PLAN_DRAFT_TTL_HOURS = 24;

const TEACHING_PLAN_DRAFT_TTL_MS = TEACHING_PLAN_DRAFT_TTL_HOURS * 60 * 60 * 1_000;

type StoredTeachingPlanCourseDraft = {
  draft: TeachingPlanCourseDraft;
  expiresAt: number;
  version: 4;
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

export function readTeachingPlanCourseDraft(
  storageKey: string,
  contentRowCount = 0,
): TeachingPlanCourseDraft {
  if (typeof window === 'undefined') {
    return createEmptyTeachingPlanCourseDraft(contentRowCount);
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return createEmptyTeachingPlanCourseDraft(contentRowCount);
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isStoredTeachingPlanCourseDraft(parsed)) {
      window.localStorage.removeItem(storageKey);
      return createEmptyTeachingPlanCourseDraft(contentRowCount);
    }
    if (parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(storageKey);
      return createEmptyTeachingPlanCourseDraft(contentRowCount);
    }

    return parsed.draft;
  } catch {
    return createEmptyTeachingPlanCourseDraft(contentRowCount);
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
      version: 4,
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
    value.version === 4 &&
    typeof value.expiresAt === 'number' &&
    Number.isFinite(value.expiresAt) &&
    isTeachingPlanCourseDraft(value.draft)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
