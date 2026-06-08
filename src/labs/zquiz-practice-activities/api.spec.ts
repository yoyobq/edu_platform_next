// src/labs/zquiz-practice-activities/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  isGraphQLIngressError: vi.fn(() => false),
}));

import {
  buildZquizPracticeSubmitAnswers,
  getMyZquizPracticeAttempt,
  submitZquizPractice,
  type ZquizPracticeAttempt,
  type ZquizPracticePaperItem,
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
  {
    assets: [],
    blanks: [],
    options: [
      { content: '正确', label: 'TRUE', sortOrder: 1 },
      { content: '错误', label: 'FALSE', sortOrder: 2 },
    ],
    paperItemNo: 5,
    questionId: 105,
    scoreMax: 1,
    stem: '判断题',
    type: 'TRUE_FALSE',
  },
] satisfies ZquizPracticePaperItem[];

function createAttempt(): ZquizPracticeAttempt {
  return {
    activity: {
      attemptLimit: 2,
      availability: 'OPEN',
      bankId: 7,
      canStart: true,
      durationMinutes: null,
      endsAt: null,
      id: 10,
      startsAt: null,
      title: '练习一',
    },
    attemptNo: 1,
    gradingStatus: 'MANUAL_PENDING',
    id: '9001',
    items: [
      {
        ...paperItems[0],
        answer: {
          answerText: null,
          blankAnswers: [],
          selectedLabels: ['B'],
        },
        gradingStatus: 'AUTO_GRADED',
        isCorrect: false,
        scoreAwarded: 0,
      },
    ],
    scoreAwarded: 0,
    scoreMax: 2,
    startedAt: '2026-06-08T01:00:00.000Z',
    status: 'SUBMITTED',
    submittedAt: '2026-06-08T01:05:00.000Z',
  };
}

describe('zquiz practice api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
  });

  it('builds submit answers from paper item numbers and omits unanswered drafts', () => {
    expect(
      buildZquizPracticeSubmitAnswers(paperItems, {
        '1': ' B ',
        '2': ['A', 'A', 'C', ' '],
        '3': {
          '1': ' 填空答案 ',
          '2': ' ',
        },
        '4': ' 问答答案 ',
        '5': ['TRUE', 'FALSE'],
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
      {
        paperItemNo: 5,
        selectedLabels: ['TRUE'],
      },
    ]);
  });

  it('submits practice answers with the signed paper token', async () => {
    const attempt = createAttempt();

    executeGraphQLMock.mockResolvedValueOnce({
      submitZquizPractice: attempt,
    });

    await expect(
      submitZquizPractice({
        activityId: 10,
        answers: [
          {
            paperItemNo: 1,
            selectedLabels: ['B'],
          },
        ],
        signedPaperToken: 'signed-token',
      }),
    ).resolves.toMatchObject({
      id: '9001',
      items: [
        {
          answer: {
            selectedLabels: ['B'],
          },
          gradingStatus: 'AUTO_GRADED',
        },
      ],
    });

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('mutation submitZquizPractice');
    expect(query).toContain('scoreAwarded');
    expect(query).toContain('answer');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('SubmitZquizPracticeInput'),
      {
        input: {
          activityId: 10,
          answers: [
            {
              paperItemNo: 1,
              selectedLabels: ['B'],
            },
          ],
          signedPaperToken: 'signed-token',
        },
      },
    );
  });

  it('loads a submitted attempt by attempt id', async () => {
    const attempt = createAttempt();

    executeGraphQLMock.mockResolvedValueOnce({
      getMyZquizPracticeAttempt: attempt,
    });

    await expect(getMyZquizPracticeAttempt({ attemptId: '9001' })).resolves.toMatchObject({
      id: '9001',
      scoreAwarded: 0,
      scoreMax: 2,
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query getMyZquizPracticeAttempt'),
      {
        input: {
          attemptId: '9001',
        },
      },
    );
  });
});
