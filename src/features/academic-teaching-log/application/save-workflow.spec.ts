import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  saveAcademicIntegratedTeachingLogMock,
  saveAcademicPracticeTeachingLogMock,
  saveAcademicTheoryTeachingLogMock,
} = vi.hoisted(() => ({
  saveAcademicIntegratedTeachingLogMock: vi.fn(),
  saveAcademicPracticeTeachingLogMock: vi.fn(),
  saveAcademicTheoryTeachingLogMock: vi.fn(),
}));

import { EMPTY_JOURNAL_DRAFT, type JournalDraft } from './journal-draft-policy';
import {
  type LectureJournalSaveWorkflowItem,
  resolveSaveValidationError,
  runLectureJournalSaveWorkflow,
} from './save-workflow';

describe('lecture journal save workflow', () => {
  const session = {
    accountId: 1,
    expiresAt: '2026-04-30T12:00:00.000Z',
    upstreamLoginId: 'teacher001',
    upstreamSessionToken: 'token-001',
    version: 2 as const,
  };

  const saveResult = {
    code: 0,
    expiresAt: '2026-04-30T13:00:00.000Z',
    lectureJournalDetailId: 'journal-detail-002',
    msg: '保存成功',
    success: true,
    upstreamSessionToken: 'token-002',
  };

  const persistSessionFromResult = vi.fn((currentSession, input) => ({
    ...currentSession,
    expiresAt: input.expiresAt ?? currentSession.expiresAt,
    upstreamSessionToken: input.upstreamSessionToken,
  }));

  const savePorts = {
    saveAcademicIntegratedTeachingLog: saveAcademicIntegratedTeachingLogMock,
    saveAcademicPracticeTeachingLog: saveAcademicPracticeTeachingLogMock,
    saveAcademicTheoryTeachingLog: saveAcademicTheoryTeachingLogMock,
  };

  function buildItem(overrides: Partial<LectureJournalSaveWorkflowItem>) {
    return {
      blockingIssue: null,
      canFill: true,
      courseCategory: '1',
      dayOfWeek: 2,
      journal: {
        lectureJournalDetailId: 'journal-detail-001',
      },
      lecturePlanDetailId: 'plan-detail-001',
      lessonHours: 2,
      matchedLectureJournalDetailId: null,
      sectionId: 'section-03',
      shift: null,
      status: 'MISSING' as const,
      teachingClassId: 'class-001',
      teachingDate: '2026-04-29',
      weekNumber: 8,
      ...overrides,
    } satisfies LectureJournalSaveWorkflowItem;
  }

  function buildDraft(overrides: Partial<JournalDraft>) {
    return {
      ...EMPTY_JOURNAL_DRAFT,
      courseContent: '课程内容',
      homeworkAssignment: '课后作业',
      topicRecord: '优',
      ...overrides,
    };
  }

  beforeEach(() => {
    saveAcademicIntegratedTeachingLogMock.mockReset();
    saveAcademicPracticeTeachingLogMock.mockReset();
    saveAcademicTheoryTeachingLogMock.mockReset();
    persistSessionFromResult.mockClear();
  });

  it('saves theory logs with section fields and rolls the session', async () => {
    saveAcademicTheoryTeachingLogMock.mockResolvedValueOnce(saveResult);

    await expect(
      runLectureJournalSaveWorkflow({
        draft: buildDraft({ topicRecord: '良' }),
        item: buildItem({ sectionId: 'section-03' }),
        persistSessionFromResult,
        ...savePorts,
        session,
      }),
    ).resolves.toEqual({
      result: saveResult,
      saveKind: 'theory',
    });

    expect(saveAcademicTheoryTeachingLogMock).toHaveBeenCalledWith({
      courseContent: '课程内容',
      dayOfWeek: '2',
      homeworkAssignment: '课后作业',
      lectureJournalDetailId: 'journal-detail-001',
      lecturePlanDetailId: 'plan-detail-001',
      lessonHours: 2,
      minSectionId: '03',
      sectionId: 'section-03',
      teachingClassId: 'class-001',
      teachingDate: '2026-04-29',
      topicRecord: '良',
      upstreamSessionToken: 'token-001',
      weekNumber: '8',
    });
    expect(persistSessionFromResult).toHaveBeenCalledWith(session, saveResult);
  });

  it('saves practice logs without section fields', async () => {
    saveAcademicPracticeTeachingLogMock.mockResolvedValueOnce(saveResult);

    await runLectureJournalSaveWorkflow({
      draft: buildDraft({
        demonstrationHours: 1,
        disciplineSituation: '遵章守纪',
        lectureHours: 1,
        practiceHours: 2,
        problemAndSolve: '无',
        productionProjectTitle: '车工基础',
        securityAndMaintain: '注意安全，已保养',
        shift: '3',
        topicRecord: '',
      }),
      item: buildItem({
        courseCategory: '2',
        lessonHours: 4,
        matchedLectureJournalDetailId: 'matched-detail-001',
      }),
      persistSessionFromResult,
      ...savePorts,
      session,
    });

    expect(saveAcademicPracticeTeachingLogMock).toHaveBeenCalledWith({
      courseContent: '课程内容',
      dayOfWeek: '2',
      disciplineSituation: '遵章守纪',
      exampleLessons: 1,
      homeworkAssignment: '课后作业',
      lectureJournalDetailId: 'matched-detail-001',
      lectureLessons: 1,
      lecturePlanDetailId: 'plan-detail-001',
      lessonHours: 4,
      problemAndSolve: '无',
      productionProjectTitle: '车工基础',
      securityAndMaintain: '注意安全，已保养',
      shift: '3',
      teachingClassId: 'class-001',
      teachingDate: '2026-04-29',
      topicRecord: undefined,
      trainingLessons: 2,
      upstreamSessionToken: 'token-001',
      weekNumber: '8',
    });
  });

  it('saves integrated logs with integrated fields', async () => {
    saveAcademicIntegratedTeachingLogMock.mockResolvedValueOnce(saveResult);

    await runLectureJournalSaveWorkflow({
      draft: buildDraft({
        completeAndSummary: '完成情况',
        disciplineSituation: '已守纪',
        problemAndSolve: '无',
        securityAndMaintain: '已保养',
        shift: '',
      }),
      item: buildItem({
        courseCategory: '3',
        matchedLectureJournalDetailId: 'integrated-detail-001',
        shift: '2',
      }),
      persistSessionFromResult,
      ...savePorts,
      session,
    });

    expect(saveAcademicIntegratedTeachingLogMock).toHaveBeenCalledWith({
      completeAndSummary: '完成情况',
      dayOfWeek: '2',
      disciplineSituation: '已守纪',
      lectureJournalDetailId: 'integrated-detail-001',
      lecturePlanDetailId: 'plan-detail-001',
      lessonHours: 2,
      problemAndSolve: '无',
      securityAndMaintain: '已保养',
      shift: '2',
      teachingClassId: 'class-001',
      teachingDate: '2026-04-29',
      upstreamSessionToken: 'token-001',
      weekNumber: '8',
    });
  });

  it('rejects future courses before calling save APIs', async () => {
    const item = buildItem({ teachingDate: '9999-12-31' });
    const draft = buildDraft({});

    expect(resolveSaveValidationError(item, draft)).toBe('课程尚未开始，不能填写教学日志。');
    await expect(
      runLectureJournalSaveWorkflow({
        draft,
        item,
        persistSessionFromResult,
        ...savePorts,
        session,
      }),
    ).rejects.toThrow('课程尚未开始，不能填写教学日志。');

    expect(saveAcademicTheoryTeachingLogMock).not.toHaveBeenCalled();
    expect(persistSessionFromResult).not.toHaveBeenCalled();
  });

  it('rejects practice hour mismatch before calling save APIs', async () => {
    await expect(
      runLectureJournalSaveWorkflow({
        draft: buildDraft({
          demonstrationHours: 1,
          lectureHours: 1,
          practiceHours: 1,
        }),
        item: buildItem({
          courseCategory: '2',
          lessonHours: 4,
        }),
        persistSessionFromResult,
        ...savePorts,
        session,
      }),
    ).rejects.toThrow(
      'lectureLessons + trainingLessons + exampleLessons 必须等于 lessonHours，当前为 3 / 4',
    );

    expect(saveAcademicPracticeTeachingLogMock).not.toHaveBeenCalled();
    expect(persistSessionFromResult).not.toHaveBeenCalled();
  });

  it('rethrows save errors without rolling the session', async () => {
    const expiredError = new Error('upstream 会话已失效');

    saveAcademicTheoryTeachingLogMock.mockRejectedValueOnce(expiredError);

    await expect(
      runLectureJournalSaveWorkflow({
        draft: buildDraft({}),
        item: buildItem({}),
        persistSessionFromResult,
        ...savePorts,
        session,
      }),
    ).rejects.toBe(expiredError);

    expect(persistSessionFromResult).not.toHaveBeenCalled();
  });
});
