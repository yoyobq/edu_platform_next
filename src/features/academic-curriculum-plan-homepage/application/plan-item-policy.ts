// src/features/academic-curriculum-plan-homepage/application/plan-item-policy.ts

import type { CurriculumPlanHomepageListItem } from '../domain/curriculum-plan-homepage-types';

function readOptionalItemKeyPart(value: unknown) {
  return typeof value === 'string' ? value.trim() || null : null;
}

export function resolveCurriculumPlanHomepageTeachingClassId(item: CurriculumPlanHomepageListItem) {
  return (
    readOptionalItemKeyPart(item.teachingClassId) ??
    readOptionalItemKeyPart(item.sstsTeachingClassId) ??
    readOptionalItemKeyPart(item.rawPlan?.TEACHING_CLASS_ID) ??
    readOptionalItemKeyPart(item.rawPlan?.SELECTEDKEY)
  );
}

export function resolveCurriculumPlanHomepageItemKey(item: CurriculumPlanHomepageListItem) {
  const teachingClassId = resolveCurriculumPlanHomepageTeachingClassId(item);

  if (teachingClassId) {
    return `teaching-class:${teachingClassId}`;
  }

  if (item.planId) {
    return `plan:${item.planId}`;
  }

  return `fallback:${item.schoolYear ?? ''}:${item.semester ?? ''}:${item.staffId ?? ''}:${
    item.courseName ?? ''
  }:${item.className ?? ''}`;
}
