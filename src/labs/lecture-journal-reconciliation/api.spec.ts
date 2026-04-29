import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, isExpiredUpstreamSessionErrorMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  isExpiredUpstreamSessionErrorMock: vi.fn(() => false),
}));

vi.mock('@/entities/upstream-session', () => ({
  isExpiredUpstreamSessionError: isExpiredUpstreamSessionErrorMock,
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import {
  fetchAcademicTeachingLogPrefillItems,
  fetchLectureJournalDepartmentOptions,
  fetchLectureJournalReconciliation,
  fetchTeacherDirectory,
  saveAcademicIntegratedTeachingLog,
  saveAcademicPracticeTeachingLog,
  saveAcademicTheoryTeachingLog,
} from './api';

describe('lecture-journal-reconciliation api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isExpiredUpstreamSessionErrorMock.mockReset();
    isExpiredUpstreamSessionErrorMock.mockReturnValue(false);
  });

  it('requests teacher directory with the current session token', async () => {
    const payload = {
      expiresAt: '2026-04-25T12:00:00.000Z',
      teachers: [
        {
          code: 'T-001',
          image: '',
          name: '张老师',
          text: '张老师 / T-001',
          value: 'STAFF-001',
        },
      ],
      upstreamSessionToken: 'rolling-token-002',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      fetchTeacherDirectory: payload,
    });

    await expect(
      fetchTeacherDirectory({
        sessionToken: 'rolling-token-001',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('fetchTeacherDirectory'),
      {
        sessionToken: 'rolling-token-001',
      },
    );
  });

  it('requests enabled department options for the department selector', async () => {
    const payload = [
      {
        departmentName: '人工智能系',
        id: 'ORG0302',
        isEnabled: true,
        shortName: 'AI',
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      departments: payload,
    });

    await expect(fetchLectureJournalDepartmentOptions()).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('LectureJournalReconciliationDepartments'),
      {
        isEnabled: true,
        limit: 500,
      },
    );
  });

  it('requests reconciliation with trimmed teacher filters', async () => {
    const payload = {
      expiresAt: '2026-04-25T12:00:00.000Z',
      filledCount: 8,
      items: [],
      journalCount: 8,
      missingCount: 2,
      missingItems: [],
      planCount: 1,
      planDetailCount: 10,
      unmatchedPlanItemCount: 1,
      unmatchedPlanItems: [],
      upstreamSessionToken: 'rolling-token-003',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      fetchLectureJournalReconciliation: payload,
    });

    await expect(
      fetchLectureJournalReconciliation({
        departmentId: ' ORG0302 ',
        schoolYear: ' 2025 ',
        semester: ' 2 ',
        sessionToken: 'rolling-token-002',
        staffId: ' STAFF-001 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('fetchLectureJournalReconciliation'),
      {
        departmentId: 'ORG0302',
        schoolYear: '2025',
        semester: '2',
        sessionToken: 'rolling-token-002',
        staffId: 'STAFF-001',
      },
    );
  });

  it('allows semester-level reconciliation without teacher filters', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      fetchLectureJournalReconciliation: {
        expiresAt: '2026-04-25T12:00:00.000Z',
        filledCount: 0,
        items: [],
        journalCount: 0,
        missingCount: 0,
        missingItems: [],
        planCount: 0,
        planDetailCount: 0,
        unmatchedPlanItemCount: 0,
        unmatchedPlanItems: [],
        upstreamSessionToken: 'rolling-token-004',
      },
    });

    await fetchLectureJournalReconciliation({
      departmentId: ' ',
      schoolYear: '2025',
      semester: '1',
      sessionToken: 'rolling-token-003',
      staffId: ' ',
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('fetchLectureJournalReconciliation'),
      {
        departmentId: undefined,
        schoolYear: '2025',
        semester: '1',
        sessionToken: 'rolling-token-003',
        staffId: undefined,
      },
    );
  });

  it('rejects when departmentId and staffId are not paired', async () => {
    await expect(
      fetchLectureJournalReconciliation({
        departmentId: 'ORG0302',
        schoolYear: '2025',
        semester: '2',
        sessionToken: 'rolling-token-002',
      }),
    ).rejects.toThrow('departmentId 和 staffId 需要同时传入，或同时留空。');

    expect(executeGraphQLMock).not.toHaveBeenCalled();
  });

  it('rethrows expired upstream session errors for relogin handling', async () => {
    const expiredError = new Error('expired');

    executeGraphQLMock.mockRejectedValueOnce(expiredError);
    isExpiredUpstreamSessionErrorMock.mockReturnValueOnce(true);

    await expect(
      fetchLectureJournalReconciliation({
        schoolYear: '2025',
        semester: '2',
        sessionToken: 'rolling-token-002',
      }),
    ).rejects.toBe(expiredError);
  });

  it('requests integrated teaching log prefill items with date window and plan fields', async () => {
    const payload = {
      blockingIssue: null,
      canFill: true,
      expiresAt: '2026-04-25T12:00:00.000Z',
      integratedPreviews: [
        {
          blockingIssue: null,
          canFill: true,
          completeAndSummary: '小结',
          courseName: '一体化课程',
          dayOfWeek: 4,
          disciplineSituation: '遵章守纪',
          expectedOccurrences: [],
          learningSessionContent: '学习环节',
          learningSessionNo: 1,
          learningSessionTarget: '环节目标',
          learningTaskName: '任务',
          learningTaskNo: 1,
          learningTaskText: '1 任务',
          lecturePlanDetailId: 'PLAN-DETAIL-001',
          lecturePlanId: 'PLAN-001',
          lessonHours: 6,
          matchedLectureJournalDetailId: null,
          problemAndSolve: '未发现问题',
          securityAndMaintain: '正常',
          shift: '3',
          status: 'MISSING',
          teachingClassId: 'CLASS-003',
          teachingClassName: '一体化 1 班',
          teachingDate: '2026-04-30',
          teachingUnitAchievement: '成果',
          teachingUnitContent: '单元内容',
          teachingUnitName: '单元',
          teachingUnitNo: 1,
          teachingUnitTarget: '单元目标',
          teachingUnitText: '1 单元',
          warnings: [],
          weekNumber: 10,
        },
      ],
      upstreamSessionToken: 'rolling-token-005',
      warnings: [],
    };

    executeGraphQLMock.mockResolvedValueOnce({
      listAcademicTeachingLogPrefillItems: payload,
    });

    await expect(
      fetchAcademicTeachingLogPrefillItems({
        departmentId: ' ORG0302 ',
        endDate: ' 2026-05-01 ',
        semesterId: 202601,
        staffId: ' STAFF-003 ',
        startDate: ' 2026-04-01 ',
        upstreamSessionToken: ' rolling-token-004 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('teachingUnitContent'),
      {
        departmentId: 'ORG0302',
        endDate: '2026-05-01',
        semesterId: 202601,
        staffId: 'STAFF-003',
        startDate: '2026-04-01',
        upstreamSessionToken: 'rolling-token-004',
      },
    );
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('teachingUnitTarget'),
      expect.any(Object),
    );
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('teachingUnitAchievement'),
      expect.any(Object),
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('courseContent');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('homeworkAssignment');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('topicRecord');
  });

  it('saves theory logs with sectionId only', async () => {
    const payload = {
      code: 200,
      expiresAt: '2026-04-28T12:00:00.000Z',
      lectureJournalDetailId: 'DETAIL-001',
      msg: 'ok',
      success: true,
      upstreamSessionToken: 'rolling-token-005',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      saveAcademicTheoryTeachingLog: payload,
    });

    await expect(
      saveAcademicTheoryTeachingLog({
        courseContent: ' 理论内容 ',
        dayOfWeek: ' 2 ',
        homeworkAssignment: ' 作业 ',
        lessonHours: 4,
        sectionId: ' 5,6 ',
        teachingClassId: ' CLASS-001 ',
        teachingDate: ' 2026-04-28 ',
        topicRecord: ' 良 ',
        upstreamSessionToken: ' rolling-token-004 ',
        weekNumber: ' 8 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('saveAcademicTheoryTeachingLog'),
      {
        input: {
          courseContent: '理论内容',
          dayOfWeek: '2',
          homeworkAssignment: '作业',
          lectureJournalDetailId: undefined,
          lecturePlanDetailId: undefined,
          lessonHours: 4,
          minSectionId: undefined,
          sectionId: '5,6',
          teachingClassId: 'CLASS-001',
          teachingDate: '2026-04-28',
          topicRecord: '良',
          upstreamSessionToken: 'rolling-token-004',
          weekNumber: '8',
        },
      },
    );
  });

  it('saves practice logs without section fields', async () => {
    const payload = {
      code: 200,
      expiresAt: '2026-04-28T12:00:00.000Z',
      lectureJournalDetailId: 'DETAIL-002',
      msg: 'ok',
      success: true,
      upstreamSessionToken: 'rolling-token-006',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      saveAcademicPracticeTeachingLog: payload,
    });

    await expect(
      saveAcademicPracticeTeachingLog({
        courseContent: ' 实训内容 ',
        dayOfWeek: ' 3 ',
        homeworkAssignment: ' 实训作业 ',
        lectureLessons: 1,
        lessonHours: 4,
        productionProjectTitle: ' 项目A ',
        teachingClassId: ' CLASS-002 ',
        teachingDate: ' 2026-04-29 ',
        trainingLessons: 2,
        exampleLessons: 1,
        upstreamSessionToken: ' rolling-token-005 ',
        weekNumber: ' 9 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('saveAcademicPracticeTeachingLog'),
      {
        input: expect.objectContaining({
          courseContent: '实训内容',
          dayOfWeek: '3',
          exampleLessons: 1,
          homeworkAssignment: '实训作业',
          lectureLessons: 1,
          lessonHours: 4,
          minSectionId: undefined,
          productionProjectTitle: '项目A',
          teachingClassId: 'CLASS-002',
          teachingDate: '2026-04-29',
          trainingLessons: 2,
          upstreamSessionToken: 'rolling-token-005',
          weekNumber: '9',
        }),
      },
    );
  });

  it('saves integrated logs with lecturePlanDetailId and rolling token', async () => {
    const payload = {
      code: 200,
      expiresAt: '2026-04-28T12:00:00.000Z',
      lectureJournalDetailId: 'DETAIL-003',
      msg: 'ok',
      success: true,
      upstreamSessionToken: 'rolling-token-007',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      saveAcademicIntegratedTeachingLog: payload,
    });

    await expect(
      saveAcademicIntegratedTeachingLog({
        completeAndSummary: ' 小结 ',
        dayOfWeek: ' 4 ',
        lecturePlanDetailId: ' PLAN-DETAIL-001 ',
        lessonHours: 6,
        shift: ' 3 ',
        teachingClassId: ' CLASS-003 ',
        teachingDate: ' 2026-04-30 ',
        upstreamSessionToken: ' rolling-token-006 ',
        weekNumber: ' 10 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('saveAcademicIntegratedTeachingLog'),
      {
        input: {
          completeAndSummary: '小结',
          courseContent: undefined,
          dayOfWeek: '4',
          disciplineSituation: undefined,
          homeworkAssignment: undefined,
          lectureJournalDetailId: undefined,
          lecturePlanDetailId: 'PLAN-DETAIL-001',
          lessonHours: 6,
          problemAndSolve: undefined,
          securityAndMaintain: undefined,
          shift: '3',
          teachingClassId: 'CLASS-003',
          teachingDate: '2026-04-30',
          topicRecord: undefined,
          upstreamSessionToken: 'rolling-token-006',
          weekNumber: '10',
        },
      },
    );
  });

  it('saves filled integrated logs with matched lecture journal detail id', async () => {
    const payload = {
      code: 200,
      expiresAt: '2026-04-28T12:00:00.000Z',
      lectureJournalDetailId: 'JOURNAL-DETAIL-009',
      msg: 'ok',
      success: true,
      upstreamSessionToken: 'rolling-token-008',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      saveAcademicIntegratedTeachingLog: payload,
    });

    await expect(
      saveAcademicIntegratedTeachingLog({
        completeAndSummary: ' 已更新小结 ',
        dayOfWeek: ' 4 ',
        lectureJournalDetailId: ' JOURNAL-DETAIL-009 ',
        lecturePlanDetailId: ' PLAN-DETAIL-001 ',
        lessonHours: 6,
        teachingClassId: ' CLASS-003 ',
        teachingDate: ' 2026-04-30 ',
        upstreamSessionToken: ' rolling-token-007 ',
        weekNumber: ' 10 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('saveAcademicIntegratedTeachingLog'),
      {
        input: expect.objectContaining({
          completeAndSummary: '已更新小结',
          lectureJournalDetailId: 'JOURNAL-DETAIL-009',
          lecturePlanDetailId: 'PLAN-DETAIL-001',
          upstreamSessionToken: 'rolling-token-007',
        }),
      },
    );
  });
});
