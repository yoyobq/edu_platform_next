import { describe, expect, it } from 'vitest';

import {
  resolveNicknameWorkbenchGreeting,
  resolveWorkbenchTimeGreeting,
} from './workbench-greeting';

function atTime(value: string) {
  return new Date(`2026-05-05T${value}:00`);
}

describe('workbench greeting', () => {
  it('resolves formal greeting boundaries', () => {
    expect(resolveWorkbenchTimeGreeting(atTime('05:59'))).toEqual({
      formalMessage: '夜深了，请休息吧',
      label: '凌晨',
    });
    expect(resolveWorkbenchTimeGreeting(atTime('06:00'))).toEqual({
      formalMessage: null,
      label: '早上',
    });
    expect(resolveWorkbenchTimeGreeting(atTime('11:00'))).toEqual({
      formalMessage: null,
      label: '中午',
    });
    expect(resolveWorkbenchTimeGreeting(atTime('13:30'))).toEqual({
      formalMessage: null,
      label: '下午',
    });
    expect(resolveWorkbenchTimeGreeting(atTime('17:30'))).toEqual({
      formalMessage: null,
      label: '晚上',
    });
    expect(resolveWorkbenchTimeGreeting(atTime('23:00'))).toEqual({
      formalMessage: '夜深了，请休息吧',
      label: '凌晨',
    });
  });

  it('keeps nickname easter egg boundaries independent from formal greeting', () => {
    expect(resolveNicknameWorkbenchGreeting(atTime('06:59'))).toBe('这就对了嘛，起来 High');
    expect(resolveNicknameWorkbenchGreeting(atTime('07:00'))).toBe('怎么才来，快开工');
    expect(resolveNicknameWorkbenchGreeting(atTime('13:29'))).toBe('别睡了，查漏补缺');
    expect(resolveNicknameWorkbenchGreeting(atTime('13:30'))).toBe('怎么没精打采的，干活了');
    expect(resolveNicknameWorkbenchGreeting(atTime('17:00'))).toBe('白天又偷懒，来不及了吧');
  });
});
