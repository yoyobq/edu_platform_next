// src/features/academic-workload/application/projection-invalid-reason.spec.ts

import { describe, expect, it } from 'vitest';

import { formatAcademicProjectionInvalidReason } from './projection-invalid-reason';

describe('academic projection invalid reason', () => {
  it('provides actionable Chinese messages for class and military training failures', () => {
    expect(formatAcademicProjectionInvalidReason('TEACHING_CLASS_LOCAL_CLASS_UNRESOLVED')).toBe(
      '课表中的教学班无法唯一匹配本地班级，请先同步班级。',
    );
    expect(formatAcademicProjectionInvalidReason('MILITARY_TRAINING_CLASS_SCOPE_CONFLICT')).toBe(
      '军训作用范围冲突，请检查班级招生起点或排课数据。',
    );
  });
});
