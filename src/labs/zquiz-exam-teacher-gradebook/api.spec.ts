// src/labs/zquiz-exam-teacher-gradebook/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, isGraphQLIngressErrorMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  isGraphQLIngressErrorMock: vi.fn(() => false),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  isGraphQLIngressError: isGraphQLIngressErrorMock,
}));

import {
  getZquizExamQuestionAnalysis,
  getZquizExamTeacherGradebook,
  getZquizExamTeacherTargets,
  listZquizTeacherExamActivities,
  normalizeListZquizTeacherExamActivitiesInput,
  normalizeZquizExamQuestionAnalysisInput,
  normalizeZquizExamTeacherGradebookInput,
  resolveZquizExamTeacherGradebookErrorMessage,
  type ZquizExamQuestionAnalysis,
  type ZquizExamTeacherGradebook,
} from './api';

function createGradebook(): ZquizExamTeacherGradebook {
  return {
    activityId: 20,
    completedStudentCount: 1,
    rows: [
      {
        accountId: 1001,
        classCode: 'C001',
        className: '一班',
        latestAttempt: {
          attemptId: 'attempt-2',
          attemptNo: 2,
          gradingStatus: 'NOT_GRADED',
          scoreAwarded: 0,
          scoreMax: 10,
          startedAt: '2026-06-09T01:20:00.000Z',
          status: 'IN_PROGRESS',
          submittedAt: null,
        },
        scoreAwarded: 8,
        scoreMax: 10,
        scoreRate: 0.8,
        selectedAttempt: {
          attemptId: 'attempt-1',
          attemptNo: 1,
          gradingStatus: 'AUTO_GRADED',
          scoreAwarded: 8,
          scoreMax: 10,
          startedAt: '2026-06-09T01:00:00.000Z',
          status: 'GRADED',
          submittedAt: '2026-06-09T01:10:00.000Z',
        },
        studentId: '20260001',
        studentName: '张三',
      },
      {
        accountId: null,
        classCode: 'C001',
        className: '一班',
        latestAttempt: null,
        scoreAwarded: null,
        scoreMax: null,
        scoreRate: null,
        selectedAttempt: null,
        studentId: '20260002',
        studentName: '李四',
      },
    ],
    scorePolicy: 'HIGHEST_SCORE',
    targetStudentCount: 2,
  };
}

function createAnalysis(): ZquizExamQuestionAnalysis {
  return {
    activityId: 20,
    items: [
      {
        answeredAttemptCount: 1,
        attemptCount: 2,
        averageScoreRate: 0.75,
        correctCount: 1,
        correctRate: 0.5,
        incorrectCount: 1,
        manualPendingCount: 0,
        questionId: 1001,
        questionStatus: 'ACTIVE',
        questionType: 'SINGLE_CHOICE',
        scoreAwardedSum: 3,
        scoreMaxSum: 4,
        stem: '题干',
        unansweredAttemptCount: 1,
      },
    ],
    scorePolicy: 'LATEST_ATTEMPT',
    selectedAttemptCount: 2,
  };
}

