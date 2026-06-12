// src/features/academic-curriculum-plan-homepage/application/draft-policy.ts

import type {
  CurriculumPlanHomepagePrefillFieldWriteRule,
  CurriculumPlanHomepageReferenceCandidateGroup,
  CurriculumPlanHomepageReferenceCandidateItem,
  CurriculumPlanHomepageTeachingEndChapterCandidateGroup,
  CurriculumPlanHomepageTeachingEndChapterCandidateItem,
} from '../domain/curriculum-plan-homepage-types';

export type CurriculumPlanHomepageDraftChange = {
  after: unknown;
  before: unknown;
  field: string;
  kind: 'append' | 'replace' | 'set';
  label: string;
};

export type CurriculumPlanHomepageDraftUpdate = {
  calculatedFields?: readonly string[];
  changes: CurriculumPlanHomepageDraftChange[];
  nextDraft: Record<string, unknown>;
};

export type CurriculumPlanHomepageSaveValidationResult = {
  errors: string[];
  valid: boolean;
};

const FIELD_LABELS: Record<string, string> = {
  compensated_lessons: '弥补',
  completed_lessons: '完成课时',
  extra_lessons: '超出',
  flexible_lessons: '机动',
  improvement_measures: '改进教学的具体措施',
  lecture_lessons: '讲课',
  planned_lessons: '计划课时',
  reduced_lessons: '减少',
  review_exam_lessons: '复习考试',
  teaching_end_chapter_content: '教学截止章节内容',
  teaching_objectives: '教学目的要求',
  teaching_weeks: '授课周数',
  textbook_name: '教材名称及版本',
  total_lessons: '授课总课时',
  training_lessons: '实训',
  weekly_lessons: '周课时',
};

const REFERENCE_VALUE_FIELDS: Record<
  string,
  keyof CurriculumPlanHomepageReferenceCandidateItem['values']
> = {
  improvement_measures: 'improvementMeasures',
  teaching_objectives: 'teachingObjectives',
  textbook_name: 'textbookName',
};

const LESSON_DISTRIBUTION_FIELDS = [
  ['total_lessons'],
  ['lecture_lessons'],
  ['training_lessons'],
  ['review_exam_lessons'],
  ['flexible_lessons'],
] as const;

const FINAL_COMPLETION_FIELDS = [
  ['planned_lessons', 'plan_lessons'],
  ['completed_lessons', 'finished_lessons'],
  ['extra_lessons', 'exceeded_lessons', 'exceed_lessons'],
  ['reduced_lessons', 'reduce_lessons'],
  ['compensated_lessons', 'makeup_lessons', 'make_up_lessons'],
] as const;

type DraftNumberState = {
  field: string;
  isEmpty: boolean;
  label: string;
  value: number | null;
};

function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function normalizeComparable(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  const text = String(value);
  const parsed = Number(text);

  if (text.trim() && Number.isFinite(parsed)) {
    return String(parsed);
  }

  return text;
}

function valuesEqual(left: unknown, right: unknown) {
  return normalizeComparable(left) === normalizeComparable(right);
}

function readNumberValue(source: Record<string, unknown>, field: string) {
  const value = source[field];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readDraftNumberState(
  source: Record<string, unknown>,
  candidates: readonly string[],
): DraftNumberState {
  const field = candidates[0] ?? '';
  const label = getFieldLabel(field);

  for (const candidate of candidates) {
    const value = source[candidate];

    if (value === null || value === undefined || value === '') {
      continue;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return {
        field,
        isEmpty: false,
        label,
        value,
      };
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.trim());

      return {
        field,
        isEmpty: false,
        label,
        value: Number.isFinite(parsed) ? parsed : null,
      };
    }

    return {
      field,
      isEmpty: false,
      label,
      value: null,
    };
  }

  return {
    field,
    isEmpty: true,
    label,
    value: null,
  };
}

function getValidationNumber(state: DraftNumberState) {
  return state.value ?? 0;
}

function formatValidationNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function areNumbersEqual(left: number, right: number) {
  return Math.abs(left - right) < 0.0001;
}

function getFieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field;
}

