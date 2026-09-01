export type MyTeachingPlanLabLoaderData = {
  canManage: boolean;
  currentAccount: {
    accountId: number;
    displayName: string;
    lockedUpstreamLoginUserId: string | null;
  };
  currentAccountId: number;
  currentStaff: {
    displayName: string;
    staffId: string;
  } | null;
};

export type TeachingPlanCalcEffect = 'CANCEL' | 'MAKEUP' | 'NORMAL' | 'SWAP_IN' | 'SWAP_OUT';

export type TeachingPlanOccurrence = {
  calcEffect: TeachingPlanCalcEffect;
  classroomName: string | null;
  coefficient: string;
  courseCategory: string | null;
  courseName: string | null;
  date: string;
  isEffective: boolean;
  logicalDayOfWeek: number;
  periodEnd: number;
  periodStart: number;
  physicalDayOfWeek: number;
  scheduleId: number;
  semesterId: number;
  slotId: number;
  staffId: string;
  staffName: string;
  teachingClassName: string;
  weekIndex: number;
};

export type TeachingPlanOccurrenceEnvelope = {
  invalidReason: string | null;
  isComplete: boolean;
  isValid: boolean;
  items: TeachingPlanOccurrence[];
  truncationReason: string | null;
};

export type TeachingPlanTeacherOption = {
  staffId: string;
  staffName: string;
};

export type CurriculumPlanDetailReferenceItem = {
  chapterAndContent: string | null;
  dayOfWeek: number | null;
  homework: string | null;
  lessonHours: number | null;
  sectionId: string | null;
  sectionName: string | null;
  sourceDetailId: string | null;
  weekNumber: number | null;
};

export type CurriculumPlanDetailReferenceCandidate = {
  courseName: string | null;
  items: CurriculumPlanDetailReferenceItem[];
  matchKind: 'CONTAINS' | 'EXACT' | 'NGRAM' | 'OTHER_RECENT' | 'SUBSEQUENCE';
  plannedLessons: number | null;
  plannedLessonsDiff: number | null;
  rank: number;
  recommended: boolean;
  schoolYear: string;
  semester: string;
  sourcePlanId: string;
  teachingClassName: string | null;
  weekCount: number | null;
  weeklyHours: number | null;
};

export type CurriculumPlanDetailReferenceCandidatesResult = {
  expiresAt: string;
  items: CurriculumPlanDetailReferenceCandidate[];
  upstreamSessionToken: string;
  warnings: string[];
};
