// src/labs/student-evaluation-comment/infrastructure/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  executeGraphQLMock,
  getAccessTokenMock,
  getGraphQLEndpointMock,
  getGraphQLRuntimeConfigMock,
  onAuthFailureMock,
  refreshSessionMock,
} = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  getAccessTokenMock: vi.fn(),
  getGraphQLEndpointMock: vi.fn(),
  getGraphQLRuntimeConfigMock: vi.fn(),
  onAuthFailureMock: vi.fn(),
  refreshSessionMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  getGraphQLEndpoint: getGraphQLEndpointMock,
  getGraphQLRuntimeConfig: getGraphQLRuntimeConfigMock,
}));

import {
  batchWriteStudentEvaluationComments,
  getMyStudentEvaluationComments,
  getStudentEvaluationCommentWorkspace,
  importStudentEvaluationCommentMaterial,
  resolveStudentEvaluationCommentMaterialImportUrl,
} from './api';

describe('student evaluation comment api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    getAccessTokenMock.mockReset();
    getGraphQLEndpointMock.mockReset();
    getGraphQLRuntimeConfigMock.mockReset();
    onAuthFailureMock.mockReset();
    refreshSessionMock.mockReset();
    vi.unstubAllGlobals();

    getAccessTokenMock.mockReturnValue('access-token-001');
    getGraphQLEndpointMock.mockReturnValue('http://127.0.0.1:3000/graphql');
    getGraphQLRuntimeConfigMock.mockReturnValue({
      getAccessToken: getAccessTokenMock,
      onAuthFailure: onAuthFailureMock,
      refreshSession: refreshSessionMock,
    });
  });

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

  it('uploads a term xlsx with selected sheet and identity mappings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: buildMaterialImportResult({
            previewRows: [
              {
                content: 'Excel 正式评语。',
                expectedRevision: null,
                matchedBy: 'MANUAL',
                proposedAction: 'CREATE',
                sourceRow: 2,
                sourceSheet: '评语',
                studentId: 's-1',
                studentName: '张三',
              },
            ],
            status: 'READY_TO_SAVE',
          }),
          requestId: 'req-1',
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['xlsx'], '评语.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const result = await importStudentEvaluationCommentMaterial({
      classId: 'class-1',
      commentKind: 'TERM',
      file,
      identityMappings: [{ mappingKey: 'a'.repeat(64), studentId: 's-1' }],
      selectedSheet: '评语',
      semesterId: 202501,
    });

    expect(result.status).toBe('READY_TO_SAVE');
    expect(result.previewRows[0]).toMatchObject({
      content: 'Excel 正式评语。',
      expectedRevision: null,
      studentId: 's-1',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://127.0.0.1:3000/student-evaluation-comments/material-imports',
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const formData = request.body as FormData;
    expect(request.headers).toEqual({ Authorization: 'Bearer access-token-001' });
    expect(formData.get('classId')).toBe('class-1');
    expect(formData.get('commentKind')).toBe('TERM');
    expect(formData.get('semesterId')).toBe('202501');
    expect(formData.get('selectedSheet')).toBe('评语');
    expect(formData.get('identityMappings')).toBe(
      JSON.stringify([{ mappingKey: 'a'.repeat(64), studentId: 's-1' }]),
    );
    expect((formData.get('file') as File).name).toBe('评语.xlsx');
  });

  it('omits semesterId for graduation comments', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: buildMaterialImportResult({ commentKind: 'GRADUATION' }) }),
          { headers: { 'Content-Type': 'application/json' }, status: 201 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await importStudentEvaluationCommentMaterial({
      classId: 'class-1',
      commentKind: 'GRADUATION',
      file: new File(['xlsx'], '毕业评语.xlsx'),
      semesterId: null,
    });

    const formData = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as FormData;
    expect(formData.get('commentKind')).toBe('GRADUATION');
    expect(formData.has('semesterId')).toBe(false);
  });

  it('refreshes once after a 401 and rebuilds the authorization header', async () => {
    getAccessTokenMock.mockReturnValueOnce('expired-token').mockReturnValue('refreshed-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: '登录失效' } }), {
          headers: { 'Content-Type': 'application/json' },
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: buildMaterialImportResult() }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      importStudentEvaluationCommentMaterial({
        classId: 'class-1',
        commentKind: 'TERM',
        file: new File(['xlsx'], '评语.xlsx'),
        semesterId: 202501,
      }),
    ).resolves.toMatchObject({ status: 'NO_CHANGES' });

    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      Authorization: 'Bearer expired-token',
    });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({
      Authorization: 'Bearer refreshed-token',
    });
  });

  it('rejects unsupported or oversized material before fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      importStudentEvaluationCommentMaterial({
        classId: 'class-1',
        commentKind: 'TERM',
        file: new File(['xls'], '评语.xls'),
        semesterId: 202501,
      }),
    ).rejects.toThrow('只支持 .xlsx');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves the REST endpoint beside the configured GraphQL endpoint', () => {
    expect(resolveStudentEvaluationCommentMaterialImportUrl()).toBe(
      'http://127.0.0.1:3000/student-evaluation-comments/material-imports',
    );
  });
});

function buildMaterialImportResult(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    blockingErrors: [],
    classId: 'class-1',
    className: '测试班',
    commentKind: 'TERM',
    identityMappingGroups: [],
    previewRows: [],
    selectedSheet: '评语',
    semesterId: 202501,
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
