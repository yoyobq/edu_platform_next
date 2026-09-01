import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildTeachingPlanDraftStorageKey,
  readTeachingPlanCourseDraft,
  TEACHING_PLAN_DRAFT_TTL_HOURS,
  writeTeachingPlanCourseDraft,
} from './draft-storage';

const STORAGE_KEY = buildTeachingPlanDraftStorageKey({
  currentAccountId: 1001,
  scheduleId: 3,
  semesterId: 2,
  targetStaffId: 'T001',
});

describe('teaching plan draft storage', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: createStorage() });
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('只在最后编辑后的 24 小时内恢复本地草稿', () => {
    writeTeachingPlanCourseDraft(STORAGE_KEY, {
      initialLocationApplied: true,
      rows: {
        row1: { deliveryMode: 'OFFLINE', location: '机房 5102' },
      },
      version: 2,
    });

    expect(TEACHING_PLAN_DRAFT_TTL_HOURS).toBe(24);
    expect(readTeachingPlanCourseDraft(STORAGE_KEY).rows.row1).toEqual({
      deliveryMode: 'OFFLINE',
      location: '机房 5102',
    });

    vi.mocked(Date.now).mockReturnValue(1_800_000_000_000 + 24 * 60 * 60 * 1_000);

    expect(readTeachingPlanCourseDraft(STORAGE_KEY).rows).toEqual({});
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('删除不带期限的旧草稿，避免形成无限期本地存储', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ initialLocationApplied: false, rows: {}, version: 1 }),
    );

    expect(readTeachingPlanCourseDraft(STORAGE_KEY).rows).toEqual({});
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('同一目标教师的草稿按当前登录账号隔离', () => {
    const otherAccountStorageKey = buildTeachingPlanDraftStorageKey({
      currentAccountId: 1002,
      scheduleId: 3,
      semesterId: 2,
      targetStaffId: 'T001',
    });

    writeTeachingPlanCourseDraft(STORAGE_KEY, {
      initialLocationApplied: false,
      rows: {
        row1: { deliveryMode: 'OFFLINE', location: '管理员一的机房' },
      },
      version: 2,
    });

    expect(readTeachingPlanCourseDraft(otherAccountStorageKey).rows).toEqual({});
    expect(otherAccountStorageKey).not.toBe(STORAGE_KEY);
  });
});

function createStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}
