// src/features/academic-curriculum-plan-homepage/application/plan-item-policy.spec.ts

import { describe, expect, it } from 'vitest';

import type { CurriculumPlanHomepageListItem } from '../domain/curriculum-plan-homepage-types';

import {
  resolveCurriculumPlanHomepageItemKey,
  resolveCurriculumPlanHomepageTeachingClassId,
} from './plan-item-policy';

function createItem(input: {
  planId: string | null;
  teachingClassId?: string | null;
}): CurriculumPlanHomepageListItem {
  return {
    className: '信息2604',
    courseCategory: '专业课',
    courseName: '网页设计',
    planId: input.planId,
    rawPlan: null,
    reviewStatus: null,
    schoolYear: '2026',
    semester: '1',
    staffId: '2226',
    sstsCourseId: 'COURSE-001',
    sstsTeachingClassId: input.teachingClassId ?? null,
    teachingClassId: input.teachingClassId ?? null,
    weekCount: 16,
    weekNumberText: '1-16周',
    weeklyHours: 4,
  };
}

describe('curriculum plan homepage item policy', () => {
  it('keeps the same item key before and after the upstream plan id is created', () => {
    const beforeCreate = createItem({ planId: null, teachingClassId: 'CLASS-001' });
    const afterCreate = createItem({ planId: 'PLAN-001', teachingClassId: 'CLASS-001' });

    expect(resolveCurriculumPlanHomepageItemKey(beforeCreate)).toBe('teaching-class:CLASS-001');
    expect(resolveCurriculumPlanHomepageItemKey(afterCreate)).toBe(
      resolveCurriculumPlanHomepageItemKey(beforeCreate),
    );
  });

  it('falls back to raw upstream teaching class identity', () => {
    const item = {
      ...createItem({ planId: null }),
      rawPlan: { TEACHING_CLASS_ID: ' RAW-CLASS-001 ' },
    };

    expect(resolveCurriculumPlanHomepageTeachingClassId(item)).toBe('RAW-CLASS-001');
    expect(resolveCurriculumPlanHomepageItemKey(item)).toBe('teaching-class:RAW-CLASS-001');
  });
});
