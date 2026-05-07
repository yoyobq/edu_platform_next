export type LectureJournalReconciliationStatus = 'FILLED' | 'MISSING' | 'UNMATCHED';

export type MatchedLectureJournalSummary = {
  completeAndSummary: string | null;
  courseContent: string | null;
  disciplineSituation: string | null;
  homeworkAssignment: string | null;
  lectureJournalDetailId: string | null;
  lectureJournalId: string | null;
  problemAndSolve: string | null;
  rawJournal: unknown;
  securityAndMaintain: string | null;
  shift: string | null;
  statusCode: string | null;
  statusName: string | null;
  topicRecord: string | null;
};

export type LectureJournalExpectedOccurrence = {
  date: string;
  dayOfWeek: number;
  lessonHours: number;
  periodEnd: number;
  periodStart: number;
  weekNumber: number;
};

export type AcademicIntegratedTeachingLogPrefillPreview = {
  blockingIssue: string | null;
  canFill: boolean;
  completeAndSummary: string | null;
  courseName: string | null;
  dayOfWeek: number | null;
  disciplineSituation: string | null;
  expectedOccurrences: LectureJournalExpectedOccurrence[];
  learningSessionContent: string | null;
  learningSessionNo: number | null;
  learningSessionTarget: string | null;
  learningTaskName: string | null;
  learningTaskNo: number | null;
  learningTaskText: string | null;
  lecturePlanDetailId: string | null;
  lecturePlanId: string | null;
  lessonHours: number | null;
  matchedLectureJournalDetailId: string | null;
  problemAndSolve: string | null;
  securityAndMaintain: string | null;
  shift: string | null;
  status: LectureJournalReconciliationStatus;
  teachingClassId: string | null;
  teachingClassName: string | null;
  teachingDate: string | null;
  teachingUnitAchievement: string | null;
  teachingUnitContent: string | null;
  teachingUnitName: string | null;
  teachingUnitNo: number | null;
  teachingUnitTarget: string | null;
  teachingUnitText: string | null;
  warnings: string[];
  weekNumber: number | null;
};

export type LectureJournalReconciliationItem = {
  blockingIssue: string | null;
  canFill: boolean;
  completeAndSummary: string | null;
  courseCategory: string | null;
  courseContent: string | null;
  courseId: string | null;
  courseName: string | null;
  dayOfWeek: number | null;
  demonstrationHours: number | null;
  disciplineSituation: string | null;
  expectedOccurrences: LectureJournalExpectedOccurrence[];
  homework: string | null;
  journal: MatchedLectureJournalSummary | null;
  learningSessionContent: string | null;
  learningSessionNo: number | null;
  learningSessionTarget: string | null;
  learningTaskName: string | null;
  learningTaskNo: number | null;
  learningTaskText: string | null;
  lectureHours: number | null;
  lecturePlanDetailId: string | null;
  lecturePlanId: string | null;
  lessonHours: number | null;
  matchKey: string | null;
  practiceHours: number | null;
  problemAndSolve: string | null;
  reason: string | null;
  schoolYear: string | null;
  sectionId: string | null;
  sectionName: string | null;
  securityAndMaintain: string | null;
  semester: string | null;
  shift: string | null;
  status: LectureJournalReconciliationStatus;
  teacherId: string | null;
  teacherName: string | null;
  teachingChapterContent: string | null;
  teachingClassId: string | null;
  teachingClassName: string | null;
  teachingDate: string | null;
  teachingUnitAchievement: string | null;
  teachingUnitContent: string | null;
  teachingUnitName: string | null;
  teachingUnitNo: number | null;
  teachingUnitTarget: string | null;
  teachingUnitText: string | null;
  topicName: string | null;
  warnings: string[];
  weekNumber: number | null;
};

export type UnmatchedLectureJournalPlanItem = {
  lecturePlanDetailId: string | null;
  lecturePlanId: string | null;
  rawPlan: unknown;
  rawPlanDetail: unknown;
  reason: string;
  teachingClassId: string | null;
};

export type LectureJournalReconciliationResult = {
  filledCount: number;
  items: LectureJournalReconciliationItem[];
  journalCount: number;
  missingCount: number;
  planCount: number;
  planDetailCount: number;
  unmatchedPlanItemCount: number;
  unmatchedPlanItems: UnmatchedLectureJournalPlanItem[];
};

export type AcademicTeachingLogPrefillItem = {
  calcEffect: unknown;
  classroomName: string | null;
  courseCategory: string | null;
  courseName: string | null;
  date: string;
  isEffective: boolean;
  periodEnd: number;
  periodStart: number;
  scheduleId: number;
  semesterId: number;
  slotId: number;
  staffId: string;
  teachingClassName: string;
};

export type AcademicTeachingLogPrefillResult = {
  blockingIssue: string | null;
  canFill: boolean;
  expiresAt: string | null;
  integratedPreviews: AcademicIntegratedTeachingLogPrefillPreview[];
  items: AcademicTeachingLogPrefillItem[];
  reconciliation: LectureJournalReconciliationResult | null;
  upstreamSessionToken: string | null;
  warnings: string[];
};

export type FetchAcademicTeachingLogPrefillInput = {
  endDate?: string;
  semesterId: number;
  staffId: string;
  startDate?: string;
  upstreamSessionToken?: string;
};

export type FetchMyAcademicTeachingLogPrefillInput = Omit<
  FetchAcademicTeachingLogPrefillInput,
  'staffId'
>;

export type AcademicTeachingLogSaveResult = {
  code: number;
  expiresAt: string;
  lectureJournalDetailId: string | null;
  msg: string;
  success: boolean;
  upstreamSessionToken: string;
};

export type SaveAcademicTheoryTeachingLogInput = {
  courseContent: string;
  dayOfWeek: string;
  homeworkAssignment: string;
  lectureJournalDetailId?: string;
  lecturePlanDetailId?: string;
  lessonHours: number;
  minSectionId?: string;
  sectionId: string;
  teachingClassId: string;
  teachingDate: string;
  topicRecord: string;
  upstreamSessionToken: string;
  weekNumber: string;
};

export type SaveAcademicPracticeTeachingLogInput = {
  completeAndSummary?: string;
  courseContent: string;
  dayOfWeek: string;
  disciplineSituation?: string;
  exampleLessons?: number;
  homeworkAssignment: string;
  lectureJournalDetailId?: string;
  lectureLessons?: number;
  lecturePlanDetailId?: string;
  lessonHours: number;
  minSectionId?: string;
  problemAndSolve?: string;
  productionBackNum?: number;
  productionName?: string;
  productionPlanNum?: number;
  productionProjectTitle?: string;
  productionQualifiedNum?: number;
  productionWasteNum?: number;
  sectionId?: string;
  sectionName?: string;
  securityAndMaintain?: string;
  shift?: string;
  teachingClassId: string;
  teachingDate: string;
  topicRecord?: string;
  trainingLessons?: number;
  upstreamSessionToken: string;
  weekNumber: string;
};

export type SaveAcademicIntegratedTeachingLogInput = {
  completeAndSummary?: string;
  courseContent?: string;
  dayOfWeek: string;
  disciplineSituation?: string;
  homeworkAssignment?: string;
  lectureJournalDetailId?: string;
  lecturePlanDetailId: string;
  lessonHours: number;
  problemAndSolve?: string;
  securityAndMaintain?: string;
  shift?: string;
  teachingClassId: string;
  teachingDate: string;
  topicRecord?: string;
  upstreamSessionToken: string;
  weekNumber: string;
};
