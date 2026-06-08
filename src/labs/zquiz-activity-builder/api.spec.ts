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
  collectZquizExamAttempts,
  getZquizActivityTeacherDetail,
  getZquizExamTeacherProgress,
  listZquizBanks,
  listZquizKnowledgeNodes,
  listZquizTeacherActivities,
  saveZquizExamDraft,
  validateZquizActivityPublishDraft,
  type ZquizExamTeacherProgress,
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

function createProgress(): ZquizExamTeacherProgress {
  return {
    abandonedAttemptCount: 0,
    activityId: 20,
    autoGradedAttemptCount: 2,
    gradedAttemptCount: 2,
    inProgressAttemptCount: 3,
    manualGradedAttemptCount: 0,
    manualPendingAttemptCount: 1,
    notGradedAttemptCount: 3,
    notStartedStudentCount: 5,
    startedStudentCount: 6,
    submittedAttemptCount: 3,
    targetStudentCount: 11,
    totalAttemptCount: 6,
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

  it('rejects timezone datetime text before saving draft input', () => {
    expect(() =>
      buildZquizActivityDraftInput({
        bankId: 1,
        durationMinutes: 90,
        endsAt: '2026-06-08T11:00:00.000Z',
        items: [{ questionId: 1001, scoreMax: 2 }],
        startsAt: '2026-06-08 09:00:00.000',
        targetClassIds: ['C001'],
        title: '期中考试',
      }),
    ).toThrow('时间必须是不带时区的业务时间');
  });

  it('builds fixed and random generation rule inputs for exam drafts', () => {
    expect(
      buildZquizActivityDraftInput({
        bankId: 1,
        generationRule: {
          fixedItems: [
            { questionId: 1001, scoreMax: 2 },
            { questionId: 1002, scoreMax: 3 },
          ],
          shuffleOptions: false,
          shuffleQuestions: true,
          strategy: 'FIXED',
        },
        items: [
          { questionId: 1001, scoreMax: 2 },
          { questionId: 1002, scoreMax: 3 },
        ],
        targetClassIds: ['C001'],
        title: '固定考试',
      }),
    ).toMatchObject({
      generationRule: {
        fixedItems: [
          { questionId: 1001, scoreMax: 2, sortOrder: 1 },
          { questionId: 1002, scoreMax: 3, sortOrder: 2 },
        ],
        shuffleOptions: false,
        shuffleQuestions: true,
        strategy: 'FIXED',
      },
    });

    expect(
      buildZquizActivityDraftInput({
        bankId: 1,
        generationRule: {
          randomRules: [
            {
              count: 5,
              includeChildren: null,
              knowledgeNodeIds: [10, 10, 11],
              questionType: 'SINGLE_CHOICE',
              scoreMax: 2,
            },
            {
              count: 3,
              includeChildren: false,
              knowledgeNodeIds: [20],
              questionType: 'MULTIPLE_CHOICE',
              scoreMax: 4,
            },
          ],
          strategy: 'RANDOM_BY_KNOWLEDGE',
        },
        items: [],
        targetClassIds: ['C001'],
        title: '随机考试',
      }),
    ).toMatchObject({
      generationRule: {
        randomRules: [
          {
            count: 5,
            includeChildren: true,
            knowledgeNodeIds: [10, 11],
            questionType: 'SINGLE_CHOICE',
            scoreMax: 2,
            sortOrder: 1,
          },
          {
            count: 3,
            includeChildren: false,
            knowledgeNodeIds: [20],
            questionType: 'MULTIPLE_CHOICE',
            scoreMax: 4,
            sortOrder: 2,
          },
        ],
        shuffleOptions: true,
        shuffleQuestions: true,
        strategy: 'RANDOM_BY_KNOWLEDGE',
      },
      items: [],
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

  it('loads zquiz knowledge nodes with normalized filters', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      listZquizKnowledgeNodes: [
        {
          bankId: 1,
          code: 'P002',
          directQuestionCount: 2,
          id: 11,
          name: '知识点二',
          nodeType: 'POINT',
          parentId: 1,
          sortOrder: 2,
          totalQuestionCount: 2,
        },
        {
          bankId: 1,
          code: 'P001',
          directQuestionCount: 3,
          id: 10,
          name: '知识点一',
          nodeType: 'POINT',
          parentId: 1,
          sortOrder: 1,
          totalQuestionCount: 3,
        },
      ],
    });

    await expect(
      listZquizKnowledgeNodes({
        bankId: 1,
        keyword: ' 知识点 ',
        nodeType: 'POINT',
      }),
    ).resolves.toMatchObject([{ id: 10 }, { id: 11 }]);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query listZquizKnowledgeNodes'),
      {
        input: {
          bankId: 1,
          keyword: '知识点',
          nodeType: 'POINT',
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

  it('saves a random exam draft through generation rule input', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      saveZquizExamDraft: {
        ...createDetail(),
        generationRule: {
          fixedItems: [],
          randomRules: [
            {
              count: 5,
              includeChildren: true,
              knowledgeNodeIds: [10, 11],
              questionType: 'SINGLE_CHOICE',
              scoreMax: 2,
              sortOrder: 1,
            },
          ],
          shuffleOptions: true,
          shuffleQuestions: true,
          strategy: 'RANDOM_BY_KNOWLEDGE',
        },
        items: [],
      },
    });

    await expect(
      saveZquizExamDraft({
        bankId: 1,
        generationRule: {
          randomRules: [
            {
              count: 5,
              includeChildren: true,
              knowledgeNodeIds: [10, 11],
              questionType: 'SINGLE_CHOICE',
              scoreMax: 2,
            },
          ],
          strategy: 'RANDOM_BY_KNOWLEDGE',
        },
        items: [],
        targetClassIds: ['C001'],
        title: '随机考试',
      }),
    ).resolves.toMatchObject({
      generationRule: {
        randomRules: [
          {
            count: 5,
            knowledgeNodeIds: [10, 11],
          },
        ],
        strategy: 'RANDOM_BY_KNOWLEDGE',
      },
      items: [],
      mode: 'EXAM',
    });

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('generationRule');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation saveZquizExamDraft'),
      expect.objectContaining({
        input: expect.objectContaining({
          generationRule: {
            randomRules: [
              {
                count: 5,
                includeChildren: true,
                knowledgeNodeIds: [10, 11],
                questionType: 'SINGLE_CHOICE',
                scoreMax: 2,
                sortOrder: 1,
              },
            ],
            shuffleOptions: true,
            shuffleQuestions: true,
            strategy: 'RANDOM_BY_KNOWLEDGE',
          },
          items: [],
        }),
      }),
    );
  });

  it('normalizes exam detail shuffle flags from generation rule when present', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      getZquizExamTeacherDetail: {
        ...createDetail(),
        generationRule: {
          fixedItems: [],
          randomRules: [
            {
              count: 5,
              includeChildren: false,
              knowledgeNodeIds: [10],
              questionType: 'SINGLE_CHOICE',
              scoreMax: 2,
              sortOrder: 1,
            },
          ],
          shuffleOptions: false,
          shuffleQuestions: false,
          strategy: 'RANDOM_BY_KNOWLEDGE',
        },
        items: [],
        shuffleOptions: true,
        shuffleQuestions: true,
      },
    });

    await expect(
      getZquizActivityTeacherDetail({
        activityId: 20,
        mode: 'EXAM',
      }),
    ).resolves.toMatchObject({
      generationRule: {
        shuffleOptions: false,
        shuffleQuestions: false,
        strategy: 'RANDOM_BY_KNOWLEDGE',
      },
      shuffleOptions: false,
      shuffleQuestions: false,
    });
  });

  it('loads exam teacher progress and collects in-progress attempts', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      getZquizExamTeacherProgress: createProgress(),
    });

    await expect(getZquizExamTeacherProgress({ activityId: 20 })).resolves.toMatchObject({
      activityId: 20,
      inProgressAttemptCount: 3,
      targetStudentCount: 11,
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query getZquizExamTeacherProgress'),
      {
        input: {
          activityId: 20,
        },
      },
    );

    executeGraphQLMock.mockResolvedValueOnce({
      collectZquizExamAttempts: {
        activityId: 20,
        collectedCount: 3,
        progress: {
          ...createProgress(),
          inProgressAttemptCount: 0,
          submittedAttemptCount: 6,
        },
        skippedCount: 3,
      },
    });

    await expect(collectZquizExamAttempts({ activityId: 20 })).resolves.toMatchObject({
      activityId: 20,
      collectedCount: 3,
      progress: {
        inProgressAttemptCount: 0,
      },
      skippedCount: 3,
    });

    expect(executeGraphQLMock).toHaveBeenLastCalledWith(
      expect.stringContaining('mutation collectZquizExamAttempts'),
      {
        input: {
          activityId: 20,
        },
      },
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

    expect(
      validateZquizActivityPublishDraft({
        durationMinutes: 90,
        endsAt: '2026-06-08 11:00:00.000',
        generationRule: {
          randomRules: [
            {
              count: 5,
              includeChildren: true,
              knowledgeNodeIds: [10],
              questionType: 'SINGLE_CHOICE',
              scoreMax: 2,
              sortOrder: 1,
            },
          ],
          shuffleOptions: true,
          shuffleQuestions: true,
          strategy: 'RANDOM_BY_KNOWLEDGE',
        },
        items: [],
        mode: 'EXAM',
        startsAt: '2026-06-08 09:00:00.000',
        targetClassIds: ['C001'],
      }),
    ).toEqual([]);

    expect(
      validateZquizActivityPublishDraft({
        durationMinutes: 90,
        endsAt: '2026-06-08 11:00:00.000',
        generationRule: {
          randomRules: [],
          shuffleOptions: true,
          shuffleQuestions: true,
          strategy: 'RANDOM_BY_KNOWLEDGE',
        },
        items: [],
        mode: 'EXAM',
        startsAt: '2026-06-08 09:00:00.000',
        targetClassIds: ['C001'],
      }),
    ).toContain('随机组卷发布前至少配置 1 条抽题规则。');
  });
});
