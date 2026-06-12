// src/labs/curriculum-plan-homepage/draft-policy.spec.ts

import { describe, expect, it } from 'vitest';

import {
  buildInitialReferenceLessonDistributionDraftUpdate,
  buildPrefillDraftUpdate,
  buildReferenceCandidateDraftUpdate,
  buildTeachingEndChapterDraftUpdate,
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

  it('removes final chapter prefix before applying initial prefill notes', () => {
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
      removeTeachingEndChapterPrefix: '最终完成至：',
    });

    expect(result.nextDraft).toMatchObject({
      teaching_end_chapter_content: '清明放假 2 课时\n运动会放假 4 课时',
    });
  });

  it('replaces generated stop notes when applying initial prefill again', () => {
    const result = buildPrefillDraftUpdate({
      currentDraft: {
        teaching_end_chapter_content:
          '清明放假 2 课时，运动会放假 4 课时\n教师手工备注保留\n最终完成至：旧章节',
      },
      fieldWriteRules: [
        {
          field: 'teaching_end_chapter_content',
          mode: 'APPEND_UNIQUE_LINE',
          value: '清明放假 2 课时，劳动节放假 2 课时',
        },
      ],
      homepagePatch: {},
      removeGeneratedStopNoteLines: true,
      removeTeachingEndChapterPrefix: '最终完成至：',
    });

    expect(result.nextDraft).toMatchObject({
      teaching_end_chapter_content: '教师手工备注保留\n清明放假 2 课时，劳动节放假 2 课时',
    });
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

  it('replaces only the teaching end chapter prefix line', () => {
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
      teaching_end_chapter_content: '清明放假 2 课时\n最终完成至：网页发布',
    });
  });
});
