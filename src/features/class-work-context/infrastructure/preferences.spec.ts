// src/features/class-work-context/infrastructure/preferences.spec.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readWorkClass, writeWorkClass } from './preferences';

afterEach(() => vi.unstubAllGlobals());
describe('工作班级浏览器偏好', () => {
  it('同一账号可恢复，账号之间隔离，清除只影响指定账号', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    expect(writeWorkClass(1, 'A')).toBe(true);
    expect(readWorkClass(1)).toBe('A');
    expect(readWorkClass(2)).toBeNull();
    writeWorkClass(2, 'B');
    writeWorkClass(1, null);
    expect(readWorkClass(1)).toBeNull();
    expect(readWorkClass(2)).toBe('B');
  });
  it('浏览器禁用存储时不阻断页面工作', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('storage unavailable');
      },
    });
    expect(readWorkClass(1)).toBeNull();
    expect(writeWorkClass(1, 'A')).toBe(false);
  });
});
