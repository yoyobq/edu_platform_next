import { isPracticeCourseCategory } from './course-category';
import {
  DEFAULT_INTEGRATED_SHIFT,
  DEFAULT_INTEGRATED_SHIFT_NAME,
  resolveShiftName,
} from './journal-draft-policy';
import type {
  AcademicIntegratedTeachingLogPrefillPreview,
  LectureJournalExpectedOccurrence,
  LectureJournalReconciliationItem,
} from './types';

export type JournalEditableCardItem = {
  blockingIssue: string | null;
  canFill: boolean;
  completeAndSummary: string | null;
  courseCategory: string | null;
  courseContent: string | null;
  courseId: string | null;
  courseName: string | null;
  dayOfWeek: number | null;
  disciplineSituation: string | null;
  homework: string | null;
  expectedOccurrences: LectureJournalExpectedOccurrence[];
  journal: LectureJournalReconciliationItem['journal'];
  key: string;
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
  schoolYear: string | null;
  sectionId: string | null;
  sectionName: string | null;
  securityAndMaintain: string | null;
  semester: string | null;
  shift: string | null;
  shiftName: string | null;
  status: LectureJournalReconciliationItem['status'];
  teacherId: string | null;
  teacherName: string | null;
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
  practiceDemonstrationHours: number | null;
  practiceLectureHours: number | null;
  practicePracticeHours: number | null;
  practiceTeachingChapterContent: string | null;
  practiceTopicName: string | null;
};

const reconciliationEditableItemCache = new WeakMap<
  LectureJournalReconciliationItem,
  JournalEditableCardItem
>();
const integratedPreviewEditableItemCache = new WeakMap<
  AcademicIntegratedTeachingLogPrefillPreview,
  JournalEditableCardItem
>();

function buildItemKey(item: {
  lecturePlanDetailId: string | null;
  lecturePlanId: string | null;
  matchKey?: string | null;
  reason?: string | null;
}) {
  return [
    item.lecturePlanDetailId || 'detail',
    item.lecturePlanId || 'plan',
    item.matchKey || 'match',
    item.reason || 'reason',
  ].join('-');
}

function buildPracticePlanFields(item: {
  courseCategory: string | null;
  demonstrationHours?: number | null;
  lectureHours?: number | null;
  practiceHours?: number | null;
  teachingChapterContent?: string | null;
  topicName?: string | null;
}) {
  if (!isPracticeCourseCategory(item.courseCategory)) {
    return {
      practiceDemonstrationHours: null,
      practiceLectureHours: null,
      practicePracticeHours: null,
      practiceTeachingChapterContent: null,
      practiceTopicName: null,
    };
  }

  return {
    practiceDemonstrationHours: item.demonstrationHours ?? null,
    practiceLectureHours: item.lectureHours ?? null,
    practicePracticeHours: item.practiceHours ?? null,
    practiceTeachingChapterContent: item.teachingChapterContent ?? null,
    practiceTopicName: item.topicName ?? null,
  };
}

