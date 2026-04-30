import type {
  PersistUpstreamSessionFromResult,
  StoredUpstreamSession,
} from '@/entities/upstream-session';

import {
  type AcademicTeachingLogSaveResult,
  saveAcademicIntegratedTeachingLog,
  saveAcademicPracticeTeachingLog,
  saveAcademicTheoryTeachingLog,
} from './api';
import { isIntegratedCourseCategory, isPracticeCourseCategory } from './course-category';
import { DEFAULT_INTEGRATED_SHIFT, type JournalDraft } from './journal-draft-policy';
import { isFutureTeachingDate } from './teaching-date';

export type LectureJournalSaveWorkflowItem = {
  blockingIssue: string | null;
  canFill: boolean;
  courseCategory: string | null;
  dayOfWeek: number | null;
  journal: {
    lectureJournalDetailId: string | null;
  } | null;
  lecturePlanDetailId: string | null;
  lessonHours: number | null;
  matchedLectureJournalDetailId: string | null;
  sectionId: string | null;
  shift: string | null;
  status: 'FILLED' | 'MISSING' | 'UNMATCHED';
  teachingClassId: string | null;
  teachingDate: string | null;
  weekNumber: number | null;
};

type LectureJournalSaveWorkflowParams = {
  draft: JournalDraft;
  item: LectureJournalSaveWorkflowItem;
  persistSessionFromResult: PersistUpstreamSessionFromResult;
  session: StoredUpstreamSession;
};

type LectureJournalSaveWorkflowOutcome = {
  result: AcademicTeachingLogSaveResult;
  saveKind: 'integrated' | 'practice' | 'theory';
};

function normalizeOptionalString(value: string) {
  const normalizedValue = value.trim();

  return normalizedValue ? normalizedValue : '';
}

function resolveJournalDetailId(item: LectureJournalSaveWorkflowItem) {
  return item.matchedLectureJournalDetailId || item.journal?.lectureJournalDetailId || undefined;
}

function resolveMinSectionId(sectionId: string | null) {
  const normalizedSectionId = normalizeOptionalString(sectionId || '');

  if (!normalizedSectionId) {
    return undefined;
  }

  const matchedValue = normalizedSectionId.match(/\d+/)?.[0];

  return matchedValue || normalizedSectionId;
}

function resolveMissingSaveFieldLabels(item: LectureJournalSaveWorkflowItem, draft: JournalDraft) {
  const requiredLabels = [
    ['teachingClassId', item.teachingClassId],
    ['teachingDate', item.teachingDate],
    ['weekNumber', item.weekNumber === null ? null : String(item.weekNumber)],
    ['dayOfWeek', item.dayOfWeek === null ? null : String(item.dayOfWeek)],
    ['lessonHours', item.lessonHours === null ? null : String(item.lessonHours)],
  ] satisfies Array<[string, string | null]>;

  const missingLabels = requiredLabels
    .filter(([, value]) => !normalizeOptionalString(value || ''))
    .map(([label]) => label);

  if (isIntegratedCourseCategory(item.courseCategory)) {
    if (!normalizeOptionalString(item.lecturePlanDetailId || '')) {
      missingLabels.push('lecturePlanDetailId');
    }

    return missingLabels;
  }

  if (!normalizeOptionalString(draft.courseContent)) {
    missingLabels.push('courseContent');
  }

  if (!normalizeOptionalString(draft.homeworkAssignment)) {
    missingLabels.push('homeworkAssignment');
  }

  if (isPracticeCourseCategory(item.courseCategory)) {
    return missingLabels;
  }

  if (!normalizeOptionalString(draft.topicRecord)) {
    missingLabels.push('topicRecord');
  }

  if (!normalizeOptionalString(item.sectionId || '')) {
    missingLabels.push('sectionId');
  }

  return missingLabels;
}

