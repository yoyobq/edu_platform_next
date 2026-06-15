// src/features/academic-curriculum-plan-homepage/application/draft-policy.spec.ts

import { describe, expect, it } from 'vitest';

import {
  buildInitialReferenceLessonDistributionDraftUpdate,
  buildPrefillDraftUpdate,
  buildReferenceCandidateDraftUpdate,
  buildTeachingEndChapterDraftUpdate,
  validateCurriculumPlanHomepageBeforeSave,
} from './draft-policy';

describe('curriculum plan homepage draft policy', () => {
  it('merges prefill patch and appends unique teaching end lines', () => {
    const result = buildPrefillDraftUpdate({
      currentDraft: {
        teaching_end_chapter_content: '清明放假 2 课时',
        teaching_weeks: 14,
      },
      fieldWriteRules: [
        {
          field: 'teaching_end_chapter_content',
          mode: 'APPEND_UNIQUE_LINE',
          value: '清明放假 2 课时',
        },
        {
          field: 'teaching_end_chapter_content',
          mode: 'APPEND_UNIQUE_LINE',
          value: '运动会放假 4 课时',
        },
      ],
      homepagePatch: {
        teaching_weeks: 15,
        weekly_lessons: 4,
      },
    });

    expect(result.nextDraft).toMatchObject({
      teaching_end_chapter_content: '清明放假 2 课时\n运动会放假 4 课时',
      teaching_weeks: 15,
      weekly_lessons: 4,
    });
    expect(result.changes.map((change) => change.field)).toEqual([
      'teaching_weeks',
      'weekly_lessons',
      'teaching_end_chapter_content',
    ]);
  });

  it('keeps existing teaching end content when appending prefill notes', () => {
    const result = buildPrefillDraftUpdate({
      currentDraft: {
        teaching_end_chapter_content: '清明放假 2 课时\n最终完成至：旧章节',
      },
      fieldWriteRules: [
        {
          field: 'teaching_end_chapter_content',
          mode: 'APPEND_UNIQUE_LINE',
          value: '运动会放假 4 课时',
        },
      ],
      homepagePatch: {},
    });

    expect(result.nextDraft).toMatchObject({
      teaching_end_chapter_content: '清明放假 2 课时\n最终完成至：旧章节\n运动会放假 4 课时',
    });
  });

  it('allows saving when lesson validation groups are empty', () => {
    expect(validateCurriculumPlanHomepageBeforeSave({})).toEqual({
      errors: [],
      valid: true,
    });
  });

  it('rejects saving when lesson distribution total does not match parts', () => {
    const result = validateCurriculumPlanHomepageBeforeSave({
      flexible_lessons: 2,
      lecture_lessons: 30,
      review_exam_lessons: 4,
      total_lessons: 40,
      training_lessons: 8,
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('课时分配校验失败');
    expect(result.errors[0]).toContain('讲课 30 + 实训 8 + 复习考试 4 + 机动 2 = 44');
  });

  it('validates final completion with signed extra, reduced and compensated lessons', () => {
    expect(
      validateCurriculumPlanHomepageBeforeSave({
        compensated_lessons: 2,
        completed_lessons: 58,
        extra_lessons: 0,
        planned_lessons: 60,
        reduced_lessons: 4,
      }),
    ).toEqual({
      errors: [],
      valid: true,
    });

    expect(
      validateCurriculumPlanHomepageBeforeSave({
        compensated_lessons: 0,
        completed_lessons: 62,
        extra_lessons: 2,
        planned_lessons: 60,
        reduced_lessons: 0,
      }),
    ).toEqual({
      errors: [],
      valid: true,
    });
  });

  it('rejects saving when final completion signed difference does not match', () => {
    const result = validateCurriculumPlanHomepageBeforeSave({
      compensated_lessons: 0,
      completed_lessons: 58,
      extra_lessons: 0,
      planned_lessons: 60,
      reduced_lessons: 1,
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('期末完成情况校验失败');
    expect(result.errors[0]).toContain('计划课时 60 - 完成课时 58 = 2');
    expect(result.errors[0]).toContain('减少 1 - 超出 0 - 弥补 0 = 1');
  });

  it('applies historical reference only within target fields', () => {
    const result = buildReferenceCandidateDraftUpdate({
      currentDraft: {
        improvement_measures: '保留期末措施',
        teaching_objectives: '旧目标',
        textbook_name: '旧教材',
      },
      group: {
        applyMode: 'APPLY_HISTORY_HOMEPAGE_PHASE_FIELDS',
        groupKey: 'historicalHomepageBasicInfo',
        items: [],
        phase: 'INITIAL',
        targetFields: ['textbook_name', 'teaching_objectives'],
        title: '参考历史教学计划',
      },
      item: {
        courseName: '网页设计与制作',
        matchKind: 'EXACT',
        plannedLessons: 32,
        plannedLessonsDiff: 28,
        rank: 1,
        recommended: true,
        schoolYear: '2024',
        semester: '2',
        sourcePlanId: 'old-plan',
        teachingClassName: '信息2401班',
        values: {
          improvementMeasures: '不应覆盖',
          teachingObjectives: '历史目标',
          textbookName: '历史教材',
        },
        weekCount: 16,
        weeklyHours: 2,
      },
    });

    expect(result.nextDraft).toMatchObject({
      improvement_measures: '保留期末措施',
      teaching_objectives: '历史目标',
      textbook_name: '历史教材',
    });
  });

  it('reuses close reference lesson distribution and calculates training lessons', () => {
    const result = buildInitialReferenceLessonDistributionDraftUpdate({
      currentDraft: {
        lecture_lessons: 30,
        review_exam_lessons: 2,
        total_lessons: 56,
        training_lessons: 20,
      },
      plannedLessonsDiff: 10,
      referenceHomepage: {
        flexible_lessons: 2,
        lecture_lessons: 36,
        review_exam_lessons: 4,
        training_lessons: 18,
      },
    });

    expect(result.nextDraft).toMatchObject({
      flexible_lessons: 2,
      lecture_lessons: 36,
      review_exam_lessons: 4,
      total_lessons: 56,
      training_lessons: 14,
    });
    expect(result.calculatedFields).toEqual(['training_lessons']);
    expect(result.changes.map((change) => change.field)).toEqual([
      'lecture_lessons',
      'review_exam_lessons',
      'flexible_lessons',
      'training_lessons',
    ]);
  });

  it('allocates remaining initial lessons by 1:2 in two-hour units', () => {
    const result = buildInitialReferenceLessonDistributionDraftUpdate({
      currentDraft: {
        total_lessons: 22,
      },
      plannedLessonsDiff: 0,
      referenceHomepage: {
        flexible_lessons: 2,
        review_exam_lessons: 4,
      },
      strategy: 'ratio_1_to_2',
    });

    expect(result.nextDraft).toMatchObject({
      flexible_lessons: 2,
      lecture_lessons: 4,
      review_exam_lessons: 4,
      total_lessons: 22,
      training_lessons: 12,
    });
    expect(result.calculatedFields).toEqual(['lecture_lessons', 'training_lessons']);
  });

  it('gives odd remaining initial lesson remainder to training lessons', () => {
    const result = buildInitialReferenceLessonDistributionDraftUpdate({
      currentDraft: {
        total_lessons: 23,
      },
      plannedLessonsDiff: 0,
      referenceHomepage: {
        flexible_lessons: 2,
        review_exam_lessons: 4,
      },
      strategy: 'ratio_1_to_2',
    });

    expect(result.nextDraft).toMatchObject({
      flexible_lessons: 2,
      lecture_lessons: 4,
      review_exam_lessons: 4,
      total_lessons: 23,
      training_lessons: 13,
    });
  });

  it('does not allocate 1:2 lessons when review and flexible exceed total lessons', () => {
    const result = buildInitialReferenceLessonDistributionDraftUpdate({
      currentDraft: {
        total_lessons: 4,
      },
      plannedLessonsDiff: 0,
      referenceHomepage: {
        flexible_lessons: 2,
        review_exam_lessons: 4,
      },
      strategy: 'ratio_1_to_2',
    });

    expect(result.nextDraft).toEqual({
      total_lessons: 4,
    });
    expect(result.calculatedFields).toEqual([]);
    expect(result.changes).toEqual([]);
  });

  it('does not reuse reference lesson distribution when lesson diff is too large', () => {
    const result = buildInitialReferenceLessonDistributionDraftUpdate({
      currentDraft: {
        total_lessons: 56,
      },
      plannedLessonsDiff: 21,
      referenceHomepage: {
        flexible_lessons: 2,
        lecture_lessons: 36,
        review_exam_lessons: 4,
      },
    });

    expect(result.nextDraft).toEqual({
      total_lessons: 56,
    });
    expect(result.changes).toEqual([]);
  });

  it('places teaching end chapter first without prefix', () => {
    const result = buildTeachingEndChapterDraftUpdate({
      currentDraft: {
        teaching_end_chapter_content: '清明放假 2 课时\n最终完成至：旧章节',
      },
      group: {
        applyMode: 'APPLY_TEACHING_END_CHAPTER_PREFIX_LINE',
        groupKey: 'teachingEndChapterContent',
        items: [],
        phase: 'FINAL',
        targetFields: ['teaching_end_chapter_content'],
        title: '教学截止章节候选',
        writeRule: {
          field: 'teaching_end_chapter_content',
          mode: 'REPLACE_PREFIX_LINE',
          prefix: '最终完成至：',
        },
      },
      item: {
        displayText: '第15周 网页发布',
        lecturePlanDetailId: 'detail-001',
        sectionId: null,
        sectionName: null,
        teachingChapterContent: '网页发布',
        topicName: null,
        value: '网页发布',
        weekNumber: '15',
      },
    });

    expect(result.nextDraft).toMatchObject({
      teaching_end_chapter_content: '网页发布\n清明放假 2 课时',
    });
  });

  it('replaces the first teaching end chapter line when applying final prefill again', () => {
    const result = buildTeachingEndChapterDraftUpdate({
      currentDraft: {
        teaching_end_chapter_content: '旧章节\n清明放假 2 课时',
      },
      group: {
        applyMode: 'APPLY_TEACHING_END_CHAPTER_PREFIX_LINE',
        groupKey: 'teachingEndChapterContent',
        items: [],
        phase: 'FINAL',
        targetFields: ['teaching_end_chapter_content'],
        title: '教学截止章节候选',
        writeRule: {
          field: 'teaching_end_chapter_content',
          mode: 'REPLACE_PREFIX_LINE',
          prefix: '最终完成至：',
        },
      },
      item: {
        displayText: '第15周 网页发布',
        lecturePlanDetailId: 'detail-001',
        sectionId: null,
        sectionName: null,
        teachingChapterContent: '网页发布',
        topicName: null,
        value: '网页发布',
        weekNumber: '15',
      },
    });

    expect(result.nextDraft).toMatchObject({
      teaching_end_chapter_content: '网页发布\n清明放假 2 课时',
    });
  });
});
