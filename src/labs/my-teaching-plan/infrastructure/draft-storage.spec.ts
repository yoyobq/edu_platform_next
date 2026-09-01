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
      contentRows: [{ chapterAndContent: '第一章', homework: '作业一', id: 'content-1' }],
      rows: {
        row1: { deliveryMode: 'OFFLINE', locationOverride: '机房 5102' },
      },
      version: 4,
    });

    expect(TEACHING_PLAN_DRAFT_TTL_HOURS).toBe(24);
    expect(readTeachingPlanCourseDraft(STORAGE_KEY).rows.row1).toEqual({
      deliveryMode: 'OFFLINE',
      locationOverride: '机房 5102',
    });
    expect(readTeachingPlanCourseDraft(STORAGE_KEY).contentRows).toHaveLength(1);

    vi.mocked(Date.now).mockReturnValue(1_800_000_000_000 + 24 * 60 * 60 * 1_000);

    expect(readTeachingPlanCourseDraft(STORAGE_KEY, 2).contentRows).toHaveLength(2);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('忽略并删除旧版草稿，按当前正式课次数初始化 v4 内容行', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        draft: {
          rows: { row1: { chapterAndContent: '旧内容', deliveryMode: 'ONLINE' } },
          version: 3,
        },
        expiresAt: 1_800_000_060_000,
        version: 3,
      }),
    );

    const draft = readTeachingPlanCourseDraft(STORAGE_KEY, 3);

    expect(draft).toMatchObject({ rows: {}, version: 4 });
    expect(draft.contentRows).toHaveLength(3);
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
      contentRows: [],
      rows: {
        row1: { deliveryMode: 'OFFLINE', locationOverride: '管理员一的机房' },
      },
      version: 4,
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