export function resolveSaveValidationError(
  item: LectureJournalSaveWorkflowItem,
  draft: JournalDraft,
) {
  if (item.blockingIssue) {
    return item.blockingIssue;
  }

  if (isFutureTeachingDate(item.teachingDate)) {
    return '课程尚未开始，不能填写教学日志。';
  }

  if (isIntegratedCourseCategory(item.courseCategory) && item.status === 'UNMATCHED') {
    return '当前一体化计划项无法可靠匹配。';
  }

  if (!item.canFill) {
    return isIntegratedCourseCategory(item.courseCategory)
      ? '当前一体化计划项尚不能稳定映射。'
      : '当前课次不可保存。';
  }

  const missingLabels = resolveMissingSaveFieldLabels(item, draft);

  if (missingLabels.length > 0) {
    return `缺少必填字段：${missingLabels.join('、')}`;
  }

  if (isPracticeCourseCategory(item.courseCategory)) {
    const practiceHoursTotal =
      (draft.lectureHours || 0) + (draft.practiceHours || 0) + (draft.demonstrationHours || 0);

    if (item.lessonHours !== null && practiceHoursTotal !== item.lessonHours) {
      return `lectureLessons + trainingLessons + exampleLessons 必须等于 lessonHours，当前为 ${practiceHoursTotal} / ${item.lessonHours}`;
    }
  }

  return null;
}

export async function runLectureJournalSaveWorkflow(
  params: LectureJournalSaveWorkflowParams,
): Promise<LectureJournalSaveWorkflowOutcome> {
  const validationError = resolveSaveValidationError(params.item, params.draft);

  if (validationError) {
    throw new Error(validationError);
  }

  const commonInput = {
    dayOfWeek: String(params.item.dayOfWeek),
    lessonHours: params.item.lessonHours as number,
    teachingClassId: params.item.teachingClassId as string,
    teachingDate: params.item.teachingDate as string,
    upstreamSessionToken: params.session.upstreamSessionToken,
    weekNumber: String(params.item.weekNumber),
  };

  const saveKind = isIntegratedCourseCategory(params.item.courseCategory)
    ? 'integrated'
    : isPracticeCourseCategory(params.item.courseCategory)
      ? 'practice'
      : 'theory';

  const result =
    saveKind === 'integrated'
      ? await saveAcademicIntegratedTeachingLog({
          ...commonInput,
          completeAndSummary: params.draft.completeAndSummary,
          disciplineSituation: params.draft.disciplineSituation,
          lectureJournalDetailId: params.item.matchedLectureJournalDetailId || undefined,
          lecturePlanDetailId: params.item.lecturePlanDetailId as string,
          problemAndSolve: params.draft.problemAndSolve,
          securityAndMaintain: params.draft.securityAndMaintain,
          shift: params.draft.shift || params.item.shift || DEFAULT_INTEGRATED_SHIFT,
        })
      : saveKind === 'practice'
        ? await saveAcademicPracticeTeachingLog({
            ...commonInput,
            courseContent: params.draft.courseContent,
            disciplineSituation: params.draft.disciplineSituation,
            exampleLessons: params.draft.demonstrationHours ?? 0,
            homeworkAssignment: params.draft.homeworkAssignment,
            lectureJournalDetailId: resolveJournalDetailId(params.item),
            lectureLessons: params.draft.lectureHours ?? 0,
            lecturePlanDetailId: params.item.lecturePlanDetailId || undefined,
            problemAndSolve: params.draft.problemAndSolve,
            productionProjectTitle: params.draft.productionProjectTitle,
            securityAndMaintain: params.draft.securityAndMaintain,
            shift: params.draft.shift || params.item.shift || undefined,
            topicRecord: params.draft.topicRecord || undefined,
            trainingLessons: params.draft.practiceHours ?? 0,
          })
        : await saveAcademicTheoryTeachingLog({
            ...commonInput,
            courseContent: params.draft.courseContent,
            homeworkAssignment: params.draft.homeworkAssignment,
            lectureJournalDetailId: resolveJournalDetailId(params.item),
            lecturePlanDetailId: params.item.lecturePlanDetailId || undefined,
            minSectionId: resolveMinSectionId(params.item.sectionId),
            sectionId: params.item.sectionId as string,
            topicRecord: params.draft.topicRecord,
          });

  if (!result.success) {
    throw new Error(result.msg || '上游未保存成功。');
  }

  params.persistSessionFromResult(params.session, result);

  return {
    result,
    saveKind,
  };
}
