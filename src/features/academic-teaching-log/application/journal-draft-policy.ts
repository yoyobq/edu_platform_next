import { isIntegratedCourseCategory, isPracticeCourseCategory } from './course-category';
import type { LectureJournalReconciliationItem } from './types';

export type JournalDraft = {
  completeAndSummary: string;
  courseContent: string;
  demonstrationHours: number | null;
  disciplineSituation: string;
  homeworkAssignment: string;
  lectureHours: number | null;
  problemAndSolve: string;
  practiceHours: number | null;
  productionProjectTitle: string;
  learningObjective: string;
  securityAndMaintain: string;
  shift: string;
  shiftName: string;
  submitStatusText: string;
  topicRecord: string;
};

export type JournalDraftMap = Record<string, JournalDraft>;

export type JournalDraftSourceItem = {
  completeAndSummary?: string | null;
  courseCategory: string | null;
  courseContent?: string | null;
  courseId?: string | null;
  courseName?: string | null;
  disciplineSituation?: string | null;
  homework?: string | null;
  journal: LectureJournalReconciliationItem['journal'] | null;
  key: string;
  learningSessionContent?: string | null;
  learningSessionTarget?: string | null;
  learningTaskText?: string | null;
  practiceDemonstrationHours?: number | null;
  practiceLectureHours?: number | null;
  practicePracticeHours?: number | null;
  practiceTeachingChapterContent?: string | null;
  practiceTopicName?: string | null;
  problemAndSolve?: string | null;
  securityAndMaintain?: string | null;
  shift?: string | null;
  status: LectureJournalReconciliationItem['status'];
  teachingClassId?: string | null;
  teachingDate?: string | null;
  teachingUnitContent?: string | null;
  teachingUnitName?: string | null;
  teachingUnitNo?: number | null;
  teachingUnitTarget?: string | null;
  teachingUnitText?: string | null;
};

export const DEFAULT_DISCIPLINE_SITUATION = '遵章守纪';
export const DEFAULT_INTEGRATED_SHIFT = '3';
export const SHIFT_NAME_BY_VALUE = {
  '1': '早班',
  '2': '中班',
  '3': '常日班',
} as const;
export const DEFAULT_INTEGRATED_SHIFT_NAME = SHIFT_NAME_BY_VALUE[DEFAULT_INTEGRATED_SHIFT];
export const DEFAULT_SECURITY_AND_MAINTAIN = '正常';

export const EMPTY_JOURNAL_DRAFT: JournalDraft = {
  completeAndSummary: '',
  courseContent: '',
  demonstrationHours: null,
  disciplineSituation: '',
  homeworkAssignment: '',
  lectureHours: null,
  problemAndSolve: '',
  practiceHours: null,
  productionProjectTitle: '',
  learningObjective: '',
  securityAndMaintain: '',
  shift: '',
  shiftName: '',
  submitStatusText: '',
  topicRecord: '',
};

export function resolveShiftName(shift: string | null | undefined) {
  const normalizedShift = shift?.trim() || '';

  if (!normalizedShift) {
    return '';
  }

  return SHIFT_NAME_BY_VALUE[normalizedShift as keyof typeof SHIFT_NAME_BY_VALUE] || '';
}

function stringifyRawValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function pickRawObjectString(rawValue: unknown, keys: string[]) {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return '';
  }

  const record = rawValue as Record<string, unknown>;
  const lowerKeyMap = new Map(Object.keys(record).map((key) => [key.toLowerCase(), key]));

  for (const key of keys) {
    const exactValue = stringifyRawValue(record[key]);

    if (exactValue) {
      return exactValue;
    }

    const matchedKey = lowerKeyMap.get(key.toLowerCase());
    const matchedValue = matchedKey ? stringifyRawValue(record[matchedKey]) : '';

    if (matchedValue) {
      return matchedValue;
    }
  }

  return '';
}

function resolveIntegratedTeachingUnitName(
  item: JournalDraftSourceItem,
  journal?: LectureJournalReconciliationItem['journal'] | null,
) {
  return (
    pickRawObjectString(journal?.rawJournal, [
      'SSS002NAME',
      'TEACHING_UNIT_NAME',
      'teachingUnitName',
      'TOPIC_NAME',
      'topicName',
    ]) ||
    item.teachingUnitText ||
    item.teachingUnitName ||
    (item.teachingUnitNo === null || item.teachingUnitNo === undefined
      ? ''
      : String(item.teachingUnitNo)) ||
    item.practiceTopicName ||
    item.practiceTeachingChapterContent ||
    item.courseContent ||
    ''
  );
}

