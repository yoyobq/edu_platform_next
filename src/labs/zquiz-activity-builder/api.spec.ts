// src/labs/zquiz-activity-builder/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  isGraphQLIngressError: vi.fn(() => false),
}));

import {
  buildZquizActivityDraftInput,
  listZquizBanks,
  listZquizTeacherActivities,
  saveZquizExamDraft,
  validateZquizActivityPublishDraft,
  type ZquizTeacherActivityDetail,
} from './api';

function createDetail(): Omit<ZquizTeacherActivityDetail, 'mode'> {
  return {
    attemptLimit: null,
    bankId: 1,
    createdAt: '2026-06-08T01:00:00.000Z',
    createdByAccountId: 1,
    durationMinutes: 90,
    endsAt: '2026-06-08 11:00:00.000',
    id: 20,
    items: [
      {
        question: {
          bankId: 1,
          explanation: null,
          id: 1002,
          knowledgeNodeIds: [],
          options: [],
          sortOrder: 2,
          status: 'ACTIVE',
          stem: '题目二',
          type: 'ESSAY',
        },
        questionId: 1002,
        scoreMax: 5,
        sortOrder: 2,
      },
      {
        question: {
          bankId: 1,
          explanation: null,
          id: 1001,
          knowledgeNodeIds: [],
          options: [],
          sortOrder: 1,
          status: 'ACTIVE',
          stem: '题目一',
          type: 'SINGLE_CHOICE',
        },
        questionId: 1001,
        scoreMax: 2,
        sortOrder: 1,
      },
    ],
    shuffleOptions: true,
    shuffleQuestions: true,
    startsAt: '2026-06-08 09:00:00.000',
    status: 'DRAFT',
    targets: [
      {
        classCodeSnapshot: 'C001',
        classId: 'C001',
        classNameSnapshot: '一班',
      },
    ],
    title: '期中考试',
    updatedAt: '2026-06-08T01:10:00.000Z',
  };
}

describe('zquiz activity builder api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
  });

  it('builds normalized draft input with generated sort order', () => {
    expect(
      buildZquizActivityDraftInput({
        activityId: 10,
        attemptLimit: null,
        bankId: 1,
        durationMinutes: 90,
        endsAt: ' 2026-06-08 11:00:00.000 ',
        items: [
          { questionId: 1002, scoreMax: 5 },
          { questionId: 1001, scoreMax: 2 },
        ],
        shuffleOptions: false,
        shuffleQuestions: true,
        startsAt: ' 2026-06-08 09:00:00.000 ',
        targetClassIds: [' C001 ', 'C001', 'C002', ' '],
        title: ' 期中考试 ',
      }),
    ).toEqual({
      activityId: 10,
      attemptLimit: null,
      bankId: 1,
      durationMinutes: 90,
      endsAt: '2026-06-08 11:00:00.000',
      items: [
        { questionId: 1002, scoreMax: 5, sortOrder: 1 },
        { questionId: 1001, scoreMax: 2, sortOrder: 2 },
      ],
      shuffleOptions: false,
      shuffleQuestions: true,
      startsAt: '2026-06-08 09:00:00.000',
      targetClassIds: ['C001', 'C002'],
      title: '期中考试',
    });
  });

  it('calls bank and activity list queries with normalized filters', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      listZquizBanks: [
        { code: 'B002', id: 2, name: '题库二', sortOrder: 2, status: 'ACTIVE' },
        { code: 'B001', id: 1, name: '题库一', sortOrder: 1, status: 'ACTIVE' },
      ],
    });

    await expect(listZquizBanks({ keyword: ' 题库 ', limit: 20 })).resolves.toMatchObject([
      { id: 1 },
      { id: 2 },
    ]);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query listZquizBanks'),
      {
        input: {
          keyword: '题库',
          limit: 20,
        },
      },
    );

    executeGraphQLMock.mockResolvedValueOnce({
      listZquizTeacherActivities: [
        {
          attemptLimit: null,
          bankId: 1,
          createdByAccountId: 1,
          durationMinutes: null,
          endsAt: null,
          id: 10,
          itemCount: 2,
          mode: 'PRACTICE',
          startsAt: null,
          status: 'DRAFT',
          targetCount: 1,
          title: '练习',
          updatedAt: '2026-06-08T01:00:00.000Z',
        },
      ],
    });

    await listZquizTeacherActivities({
      bankId: 1,
      keyword: ' 练习 ',
      mode: 'PRACTICE',
      status: 'DRAFT',
    });

    expect(executeGraphQLMock).toHaveBeenLastCalledWith(
      expect.stringContaining('query listZquizTeacherActivities'),
      {
        input: {
          bankId: 1,
          keyword: '练习',
          mode: 'PRACTICE',
          status: 'DRAFT',
        },
      },
    );
  });

  it('saves exam draft through the exam mutation and normalizes detail order', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      saveZquizExamDraft: createDetail(),
    });

    await expect(
      saveZquizExamDraft({
        bankId: 1,
        durationMinutes: 90,
        endsAt: '2026-06-08 11:00:00.000',
        items: [
          { questionId: 1002, scoreMax: 5 },
          { questionId: 1001, scoreMax: 2 },
        ],
        startsAt: '2026-06-08 09:00:00.000',
        targetClassIds: ['C001'],
        title: '期中考试',
      }),
    ).resolves.toMatchObject({
      id: 20,
      items: [{ questionId: 1001 }, { questionId: 1002 }],
      mode: 'EXAM',
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation saveZquizExamDraft'),
      expect.objectContaining({
        input: expect.objectContaining({
          items: [
            { questionId: 1002, scoreMax: 5, sortOrder: 1 },
            { questionId: 1001, scoreMax: 2, sortOrder: 2 },
          ],
        }),
      }),
    );
  });

  it('validates publish rules for practice and exam', () => {
    expect(
      validateZquizActivityPublishDraft({
        durationMinutes: null,
        endsAt: null,
        items: [],
        mode: 'PRACTICE',
        startsAt: null,
        targetClassIds: [],
      }),
    ).toEqual(['发布前至少选择 1 道题。', '发布前至少选择 1 个目标班级。']);

    expect(
      validateZquizActivityPublishDraft({
        durationMinutes: 90,
        endsAt: '2026-06-08 09:00:00.000',
        items: [{ questionId: 1001, scoreMax: 2, sortOrder: 1 }],
        mode: 'EXAM',
        startsAt: '2026-06-08 11:00:00.000',
        targetClassIds: ['C001'],
      }),
    ).toEqual(['考试开始时间不能晚于结束时间。']);
  });
});
