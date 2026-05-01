import { describe, expect, it } from 'vitest';

import {
  buildEditableCardItemFromIntegratedPreview,
  buildEditableCardItemFromReconciliation,
} from './editable-item-mapper';
import type {
  AcademicIntegratedTeachingLogPrefillPreview,
  LectureJournalReconciliationItem,
} from './types';

function buildReconciliationItem(
  overrides: Partial<LectureJournalReconciliationItem>,
): LectureJournalReconciliationItem {
  return {
    blockingIssue: null,
    canFill: true,
    completeAndSummary: null,
    courseCategory: '1',
    courseContent: '理论内容',
    courseId: 'course-001',
    courseName: '课程',
    dayOfWeek: 1,
    demonstrationHours: null,
    disciplineSituation: null,
    expectedOccurrences: [],
    homework: '作业',
    journal: null,
    learningSessionContent: null,
    learningSessionNo: null,
    learningSessionTarget: null,
    learningTaskName: null,
    learningTaskNo: null,
    learningTaskText: null,
    lectureHours: null,
    lecturePlanDetailId: 'detail-001',
    lecturePlanId: 'plan-001',
    lessonHours: 2,
    matchKey: 'match-001',
    practiceHours: null,
    problemAndSolve: null,
    reason: null,
    schoolYear: '2025',
    sectionId: 'section-01',
    sectionName: '第 1 节',
    securityAndMaintain: null,
    semester: '2',
    shift: null,
    status: 'MISSING',
    teacherId: 'teacher-001',
    teacherName: '教师',
    teachingChapterContent: null,
    teachingClassId: 'class-001',
    teachingClassName: '教学班',
    teachingDate: '2026-04-29',
    teachingUnitAchievement: null,
    teachingUnitContent: null,
    teachingUnitName: null,
    teachingUnitNo: null,
    teachingUnitTarget: null,
    teachingUnitText: null,
    topicName: null,
    warnings: [],
    weekNumber: 8,
    ...overrides,
  };
}

function buildIntegratedPreview(
  overrides: Partial<AcademicIntegratedTeachingLogPrefillPreview>,
): AcademicIntegratedTeachingLogPrefillPreview {
  return {
    blockingIssue: null,
    canFill: true,
    completeAndSummary: '完成情况',
    courseName: '一体化课程',
    dayOfWeek: 2,
    disciplineSituation: '遵章守纪',
    expectedOccurrences: [],
    learningSessionContent: '学习环节',
    learningSessionNo: 1,
    learningSessionTarget: '环节目标',
    learningTaskName: '任务名',
    learningTaskNo: 2,
    learningTaskText: '任务文本',
    lecturePlanDetailId: 'integrated-detail-001',
    lecturePlanId: 'integrated-plan-001',
    lessonHours: 4,
    matchedLectureJournalDetailId: null,
    problemAndSolve: '暂无问题',
    securityAndMaintain: '注意安全',
    shift: null,
    status: 'MISSING',
    teachingClassId: 'class-002',
    teachingClassName: '一体化班',
    teachingDate: '2026-04-30',
    teachingUnitAchievement: '成果',
    teachingUnitContent: '单元内容',
    teachingUnitName: '单元',
    teachingUnitNo: 3,
    teachingUnitTarget: '单元目标',
    teachingUnitText: '单元文本',
    warnings: [],
    weekNumber: 9,
    ...overrides,
  };
}

describe('editable item mapper', () => {
  it('maps practice plan fields from reconciliation item', () => {
    const item = buildReconciliationItem({
      courseCategory: '2',
      demonstrationHours: 1,
      lectureHours: 2,
      practiceHours: 3,
      teachingChapterContent: '实训章节',
      topicName: '实训课题',
    });

    const editableItem = buildEditableCardItemFromReconciliation(item);

    expect(editableItem).toMatchObject({
      key: 'detail-001-plan-001-match-001-reason',
      practiceDemonstrationHours: 1,
      practiceLectureHours: 2,
      practicePracticeHours: 3,
      practiceTeachingChapterContent: '实训章节',
      practiceTopicName: '实训课题',
    });
    expect(buildEditableCardItemFromReconciliation(item)).toBe(editableItem);
  });

  it('maps integrated preview into integrated editable card item', () => {
    const item = buildIntegratedPreview({
      shift: null,
    });

    const editableItem = buildEditableCardItemFromIntegratedPreview(item);

    expect(editableItem).toMatchObject({
      courseCategory: '3',
      key: 'integrated-detail-001-integrated-plan-001-integrated-preview-MISSING-reason',
      shift: null,
      shiftName: '常日班',
      teachingClassId: 'class-002',
      teachingUnitText: '单元文本',
    });
    expect(buildEditableCardItemFromIntegratedPreview(item)).toBe(editableItem);
  });
});
