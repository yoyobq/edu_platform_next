// src/labs/student-evaluation-comment/infrastructure/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({ executeGraphQLMock: vi.fn() }));

vi.mock('@/shared/graphql', () => ({ executeGraphQL: executeGraphQLMock }));

import {
  batchWriteStudentEvaluationComments,
  getMyStudentEvaluationComments,
  getStudentEvaluationCommentWorkspace,
} from './api';

describe('student evaluation comment api', () => {
  beforeEach(() => executeGraphQLMock.mockReset());

  it('queries options, governance and class view as one workspace', async () => {
    const payload = { classOptions: [], commentKind: 'TERM', status: 'NO_CLASSES', view: null };
    executeGraphQLMock.mockResolvedValueOnce({ studentEvaluationCommentWorkspace: payload });

    await expect(getStudentEvaluationCommentWorkspace({ commentKind: 'TERM' })).resolves.toBe(
      payload,
    );
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query StudentEvaluationCommentWorkspace'),
      { input: { commentKind: 'TERM' } },
    );
    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    expect(query).toContain('classOptions');
    expect(query).toContain('termOptions');
    expect(query).toContain('actions');
    expect(query).toContain('revision');
  });

  it('writes one scope with the caller-provided opaque revision', async () => {
    const revision = { payloadHash: 'a'.repeat(64), payloadVersion: 1 };
    const payload = {
      counts: { created: 0, deleted: 0, unchanged: 0, updated: 1 },
      items: [{ status: 'UPDATED', studentId: '324010112' }],
      status: 'UPDATED',
    };
    executeGraphQLMock.mockResolvedValueOnce({ batchWriteStudentEvaluationComments: payload });

    await expect(
      batchWriteStudentEvaluationComments({
        items: [
          {
            action: 'UPSERT',
            content: '更新后的正式评语。',
            expectedRevision: revision,
            studentId: '324010112',
          },
        ],
        scope: { classId: '1021904', commentKind: 'TERM', semesterId: 202501 },
      }),
    ).resolves.toBe(payload);
    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({
      input: {
        classId: '1021904',
        commentKind: 'TERM',
        semesterId: 202501,
        items: [
          {
            action: 'UPSERT',
            content: '更新后的正式评语。',
            expectedRevision: revision,
            studentId: '324010112',
          },
        ],
      },
    });
  });

  it('reads only the current account student without variables', async () => {
    const payload = { graduation: null, studentId: '324010112', terms: [] };
    executeGraphQLMock.mockResolvedValueOnce({ myStudentEvaluationComments: payload });

    await expect(getMyStudentEvaluationComments()).resolves.toBe(payload);
    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({});
  });
});