function resolveIntegratedLearningObjective(
  item: JournalDraftSourceItem,
  journal?: LectureJournalReconciliationItem['journal'] | null,
) {
  return (
    pickRawObjectString(journal?.rawJournal, [
      'LEARNING_OBJECTIVE',
      'LEARNING_TARGET',
      'learningObjective',
      'learningTarget',
      'STUDY_GOAL',
      'studyGoal',
      'TEACHING_CHAPTER_CONTENT',
      'teachingChapterContent',
    ]) ||
    item.teachingUnitTarget ||
    item.learningSessionTarget ||
    item.practiceTeachingChapterContent ||
    ''
  );
}

function resolveIntegratedLearningContent(
  item: JournalDraftSourceItem,
  journal?: LectureJournalReconciliationItem['journal'] | null,
) {
  return (
    journal?.courseContent ||
    pickRawObjectString(journal?.rawJournal, [
      'COURSE_CONTENT',
      'courseContent',
      'LEARNING_CONTENT',
      'learningContent',
      'STUDY_CONTENT',
      'studyContent',
    ]) ||
    item.teachingUnitContent ||
    item.learningSessionContent ||
    item.learningTaskText ||
    item.courseContent ||
    ''
  );
}

function resolveIntegratedLearningOutcome(
  item: JournalDraftSourceItem,
  journal?: LectureJournalReconciliationItem['journal'] | null,
) {
  return (
    journal?.homeworkAssignment ||
    pickRawObjectString(journal?.rawJournal, [
      'LEARNING_OUTCOME',
      'learningOutcome',
      'STUDY_RESULT',
      'studyResult',
      'HOMEWORK',
      'homeworkAssignment',
    ]) ||
    item.homework ||
    ''
  );
}

function resolveTeachingDateTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(`${value}T00:00:00Z`).getTime();

  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function pickNearestFilledJournalTemplate(
  target: JournalDraftSourceItem,
  filledItems: JournalDraftSourceItem[],
) {
  const candidateGroups = [
    filledItems.filter(
      (item) =>
        Boolean(target.teachingClassId) &&
        item.teachingClassId === target.teachingClassId &&
        item.journal,
    ),
    filledItems.filter(
      (item) => Boolean(target.courseId) && item.courseId === target.courseId && item.journal,
    ),
    filledItems.filter(
      (item) =>
        Boolean(target.courseName) &&
        item.courseName === target.courseName &&
        Boolean(item.journal),
    ),
  ];

  const candidates = candidateGroups.find((group) => group.length > 0) ?? [];

  if (candidates.length === 0) {
    return null;
  }

  const targetTimestamp = resolveTeachingDateTimestamp(target.teachingDate);

  return [...candidates].sort((left, right) => {
    const leftDistance = Math.abs(
      resolveTeachingDateTimestamp(left.teachingDate) - targetTimestamp,
    );
    const rightDistance = Math.abs(
      resolveTeachingDateTimestamp(right.teachingDate) - targetTimestamp,
    );

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return (
      resolveTeachingDateTimestamp(left.teachingDate) -
      resolveTeachingDateTimestamp(right.teachingDate)
    );
  })[0];
}

export function areJournalDraftsEqual(left: JournalDraft, right: JournalDraft) {
  return (
    left.completeAndSummary === right.completeAndSummary &&
    left.courseContent === right.courseContent &&
    left.demonstrationHours === right.demonstrationHours &&
    left.disciplineSituation === right.disciplineSituation &&
    left.homeworkAssignment === right.homeworkAssignment &&
    left.lectureHours === right.lectureHours &&
    left.problemAndSolve === right.problemAndSolve &&
    left.practiceHours === right.practiceHours &&
    left.productionProjectTitle === right.productionProjectTitle &&
    left.learningObjective === right.learningObjective &&
    left.securityAndMaintain === right.securityAndMaintain &&
    left.shift === right.shift &&
    left.shiftName === right.shiftName &&
    left.submitStatusText === right.submitStatusText &&
    left.topicRecord === right.topicRecord
  );
}

