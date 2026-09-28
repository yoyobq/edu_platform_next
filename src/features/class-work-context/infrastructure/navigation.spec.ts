// src/features/class-work-context/infrastructure/navigation.spec.ts
import { describe, expect, it } from 'vitest';

import {
  buildGovernancePath,
  CARD_PATH,
  readClassWorkScope,
  readInspectionReturn,
} from './navigation';

describe('班务导航范围', () => {
  it('携带目标班级、学期、学生并返回原学生的检查', () => {
    const path = buildGovernancePath('comments', { classId: 'A', studentId: 'S1', semesterId: 3 });
    const search = path.slice(path.indexOf('?'));
    expect(readClassWorkScope(search)).toMatchObject({
      classId: 'A',
      studentId: 'S1',
      semesterId: 3,
    });
    expect(readInspectionReturn(search)).toBe(`${CARD_PATH}?classId=A&studentId=S1&inspect=1`);
  });
  it('毕业鉴定跳转保留业务类型', () => {
    const path = buildGovernancePath('comments', {
      classId: 'A',
      studentId: 'S1',
      commentKind: 'GRADUATION',
    });
    expect(readClassWorkScope(path.slice(path.indexOf('?'))).commentKind).toBe('GRADUATION');
  });
  it.each(['https://example.com', '//example.com', '/admin/users', `${CARD_PATH}?classId=A`])(
    '拒绝无效回跳 %s',
    (target) => {
      expect(readInspectionReturn(`?returnTo=${encodeURIComponent(target)}`)).toBeNull();
    },
  );
  it.each(['0', '-1', '1.5', '9007199254740992', 'abc'])('不把非法学期 %s 带入请求', (value) => {
    expect(readClassWorkScope(`?semesterId=${value}`).semesterId).toBeUndefined();
  });
});