function validateLessonDistribution(draft: Record<string, unknown>) {
  const [total, lecture, training, reviewExam, flexible] = LESSON_DISTRIBUTION_FIELDS.map(
    (fields) => readDraftNumberState(draft, fields),
  );
  const values = [total, lecture, training, reviewExam, flexible];

  if (values.every((value) => value.isEmpty)) {
    return null;
  }

  const invalidValue = values.find((value) => value.value === null && !value.isEmpty);

  if (invalidValue) {
    return `${invalidValue.label}必须是有效数字。`;
  }

  const actual = getValidationNumber(total);
  const expected =
    getValidationNumber(lecture) +
    getValidationNumber(training) +
    getValidationNumber(reviewExam) +
    getValidationNumber(flexible);

  if (areNumbersEqual(actual, expected)) {
    return null;
  }

  return `课时分配校验失败：授课总课时 ${formatValidationNumber(
    actual,
  )} 不等于讲课 ${formatValidationNumber(getValidationNumber(lecture))} + 实训 ${formatValidationNumber(
    getValidationNumber(training),
  )} + 复习考试 ${formatValidationNumber(
    getValidationNumber(reviewExam),
  )} + 机动 ${formatValidationNumber(getValidationNumber(flexible))} = ${formatValidationNumber(
    expected,
  )}。`;
}

function validateFinalCompletion(draft: Record<string, unknown>) {
  const [planned, completed, extra, reduced, compensated] = FINAL_COMPLETION_FIELDS.map((fields) =>
    readDraftNumberState(draft, fields),
  );
  const values = [planned, completed, extra, reduced, compensated];

  if (values.every((value) => value.isEmpty)) {
    return null;
  }

  const invalidValue = values.find((value) => value.value === null && !value.isEmpty);

  if (invalidValue) {
    return `${invalidValue.label}必须是有效数字。`;
  }

  const actual = getValidationNumber(planned) - getValidationNumber(completed);
  const expected =
    getValidationNumber(reduced) - getValidationNumber(extra) - getValidationNumber(compensated);

  if (areNumbersEqual(actual, expected)) {
    return null;
  }

  return `期末完成情况校验失败：计划课时 ${formatValidationNumber(
    getValidationNumber(planned),
  )} - 完成课时 ${formatValidationNumber(getValidationNumber(completed))} = ${formatValidationNumber(
    actual,
  )}，应等于减少 ${formatValidationNumber(
    getValidationNumber(reduced),
  )} - 超出 ${formatValidationNumber(getValidationNumber(extra))} - 弥补 ${formatValidationNumber(
    getValidationNumber(compensated),
  )} = ${formatValidationNumber(expected)}。`;
}

export function validateCurriculumPlanHomepageBeforeSave(
  draft: Record<string, unknown>,
): CurriculumPlanHomepageSaveValidationResult {
  const errors = [validateLessonDistribution(draft), validateFinalCompletion(draft)].filter(
    (error): error is string => Boolean(error),
  );

  return {
    errors,
    valid: errors.length === 0,
  };
}

function appendUniqueLine(currentValue: unknown, line: string) {
  const currentText = normalizeText(currentValue);
  const nextLine = line.trim();

  if (!nextLine) {
    return currentText;
  }

  const currentLines = currentText.split(/\r?\n/);

  if (currentLines.some((currentLine) => currentLine.trim() === nextLine)) {
    return currentText;
  }

  const trimmedCurrentText = currentText.replace(/\s+$/u, '');

  return trimmedCurrentText ? `${trimmedCurrentText}\n${nextLine}` : nextLine;
}

function isGeneratedStopNoteLine(line: string) {
  const normalizedLine = line.trim();

  return /(放假|停课|运动会)/u.test(normalizedLine) && /\d+(?:\.\d+)?\s*课时/u.test(normalizedLine);
}

function placeTeachingEndChapterFirstLine(currentValue: unknown, prefix: string, value: string) {
  const nextLine = value.trim();
  const currentText = normalizeText(currentValue);

  if (!nextLine) {
    return currentText;
  }

  const retainedLines = (currentText ? currentText.split(/\r?\n/) : [])
    .filter((line) => !line.trimStart().startsWith(prefix))
    .filter((line) => line.trim() && line.trim() !== nextLine);
  const [firstLine, ...restLines] = retainedLines;
  const shouldReplaceFirstLine = Boolean(firstLine) && !isGeneratedStopNoteLine(firstLine);
  const tailLines = shouldReplaceFirstLine ? restLines : retainedLines;

  return [nextLine, ...tailLines].join('\n');
}

function setDraftValue(input: {
  changes: CurriculumPlanHomepageDraftChange[];
  draft: Record<string, unknown>;
  field: string;
  kind: CurriculumPlanHomepageDraftChange['kind'];
  nextValue: unknown;
}) {
  const before = input.draft[input.field];

  if (valuesEqual(before, input.nextValue)) {
    return;
  }

  input.draft[input.field] = input.nextValue;
  input.changes.push({
    after: input.nextValue,
    before,
    field: input.field,
    kind: input.kind,
    label: getFieldLabel(input.field),
  });
}

