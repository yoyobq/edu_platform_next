// src/labs/zquiz-exam-activities/api.spec.ts

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
  autosaveZquizExam,
  buildZquizExamAnswers,
  buildZquizExamDraftAnswersFromServer,
  resolveZquizExamErrorMessage,
  startZquizExam,
  submitZquizExam,
  type ZquizExamPaper,
  type ZquizExamPaperItem,
} from './api';

const paperItems = [
  {
    assets: [],
    blanks: [],
    options: [
      { content: 'A 选项', label: 'A', sortOrder: 1 },
      { content: 'B 选项', label: 'B', sortOrder: 2 },
    ],
    paperItemNo: 1,
    questionId: 101,
    scoreMax: 2,
    stem: '单选题',
    type: 'SINGLE_CHOICE',
  },
  {
    assets: [],
    blanks: [],
    options: [
      { content: 'A 选项', label: 'A', sortOrder: 1 },
      { content: 'B 选项', label: 'B', sortOrder: 2 },
      { content: 'C 选项', label: 'C', sortOrder: 3 },
    ],
    paperItemNo: 2,
    questionId: 102,
    scoreMax: 3,
    stem: '多选题',
    type: 'MULTIPLE_CHOICE',
  },
  {
    assets: [],
    blanks: [
      { blankNo: 1, score: null },
      { blankNo: 2, score: 1 },
    ],
    options: [],
    paperItemNo: 3,
    questionId: 103,
    scoreMax: 2,
    stem: '填空题',
    type: 'FILL_BLANK',
  },
  {
    assets: [],
    blanks: [],
    options: [],
    paperItemNo: 4,
    questionId: 104,
    scoreMax: 5,
    stem: '问答题',
    type: 'ESSAY',
  },
] satisfies ZquizExamPaperItem[];

function createPaper(): ZquizExamPaper {
  return {
    activity: {
      attemptLimit: 1,
      availability: 'OPEN',
      bankId: 1,
      canStart: true,
      durationMinutes: 90,
      endsAt: '2026-06-09 11:00:00.000',
      id: 30,
      startsAt: '2026-06-09 09:00:00.000',
      title: '期中考试',
    },
    attemptId: '9001',
    attemptNo: 1,
    deadlineAt: '2026-06-09T02:30:00.000Z',
    draftAnswers: [
      {
        answerText: null,
        blankAnswers: [],
        paperItemNo: 1,
        selectedLabels: ['B'],
      },
    ],
    items: paperItems,
    startedAt: '2026-06-09T01:00:00.000Z',
  };
}

describe('zquiz exam api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isGraphQLIngressErrorMock.mockReset();
    isGraphQLIngressErrorMock.mockReturnValue(false);
  });

  it('builds submit answers from paper item numbers and omits unanswered drafts', () => {
    expect(
      buildZquizExamAnswers(paperItems, {
        '1': ' B ',
        '2': ['A', 'A', 'C', ' '],
        '3': {
          '1': ' 填空答案 ',
          '2': ' ',
        },
        '4': ' 问答答案 ',
        '99': 'ignored',
      }),
    ).toEqual([
      {
        paperItemNo: 1,
        selectedLabels: ['B'],
      },
      {
        paperItemNo: 2,
        selectedLabels: ['A', 'C'],
      },
      {
        blankAnswers: [
          {
            answerText: '填空答案',
            blankNo: 1,
          },
        ],
        paperItemNo: 3,
      },
      {
        answerText: '问答答案',
        paperItemNo: 4,
      },
    ]);
  });

  it('maps server draft answers back to local paper item draft state', () => {
    expect(
      buildZquizExamDraftAnswersFromServer(paperItems, [
        {
          answerText: null,
          blankAnswers: [],
          paperItemNo: 1,
          selectedLabels: ['B'],
        },
        {
          answerText: null,
          blankAnswers: [
            {
              answerText: '填空答案',
              blankNo: 1,
            },
          ],
          paperItemNo: 3,
          selectedLabels: [],
        },
        {
          answerText: '问答答案',
          blankAnswers: [],
          paperItemNo: 4,
          selectedLabels: [],
        },
      ]),
    ).toEqual({
      '1': 'B',
      '3': {
        '1': '填空答案',
      },
      '4': '问答答案',
    });
  });

  it('starts an exam and requests draft answers from the paper payload', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      startZquizExam: createPaper(),
    });

    await expect(startZquizExam({ activityId: 30 })).resolves.toMatchObject({
      attemptId: '9001',
      draftAnswers: [
        {
          paperItemNo: 1,
          selectedLabels: ['B'],
        },
      ],
    });

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('mutation startZquizExam');
    expect(query).toContain('attemptId');
    expect(query).toContain('deadlineAt');
    expect(query).toContain('draftAnswers');
  });

  it('autosaves and submits exam answers with attempt id', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      autosaveZquizExam: {
        attemptId: '9001',
        draftAnswers: [
          {
            answerText: null,
            blankAnswers: [],
            paperItemNo: 1,
            selectedLabels: ['B'],
          },
        ],
        lastSavedAt: '2026-06-09T01:05:00.000Z',
      },
    });

    await autosaveZquizExam({
      answers: [
        {
          paperItemNo: 1,
          selectedLabels: ['B'],
        },
      ],
      attemptId: '9001',
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation autosaveZquizExam'),
      {
        input: {
          answers: [
            {
              paperItemNo: 1,
              selectedLabels: ['B'],
            },
          ],
          attemptId: '9001',
        },
      },
    );

    executeGraphQLMock.mockResolvedValueOnce({
      submitZquizExam: {
        attemptId: '9001',
        attemptNo: 1,
        gradingStatus: 'AUTO_GRADED',
        scoreAwarded: 2,
        scoreMax: 2,
        startedAt: '2026-06-09T01:00:00.000Z',
        status: 'GRADED',
        submittedAt: '2026-06-09T01:10:00.000Z',
      },
    });

    await submitZquizExam({
      answers: [
        {
          paperItemNo: 1,
          selectedLabels: ['B'],
        },
      ],
      attemptId: '9001',
    });

    expect(executeGraphQLMock).toHaveBeenLastCalledWith(
      expect.stringContaining('mutation submitZquizExam'),
      {
        input: {
          answers: [
            {
              paperItemNo: 1,
              selectedLabels: ['B'],
            },
          ],
          attemptId: '9001',
        },
      },
    );
  });

  it('maps invalid exam schedule config to the teacher-contact message', () => {
    const error = {
      graphqlErrors: [
        {
          extensions: {
            errorCode: 'ZQUIZ_ACTIVITY_TIME_RANGE_INVALID',
            errorMessage: '考试开放时间和时长配置不完整',
          },
          message: 'BAD_USER_INPUT',
        },
      ],
      userMessage: '请求参数错误。',
    };

    isGraphQLIngressErrorMock.mockReturnValueOnce(true);

    expect(resolveZquizExamErrorMessage(error, 'fallback')).toBe('考试配置异常，请联系教师');
  });

  it('maps invalid business datetime errors to the teacher-contact message', () => {
    const error = {
      graphqlErrors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            errorCode: 'TIME_INVALID_BUSINESS_DATETIME',
            errorMessage: '业务日期时间必须为不带时区的 datetime 字符串',
          },
          message: '业务日期时间必须为不带时区的 datetime 字符串',
        },
      ],
      userMessage: '请求参数错误。',
    };

    isGraphQLIngressErrorMock.mockReturnValueOnce(true);

    expect(resolveZquizExamErrorMessage(error, 'fallback')).toBe('考试配置异常，请联系教师');
  });
});
