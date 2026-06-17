// src/features/academic-curriculum-plan-homepage/domain/curriculum-plan-homepage-types.ts

import type { AuthAccessGroup } from '@/entities/auth-access';

export type CurrentCurriculumPlanHomepageAccount = {
  accessGroup: AuthAccessGroup[];
  accountId: number;
  displayName: string;
  lockedUpstreamLoginUserId: string | null;
  slotGroup: string[];
  staffId: string | null;
};

export type CurriculumPlanHomepageListItem = {
  className: string | null;
  courseCategory: string | null;
  courseName: string | null;
  planId: string;
  rawPlan: Record<string, unknown> | null;
  reviewStatus: string | null;
  schoolYear: string | null;
  semester: string | null;
  staffId: string | null;
  sstsCourseId: string | null;
  sstsTeachingClassId: string | null;
  teachingClassId: string | null;
  weekCount: number | null;
  weekNumberText: string | null;
  weeklyHours: number | null;
};

export type CurriculumPlanHomepageListResult = {
  count: number;
  expiresAt: string | null;
  items: CurriculumPlanHomepageListItem[];
  upstreamSessionToken: string;
};

export type CurriculumPlanHomepageDetailResult = {
  expiresAt: string | null;
  homepage: Record<string, unknown> | null;
  planId: string;
  upstreamSessionToken: string;
};

export type SaveCurriculumPlanHomepageResult = {
  code: string | null;
  data: unknown;
  expiresAt: string | null;
  msg: string | null;
  success: boolean;
  upstreamSessionToken: string;
};

export type CurriculumPlanHomepageDepartmentOption = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  shortName: string | null;
};

export type CurriculumPlanHomepagePrefillPhase = 'FINAL' | 'INITIAL';

export type CurriculumPlanHomepagePrefillMode = 'managed' | 'my';

export type CurriculumPlanHomepagePrefillFieldWriteRule = {
  field: string;
  mode: string;
  value: string;
};

export type CurriculumPlanHomepagePrefillResult = {
  fieldWriteRules: CurriculumPlanHomepagePrefillFieldWriteRule[];
  homepagePatch: Record<string, unknown>;
  warnings: string[];
};

export type CurriculumPlanHomepagePrefillContext = {
  courseName: string | null;
  schoolYear: string;
  semester: string;
  sstsCourseId: string;
  sstsTeachingClassId: string;
  staffId?: string;
  weekCount: number | null;
  weeklyHours: number | null;
};

export type CurriculumPlanHomepageReferenceCandidateValues = {
  improvementMeasures: string | null;
  teachingObjectives: string | null;
  textbookName: string | null;
};

export type CurriculumPlanHomepageReferenceCandidateItem = {
  courseName: string | null;
  matchKind: string;
  plannedLessons: number | null;
  plannedLessonsDiff: number | null;
  rank: number;
  recommended: boolean;
  schoolYear: string;
  semester: string;
  sourcePlanId: string;
  teachingClassName: string | null;
  values: CurriculumPlanHomepageReferenceCandidateValues;
  weekCount: number | null;
  weeklyHours: number | null;
};

export type CurriculumPlanHomepageReferenceCandidateGroup = {
  applyMode: string;
  groupKey: string;
  items: CurriculumPlanHomepageReferenceCandidateItem[];
  phase: CurriculumPlanHomepagePrefillPhase;
  targetFields: string[];
  title: string;
};

export type CurriculumPlanHomepageReferenceCandidatesResult = {
  candidateGroups: CurriculumPlanHomepageReferenceCandidateGroup[];
  expiresAt: string | null;
  upstreamSessionToken: string;
  warnings: string[];
};

export type CurriculumPlanHomepageTeachingEndChapterCandidateItem = {
  displayText: string;
  lecturePlanDetailId: string | null;
  sectionId: string | null;
  sectionName: string | null;
  teachingChapterContent: string | null;
  topicName: string | null;
  value: string;
  weekNumber: string | null;
};

export type CurriculumPlanHomepageTeachingEndChapterWriteRule = {
  field: string;
  mode: string;
  prefix: string;
};

export type CurriculumPlanHomepageTeachingEndChapterCandidateGroup = {
  applyMode: string;
  groupKey: string;
  items: CurriculumPlanHomepageTeachingEndChapterCandidateItem[];
  phase: CurriculumPlanHomepagePrefillPhase;
  targetFields: string[];
  title: string;
  writeRule: CurriculumPlanHomepageTeachingEndChapterWriteRule;
};

export type CurriculumPlanHomepageTeachingEndChapterCandidatesResult = {
  candidateGroups: CurriculumPlanHomepageTeachingEndChapterCandidateGroup[];
  expiresAt: string | null;
  upstreamSessionToken: string;
  warnings: string[];
};