export function buildPrefillDraftUpdate(input: {
  currentDraft: Record<string, unknown>;
  fieldWriteRules: readonly CurriculumPlanHomepagePrefillFieldWriteRule[];
  homepagePatch: Record<string, unknown>;
}) {
  const nextDraft = { ...input.currentDraft };
  const changes: CurriculumPlanHomepageDraftChange[] = [];

  for (const [field, nextValue] of Object.entries(input.homepagePatch)) {
    setDraftValue({
      changes,
      draft: nextDraft,
      field,
      kind: 'set',
      nextValue,
    });
  }

  for (const rule of input.fieldWriteRules) {
    if (rule.field !== 'teaching_end_chapter_content' || rule.mode !== 'APPEND_UNIQUE_LINE') {
      continue;
    }

    setDraftValue({
      changes,
      draft: nextDraft,
      field: rule.field,
      kind: 'append',
      nextValue: appendUniqueLine(nextDraft[rule.field], rule.value),
    });
  }

  return {
    changes,
    nextDraft,
  };
}

export function buildReferenceCandidateDraftUpdate(input: {
  currentDraft: Record<string, unknown>;
  group: CurriculumPlanHomepageReferenceCandidateGroup;
  item: CurriculumPlanHomepageReferenceCandidateItem;
}) {
  const nextDraft = { ...input.currentDraft };
  const changes: CurriculumPlanHomepageDraftChange[] = [];

  for (const field of input.group.targetFields) {
    const valueField = REFERENCE_VALUE_FIELDS[field];

    if (!valueField) {
      continue;
    }

    const nextValue = input.item.values[valueField];

    if (nextValue === null || nextValue === undefined) {
      continue;
    }

    setDraftValue({
      changes,
      draft: nextDraft,
      field,
      kind: 'set',
      nextValue,
    });
  }

  return {
    changes,
    nextDraft,
  };
}

export function buildInitialReferenceLessonDistributionDraftUpdate(input: {
  currentDraft: Record<string, unknown>;
  plannedLessonsDiff: number | null;
  referenceHomepage: Record<string, unknown>;
}): CurriculumPlanHomepageDraftUpdate {
  const nextDraft = { ...input.currentDraft };
  const changes: CurriculumPlanHomepageDraftChange[] = [];

  if (input.plannedLessonsDiff === null || input.plannedLessonsDiff > 20) {
    return {
      calculatedFields: [],
      changes,
      nextDraft,
    };
  }

  const totalLessons = readNumberValue(nextDraft, 'total_lessons');
  const lectureLessons = readNumberValue(input.referenceHomepage, 'lecture_lessons');
  const reviewExamLessons = readNumberValue(input.referenceHomepage, 'review_exam_lessons');
  const flexibleLessons = readNumberValue(input.referenceHomepage, 'flexible_lessons');

  if (
    totalLessons === null ||
    lectureLessons === null ||
    reviewExamLessons === null ||
    flexibleLessons === null
  ) {
    return {
      calculatedFields: [],
      changes,
      nextDraft,
    };
  }

  const trainingLessons = totalLessons - lectureLessons - reviewExamLessons - flexibleLessons;

  if (trainingLessons < 0) {
    return {
      calculatedFields: [],
      changes,
      nextDraft,
    };
  }

  setDraftValue({
    changes,
    draft: nextDraft,
    field: 'lecture_lessons',
    kind: 'set',
    nextValue: lectureLessons,
  });
  setDraftValue({
    changes,
    draft: nextDraft,
    field: 'review_exam_lessons',
    kind: 'set',
    nextValue: reviewExamLessons,
  });
  setDraftValue({
    changes,
    draft: nextDraft,
    field: 'flexible_lessons',
    kind: 'set',
    nextValue: flexibleLessons,
  });
  setDraftValue({
    changes,
    draft: nextDraft,
    field: 'training_lessons',
    kind: 'set',
    nextValue: trainingLessons,
  });

  return {
    calculatedFields: ['training_lessons'],
    changes,
    nextDraft,
  };
}

export function buildTeachingEndChapterDraftUpdate(input: {
  currentDraft: Record<string, unknown>;
  group: CurriculumPlanHomepageTeachingEndChapterCandidateGroup;
  item: CurriculumPlanHomepageTeachingEndChapterCandidateItem;
}) {
  const field = input.group.writeRule.field;
  const nextDraft = { ...input.currentDraft };
  const changes: CurriculumPlanHomepageDraftChange[] = [];

  if (
    field !== 'teaching_end_chapter_content' ||
    input.group.writeRule.mode !== 'REPLACE_PREFIX_LINE'
  ) {
    return {
      changes,
      nextDraft,
    };
  }

  setDraftValue({
    changes,
    draft: nextDraft,
    field,
    kind: 'replace',
    nextValue: placeTeachingEndChapterFirstLine(
      nextDraft[field],
      input.group.writeRule.prefix,
      input.item.value,
    ),
  });

  return {
    changes,
    nextDraft,
  };
}
