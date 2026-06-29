// src/labs/student-private-profile/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  executeGraphQLMock,
  executeUpstreamSessionGraphQLMock,
  getAccessTokenMock,
  getGraphQLEndpointMock,
  onAuthFailureMock,
  readUpstreamGraphQLErrorDetailMock,
  refreshSessionMock,
} = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  executeUpstreamSessionGraphQLMock: vi.fn(),
  getAccessTokenMock: vi.fn(),
  getGraphQLEndpointMock: vi.fn(),
  onAuthFailureMock: vi.fn(),
  readUpstreamGraphQLErrorDetailMock: vi.fn(),
  refreshSessionMock: vi.fn(),
}));

vi.mock('@/entities/upstream-session', () => ({
  executeUpstreamSessionGraphQL: executeUpstreamSessionGraphQLMock,
  isExpiredUpstreamSessionError: vi.fn(() => false),
  readUpstreamGraphQLErrorDetail: readUpstreamGraphQLErrorDetailMock,
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  getGraphQLEndpoint: getGraphQLEndpointMock,
  getGraphQLRuntimeConfig: () => ({
    getAccessToken: getAccessTokenMock,
    onAuthFailure: onAuthFailureMock,
    refreshSession: refreshSessionMock,
  }),
}));

import {
  buildStudentPrivateProfileSupplementTemplateWorkbookColumns,
  buildStudentPrivateProfileSupplementTemplateWorkbookRows,
  compareStudentPrivateProfileFields,
  downloadStudentRegistrationCardDocument,
  dryRunStudentPrivateProfileSupplement,
  generateStudentRegistrationCardDocument,
  getStudentPrivateProfileClassOverview,
  getStudentPrivateProfileGovernanceReadinessPreflight,
  getStudentPrivateProfilePreview,
  getStudentPrivateProfileSummary,
  getStudentPrivateProfileSupplementTemplate,
  getStudentRegistrationCardGenerationPreflight,
  isStudentPrivateProfileUpstreamSessionRequiredError,
  listStudentPrivateProfileClassOptions,
  listStudentPrivateProfileClassStudentOptions,
  normalizeBatchRefreshInput,
  normalizeBatchRefreshStudentIds,
  normalizeCompareStudentPrivateProfileFieldsInput,
  normalizeListClassStudentOptionsInput,
  normalizePatchStudentPrivateProfileFamilyMembersInput,
  normalizePatchStudentPrivateProfileFieldsInput,
  normalizeReadStudentPrivateProfilePhotoInput,
  normalizeStudentPrivateProfileClassOverviewInput,
  normalizeStudentPrivateProfileGovernanceReadinessPreflightInput,
  normalizeStudentPrivateProfilePreviewInput,
  normalizeStudentPrivateProfileSupplementDryRunInput,
  normalizeStudentPrivateProfileSupplementFile,
  normalizeStudentPrivateProfileSupplementTemplateInput,
  normalizeStudentRegistrationCardGenerationInput,
  normalizeWriteStudentPrivateProfileEducationToUpstreamInput,
  normalizeWriteStudentPrivateProfileFamilyToUpstreamInput,
  patchStudentPrivateProfileFamilyMembers,
  patchStudentPrivateProfileFields,
  readStudentPrivateProfilePhoto,
  refreshStudentPrivateProfileFromUpstream,
  refreshStudentPrivateProfilesFromUpstream,
  resolveStudentPrivateProfileSupplementUploadUrl,
  resolveStudentRegistrationCardDocumentDownloadUrl,
  uploadStudentPrivateProfileSupplementFile,
  writeStudentPrivateProfileEducationToUpstream,
  writeStudentPrivateProfileFamilyToUpstream,
} from './api';

