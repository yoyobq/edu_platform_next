// src/labs/student-private-profile/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  executeGraphQLMock,
  executeUpstreamSessionGraphQLMock,
  readUpstreamGraphQLErrorDetailMock,
} = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  executeUpstreamSessionGraphQLMock: vi.fn(),
  readUpstreamGraphQLErrorDetailMock: vi.fn(),
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
}));

import {
  compareStudentPrivateProfileFields,
  getStudentPrivateProfileClassOverview,
  getStudentPrivateProfileGovernanceReadinessPreflight,
  getStudentPrivateProfilePreview,
  getStudentPrivateProfileSummary,
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
  patchStudentPrivateProfileFamilyMembers,
  patchStudentPrivateProfileFields,
  readStudentPrivateProfilePhoto,
  refreshStudentPrivateProfileFromUpstream,
  refreshStudentPrivateProfilesFromUpstream,
} from './api';

describe('student-private-profile lab api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    executeUpstreamSessionGraphQLMock.mockReset();
    readUpstreamGraphQLErrorDetailMock.mockReset();
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