describe('zquiz exam teacher gradebook api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isGraphQLIngressErrorMock.mockReset();
    isGraphQLIngressErrorMock.mockReturnValue(false);
  });

  it('normalizes teacher gradebook input and keeps default score policy optional', () => {
    expect(
      normalizeZquizExamTeacherGradebookInput({
        activityId: 20,
        classId: ' C001 ',
        scorePolicy: 'HIGHEST_SCORE',
      }),
    ).toEqual({
      activityId: 20,
      classId: 'C001',
      scorePolicy: 'HIGHEST_SCORE',
    });

    expect(
      normalizeZquizExamTeacherGradebookInput({
        activityId: 20,
        classId: ' ',
        scorePolicy: null,
      }),
    ).toEqual({
      activityId: 20,
    });
  });

  it('normalizes teacher exam activity list input as exam mode', () => {
    expect(
      normalizeListZquizTeacherExamActivitiesInput({
        keyword: ' 期中 ',
        limit: 100,
        status: 'PUBLISHED',
      }),
    ).toEqual({
      keyword: '期中',
      limit: 100,
      mode: 'EXAM',
      status: 'PUBLISHED',
    });
  });

  it('normalizes question analysis input', () => {
    expect(
      normalizeZquizExamQuestionAnalysisInput({
        activityId: 20,
        scorePolicy: 'LATEST_ATTEMPT',
      }),
    ).toEqual({
      activityId: 20,
      scorePolicy: 'LATEST_ATTEMPT',
    });

    expect(() =>
      normalizeZquizExamQuestionAnalysisInput({
        activityId: 0,
      }),
    ).toThrow('活动 ID 必须是正整数');
  });

  it('loads teacher exam activity options', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      listZquizTeacherActivities: [
        {
          endsAt: '2026-06-09 11:00:00.000',
          id: 20,
          itemCount: 10,
          startsAt: '2026-06-09 09:00:00.000',
          status: 'PUBLISHED',
          targetCount: 2,
          title: '期中考试',
          updatedAt: '2026-06-08T01:00:00.000Z',
        },
      ],
    });

    await expect(listZquizTeacherExamActivities({ limit: 200 })).resolves.toMatchObject([
      {
        id: 20,
        title: '期中考试',
      },
    ]);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query listZquizTeacherExamActivities'),
      {
        input: {
          limit: 200,
          mode: 'EXAM',
        },
      },
    );
  });

  it('loads target class options from exam teacher detail', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      getZquizExamTeacherDetail: {
        id: 20,
        status: 'PUBLISHED',
        targets: [
          {
            classCodeSnapshot: 'C001',
            classId: 'class-1',
            classNameSnapshot: '一班',
          },
        ],
        title: '期中考试',
      },
    });

    await expect(getZquizExamTeacherTargets({ activityId: 20 })).resolves.toMatchObject({
      targets: [
        {
          classId: 'class-1',
          classNameSnapshot: '一班',
        },
      ],
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query getZquizExamTeacherTargets'),
      {
        input: {
          activityId: 20,
        },
      },
    );
  });

  it('loads teacher gradebook rows with selected and latest attempts', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      getZquizExamTeacherGradebook: createGradebook(),
    });

    await expect(
      getZquizExamTeacherGradebook({
        activityId: 20,
        classId: ' C001 ',
        scorePolicy: 'HIGHEST_SCORE',
      }),
    ).resolves.toMatchObject({
      completedStudentCount: 1,
      rows: [
        {
          latestAttempt: {
            status: 'IN_PROGRESS',
          },
          scoreRate: 0.8,
          selectedAttempt: {
            attemptNo: 1,
          },
        },
        {
          latestAttempt: null,
          scoreRate: null,
          selectedAttempt: null,
        },
      ],
      targetStudentCount: 2,
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query getZquizExamTeacherGradebook'),
      {
        input: {
          activityId: 20,
          classId: 'C001',
          scorePolicy: 'HIGHEST_SCORE',
        },
      },
    );
  });

  it('loads question analysis without answer or grading payload fields', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      getZquizExamQuestionAnalysis: createAnalysis(),
    });

    await expect(
      getZquizExamQuestionAnalysis({
        activityId: 20,
        scorePolicy: 'LATEST_ATTEMPT',
      }),
    ).resolves.toMatchObject({
      items: [
        {
          averageScoreRate: 0.75,
          correctRate: 0.5,
          questionId: 1001,
        },
      ],
      selectedAttemptCount: 2,
    });

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('getZquizExamQuestionAnalysis');
    expect(query).not.toContain('correctAnswer');
    expect(query).not.toContain('answerText');
    expect(query).not.toContain('selectedLabels');
    expect(query).not.toContain('blankAnswers');
    expect(query).not.toContain('explanation');
    expect(query).not.toContain('rubric');
    expect(query).not.toContain('gradingJson');
    expect(query).not.toContain('grading_json');
  });

  it('prefers backend business error messages when available', () => {
    isGraphQLIngressErrorMock.mockReturnValue(true);

    expect(
      resolveZquizExamTeacherGradebookErrorMessage(
        {
          graphqlErrors: [
            {
              extensions: {
                errorMessage: '没有教师权限',
              },
              message: 'FORBIDDEN',
            },
          ],
          userMessage: '请求处理失败，请稍后重试。',
        },
        '查询失败。',
      ),
    ).toBe('没有教师权限');
  });
});