export function reuseJournalDraftMapReferences(
  previous: JournalDraftMap,
  next: JournalDraftMap,
): JournalDraftMap {
  let changed = false;
  const result = {} as JournalDraftMap;

  for (const [key, nextDraft] of Object.entries(next)) {
    const previousDraft = previous[key];

    if (previousDraft && areJournalDraftsEqual(previousDraft, nextDraft)) {
      result[key] = previousDraft;
    } else {
      result[key] = nextDraft;
      changed = true;
    }
  }

  if (Object.keys(previous).length !== Object.keys(next).length) {
    changed = true;
  }

  if (!changed) {
    return previous;
  }

  return result;
}

export function buildJournalDrafts(items: JournalDraftSourceItem[]): JournalDraftMap {
  const filledItems = items.filter((item) => item.status === 'FILLED' && item.journal);

  return items.reduce<JournalDraftMap>((result, item) => {
    if (item.status === 'FILLED' && item.journal) {
      const isIntegratedCard = isIntegratedCourseCategory(item.courseCategory);

      result[item.key] = {
        completeAndSummary: isIntegratedCard ? item.completeAndSummary || '' : '',
        courseContent: isIntegratedCard
          ? resolveIntegratedLearningContent(item, item.journal)
          : item.journal.courseContent || '',
        demonstrationHours: item.practiceDemonstrationHours ?? null,
        disciplineSituation: isIntegratedCard ? item.disciplineSituation || '' : '',
        homeworkAssignment: isIntegratedCard
          ? resolveIntegratedLearningOutcome(item, item.journal)
          : item.journal.homeworkAssignment || '',
        lectureHours: item.practiceLectureHours ?? null,
        learningObjective: isIntegratedCard
          ? resolveIntegratedLearningObjective(item, item.journal)
          : '',
        problemAndSolve: isIntegratedCard ? item.problemAndSolve || '' : '',
        practiceHours: item.practicePracticeHours ?? null,
        productionProjectTitle: isIntegratedCard
          ? resolveIntegratedTeachingUnitName(item, item.journal)
          : item.practiceTeachingChapterContent || '',
        securityAndMaintain: isIntegratedCard ? item.securityAndMaintain || '' : '',
        shift: isIntegratedCard ? item.shift || DEFAULT_INTEGRATED_SHIFT : '',
        shiftName: isIntegratedCard
          ? resolveShiftName(item.shift || DEFAULT_INTEGRATED_SHIFT) ||
            DEFAULT_INTEGRATED_SHIFT_NAME
          : '',
        submitStatusText: item.journal.statusName || item.journal.statusCode || '',
        topicRecord: item.journal.topicRecord || '',
      };

      return result;
    }

    const template = pickNearestFilledJournalTemplate(item, filledItems);
    const isIntegratedCard = isIntegratedCourseCategory(item.courseCategory);
    const planCourseContent = isPracticeCourseCategory(item.courseCategory)
      ? item.practiceTopicName || ''
      : item.courseContent || '';

    result[item.key] = {
      completeAndSummary: isIntegratedCard ? item.completeAndSummary || '' : '',
      courseContent: isIntegratedCard
        ? ''
        : planCourseContent || template?.journal?.courseContent || '',
      demonstrationHours: item.practiceDemonstrationHours ?? null,
      disciplineSituation: isPracticeCourseCategory(item.courseCategory)
        ? item.disciplineSituation || DEFAULT_DISCIPLINE_SITUATION
        : isIntegratedCard
          ? item.disciplineSituation || ''
          : '',
      homeworkAssignment: isIntegratedCard
        ? ''
        : item.homework || template?.journal?.homeworkAssignment || '',
      lectureHours: item.practiceLectureHours ?? null,
      learningObjective: '',
      problemAndSolve: isIntegratedCard ? item.problemAndSolve || '' : '',
      practiceHours: item.practicePracticeHours ?? null,
      productionProjectTitle: isIntegratedCard ? '' : item.practiceTeachingChapterContent || '',
      securityAndMaintain: isIntegratedCard
        ? item.securityAndMaintain || ''
        : isPracticeCourseCategory(item.courseCategory)
          ? DEFAULT_SECURITY_AND_MAINTAIN
          : '',
      shift: isIntegratedCard ? item.shift || DEFAULT_INTEGRATED_SHIFT : '',
      shiftName: isIntegratedCard
        ? resolveShiftName(item.shift || DEFAULT_INTEGRATED_SHIFT) || DEFAULT_INTEGRATED_SHIFT_NAME
        : '',
      submitStatusText: isIntegratedCard && item.status === 'FILLED' ? '已填写' : '',
      topicRecord: isIntegratedCard ? '' : template?.journal?.topicRecord || '',
    };

    return result;
  }, {});
}