describe('student-private-profile lab api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    executeUpstreamSessionGraphQLMock.mockReset();
    getAccessTokenMock.mockReset();
    getGraphQLEndpointMock.mockReset();
    onAuthFailureMock.mockReset();
    readUpstreamGraphQLErrorDetailMock.mockReset();
    refreshSessionMock.mockReset();
    vi.unstubAllGlobals();

    getAccessTokenMock.mockReturnValue('access-token-001');
    getGraphQLEndpointMock.mockReturnValue('http://127.0.0.1:3000/graphql');
  });

  it('loads summary with the documented query shape', async () => {
    const summary = {
      educationResumes: [],
      familyMembers: [],
      fields: [],
      lastManualUpdatedAt: null,
      lastSyncedAt: '2026-06-23T10:00:00.000Z',
      photo: {
        byteSize: 0,
        present: false,
        sourceObservedAt: '2026-06-23T10:00:00.000Z',
      },
      profileCompletenessFlags: {
        educationObserved: false,
        familyObserved: false,
        personalObserved: true,
        photoObserved: false,
        recordObserved: false,
        sensitiveIdentifiersObserved: true,
      },
      recordChanges: [],
      sectionStatuses: [],
      sourceObservedAt: '2026-06-23T10:00:00.000Z',
      studentId: 'S001',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      studentPrivateProfileSummary: summary,
    });

    await expect(getStudentPrivateProfileSummary({ studentId: ' S001 ' })).resolves.toEqual(
      summary,
    );

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentPrivateProfileLabSummary'),
      {
        input: {
          studentId: 'S001',
        },
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('upstreamBaselineToken');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('manualOverrideActive');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('familyMembers');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('educationResumes');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('recordChanges');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('sectionBaselineToken');
  });

  it('refreshes through upstream-session GraphQL and sends local student id', async () => {
    const refreshResult = {
      changedSections: ['personal'],
      expiresAt: '2026-06-23T11:00:00.000Z',
      lastSyncedAt: '2026-06-23T10:00:00.000Z',
      photoByteSize: 0,
      photoPresent: false,
      snapshotUpdated: true,
      sourceObservedAt: '2026-06-23T10:00:00.000Z',
      studentId: 'S001',
      success: true,
      traceId: 'trace-001',
      upstreamSessionToken: 'rolling-token-002',
      warnings: [],
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      refreshStudentPrivateProfileFromUpstream: refreshResult,
    });

    await expect(
      refreshStudentPrivateProfileFromUpstream({
        studentId: ' S001 ',
        upstreamSessionToken: ' rolling-token-001 ',
      }),
    ).resolves.toEqual(refreshResult);

    expect(executeUpstreamSessionGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentPrivateProfileLabRefresh'),
      {
        input: {
          studentId: 'S001',
          upstreamSessionToken: 'rolling-token-001',
        },
      },
    );
  });

  it('normalizes batch refresh student ids with trim, empty filtering, dedupe, and limits', () => {
    expect(normalizeBatchRefreshStudentIds([' S001 ', '', 'S002', 'S001', '  ', 'S003'])).toEqual([
      'S001',
      'S002',
      'S003',
    ]);
    expect(
      normalizeBatchRefreshInput({
        studentIds: [' S001 '],
        upstreamSessionToken: ' rolling-token-001 ',
      }),
    ).toEqual({
      studentIds: ['S001'],
      upstreamSessionToken: 'rolling-token-001',
    });

    expect(() => normalizeBatchRefreshStudentIds([])).toThrow('请选择或输入至少 1 个本地学生 ID。');

    expect(() =>
      normalizeBatchRefreshStudentIds(Array.from({ length: 21 }, (_, index) => `S${index}`)),
    ).toThrow('一次最多刷新 20 个学生。');

    expect(() => normalizeBatchRefreshStudentIds(['S'.repeat(33)])).toThrow(
      '本地学生 ID 不能超过 32 个字符。',
    );
  });

  it('batch refreshes through upstream-session GraphQL and requests ordered result fields', async () => {
    const batchResult = {
      expiresAt: null,
      failureCount: 1,
      requestedCount: 2,
      results: [
        {
          changedSections: ['personal', 'family'],
          errorCode: null,
          errorMessage: null,
          snapshotUpdated: true,
          status: 'SUCCESS',
          studentId: 'S001',
          warningCodes: [],
        },
        {
          changedSections: [],
          errorCode: 'STUDENT_PRIVATE_PROFILE_UPSTREAM_ID_MISSING',
          errorMessage: '目标学生缺少 upstream id',
          snapshotUpdated: null,
          status: 'FAILED',
          studentId: 'S002',
          warningCodes: [],
        },
      ],
      success: false,
      successCount: 1,
      traceId: 'trace-batch-001',
      upstreamSessionToken: 'rolling-token-002',
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      refreshStudentPrivateProfilesFromUpstream: batchResult,
    });

    await expect(
      refreshStudentPrivateProfilesFromUpstream({
        studentIds: [' S001 ', 'S002', 'S001'],
        upstreamSessionToken: ' rolling-token-001 ',
      }),
    ).resolves.toEqual(batchResult);

    expect(executeUpstreamSessionGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentPrivateProfileLabBatchRefresh'),
      {
        input: {
          studentIds: ['S001', 'S002'],
          upstreamSessionToken: 'rolling-token-001',
        },
      },
    );
    expect(executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0]).toContain(
      'refreshStudentPrivateProfilesFromUpstream',
    );
    expect(executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0]).toContain('results');
    expect(executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0]).toContain('errorCode');
    expect(readUpstreamGraphQLErrorDetailMock).not.toHaveBeenCalled();
  });

  it('loads local active-membership class options through the profile contract', async () => {
    const payload = [
      {
        authorizationPath: 'ORG0301/1032301',
        classCode: '1032301',
        className: '23 计算机 1 班',
        departmentId: 'ORG0301',
        gradeYear: 2023,
        id: 'class-1032301',
        resolvedAuthorityCode: 'ORG0301',
        studentCount: 42,
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      studentPrivateProfileClassOptions: payload,
    });

    await expect(listStudentPrivateProfileClassOptions()).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentPrivateProfileLabClassOptions'),
      { input: {} },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('studentPrivateProfileClassOptions');
  });

  it('loads active-membership student options by local class id without upstream access', async () => {
    expect(
      normalizeListClassStudentOptionsInput({
        classId: ' class-1032301 ',
      }),
    ).toEqual({
      classId: 'class-1032301',
    });

    executeGraphQLMock.mockResolvedValueOnce({
      studentPrivateProfileClassStudentOptions: [
        {
          activeMembershipClassCode: '1032301',
          activeMembershipClassName: '23 计算机 1 班',
          currentClassCode: '1032301',
          currentClassId: 'class-1032301',
          lastObservedAt: '2026-06-23T10:00:00.000Z',
          studentId: '20230002',
          studentName: '李四',
          studentStatus: 'ACTIVE',
          upstreamIdPresent: false,
        },
        {
          activeMembershipClassCode: '1032301',
          activeMembershipClassName: '23 计算机 1 班',
          currentClassCode: '1032301',
          currentClassId: 'class-1032301',
          lastObservedAt: '2026-06-23T10:00:00.000Z',
          studentId: '20230001',
          studentName: '张三',
          studentStatus: 'ACTIVE',
          upstreamIdPresent: true,
        },
      ],
    });

    await expect(
      listStudentPrivateProfileClassStudentOptions({ classId: ' class-1032301 ' }),
    ).resolves.toEqual([
      {
        activeMembershipClassCode: '1032301',
        activeMembershipClassName: '23 计算机 1 班',
        currentClassCode: '1032301',
        currentClassId: 'class-1032301',
        lastObservedAt: '2026-06-23T10:00:00.000Z',
        studentId: '20230001',
        studentName: '张三',
        studentStatus: 'ACTIVE',
        upstreamIdPresent: true,
      },
      {
        activeMembershipClassCode: '1032301',
        activeMembershipClassName: '23 计算机 1 班',
        currentClassCode: '1032301',
        currentClassId: 'class-1032301',
        lastObservedAt: '2026-06-23T10:00:00.000Z',
        studentId: '20230002',
        studentName: '李四',
        studentStatus: 'ACTIVE',
        upstreamIdPresent: false,
      },
    ]);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentPrivateProfileLabClassStudentOptions'),
      {
        input: {
          classId: 'class-1032301',
        },
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('sessionToken');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('fetchClassStudentCourseResults');
  });

  it('loads class overview without upstream access and requests thin status fields', async () => {
    expect(
      normalizeStudentPrivateProfileClassOverviewInput({
        classId: ' class-1032301 ',
      }),
    ).toEqual({
      classId: 'class-1032301',
    });

    const overview = {
      classCode: '1032301',
      classId: 'class-1032301',
      className: '23 计算机 1 班',
      studentCount: 1,
      students: [
        {
          activeMembershipClassCode: '1032301',
          activeMembershipClassName: '23 计算机 1 班',
          attentionLevel: 'MANUAL_OVERRIDE',
          currentClassCode: '1032301',
          currentClassId: 'class-1032301',
          lastManualUpdatedAt: '2026-06-23T10:00:00.000Z',
          lastSyncedAt: '2026-06-23T09:00:00.000Z',
          manualOverrideActive: true,
          membershipLastObservedAt: '2026-06-23T08:00:00.000Z',
          photo: {
            byteSize: 1024,
            present: true,
            sourceObservedAt: '2026-06-23T09:00:00.000Z',
          },
          profileCompletenessFlags: {
            educationObserved: true,
            familyObserved: true,
            personalObserved: true,
            photoObserved: true,
            recordObserved: true,
            sensitiveIdentifiersObserved: true,
          },
          sectionStatuses: [
            {
              lastManualUpdatedAt: '2026-06-23T10:00:00.000Z',
              manualOverrideActive: true,
              observedAt: '2026-06-23T09:00:00.000Z',
              section: 'FAMILY',
              snapshotPresent: true,
              sourceEndpoint: 'pagegrid',
              sourceStatus: 'OBSERVED',
              sourceTotal: 2,
              upstreamChangedSinceManualPatch: false,
              warningCodes: [],
            },
          ],
          snapshotPresent: true,
          sourceObservedAt: '2026-06-23T09:00:00.000Z',
          studentId: '20230001',
          studentName: '张三',
          studentStatus: 'ACTIVE',
          upstreamChangedSinceManualPatch: false,
          upstreamIdPresent: true,
          warningCodes: [],
        },
      ],
    };

    executeGraphQLMock.mockResolvedValueOnce({
      studentPrivateProfileClassOverview: overview,
    });

    await expect(
      getStudentPrivateProfileClassOverview({ classId: ' class-1032301 ' }),
    ).resolves.toEqual(overview);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentPrivateProfileLabClassOverview'),
      {
        input: {
          classId: 'class-1032301',
        },
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('attentionLevel');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('profileCompletenessFlags');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('sectionStatuses');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('photoBase64');
    expect(executeUpstreamSessionGraphQLMock).not.toHaveBeenCalled();
  });

  it('loads governance readiness preflight without upstream access or field values', async () => {
    expect(
      normalizeStudentPrivateProfileGovernanceReadinessPreflightInput({
        classId: ' class-1032301 ',
      }),
    ).toEqual({
      classId: 'class-1032301',
    });

    const readiness = {
      blockedCount: 1,
      classCode: '1032301',
      classId: 'class-1032301',
      className: '23 计算机 1 班',
      readyCount: 0,
      studentCount: 1,
      students: [
        {
          courseResultSnapshotPresent: false,
          issueCodes: ['PRIVATE_PROFILE_SNAPSHOT_MISSING', 'COURSE_RESULT_SNAPSHOT_MISSING'],
          manualOverrideActive: false,
          missingSections: ['courseResult'],
          privateProfileSnapshotPresent: false,
          status: 'BLOCKED',
          studentId: '20230001',
          studentName: '张三',
          studentStatus: 'ACTIVE',
          upstreamChangedSinceManualPatch: false,
          upstreamIdPresent: true,
          warningCodes: [],
        },
      ],
      warningCount: 0,
    };

    executeGraphQLMock.mockResolvedValueOnce({
      studentPrivateProfileGovernanceReadinessPreflight: readiness,
    });

    await expect(
      getStudentPrivateProfileGovernanceReadinessPreflight({
        classId: ' class-1032301 ',
      }),
    ).resolves.toEqual(readiness);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentPrivateProfileLabGovernanceReadinessPreflight'),
      {
        input: {
          classId: 'class-1032301',
        },
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain(
      'studentPrivateProfileGovernanceReadinessPreflight',
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('issueCodes');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('missingSections');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('courseResultSnapshotPresent');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('maskedValue');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('photoBase64');
    expect(executeUpstreamSessionGraphQLMock).not.toHaveBeenCalled();
  });

  it('loads partial preview with fixed template without upstream access or photo body', async () => {
    expect(
      normalizeStudentPrivateProfilePreviewInput({
        studentId: ' S001 ',
        templateCode: 'STUDENT_PRIVATE_PROFILE_PARTIAL_PREVIEW',
      }),
    ).toEqual({
      studentId: 'S001',
      templateCode: 'STUDENT_PRIVATE_PROFILE_PARTIAL_PREVIEW',
    });

    const preview = {
      educationResumes: [
        {
          fields: [
            {
              confidence: 'HIGH',
              fieldKey: 'education.organization',
              label: '学校',
              manualOverrideActive: false,
              section: 'EDUCATION',
              source: 'UPSTREAM',
              sourceObservedAt: '2026-06-23T09:00:00.000Z',
              upstreamChangedSinceManualPatch: false,
              value: '第一中学',
              valueStatus: 'PRESENT',
            },
          ],
          itemKey: 'education-001',
          sourceObservedAt: '2026-06-23T09:00:00.000Z',
          sourceUpdatedAt: null,
        },
      ],
      familyMembers: [
        {
          fields: [
            {
              confidence: 'HIGH',
              fieldKey: 'family.name',
              label: '姓名',
              manualOverrideActive: true,
              section: 'FAMILY',
              source: 'MANUAL',
              sourceObservedAt: '2026-06-23T09:00:00.000Z',
              upstreamChangedSinceManualPatch: false,
              value: '张某',
              valueStatus: 'PRESENT',
            },
          ],
          itemKey: 'family-001',
          manualOverrideActive: true,
          manualPatchFieldKeys: ['NAME'],
          sourceObservedAt: '2026-06-23T09:00:00.000Z',
          sourceUpdatedAt: null,
          upstreamChangedSinceManualPatch: false,
        },
      ],
      fields: [
        {
          confidence: 'HIGH',
          fieldKey: 'idCard',
          label: '身份证号',
          manualOverrideActive: false,
          section: 'SENSITIVE_IDENTIFIERS',
          source: 'UPSTREAM',
          sourceObservedAt: '2026-06-23T09:00:00.000Z',
          upstreamChangedSinceManualPatch: false,
          value: '110101200001010010',
          valueStatus: 'PRESENT',
        },
      ],
      lastManualUpdatedAt: null,
      lastSyncedAt: '2026-06-23T10:00:00.000Z',
      photo: {
        byteSize: 1024,
        present: true,
        sourceObservedAt: '2026-06-23T09:00:00.000Z',
      },
      recordChanges: [
        {
          fields: [
            {
              confidence: 'HIGH',
              fieldKey: 'record.className',
              label: '班级',
              manualOverrideActive: false,
              section: 'RECORD',
              source: 'UPSTREAM',
              sourceObservedAt: '2026-06-23T09:00:00.000Z',
              upstreamChangedSinceManualPatch: false,
              value: '23 计算机 1 班',
              valueStatus: 'PRESENT',
            },
          ],
          itemKey: 'record-001',
          sourceObservedAt: '2026-06-23T09:00:00.000Z',
        },
      ],
      sourceObservedAt: '2026-06-23T09:00:00.000Z',
      studentId: 'S001',
      templateCode: 'STUDENT_PRIVATE_PROFILE_PARTIAL_PREVIEW',
      templateVersion: 1,
    };

    executeGraphQLMock.mockResolvedValueOnce({
      studentPrivateProfilePreview: preview,
    });

    await expect(getStudentPrivateProfilePreview({ studentId: ' S001 ' })).resolves.toEqual(
      preview,
    );

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentPrivateProfileLabPreview'),
      {
        input: {
          studentId: 'S001',
          templateCode: 'STUDENT_PRIVATE_PROFILE_PARTIAL_PREVIEW',
        },
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('studentPrivateProfilePreview');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('value');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('familyMembers');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('educationResumes');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('recordChanges');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('photo');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('photoBase64');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('upstreamSessionToken');
    expect(executeUpstreamSessionGraphQLMock).not.toHaveBeenCalled();
  });

  it('checks and generates one student registration card document with fixed template', async () => {
    expect(
      normalizeStudentRegistrationCardGenerationInput({
        studentId: ' S001 ',
      }),
    ).toEqual({
      studentId: 'S001',
      templateCode: 'STUDENT_REGISTRATION_CARD_FULL_EXPORT',
    });

    expect(() =>
      normalizeStudentRegistrationCardGenerationInput({
        studentId: 'S001',
        templateCode: 'OTHER_TEMPLATE',
      }),
    ).toThrow('学籍卡模板当前只支持 STUDENT_REGISTRATION_CARD_FULL_EXPORT。');

    const preflight = {
      issueCodes: [],
      missingSections: ['family'],
      status: 'WARNING',
      studentId: 'S001',
      templateCode: 'STUDENT_REGISTRATION_CARD_FULL_EXPORT',
      templateVersion: 1,
      warningCodes: ['FAMILY_MISSING'],
    };

    executeGraphQLMock.mockResolvedValueOnce({
      studentRegistrationCardGenerationPreflight: preflight,
    });

    await expect(
      getStudentRegistrationCardGenerationPreflight({ studentId: ' S001 ' }),
    ).resolves.toEqual(preflight);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentPrivateProfileLabRegistrationCardPreflight'),
      {
        input: {
          studentId: 'S001',
          templateCode: 'STUDENT_REGISTRATION_CARD_FULL_EXPORT',
        },
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain(
      'studentRegistrationCardGenerationPreflight',
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('issueCodes');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('photoBase64');

    const generation = {
      ...preflight,
      byteSize: 32768,
      downloadToken: 'sprcd1_001',
      downloadUrl: '/student-private-profile/registration-card-documents/sprcd1_001',
      expiresAt: '2026-06-25T11:00:00.000Z',
      fileName: '张三-学籍卡.docx',
      sha256: 'sha256-001',
      status: 'WARNING',
      traceId: 'trace-registration-card-001',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      generateStudentRegistrationCardDocument: generation,
    });

    await expect(generateStudentRegistrationCardDocument({ studentId: ' S001 ' })).resolves.toEqual(
      generation,
    );

    expect(executeGraphQLMock).toHaveBeenLastCalledWith(
      expect.stringContaining('StudentPrivateProfileLabGenerateRegistrationCardDocument'),
      {
        input: {
          studentId: 'S001',
          templateCode: 'STUDENT_REGISTRATION_CARD_FULL_EXPORT',
        },
      },
    );
    expect(executeGraphQLMock.mock.calls[1]?.[0]).toContain(
      'generateStudentRegistrationCardDocument',
    );
    expect(executeGraphQLMock.mock.calls[1]?.[0]).toContain('downloadToken');
    expect(executeUpstreamSessionGraphQLMock).not.toHaveBeenCalled();
  });

  it('downloads registration card docx through REST with auth header', async () => {
    expect(
      resolveStudentRegistrationCardDocumentDownloadUrl({
        downloadToken: ' sprcd1_001 ',
      }),
    ).toBe('http://127.0.0.1:3000/student-private-profile/registration-card-documents/sprcd1_001');
    expect(
      resolveStudentRegistrationCardDocumentDownloadUrl({
        downloadUrl: '/student-private-profile/registration-card-documents/sprcd1_002',
      }),
    ).toBe('http://127.0.0.1:3000/student-private-profile/registration-card-documents/sprcd1_002');

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:registration-card'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });

    const anchor = {
      click: vi.fn(),
      download: '',
      href: '',
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(new Blob(['docx']), {
        status: 200,
      }),
    );

    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      downloadStudentRegistrationCardDocument({
        downloadToken: 'sprcd1_001',
        fileName: '张三-学籍卡.docx',
      }),
    ).resolves.toEqual({
      byteSize: 4,
      fileName: '张三-学籍卡.docx',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/student-private-profile/registration-card-documents/sprcd1_001',
      {
        headers: {
          Authorization: 'Bearer access-token-001',
        },
        method: 'GET',
      },
    );
    expect(anchor.download).toBe('张三-学籍卡.docx');
    expect(anchor.click).toHaveBeenCalled();
  });

  it('loads supplement template schema and keeps column keys in order', async () => {
    expect(
      normalizeStudentPrivateProfileSupplementTemplateInput({
        mode: 'FLEXIBLE',
        templateCode: ' STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT ',
      }),
    ).toEqual({
      mode: 'FLEXIBLE',
      templateCode: 'STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT',
    });

    const template = {
      actions: ['CREATE', 'DELETE'],
      columns: [
        {
          aliases: ['学生编号'],
          alwaysRequired: true,
          auditPolicy: 'NEVER_LOG_VALUE',
          destination: 'UPSTREAM_WRITE_THROUGH',
          enumValues: [],
          fieldKey: null,
          key: 'studentId',
          label: '学号',
          requiredForActions: [],
          sensitive: false,
          valueType: 'STRING',
        },
        {
          aliases: [],
          alwaysRequired: true,
          auditPolicy: 'NEVER_LOG_VALUE',
          destination: null,
          enumValues: [],
          fieldKey: null,
          key: 'studentName',
          label: '学生姓名',
          requiredForActions: [],
          sensitive: true,
          valueType: 'STRING',
        },
        {
          aliases: [],
          alwaysRequired: true,
          auditPolicy: 'NEVER_LOG_VALUE',
          destination: 'UPSTREAM_WRITE_THROUGH',
          enumValues: [],
          fieldKey: null,
          key: 'expectedSectionBaselineToken',
          label: 'section baseline token',
          requiredForActions: [],
          sensitive: false,
          valueType: 'STRING',
        },
      ],
      mode: 'FLEXIBLE',
      sectionKey: 'FAMILY',
      templateCode: 'STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT',
      templateVersion: 1,
    };

    executeGraphQLMock.mockResolvedValueOnce({
      studentPrivateProfileSupplementTemplate: template,
    });

    await expect(
      getStudentPrivateProfileSupplementTemplate({
        mode: 'FLEXIBLE',
        templateCode: ' STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT ',
      }),
    ).resolves.toEqual(template);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentPrivateProfileLabSupplementTemplate'),
      {
        input: {
          mode: 'FLEXIBLE',
          templateCode: 'STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT',
        },
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('columns');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('mode');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('aliases');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('destination');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('auditPolicy');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('requiredForActions');
    expect(executeUpstreamSessionGraphQLMock).not.toHaveBeenCalled();
  });

  it('uploads supplement xlsx through REST body with auth header', async () => {
    const file = new Blob(['excel']) as File;

    Object.defineProperty(file, 'name', { value: 'family.xlsx' });

    expect(normalizeStudentPrivateProfileSupplementFile(file)).toBe(file);
    expect(resolveStudentPrivateProfileSupplementUploadUrl()).toBe(
      'http://127.0.0.1:3000/student-private-profile/supplement-files',
    );

    const uploadResult = {
      byteSize: 12345,
      expiresAt: '2026-06-25T10:00:00.000Z',
      fileToken: 'sppsf_001',
      originalFilename: 'family.xlsx',
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: uploadResult,
        }),
        {
          status: 200,
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadStudentPrivateProfileSupplementFile({ file })).resolves.toEqual(
      uploadResult,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/student-private-profile/supplement-files',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer access-token-001',
        },
        method: 'POST',
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeInstanceOf(FormData);
  });

  it('runs supplement dry-run with uploaded file token', async () => {
    expect(
      normalizeStudentPrivateProfileSupplementDryRunInput({
        fileToken: ' sppsf_001 ',
        mode: 'FLEXIBLE',
        templateCode: ' STUDENT_PRIVATE_PROFILE_EDUCATION_SUPPLEMENT ',
        templateVersion: 1,
      }),
    ).toEqual({
      fileToken: 'sppsf_001',
      mode: 'FLEXIBLE',
      templateCode: 'STUDENT_PRIVATE_PROFILE_EDUCATION_SUPPLEMENT',
      templateVersion: 1,
    });

    expect(() =>
      normalizeStudentPrivateProfileSupplementDryRunInput({
        fileToken: 'sppsf_001',
        templateCode: 'STUDENT_PRIVATE_PROFILE_EDUCATION_SUPPLEMENT',
        templateVersion: 0,
      }),
    ).toThrow('补录模板版本必须是大于 0 的整数。');

    const dryRun = {
      affectedStudents: 1,
      columnMappings: [
        {
          columnIndex: 1,
          columnKey: 'studentId',
          destination: 'UPSTREAM_WRITE_THROUGH',
          fieldKey: null,
          header: '学号',
          issueCode: null,
          sectionKey: 'EDUCATION_RESUME',
          status: 'MAPPED',
        },
      ],
      dryRun: true,
      fileIssues: [
        {
          code: 'UNKNOWN_COLUMN',
          columnIndex: 8,
          columnKey: null,
          header: '备注',
        },
      ],
      invalidRows: 1,
      mode: 'FLEXIBLE',
      rowResults: [
        {
          action: 'CREATE',
          errorCodes: ['DATE_INVALID'],
          issues: [
            {
              code: 'DATE_INVALID',
              columnKey: 'startDate',
            },
          ],
          rowNumber: 2,
          status: 'INVALID',
          studentId: 'S001',
          warningCodes: [],
        },
      ],
      sectionKey: 'EDUCATION_RESUME',
      status: 'BLOCKED',
      templateCode: 'STUDENT_PRIVATE_PROFILE_EDUCATION_SUPPLEMENT',
      templateVersion: 1,
      totalRows: 1,
      validRows: 0,
    };

    executeGraphQLMock.mockResolvedValueOnce({
      studentPrivateProfileSupplementDryRun: dryRun,
    });

    await expect(
      dryRunStudentPrivateProfileSupplement({
        fileToken: ' sppsf_001 ',
        mode: 'FLEXIBLE',
        templateCode: ' STUDENT_PRIVATE_PROFILE_EDUCATION_SUPPLEMENT ',
        templateVersion: 1,
      }),
    ).resolves.toEqual(dryRun);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentPrivateProfileLabSupplementDryRun'),
      {
        input: {
          fileToken: 'sppsf_001',
          mode: 'FLEXIBLE',
          templateCode: 'STUDENT_PRIVATE_PROFILE_EDUCATION_SUPPLEMENT',
          templateVersion: 1,
        },
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('fileIssues');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('columnMappings');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('rowResults');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('columnKey');
  });

  it('uses supplement schema labels for workbook headers and keys for row values', () => {
    const familyTemplate = {
      actions: ['CREATE', 'DELETE'],
      columns: [
        { key: 'studentId', label: '学号' },
        { key: 'studentName', label: '学生姓名' },
        { key: 'expectedSectionBaselineToken', label: '资料版本校验码' },
        { key: 'action', label: '写回动作' },
        { key: 'itemKey', label: '行标识' },
        { key: 'upstreamBaselineToken', label: '行版本校验码' },
        { key: 'relationshipCode', label: '家庭关系' },
        { key: 'name', label: '姓名' },
      ].map((column) => ({
        aliases: [],
        alwaysRequired: column.key === 'studentId' || column.key === 'studentName',
        auditPolicy: 'NEVER_LOG_VALUE',
        destination: 'UPSTREAM_WRITE_THROUGH',
        enumValues: [],
        fieldKey: null,
        key: column.key,
        label: column.label,
        requiredForActions: [],
        sensitive: false,
        valueType: 'STRING',
      })),
      mode: 'STRICT',
      sectionKey: 'FAMILY',
      templateCode: 'STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT',
      templateVersion: 1,
    } as const;
    const summary = {
      educationResumes: [],
      familyMembers: [
        {
          itemKey: 'family-row-001',
          manualOverrideActive: false,
          manualPatchFieldKeys: [],
          maskedName: '张*',
          maskedPhone: null,
          maskedWorkplace: null,
          relationshipCode: '1',
          sourceObservedAt: '2026-06-23T09:00:00.000Z',
          sourceUpdatedAt: null,
          upstreamBaselineToken: 'family-row-token-001',
          upstreamChangedSinceManualPatch: false,
        },
      ],
      fields: [],
      lastManualUpdatedAt: null,
      lastSyncedAt: '2026-06-23T10:00:00.000Z',
      photo: {
        byteSize: 0,
        present: false,
        sourceObservedAt: '2026-06-23T10:00:00.000Z',
      },
      profileCompletenessFlags: {
        educationObserved: false,
        familyObserved: true,
        personalObserved: true,
        photoObserved: false,
        recordObserved: false,
        sensitiveIdentifiersObserved: true,
      },
      recordChanges: [],
      sectionStatuses: [
        {
          observedAt: '2026-06-23T09:00:00.000Z',
          section: 'family',
          sectionBaselineToken: 'family-section-token-001',
          sourceEndpoint: 'pagegrid',
          sourceStatus: 'OBSERVED',
          warningCodes: [],
        },
      ],
      sourceObservedAt: '2026-06-23T09:00:00.000Z',
      studentId: 'S001',
    };

    expect(
      buildStudentPrivateProfileSupplementTemplateWorkbookColumns(familyTemplate.columns).map(
        (column) => ({
          header: column.header,
          key: column.key,
        }),
      ),
    ).toEqual([
      { header: '学号', key: 'studentId' },
      { header: '学生姓名', key: 'studentName' },
      { header: '资料版本校验码', key: 'expectedSectionBaselineToken' },
      { header: '写回动作', key: 'action' },
      { header: '行标识', key: 'itemKey' },
      { header: '行版本校验码', key: 'upstreamBaselineToken' },
      { header: '家庭关系', key: 'relationshipCode' },
      { header: '姓名', key: 'name' },
    ]);
    expect(
      familyTemplate.columns.filter((column) => column.alwaysRequired).map((column) => column.key),
    ).toEqual(['studentId', 'studentName']);
    expect(
      buildStudentPrivateProfileSupplementTemplateWorkbookColumns([
        {
          aliases: ['所在单位', '教育经历所在单位', '就读学校'],
          alwaysRequired: false,
          auditPolicy: 'NEVER_LOG_VALUE',
          destination: 'UPSTREAM_WRITE_THROUGH',
          enumValues: [],
          fieldKey: 'education.organization',
          key: 'organization',
          label: '学校',
          requiredForActions: ['CREATE'],
          sensitive: true,
          valueType: 'STRING',
        },
      ]),
    ).toEqual([
      {
        header: '学校',
        hidden: false,
        key: 'organization',
        width: 16,
      },
    ]);

    expect(
      buildStudentPrivateProfileSupplementTemplateWorkbookRows({
        summary,
        studentName: '张三',
        template: familyTemplate,
      }),
    ).toEqual([
      {
        action: 'CREATE',
        expectedSectionBaselineToken: 'family-section-token-001',
        itemKey: '',
        name: '',
        relationshipCode: '1',
        studentId: 'S001',
        studentName: '张三',
        upstreamBaselineToken: '',
      },
      {
        action: 'CREATE',
        expectedSectionBaselineToken: 'family-section-token-001',
        itemKey: '',
        name: '',
        relationshipCode: '2',
        studentId: 'S001',
        studentName: '张三',
        upstreamBaselineToken: '',
      },
    ]);
  });

  it('writes one family member to upstream with section baseline token', async () => {
    expect(
      normalizeWriteStudentPrivateProfileFamilyToUpstreamInput({
        expectedSectionBaselineToken: ' section-token-family ',
        members: [
          {
            action: 'CREATE',
            name: ' 张三 ',
            phone: ' 13800000000 ',
            relationshipCode: '1',
            workplace: ' 某单位 ',
          },
        ],
        studentId: ' S001 ',
        upstreamSessionToken: ' rolling-token-001 ',
      }),
    ).toEqual({
      expectedSectionBaselineToken: 'section-token-family',
      members: [
        {
          action: 'CREATE',
          name: '张三',
          phone: '13800000000',
          relationshipCode: '1',
          workplace: '某单位',
        },
      ],
      studentId: 'S001',
      upstreamSessionToken: 'rolling-token-001',
    });

    expect(
      normalizeWriteStudentPrivateProfileFamilyToUpstreamInput({
        expectedSectionBaselineToken: ' section-token-family ',
        members: [
          {
            action: 'DELETE',
            itemKey: ' row-family-001 ',
            upstreamBaselineToken: ' row-token-family-001 ',
          },
        ],
        studentId: ' S001 ',
        upstreamSessionToken: ' rolling-token-001 ',
      }),
    ).toEqual({
      expectedSectionBaselineToken: 'section-token-family',
      members: [
        {
          action: 'DELETE',
          itemKey: 'row-family-001',
          upstreamBaselineToken: 'row-token-family-001',
        },
      ],
      studentId: 'S001',
      upstreamSessionToken: 'rolling-token-001',
    });

    expect(() =>
      normalizeWriteStudentPrivateProfileFamilyToUpstreamInput({
        expectedSectionBaselineToken: 'section-token-family',
        members: [
          {
            action: 'CREATE',
            name: '张三',
            relationshipCode: '9',
          },
        ],
        studentId: 'S001',
        upstreamSessionToken: 'rolling-token-001',
      }),
    ).toThrow('家庭关系当前只支持 1 / 2 / 3 / 4。');

    const result = {
      action: 'CREATE',
      changedSections: ['FAMILY'],
      expiresAt: '2026-06-23T11:00:00.000Z',
      localSnapshotRefreshed: true,
      sectionKey: 'FAMILY',
      snapshotUpdated: true,
      sourceObservedAt: '2026-06-23T10:00:00.000Z',
      studentId: 'S001',
      success: true,
      summary: null,
      summaryRefreshFailed: true,
      traceId: 'trace-family-001',
      upstreamSaved: true,
      upstreamSessionToken: 'rolling-token-002',
      warningCodes: [],
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      writeStudentPrivateProfileFamilyToUpstream: result,
    });

    await expect(
      writeStudentPrivateProfileFamilyToUpstream({
        expectedSectionBaselineToken: ' section-token-family ',
        members: [
          {
            action: 'CREATE',
            name: ' 张三 ',
            relationshipCode: '1',
          },
        ],
        studentId: ' S001 ',
        upstreamSessionToken: ' rolling-token-001 ',
      }),
    ).resolves.toEqual(result);

    expect(executeUpstreamSessionGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentPrivateProfileLabWriteFamilyToUpstream'),
      {
        input: {
          expectedSectionBaselineToken: 'section-token-family',
          members: [
            {
              action: 'CREATE',
              name: '张三',
              relationshipCode: '1',
            },
          ],
          studentId: 'S001',
          upstreamSessionToken: 'rolling-token-001',
        },
      },
    );
    expect(executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0]).toContain(
      'writeStudentPrivateProfileFamilyToUpstream',
    );
    expect(executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0]).toContain('summaryRefreshFailed');
    expect(executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0]).toContain('sectionBaselineToken');
    expect(executeGraphQLMock).not.toHaveBeenCalled();
  });

  it('writes one education resume to upstream with date validation', async () => {
    expect(
      normalizeWriteStudentPrivateProfileEducationToUpstreamInput({
        expectedSectionBaselineToken: ' section-token-education ',
        resumes: [
          {
            action: 'CREATE',
            endDate: ' 2023-06-30 ',
            organization: ' 学校 ',
            reference: ' 证明人 ',
            startDate: ' 2020-09-01 ',
          },
        ],
        studentId: ' S001 ',
        upstreamSessionToken: ' rolling-token-001 ',
      }),
    ).toEqual({
      expectedSectionBaselineToken: 'section-token-education',
      resumes: [
        {
          action: 'CREATE',
          endDate: '2023-06-30',
          organization: '学校',
          reference: '证明人',
          startDate: '2020-09-01',
        },
      ],
      studentId: 'S001',
      upstreamSessionToken: 'rolling-token-001',
    });

    expect(() =>
      normalizeWriteStudentPrivateProfileEducationToUpstreamInput({
        expectedSectionBaselineToken: 'section-token-education',
        resumes: [
          {
            action: 'CREATE',
            endDate: '2023-06-30',
            organization: '学校',
            reference: '证明人',
            startDate: '2023-07-01',
          },
        ],
        studentId: 'S001',
        upstreamSessionToken: 'rolling-token-001',
      }),
    ).toThrow('开始日期不能晚于结束日期。');

    const result = {
      action: 'DELETE',
      changedSections: ['EDUCATION_RESUME'],
      expiresAt: '2026-06-23T11:00:00.000Z',
      localSnapshotRefreshed: true,
      sectionKey: 'EDUCATION_RESUME',
      snapshotUpdated: true,
      sourceObservedAt: '2026-06-23T10:00:00.000Z',
      studentId: 'S001',
      success: true,
      summary: null,
      summaryRefreshFailed: true,
      traceId: 'trace-education-001',
      upstreamSaved: true,
      upstreamSessionToken: 'rolling-token-002',
      warningCodes: [],
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      writeStudentPrivateProfileEducationToUpstream: result,
    });

    await expect(
      writeStudentPrivateProfileEducationToUpstream({
        expectedSectionBaselineToken: ' section-token-education ',
        resumes: [
          {
            action: 'DELETE',
            itemKey: ' row-education-001 ',
            upstreamBaselineToken: ' row-token-education-001 ',
          },
        ],
        studentId: ' S001 ',
        upstreamSessionToken: ' rolling-token-001 ',
      }),
    ).resolves.toEqual(result);

    expect(executeUpstreamSessionGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentPrivateProfileLabWriteEducationToUpstream'),
      {
        input: {
          expectedSectionBaselineToken: 'section-token-education',
          resumes: [
            {
              action: 'DELETE',
              itemKey: 'row-education-001',
              upstreamBaselineToken: 'row-token-education-001',
            },
          ],
          studentId: 'S001',
          upstreamSessionToken: 'rolling-token-001',
        },
      },
    );
    expect(executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0]).toContain(
      'writeStudentPrivateProfileEducationToUpstream',
    );
    expect(executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0]).toContain('summaryRefreshFailed');
    expect(executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0]).toContain('sectionBaselineToken');
    expect(executeGraphQLMock).not.toHaveBeenCalled();
  });

  it('normalizes compare fields without exposing candidate values beyond variables', async () => {
    expect(
      normalizeCompareStudentPrivateProfileFieldsInput({
        fields: [
          {
            candidateValue: ' 13800000000 ',
            fieldKey: 'STUDENT_PHONE',
          },
        ],
        studentId: ' S001 ',
      }),
    ).toEqual({
      fields: [
        {
          candidateValue: '13800000000',
          fieldKey: 'STUDENT_PHONE',
        },
      ],
      studentId: 'S001',
    });

    executeGraphQLMock.mockResolvedValueOnce({
      compareStudentPrivateProfileFields: {
        results: [
          {
            fieldKey: 'STUDENT_PHONE',
            result: 'MATCH',
            valueStatus: 'PRESENT',
          },
        ],
        studentId: 'S001',
      },
    });

    await compareStudentPrivateProfileFields({
      fields: [
        {
          candidateValue: ' 13800000000 ',
          fieldKey: 'STUDENT_PHONE',
        },
      ],
      studentId: ' S001 ',
    });

    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('StudentPrivateProfileLabCompare');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('candidateValue');
    expect(executeGraphQLMock).toHaveBeenCalledWith(expect.any(String), {
      input: {
        fields: [
          {
            candidateValue: '13800000000',
            fieldKey: 'STUDENT_PHONE',
          },
        ],
        studentId: 'S001',
      },
    });
  });

  it('requires baseline token for SET and omits it for CLEAR', async () => {
    expect(
      normalizePatchStudentPrivateProfileFieldsInput({
        fields: [
          {
            action: 'SET',
            fieldKey: 'STUDENT_PHONE',
            upstreamBaselineToken: ' baseline-001 ',
            value: ' 13800000000 ',
          },
          {
            action: 'CLEAR',
            fieldKey: 'HOME_ADDRESS',
            upstreamBaselineToken: ' ignored ',
            value: ' ignored ',
          },
        ],
        studentId: ' S001 ',
      }),
    ).toEqual({
      fields: [
        {
          action: 'SET',
          fieldKey: 'STUDENT_PHONE',
          upstreamBaselineToken: 'baseline-001',
          value: '13800000000',
        },
        {
          action: 'CLEAR',
          fieldKey: 'HOME_ADDRESS',
        },
      ],
      studentId: 'S001',
    });

    executeGraphQLMock.mockResolvedValueOnce({
      patchStudentPrivateProfileFields: {
        educationResumes: [],
        familyMembers: [],
        fields: [],
        lastManualUpdatedAt: '2026-06-23T10:00:00.000Z',
        lastSyncedAt: '2026-06-23T10:00:00.000Z',
        photo: {
          byteSize: 0,
          present: false,
          sourceObservedAt: '2026-06-23T10:00:00.000Z',
        },
        profileCompletenessFlags: {
          educationObserved: false,
          familyObserved: false,
          personalObserved: true,
          photoObserved: false,
          recordObserved: false,
          sensitiveIdentifiersObserved: true,
        },
        recordChanges: [],
        sectionStatuses: [],
        sourceObservedAt: '2026-06-23T10:00:00.000Z',
        studentId: 'S001',
      },
    });

    await patchStudentPrivateProfileFields({
      fields: [
        {
          action: 'SET',
          fieldKey: 'STUDENT_PHONE',
          upstreamBaselineToken: ' baseline-001 ',
          value: ' 13800000000 ',
        },
      ],
      studentId: ' S001 ',
    });

    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('StudentPrivateProfileLabPatch');
    expect(executeGraphQLMock).toHaveBeenCalledWith(expect.any(String), {
      input: {
        fields: [
          {
            action: 'SET',
            fieldKey: 'STUDENT_PHONE',
            upstreamBaselineToken: 'baseline-001',
            value: '13800000000',
          },
        ],
        studentId: 'S001',
      },
    });
  });

  it('reads photo through explicit photo mutation and keeps token optional', async () => {
    expect(
      normalizeReadStudentPrivateProfilePhotoInput({
        forceRefresh: true,
        studentId: ' S001 ',
        upstreamSessionToken: ' upstream-token ',
      }),
    ).toEqual({
      input: {
        forceRefresh: true,
        studentId: 'S001',
        upstreamSessionToken: 'upstream-token',
      },
    });
    expect(
      normalizeReadStudentPrivateProfilePhotoInput({
        forceRefresh: false,
        studentId: ' S001 ',
        upstreamSessionToken: ' ',
      }),
    ).toEqual({
      input: {
        forceRefresh: false,
        studentId: 'S001',
      },
    });

    const photoResult = {
      byteSize: 1024,
      expiresAt: '2026-06-23T11:00:00.000Z',
      height: 120,
      materializedAt: '2026-06-23T10:00:00.000Z',
      mimeType: 'image/jpeg',
      photoBase64: 'base64-photo',
      photoStatus: 'PRESENT',
      source: 'UPSTREAM',
      sourceObservedAt: '2026-06-23T10:00:00.000Z',
      studentId: 'S001',
      traceId: 'trace-photo',
      upstreamSessionToken: 'rolling-token-002',
      warnings: [],
      width: 90,
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      readStudentPrivateProfilePhoto: photoResult,
    });

    await expect(
      readStudentPrivateProfilePhoto({
        forceRefresh: true,
        studentId: ' S001 ',
        upstreamSessionToken: ' rolling-token-001 ',
      }),
    ).resolves.toEqual(photoResult);

    expect(executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0]).toContain(
      'StudentPrivateProfileLabReadPhoto',
    );
    expect(executeUpstreamSessionGraphQLMock).toHaveBeenCalledWith(expect.any(String), {
      input: {
        forceRefresh: true,
        studentId: 'S001',
        upstreamSessionToken: 'rolling-token-001',
      },
    });

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      readStudentPrivateProfilePhoto: {
        ...photoResult,
        photoStatus: 'PRESENT',
        source: 'CACHE',
        upstreamSessionToken: null,
      },
    });

    await readStudentPrivateProfilePhoto({
      forceRefresh: false,
      studentId: ' S001 ',
    });

    expect(executeUpstreamSessionGraphQLMock).toHaveBeenLastCalledWith(expect.any(String), {
      input: {
        forceRefresh: false,
        studentId: 'S001',
      },
    });
  });

  it('recognizes photo upstream session required errors from GraphQL details', () => {
    const error = new Error('need upstream session');

    readUpstreamGraphQLErrorDetailMock.mockReturnValueOnce({
      code: 'BAD_USER_INPUT',
      errorCode: 'STUDENT_PRIVATE_PROFILE_UPSTREAM_SESSION_REQUIRED',
      message: '首次读取或强制刷新学生照片需要 upstream 会话 token',
    });

    expect(isStudentPrivateProfileUpstreamSessionRequiredError(error)).toBe(true);
    expect(readUpstreamGraphQLErrorDetailMock).toHaveBeenCalledWith(error);

    readUpstreamGraphQLErrorDetailMock.mockReturnValueOnce({
      code: 'BAD_USER_INPUT',
      errorCode: 'STUDENT_PRIVATE_PROFILE_UPSTREAM_ID_MISSING',
      message: '目标学生缺少 upstream id',
    });

    expect(isStudentPrivateProfileUpstreamSessionRequiredError(error)).toBe(false);
  });

  it('patches family members with row baseline only for SET', async () => {
    expect(
      normalizePatchStudentPrivateProfileFamilyMembersInput({
        members: [
          {
            fields: [
              {
                action: 'SET',
                fieldKey: 'PHONE',
                value: ' 13900001111 ',
              },
              {
                action: 'CLEAR',
                fieldKey: 'WORKPLACE',
                value: ' ignored ',
              },
            ],
            itemKey: ' item-001 ',
            upstreamBaselineToken: ' baseline-001 ',
          },
          {
            fields: [
              {
                action: 'CLEAR',
                fieldKey: 'NAME',
              },
            ],
            itemKey: ' item-002 ',
            upstreamBaselineToken: ' ignored ',
          },
        ],
        studentId: ' S001 ',
      }),
    ).toEqual({
      members: [
        {
          fields: [
            {
              action: 'SET',
              fieldKey: 'PHONE',
              value: '13900001111',
            },
            {
              action: 'CLEAR',
              fieldKey: 'WORKPLACE',
            },
          ],
          itemKey: 'item-001',
          upstreamBaselineToken: 'baseline-001',
        },
        {
          fields: [
            {
              action: 'CLEAR',
              fieldKey: 'NAME',
            },
          ],
          itemKey: 'item-002',
        },
      ],
      studentId: 'S001',
    });

    executeGraphQLMock.mockResolvedValueOnce({
      patchStudentPrivateProfileFamilyMembers: {
        educationResumes: [],
        familyMembers: [],
        fields: [],
        lastManualUpdatedAt: '2026-06-23T10:00:00.000Z',
        lastSyncedAt: '2026-06-23T10:00:00.000Z',
        photo: {
          byteSize: 0,
          present: false,
          sourceObservedAt: '2026-06-23T10:00:00.000Z',
        },
        profileCompletenessFlags: {
          educationObserved: false,
          familyObserved: true,
          personalObserved: true,
          photoObserved: false,
          recordObserved: false,
          sensitiveIdentifiersObserved: true,
        },
        recordChanges: [],
        sectionStatuses: [],
        sourceObservedAt: '2026-06-23T10:00:00.000Z',
        studentId: 'S001',
      },
    });

    await patchStudentPrivateProfileFamilyMembers({
      members: [
        {
          fields: [
            {
              action: 'SET',
              fieldKey: 'PHONE',
              value: ' 13900001111 ',
            },
          ],
          itemKey: ' item-001 ',
          upstreamBaselineToken: ' baseline-001 ',
        },
      ],
      studentId: ' S001 ',
    });

    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('StudentPrivateProfileLabPatchFamily');
    expect(executeGraphQLMock).toHaveBeenCalledWith(expect.any(String), {
      input: {
        members: [
          {
            fields: [
              {
                action: 'SET',
                fieldKey: 'PHONE',
                value: '13900001111',
              },
            ],
            itemKey: 'item-001',
            upstreamBaselineToken: 'baseline-001',
          },
        ],
        studentId: 'S001',
      },
    });
  });
});
