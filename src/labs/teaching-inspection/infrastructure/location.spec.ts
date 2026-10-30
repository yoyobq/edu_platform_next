// src/labs/teaching-inspection/infrastructure/location.spec.ts
import { describe, expect, it } from 'vitest';

import { readLocation, writeLocation } from './location';
describe('教学检查链接', () => {
  it('缺省使用服务端组织，明确保留选定系和全校范围', () => {
    expect(readLocation(new URLSearchParams()).departmentId).toBeUndefined();
    for (const departmentId of ['ORG0302', null]) {
      const value = { ...readLocation(new URLSearchParams('kind=progress')), departmentId };
      expect(readLocation(writeLocation(value)).departmentId).toBe(departmentId);
    }
  });
  it('新入口默认检查时间，保留旧类型深链接', () => {
    expect(readLocation(new URLSearchParams()).section).toBe('dates');
    expect(readLocation(new URLSearchParams('kind=progress')).section).toBe('checks');
    const dates = readLocation(
      new URLSearchParams('view=dates&kind=progress&semester=2&resource=2:course'),
    );
    expect(readLocation(writeLocation(dates))).toMatchObject({
      section: 'dates',
      semesterId: 2,
      resourceKey: '2:course',
    });
    expect(writeLocation(dates).has('kind')).toBe(false);
  });
  it('非法类型和分页回归缺省，移除非筛选字段', () => {
    const value = readLocation(
      new URLSearchParams('kind=bad&page=-2&semester=Infinity&token=secret'),
    );
    expect(value.type.kind).toBe('LESSON_PLAN');
    expect(value.page).toBe(1);
    expect(value.semesterId).toBeUndefined();
    expect(writeLocation(value).toString()).toBe('kind=lesson-plan');
  });
  it('保留类型、学期、教师、关键词和页码', () => {
    const params = new URLSearchParams('kind=assignment&semester=2&teacher=T&keyword=课程&page=3');
    expect(readLocation(writeLocation(readLocation(params)))).toEqual(readLocation(params));
  });
});