export function buildEditableCardItemFromReconciliation(
  item: LectureJournalReconciliationItem,
): JournalEditableCardItem {
  const cachedItem = reconciliationEditableItemCache.get(item);

  if (cachedItem) {
    return cachedItem;
  }

  const practicePlanFields = buildPracticePlanFields(item);

  const editableItem = {
    blockingIssue: item.blockingIssue,
    canFill: item.canFill,
    completeAndSummary: null,
    courseCategory: item.courseCategory,
    courseContent: item.courseContent,
    courseId: item.courseId,
    courseName: item.courseName,
    dayOfWeek: item.dayOfWeek,
    disciplineSituation: null,
    expectedOccurrences: item.expectedOccurrences,
    homework: item.homework,
    journal: item.journal,
    key: buildItemKey(item),
    learningSessionContent: null,
    learningSessionNo: null,
    learningSessionTarget: null,
    learningTaskName: null,
    learningTaskNo: null,
    learningTaskText: null,
    lecturePlanDetailId: item.lecturePlanDetailId,
    lecturePlanId: item.lecturePlanId,
    lessonHours: item.lessonHours,
    matchedLectureJournalDetailId: item.journal?.lectureJournalDetailId ?? null,
    problemAndSolve: null,
    schoolYear: item.schoolYear,
    sectionId: item.sectionId,
    sectionName: item.sectionName,
    securityAndMaintain: null,
    semester: item.semester,
    shift: null,
    shiftName: null,
    status: item.status,
    teacherId: item.teacherId,
    teacherName: item.teacherName,
    teachingClassId: item.teachingClassId,
    teachingClassName: item.teachingClassName,
    teachingDate: item.teachingDate,
    teachingUnitAchievement: null,
    teachingUnitContent: null,
    teachingUnitName: null,
    teachingUnitNo: null,
    teachingUnitTarget: null,
    teachingUnitText: null,
    warnings: item.warnings,
    weekNumber: item.weekNumber,
    ...practicePlanFields,
  };

  reconciliationEditableItemCache.set(item, editableItem);

  return editableItem;
}

export function buildEditableCardItemFromIntegratedPreview(
  item: AcademicIntegratedTeachingLogPrefillPreview,
): JournalEditableCardItem {
  const cachedItem = integratedPreviewEditableItemCache.get(item);

  if (cachedItem) {
    return cachedItem;
  }

  const resolvedShift = item.shift || DEFAULT_INTEGRATED_SHIFT;

  const editableItem = {
    blockingIssue: item.blockingIssue,
    canFill: item.canFill,
    completeAndSummary: item.completeAndSummary,
    courseCategory: '3',
    courseContent: null,
    courseId: null,
    courseName: item.courseName,
    dayOfWeek: item.dayOfWeek,
    disciplineSituation: item.disciplineSituation,
    expectedOccurrences: item.expectedOccurrences,
    homework: null,
    journal: null,
    key: buildItemKey({
      lecturePlanDetailId: item.lecturePlanDetailId,
      lecturePlanId: item.lecturePlanId,
      matchKey: `integrated-preview-${item.status}`,
      reason: item.blockingIssue,
    }),
    learningSessionContent: item.learningSessionContent,
    learningSessionNo: item.learningSessionNo,
    learningSessionTarget: item.learningSessionTarget,
    learningTaskName: item.learningTaskName,
    learningTaskNo: item.learningTaskNo,
    learningTaskText: item.learningTaskText,
    lecturePlanDetailId: item.lecturePlanDetailId,
    lecturePlanId: item.lecturePlanId,
    lessonHours: item.lessonHours,
    matchedLectureJournalDetailId: item.matchedLectureJournalDetailId,
    practiceDemonstrationHours: null,
    practiceLectureHours: null,
    practicePracticeHours: null,
    practiceTeachingChapterContent: null,
    practiceTopicName: null,
    problemAndSolve: item.problemAndSolve,
    schoolYear: null,
    sectionId: null,
    sectionName: null,
    securityAndMaintain: item.securityAndMaintain,
    semester: null,
    shift: item.shift,
    shiftName: resolveShiftName(resolvedShift) || DEFAULT_INTEGRATED_SHIFT_NAME,
    status: item.status,
    teacherId: null,
    teacherName: null,
    teachingClassId: item.teachingClassId,
    teachingClassName: item.teachingClassName,
    teachingDate: item.teachingDate,
    teachingUnitAchievement: item.teachingUnitAchievement,
    teachingUnitContent: item.teachingUnitContent,
    teachingUnitName: item.teachingUnitName,
    teachingUnitNo: item.teachingUnitNo,
    teachingUnitTarget: item.teachingUnitTarget,
    teachingUnitText: item.teachingUnitText,
    warnings: item.warnings,
    weekNumber: item.weekNumber,
  };

  integratedPreviewEditableItemCache.set(item, editableItem);

  return editableItem;
}
