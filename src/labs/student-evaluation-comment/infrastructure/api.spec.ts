// src/labs/student-evaluation-comment/infrastructure/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import {
  batchWriteStudentEvaluationComments,
  getMyStudentEvaluationComments,
  getStudentEvaluationCommentClassScope,
  listStudentEvaluationCommentClassOptions,
  listStudentEvaluationCommentSemesters,
} from './api';

describe('student evaluation comment api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
  });

  it('searches all local classes with a normalized keyword for admin', async () => {
    const payload = [{ id: '1021904', className: '计算机2024级1班' }];
    executeGraphQLMock.mockResolvedValueOnce({ listLocalClassOptions: payload });

    await expect(listStudentEvaluationCommentClassOptions('ALL', ' 计算机 ')).resolves.toBe(
      payload,
    );

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    expect(query).toContain('StudentEvaluationCommentLocalClassOptions');
    expect(query).toContain('listLocalClassOptions(input: $input)');
    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({
      input: { keyword: '计算机' },
    });
  });

  it('uses myManagedClasses for class adviser candidates', async () => {
    const payload = [{ id: '1021904', className: '计算机2024级1班' }];
    executeGraphQLMock.mockResolvedValueOnce({ myManagedClasses: payload });

    await expect(listStudentEvaluationCommentClassOptions('MANAGED')).resolves.toBe(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    expect(query).toContain('StudentEvaluationCommentMyManagedClasses');
    expect(query).toContain('myManagedClasses');
    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({});
  });

  it('does not call GraphQL when the class id must be entered manually', async () => {
    await expect(listStudentEvaluationCommentClassOptions('MANUAL')).resolves.toEqual([]);
    expect(executeGraphQLMock).not.toHaveBeenCalled();
  });

  it('loads all local semesters without filtering out hidden records', async () => {
    const payload = [{ id: 202501, name: '2025-2026 第一学期' }];
    executeGraphQLMock.mockResolvedValueOnce({ academicSemesters: payload });

    await expect(listStudentEvaluationCommentSemesters()).resolves.toBe(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    expect(query).toContain('StudentEvaluationCommentAcademicSemesters');
    expect(query).toContain('academicSemesters(limit: $limit)');
    expect(query).not.toContain('isVisible:');
    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({ limit: 500 });
  });

  it('reads a graduation class scope with an explicit null semester', async () => {
    const payload = { classItem: { id: '1021904' }, students: [] };
    executeGraphQLMock.mockResolvedValueOnce({
      studentEvaluationCommentClassScope: payload,
    });

    await expect(
      getStudentEvaluationCommentClassScope({
        classId: '1021904',
        commentKind: 'GRADUATION',
        semesterId: null,
      }),
    ).resolves.toBe(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    expect(query).toContain('StudentEvaluationCommentClassScopeInput!');
    expect(query).toContain('revision');
    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({
      input: {
        classId: '1021904',
        commentKind: 'GRADUATION',
        semesterId: null,
      },
    });
  });

  it('writes one scope with the caller-provided opaque revision', async () => {
    const revision = { payloadHash: 'a'.repeat(64), payloadVersion: 1 };
    const payload = {
      counts: { created: 0, deleted: 0, unchanged: 0, updated: 1 },
      items: [{ status: 'UPDATED', studentId: '324010112' }],
      status: 'UPDATED',
    };
    executeGraphQLMock.mockResolvedValueOnce({
      batchWriteStudentEvaluationComments: payload,
    });

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
        scope: {
          classId: '1021904',
          commentKind: 'TERM',
          semesterId: 202501,
        },
      }),
    ).resolves.toBe(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    expect(query).toContain('BatchWriteStudentEvaluationCommentsInput!');
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

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    expect(query).toContain('query MyStudentEvaluationComments');
    expect(query).not.toContain('$studentId');
    expect(query).not.toContain('myStudentEvaluationComments(');
    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({});
  });
});
