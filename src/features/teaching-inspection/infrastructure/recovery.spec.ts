// src/features/teaching-inspection/infrastructure/recovery.spec.ts
import { describe, expect, it } from 'vitest';

import {
  closureDetails,
  discardLessonPreparations,
  putRecovery,
  readRecovery,
  type RecoveryEntry,
  removeRecovery,
} from './recovery';
function memory(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
const entry: RecoveryEntry = {
  accountId: 1,
  semesterId: 2,
  kind: 'PROGRESS',
  resourceKey: '2:c',
  action: 'PREPARE',
  upstreamLoginId: 'T1',
  clientRequestId: 'original-request',
  prepare: {
    semesterId: 2,
    kind: 'PROGRESS',
    resourceKey: '2:c',
    clientRequestId: 'original-request',
    round: 2,
    checkDate: '2026-10-01',
    scheduleVersion: 1,
    retryOfOperationId: 'uncertain-operation',
  },
};
describe('检查恢复存储', () => {
  it('保存请求保留关闭所需日期轮次，旧记录从原准备请求恢复，不能借用其他资源', () => {
    const storage = memory();
    const save: RecoveryEntry = {
      ...entry,
      action: 'SAVE',
      clientRequestId: 'save-request',
      prepare: undefined,
      parentRequestId: entry.clientRequestId,
      round: 2,
      checkDate: '2026-10-01',
    };
    putRecovery(save, storage);
    expect(closureDetails(readRecovery(1, storage)[0], [])).toEqual({
      round: 2,
      checkDate: '2026-10-01',
    });
    const legacy = { ...save, round: undefined, checkDate: undefined };
    expect(closureDetails(legacy, [entry])).toEqual({ round: 2, checkDate: '2026-10-01' });
    expect(closureDetails(legacy, [{ ...entry, resourceKey: 'other' }])).toBeNull();
    expect(closureDetails(legacy, [])).toBeNull();
  });
  it('保留原版本与风险确认，剔除材料、评分和凭据，按账号隔离', () => {
    const storage = memory();
    putRecovery(
      {
        ...entry,
        prepare: { ...entry.prepare!, upstreamSessionToken: 'secret', scores: [99] },
        material: 'private',
      } as RecoveryEntry,
      storage,
    );
    expect(readRecovery(1, storage)).toEqual([entry]);
    expect(readRecovery(2, storage)).toEqual([]);
    expect(storage.getItem(storage.key(0)!)).not.toMatch(/secret|scores|material/);
    putRecovery({ ...entry, operationId: 'op' }, storage);
    expect(readRecovery(1, storage)).toHaveLength(1);
    removeRecovery(1, [entry.clientRequestId], storage);
    expect(readRecovery(1, storage)).toEqual([]);
  });
  it('存储损坏或写入失败必须显式失败', () => {
    const storage = memory();
    storage.setItem('teaching-inspection.recovery.v1.1', '{');
    expect(() => readRecovery(1, storage)).toThrow();
    storage.clear();
    storage.setItem = () => {
      throw new Error('quota');
    };
    expect(() => putRecovery(entry, storage)).toThrow('quota');
  });
});

it('教案旧PREPARE清理前补齐SAVE轮次日期，其他检查类型保持不变', () => {
  const storage = memory();
  const lesson: RecoveryEntry = {
    ...entry,
    kind: 'LESSON_PLAN',
    clientRequestId: 'lesson-prep',
    prepare: { ...entry.prepare!, kind: 'LESSON_PLAN', clientRequestId: 'lesson-prep' },
  };
  putRecovery(lesson, storage);
  putRecovery(
    {
      ...lesson,
      action: 'SAVE',
      clientRequestId: 'lesson-save',
      prepare: undefined,
      parentRequestId: 'lesson-prep',
    },
    storage,
  );
  putRecovery(entry, storage);
  const result = discardLessonPreparations(1, storage);
  expect(result.find((row) => row.clientRequestId === 'lesson-prep')).toBeUndefined();
  expect(result.find((row) => row.clientRequestId === 'lesson-save')).toMatchObject({
    round: 2,
    checkDate: '2026-10-01',
  });
  expect(result.find((row) => row.clientRequestId === entry.clientRequestId)).toEqual(entry);
});
