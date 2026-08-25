// src/labs/student-evaluation-comment-workbench/infrastructure/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  executeGraphQLMock,
  executeUpstreamSessionGraphQLMock,
  getAccessTokenMock,
  getGraphQLEndpointMock,
  getGraphQLRuntimeConfigMock,
} = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  executeUpstreamSessionGraphQLMock: vi.fn(),
  getAccessTokenMock: vi.fn(),
  getGraphQLEndpointMock: vi.fn(),
  getGraphQLRuntimeConfigMock: vi.fn(),
}));

vi.mock('@/entities/upstream-session', () => ({
  executeUpstreamSessionGraphQL: executeUpstreamSessionGraphQLMock,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  getGraphQLEndpoint: getGraphQLEndpointMock,
  getGraphQLRuntimeConfig: getGraphQLRuntimeConfigMock,
}));

import {
  discardStudentEvaluationCommentProductDrafts,
  getStudentEvaluationCommentProductWorkbench,
  importStudentEvaluationCommentProductMaterial,
  writeStudentEvaluationCommentProductComment,
  writeStudentEvaluationCommentProductComments,
} from './api';

describe('student evaluation comment product workbench api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    executeUpstreamSessionGraphQLMock.mockReset();
    getAccessTokenMock.mockReset();
    getGraphQLEndpointMock.mockReset();
    getGraphQLRuntimeConfigMock.mockReset();
    vi.unstubAllGlobals();
    getAccessTokenMock.mockReturnValue('access-token-001');
    getGraphQLEndpointMock.mockReturnValue('http://127.0.0.1:3000/graphql');
    getGraphQLRuntimeConfigMock.mockReturnValue({ getAccessToken: getAccessTokenMock });
  });

  it('always reads the teacher workspace in TERM scope', async () => {
    const workspace = { status: 'READY' };
    executeGraphQLMock.mockResolvedValueOnce({ studentEvaluationCommentWorkspace: workspace });

    await expect(
      getStudentEvaluationCommentProductWorkbench({ classId: '1021904', semesterId: 3 }),
    ).resolves.toBe(workspace);
    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({
      input: { classId: '1021904', commentKind: 'TERM', semesterId: 3 },
    });
  });

  it('removes Apollo typename fields from every revision input', async () => {
    const revision = {
      __typename: 'StudentEvaluationCommentRevisionDTO',
      payloadHash: 'a'.repeat(64),
      payloadVersion: 1,
    };
    const cleanRevision = { payloadHash: 'a'.repeat(64), payloadVersion: 1 };
    executeGraphQLMock
      .mockResolvedValueOnce({
        discardStudentEvaluationCommentAiDrafts: { discardedCount: 1 },
      })
      .mockResolvedValueOnce({
        batchWriteStudentEvaluationComments: { status: 'UPDATED' },
      });

    await discardStudentEvaluationCommentProductDrafts({
      classId: '1021904',
      items: [{ draftId: '7', expectedRevision: revision }],
      semesterId: 3,
    });
    await writeStudentEvaluationCommentProductComment({
      classId: '1021904',
      content: '正式评语',
      expectedRevision: revision,
      semesterId: 3,
      studentId: '324010101',
    });

    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({
      input: {
        classId: '1021904',
        items: [{ draftId: '7', expectedRevision: cleanRevision }],
        semesterId: 3,
      },
    });
    expect(executeGraphQLMock.mock.calls[1]?.[1]).toEqual({
      input: {
        classId: '1021904',
        commentKind: 'TERM',
        items: [
          {
            action: 'UPSERT',
            content: '正式评语',
            expectedRevision: cleanRevision,
            studentId: '324010101',
          },
        ],
        semesterId: 3,
      },
    });
  });

  it('batch writes imported drafts and strips transport-only revision fields', async () => {
    const revisionWithTypename = {
      __typename: 'StudentEvaluationCommentRevisionDTO',
      payloadHash: 'b'.repeat(64),
      payloadVersion: 2,
    };
    executeGraphQLMock.mockResolvedValueOnce({
      batchWriteStudentEvaluationComments: {
        counts: { created: 1, deleted: 0, unchanged: 0, updated: 1 },
        status: 'UPDATED',
      },
    });

    await writeStudentEvaluationCommentProductComments({
      classId: '1021904',
      items: [
        { content: '新建评语', expectedRevision: null, studentId: '324010101' },
        {
          content: '更新评语',
          expectedRevision: revisionWithTypename,
          studentId: '324010102',
        },
      ],
      semesterId: 3,
    });

    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({
      input: {
        classId: '1021904',
        commentKind: 'TERM',
        items: [
          {
            action: 'UPSERT',
            content: '新建评语',
            expectedRevision: null,
            studentId: '324010101',
          },
          {
            action: 'UPSERT',
            content: '更新评语',
            expectedRevision: { payloadHash: 'b'.repeat(64), payloadVersion: 2 },
            studentId: '324010102',
          },
        ],
        semesterId: 3,
      },
    });
  });

  it('uploads an xlsx as a term-scoped material import', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: buildMaterialImportResult({
            previewRows: [
              {
                content: 'Excel 评语',
                expectedRevision: null,
                matchedBy: 'STUDENT_ID',
                proposedAction: 'CREATE',
                sourceRow: 2,
                sourceSheet: '评语',
                studentId: '324010101',
                studentName: '张三',
              },
            ],
            status: 'READY_TO_SAVE',
          }),
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await importStudentEvaluationCommentProductMaterial({
      classId: '1021904',
      file: new File(['xlsx'], '评语.xlsx'),
      semesterId: 3,
    });

    expect(result.previewRows[0]).toMatchObject({
      content: 'Excel 评语',
      studentId: '324010101',
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://127.0.0.1:3000/student-evaluation-comments/material-imports',
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const formData = request.body as FormData;
    expect(request.headers).toEqual({ Authorization: 'Bearer access-token-001' });
    expect(formData.get('commentKind')).toBe('TERM');
    expect(formData.get('semesterId')).toBe('3');
  });
});

function buildMaterialImportResult(overrides: Record<string, unknown> = {}) {
  return {
    blockingErrors: [],
    classId: '1021904',
    className: '计算机2024级1班',
    commentKind: 'TERM',
    identityMappingGroups: [],
    previewRows: [],
    selectedSheet: '评语',
    semesterId: 3,
    sheetOptions: [],
    status: 'NO_CHANGES',
    summary: {
      blankCommentCount: 0,
      createCount: 0,
      matchedRows: 1,
      parsedRows: 1,
      unchangedCount: 1,
      updateCount: 0,
    },
    warnings: [],
    ...overrides,
  };
}
