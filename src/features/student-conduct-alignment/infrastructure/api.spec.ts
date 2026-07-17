// src/features/student-conduct-alignment/infrastructure/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  executeGraphQLMock,
  executeUpstreamSessionGraphQLMock,
  fetchMock,
  getGraphQLEndpointMock,
  getGraphQLRuntimeConfigMock,
  isGraphQLIngressErrorMock,
} = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  executeUpstreamSessionGraphQLMock: vi.fn(),
  fetchMock: vi.fn(),
  getGraphQLEndpointMock: vi.fn(),
  getGraphQLRuntimeConfigMock: vi.fn(),
  isGraphQLIngressErrorMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  getGraphQLEndpoint: getGraphQLEndpointMock,
  getGraphQLRuntimeConfig: getGraphQLRuntimeConfigMock,
  isGraphQLIngressError: isGraphQLIngressErrorMock,
}));

vi.mock('@/entities/upstream-session', () => ({
  executeUpstreamSessionGraphQL: executeUpstreamSessionGraphQLMock,
  isExpiredUpstreamSessionError: vi.fn(),
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

import {
  cleanupStudentConductGradeCorrection,
  fetchStudentConductGradeWorkspace,
  importStudentConductGradeMaterials,
  normalizeConductCleanupInput,
  normalizeConductWorkspaceInput,
  normalizeImportStudentConductGradeMaterialsInput,
  normalizePatchStudentConductGradeCorrectionsInput,
  normalizeRefreshConductClassInput,
  patchStudentConductGradeCorrections,
  readStudentConductGradePatchRowIssues,
  refreshStudentConductGradeClassFromUpstream,
  resolveStudentConductGradeMaterialImportUrl,
} from './api';

describe('student-conduct-alignment api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    executeUpstreamSessionGraphQLMock.mockReset();
    fetchMock.mockReset();
    getGraphQLEndpointMock.mockReset();
    getGraphQLRuntimeConfigMock.mockReset();
    isGraphQLIngressErrorMock.mockReset();
    getGraphQLEndpointMock.mockReturnValue('http://127.0.0.1:3000/graphql');
    getGraphQLRuntimeConfigMock.mockReturnValue({});
    isGraphQLIngressErrorMock.mockReturnValue(false);
    vi.stubGlobal('fetch', fetchMock);
  });

  it('normalizes conduct view and cleanup inputs', () => {
    expect(
      normalizeConductWorkspaceInput({
        classId: ' class-1 ',
        semesterId: 7,
      }),
    ).toEqual({
      classId: 'class-1',
      semesterId: 7,
    });

    expect(
      normalizeConductCleanupInput({
        classId: ' class-1 ',
        semesterId: 7,
        studentId: ' stu-1 ',
      }),
    ).toEqual({
      classId: 'class-1',
      semesterId: 7,
      studentId: 'stu-1',
    });
  });

  it('normalizes conduct upstream refresh scope and validates semester scope', () => {
    expect(
      normalizeRefreshConductClassInput({
        classId: ' class-1 ',
        scope: 'ALL_TERMS',
        upstreamSessionToken: ' token-1 ',
      }),
    ).toEqual({
      classId: 'class-1',
      scope: 'ALL_TERMS',
      upstreamSessionToken: 'token-1',
    });

    expect(
      normalizeRefreshConductClassInput({
        classId: 'class-1',
        scope: 'SELECTED_TERM',
        semesterId: 7,
        upstreamSessionToken: ' token-1 ',
      }),
    ).toEqual({
      classId: 'class-1',
      scope: 'SELECTED_TERM',
      semesterId: 7,
      upstreamSessionToken: 'token-1',
    });

    expect(() =>
      normalizeRefreshConductClassInput({
        classId: 'class-1',
        scope: 'SELECTED_TERM',
        upstreamSessionToken: ' token-1 ',
      }),
    ).toThrow('同步所选学期时必须提供 semesterId。');
  });

  it('normalizes conduct correction patch input and omits empty fields', () => {
    expect(
      normalizePatchStudentConductGradeCorrectionsInput({
        classId: ' class-1 ',
        semesterId: 7,
        students: [
          {
            confirmedGrade: ' 优 ',
            score: ' 88.0 ',
            studentId: ' stu-1 ',
          },
          {
            clearFieldKeys: ['score', 'score', 'confirmedGrade'],
            confirmedGrade: '   ',
            score: null,
            studentId: ' stu-2 ',
          },
        ],
      }),
    ).toEqual({
      classId: 'class-1',
      semesterId: 7,
      students: [
        {
          confirmedGrade: '优',
          score: '88.0',
          studentId: 'stu-1',
        },
        {
          clearFieldKeys: ['score', 'confirmedGrade'],
          studentId: 'stu-2',
        },
      ],
    });
  });

  it('normalizes material import input and accepts supported Office formats', () => {
    const docFile = new File(['doc'], 'conduct.doc');
    const docxFile = new File(['docx'], 'conduct.docx');
    const xlsFile = new File(['xls'], 'conduct.xls');
    const xlsxFile = new File(['xlsx'], 'conduct.xlsx');

    expect(
      normalizeImportStudentConductGradeMaterialsInput({
        classCode: ' 2501 ',
        confirmedWarningKeys: [' key-1 ', 'key-1', ''],
        files: [docFile, docxFile, xlsFile, xlsxFile],
        schoolYear: ' 2025 ',
        semester: ' 1 ',
      }),
    ).toEqual({
      classCode: '2501',
      confirmedWarningKeys: ['key-1'],
      files: [docFile, docxFile, xlsFile, xlsxFile],
      schoolYear: '2025',
      semester: '1',
    });

    expect(() =>
      normalizeImportStudentConductGradeMaterialsInput({
        classCode: '2501',
        files: [],
        schoolYear: '2025',
        semester: '1',
      }),
    ).toThrow('请选择需要导入的操行材料。');

    expect(() =>
      normalizeImportStudentConductGradeMaterialsInput({
        classCode: '2501',
        files: [new File(['pdf'], 'conduct.pdf')],
        schoolYear: '2025',
        semester: '1',
      }),
    ).toThrow('操行材料仅支持 .doc、.docx、.xls、.xlsx。');

    expect(() =>
      normalizeImportStudentConductGradeMaterialsInput({
        classCode: '2501',
        files: Array.from({ length: 6 }, (_, index) => new File(['docx'], `conduct-${index}.docx`)),
        schoolYear: '2025',
        semester: '1',
      }),
    ).toThrow('单次最多导入 5 个操行材料文件。');

    expect(() =>
      normalizeImportStudentConductGradeMaterialsInput({
        classCode: '2501',
        files: [new File(['x'.repeat(204801)], 'conduct.docx')],
        schoolYear: '2025',
        semester: '1',
      }),
    ).toThrow('操行材料单文件大小不能超过 200KB。');
  });

  it('rejects invalid conduct correction patch inputs before graphql', () => {
    expect(() =>
      normalizePatchStudentConductGradeCorrectionsInput({
        classId: 'class-1',
        semesterId: 7,
        students: [],
      }),
    ).toThrow('请至少选择一名需要补录操行的学生。');

    expect(() =>
      normalizePatchStudentConductGradeCorrectionsInput({
        classId: 'class-1',
        semesterId: 7,
        students: [
          {
            confirmedGrade: ' ',
            score: null,
            studentId: 'stu-1',
          },
        ],
      }),
    ).toThrow('每个学生至少需要一个操行补录或清除操作。');

    expect(() =>
      normalizePatchStudentConductGradeCorrectionsInput({
        classId: 'class-1',
        semesterId: 7,
        students: [
          {
            clearFieldKeys: ['score'],
            score: '90',
            studentId: 'stu-1',
          },
        ],
      }),
    ).toThrow('同一个操行字段不能同时补录和清除。');

    expect(() =>
      normalizePatchStudentConductGradeCorrectionsInput({
        classId: 'class-1',
        semesterId: 7,
        students: [
          {
            clearFieldKeys: ['estimatedGrade' as 'score'],
            studentId: 'stu-1',
          },
        ],
      }),
    ).toThrow('操行补录清除字段只支持 score、confirmedGrade。');

    expect(() =>
      normalizePatchStudentConductGradeCorrectionsInput({
        classId: 'class-1',
        semesterId: 7,
        students: Array.from({ length: 501 }, (_, index) => ({
          score: String(index),
          studentId: `stu-${index}`,
        })),
      }),
    ).toThrow('单次操行补录最多提交 500 名学生。');
  });

  it('loads the conduct workspace with server-owned selection, actions and view', async () => {
    const classOption = {
      blockingReasonCode: null,
      blockingReasonMessage: null,
      catalogStatus: 'READY',
      classCode: '2501',
      classId: 'class-1',
      className: '25计算机1班',
      departmentId: 'dept-1',
      gradeYear: 2025,
      majorId: 'major-1',
      majorName: '计算机',
      trainingYears: 4,
    };
    const termOption = {
      isCurrent: true,
      label: '2025-2026学年第二学期',
      schoolYear: 2025,
      semesterId: 7,
      sequence: 2,
      termNumber: 2,
    };
    const payload = {
      actions: [
        {
          action: 'PATCH_CORRECTIONS',
          allowed: true,
          reasonCode: null,
          reasonMessage: null,
        },
      ],
      classOptions: [classOption],
      selectedClass: classOption,
      selectedTerm: termOption,
      status: 'READY',
      termOptions: [termOption],
      view: {
        classCode: '2501',
        classId: 'class-1',
        className: '25计算机1班',
        rosterEligibilitySummary: {
          excludedAfterExitCount: 0,
          excludedBeforeEntryCount: 0,
          excludedNotCheckedInCount: 1,
          inScopeCount: 0,
          unresolvedEffectiveSemesterCount: 0,
        },
        schoolYear: '2025',
        sectionKey: 'CONDUCT_GRADE',
        semester: '2',
        studentCount: 0,
        students: [],
      },
      warnings: [],
    };

    executeGraphQLMock.mockResolvedValueOnce({ studentConductGradeWorkspace: payload });

    await expect(
      fetchStudentConductGradeWorkspace({ classId: ' class-1 ', semesterId: 7 }),
    ).resolves.toMatchObject({
      ...payload,
      classOptions: [expect.objectContaining({ id: 'class-1' })],
      selectedClass: expect.objectContaining({ id: 'class-1' }),
    });

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('studentConductGradeWorkspace');
    expect(query).toContain('sequence');
    expect(query).toContain('actions');
    expect(query).toContain('manualPatchFieldKeys');
    expect(query).toContain('rosterEligibilitySummary');
    expect(query).toMatch(/score\s*\{\s*value\s+source\s+conflict\s*\}/);
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentConductGradeGovernanceWorkspace'),
      {
        input: {
          classId: 'class-1',
          semesterId: 7,
        },
      },
    );
  });

  it('cleans stale conduct corrections without sending upstream session data', async () => {
    const payload = {
      classCode: '2501',
      clearedFieldKeys: ['confirmedGrade'],
      remainingManualPatchFieldKeys: [],
      schoolYear: '2025',
      semester: '1',
      status: 'CLEARED',
      studentId: 'stu-1',
      termKey: '2025::1',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      cleanupStudentConductGradeCorrection: payload,
    });

    await expect(
      cleanupStudentConductGradeCorrection({
        classId: ' class-1 ',
        semesterId: 7,
        studentId: ' stu-1 ',
      }),
    ).resolves.toBe(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('cleanupStudentConductGradeCorrection');
    expect(query).not.toContain('upstreamSessionToken');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentConductGradeGovernanceCleanup'),
      {
        input: {
          classId: 'class-1',
          semesterId: 7,
          studentId: 'stu-1',
        },
      },
    );
  });

  it('patches conduct corrections without estimated grade or upstream session data', async () => {
    const payload = {
      affectedStudents: 2,
      classCode: '2501',
      className: '25计算机1班',
      clearedFieldCount: 1,
      clearedUpstreamFieldCount: 0,
      createdSectionCount: 0,
      rowResults: [
        {
          clearedFieldKeys: [],
          clearedUpstreamFieldKeys: [],
          conductSectionStatus: 'LOCAL_CORRECTION',
          createdSection: false,
          rowIndex: 0,
          skippedUpstreamFieldKeys: [],
          status: 'WRITTEN',
          studentId: 'stu-1',
          unchangedFieldKeys: [],
          writtenFieldKeys: ['score', 'confirmedGrade'],
        },
      ],
      schoolYear: '2025',
      sectionKey: 'CONDUCT_GRADE',
      semester: '1',
      skippedUpstreamFieldCount: 0,
      status: 'WRITTEN',
      totalRows: 2,
      unchangedFieldCount: 0,
      unchangedStudentCount: 0,
      writtenFieldCount: 2,
      writtenStudentCount: 1,
    };

    executeGraphQLMock.mockResolvedValueOnce({
      patchStudentConductGradeCorrections: payload,
    });

    await expect(
      patchStudentConductGradeCorrections({
        classId: ' class-1 ',
        semesterId: 7,
        students: [
          {
            confirmedGrade: ' 优 ',
            score: ' 90 ',
            studentId: ' stu-1 ',
          },
          {
            clearFieldKeys: ['confirmedGrade'],
            studentId: ' stu-2 ',
          },
        ],
      }),
    ).resolves.toBe(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('patchStudentConductGradeCorrections');
    expect(query).toContain('writtenFieldCount');
    expect(query).toContain('clearedUpstreamFieldKeys');
    expect(query).toContain('skippedUpstreamFieldKeys');
    expect(query).not.toContain('estimatedGrade');
    expect(query).not.toContain('upstreamSessionToken');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentConductGradeGovernancePatchCorrections'),
      {
        input: {
          classId: 'class-1',
          semesterId: 7,
          students: [
            {
              confirmedGrade: '优',
              score: '90',
              studentId: 'stu-1',
            },
            {
              clearFieldKeys: ['confirmedGrade'],
              studentId: 'stu-2',
            },
          ],
        },
      },
    );
  });

  it('imports conduct grade materials through one-shot multipart rest', async () => {
    const docxFile = new File(['docx'], 'conduct.docx');
    const xlsFile = new File(['xls'], 'conduct.xls');
    const payload = {
      affectedStudents: 0,
      blockingErrors: [],
      classCode: '2501',
      className: '测试班',
      clearedUpstreamFieldCount: 0,
      createdSectionCount: 0,
      emptyFieldCount: 0,
      schoolYear: '2025',
      sectionKey: 'CONDUCT_GRADE',
      semester: '1',
      previewRows: [
        {
          confirmedGrade: '优',
          score: '106',
          schoolYear: '2025',
          semester: '1',
          studentId: '323010201',
          studentName: '学生甲',
        },
      ],
      status: 'WARNING_CONFIRMATION_REQUIRED',
      totalFiles: 1,
      totalParsedRows: 1,
      totalResolvedRows: 0,
      totalSkippedTables: 0,
      unchangedFieldCount: 0,
      unchangedStudentCount: 0,
      warnings: [
        {
          code: 'DOCUMENT_TERM_MISMATCH',
          confirmed: false,
          schoolYear: '2024',
          semester: '2',
          sourceFileDigest: 'digest-1',
          sourceFileIndex: 0,
          sourceFilename: 'conduct.docx',
          sourceSheetOrTable: '表1',
          warningKey: 'warning-key-1',
        },
      ],
      writtenFieldCount: 0,
      writtenStudentCount: 0,
    };

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: payload }), {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 200,
      }),
    );

    await expect(
      importStudentConductGradeMaterials({
        classCode: ' 2501 ',
        confirmedWarningKeys: [' warning-key-1 '],
        files: [docxFile, xlsFile],
        schoolYear: ' 2025 ',
        semester: ' 1 ',
      }),
    ).resolves.toMatchObject({
      ...payload,
      summary: {
        totalFiles: 1,
        totalParsedRows: 1,
        totalResolvedRows: 0,
      },
      previewRows: [
        {
          confirmedGrade: '优',
          score: '106',
          schoolYear: '2025',
          semester: '1',
          studentId: '323010201',
          studentName: '学生甲',
        },
      ],
      warnings: [
        expect.objectContaining({
          code: 'DOCUMENT_TERM_MISMATCH',
          message: null,
          sourceFileIndex: 0,
          sourceRow: null,
          warningKey: 'warning-key-1',
        }),
      ],
    });

    expect(resolveStudentConductGradeMaterialImportUrl()).toBe(
      'http://127.0.0.1:3000/student-private-profile/conduct-grade-material-imports',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/student-private-profile/conduct-grade-material-imports',
      expect.objectContaining({
        body: expect.any(FormData),
        method: 'POST',
      }),
    );

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const formData = request.body as FormData;

    expect(formData.get('classCode')).toBe('2501');
    expect(formData.get('schoolYear')).toBe('2025');
    expect(formData.get('semester')).toBe('1');
    expect(formData.get('confirmedWarningKeys')).toBe('["warning-key-1"]');
    expect(formData.getAll('files')).toEqual([docxFile, xlsFile]);
  });

  it('maps legacy Office conversion failure to actionable material import message', async () => {
    const docFile = new File(['doc'], 'conduct.doc');

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'STUDENT_PRIVATE_PROFILE_SUPPLEMENT_FILE_INVALID',
            message: '转换失败',
          },
          requestId: 'req-1',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 400,
        },
      ),
    );

    await expect(
      importStudentConductGradeMaterials({
        classCode: '2501',
        files: [docFile],
        schoolYear: '2025',
        semester: '1',
      }),
    ).rejects.toThrow('旧版 Office 文件无法自动转换，请手工另存为 .docx / .xlsx 后重试。');
  });

  it('refreshes local session before retrying material import after unauthorized response', async () => {
    const refreshSessionMock = vi.fn();
    const docxFile = new File(['docx'], 'conduct.docx');

    getGraphQLRuntimeConfigMock.mockReturnValue({
      getAccessToken: () => 'token-1',
      refreshSession: refreshSessionMock,
    });
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'TOKEN_EXPIRED' }), {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              blockingErrors: [],
              status: 'READY_TO_SAVE',
              summary: {
                writtenFieldCount: 1,
              },
              warnings: [],
            },
          }),
          {
            headers: {
              'Content-Type': 'application/json',
            },
            status: 200,
          },
        ),
      );

    await expect(
      importStudentConductGradeMaterials({
        classCode: '2501',
        files: [docxFile],
        schoolYear: '2025',
        semester: '1',
      }),
    ).resolves.toMatchObject({
      status: 'READY_TO_SAVE',
      summary: {
        writtenFieldCount: 1,
      },
    });

    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer token-1',
        },
      }),
    );
  });

  it('handles material import unauthorized response by http status without error code branching', async () => {
    const onAuthFailureMock = vi.fn();
    const docxFile = new File(['docx'], 'conduct.docx');

    getGraphQLRuntimeConfigMock.mockReturnValue({
      getAccessToken: () => 'token-1',
      onAuthFailure: onAuthFailureMock,
    });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'ANY_DETAIL_CODE',
            message: '登录状态已失效',
          },
          requestId: 'req-1',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 401,
        },
      ),
    );

    await expect(
      importStudentConductGradeMaterials({
        classCode: '2501',
        files: [docxFile],
        schoolYear: '2025',
        semester: '1',
      }),
    ).rejects.toThrow('登录状态已失效');

    expect(onAuthFailureMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads conduct correction row issues from graphql details', () => {
    const error = {
      graphqlErrors: [
        {
          extensions: {
            details: {
              rowIssues: [
                {
                  code: 'CONFIRMED_GRADE_INVALID',
                  message: '确认等级无效',
                  rowIndex: 0,
                  studentId: 'stu-1',
                },
                {
                  code: 'FIELD_SET_CLEAR_CONFLICT',
                  rowIndex: 1,
                },
                {
                  code: '',
                  rowIndex: 2,
                },
              ],
            },
          },
          message: 'STUDENT_PRIVATE_PROFILE_SUPPLEMENT_DRY_RUN_INVALID',
        },
      ],
      userMessage: '请求处理失败，请稍后重试。',
    };

    isGraphQLIngressErrorMock.mockReturnValueOnce(true);

    expect(readStudentConductGradePatchRowIssues(error)).toEqual([
      {
        code: 'CONFIRMED_GRADE_INVALID',
        message: '确认等级无效',
        rowIndex: 0,
        studentId: 'stu-1',
      },
      {
        code: 'FIELD_SET_CLEAR_CONFLICT',
        message: null,
        rowIndex: 1,
        studentId: null,
      },
    ]);
  });

  it('refreshes conduct grade snapshots through upstream session graphql', async () => {
    const payload = {
      confirmedRegistrationCount: 1,
      createdCount: 40,
      expiresAt: '2026-06-26T10:00:00.000Z',
      failureCount: 0,
      failures: [],
      processedRegistrationCount: 1,
      requestedRegistrationCount: 1,
      skippedRegistrationCount: 0,
      success: true,
      termResults: [
        {
          failureCount: 0,
          schoolYear: '2025',
          semester: '2',
          status: 'SYNCED',
          writtenStudentCount: 42,
        },
      ],
      traceId: 'trace-1',
      unchangedCount: 0,
      upstreamSessionToken: 'token-2',
      upstreamTotal: 1,
      updatedCount: 2,
      writtenStudentCount: 42,
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      refreshStudentConductGradeClassFromUpstream: payload,
    });

    await expect(
      refreshStudentConductGradeClassFromUpstream({
        classId: ' class-1 ',
        scope: 'SELECTED_TERM',
        semesterId: 7,
        upstreamSessionToken: ' token-1 ',
      }),
    ).resolves.toBe(payload);

    const query = executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('refreshStudentConductGradeClassFromUpstream');
    expect(query).toContain('requestedRegistrationCount');
    expect(query).toContain('writtenStudentCount');
    expect(query).toContain('termResults');
    expect(query).toContain('failures');
    expect(query).toContain('reasonMessage');
    expect(query).toContain('upstreamSessionToken');
    expect(query).not.toContain('requestedCount');
    expect(query).not.toContain('successCount');
    expect(executeUpstreamSessionGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentConductGradeGovernanceRefreshClass'),
      {
        input: {
          classId: 'class-1',
          scope: 'SELECTED_TERM',
          semesterId: 7,
          upstreamSessionToken: 'token-1',
        },
      },
    );
  });
});
