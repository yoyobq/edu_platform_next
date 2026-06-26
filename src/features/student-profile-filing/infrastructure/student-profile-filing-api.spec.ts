// src/features/student-profile-filing/infrastructure/student-profile-filing-api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, executeUpstreamSessionGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  executeUpstreamSessionGraphQLMock: vi.fn(),
}));

vi.mock('@/entities/upstream-session', () => ({
  executeUpstreamSessionGraphQL: executeUpstreamSessionGraphQLMock,
  isExpiredUpstreamSessionError: vi.fn(() => false),
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import {
  getStudentProfileFilingClassOverview,
  getStudentProfileFilingSupplementSummary,
  listStudentProfileFilingClassOptions,
  normalizeStudentProfileFilingBatchRefreshInput,
  normalizeStudentProfileFilingClassOverviewInput,
  normalizeStudentProfileFilingClassRefreshInput,
  normalizeStudentProfileFilingEducationSupplementInput,
  normalizeStudentProfileFilingFamilySupplementInput,
  normalizeStudentProfileFilingRefreshInput,
  refreshStudentProfileFilingClass,
  refreshStudentProfileFilingStudent,
  refreshStudentProfileFilingStudents,
  writeStudentProfileFilingEducationSupplement,
  writeStudentProfileFilingFamilySupplement,
} from './student-profile-filing-api';

describe('student profile filing api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    executeUpstreamSessionGraphQLMock.mockReset();
  });

  it('normalizes class overview and upstream refresh input', () => {
    expect(
      normalizeStudentProfileFilingClassOverviewInput({
        classId: ' class-1 ',
      }),
    ).toEqual({
      classId: 'class-1',
    });
    expect(
      normalizeStudentProfileFilingRefreshInput({
        studentId: ' S001 ',
        upstreamSessionToken: ' token-1 ',
      }),
    ).toEqual({
      studentId: 'S001',
      upstreamSessionToken: 'token-1',
    });
    expect(
      normalizeStudentProfileFilingClassRefreshInput({
        classId: ' class-1 ',
        upstreamSessionToken: ' token-1 ',
      }),
    ).toEqual({
      classId: 'class-1',
      upstreamSessionToken: 'token-1',
    });
    expect(
      normalizeStudentProfileFilingBatchRefreshInput({
        studentIds: [' S001 ', 'S002', 'S001', '', null],
        upstreamSessionToken: ' token-1 ',
      }),
    ).toEqual({
      studentIds: ['S001', 'S002'],
      upstreamSessionToken: 'token-1',
    });
  });

  it('caps batch refresh to backend batch size', () => {
    expect(() =>
      normalizeStudentProfileFilingBatchRefreshInput({
        studentIds: Array.from({ length: 21 }, (_, index) => `S${index}`),
        upstreamSessionToken: 'token-1',
      }),
    ).toThrow('一次最多建档或更新 20 个学生。');
  });

  it('loads student profile filing class options from the private profile contract', async () => {
    const payload = [
      {
        authorizationPath: 'ADMIN',
        classAdvisers: [
          {
            isTemporary: false,
            staffId: 'T001',
            staffName: '李老师',
          },
        ],
        classCode: '2501',
        classEnrollmentYear: 2025,
        classExpectedGraduationYear: 2030,
        classInSchool: true,
        className: '25计算机1班',
        classSchoolYearRangeLabel: '2025-2030',
        departmentId: 'D001',
        gradeYear: 2025,
        id: 'class-1',
        majorId: 'M001',
        majorName: '计算机网络应用',
        resolvedAuthorityCode: 'ADMIN',
        studentCount: 30,
        trainingYears: 5,
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      studentPrivateProfileClassOptions: payload,
    });

    await expect(listStudentProfileFilingClassOptions()).resolves.toEqual(payload);
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentProfileFilingClassOptions'),
      {
        input: {},
      },
    );
    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('studentPrivateProfileClassOptions');
    expect(query).toContain('classAdvisers');
    expect(query).toContain('staffName');
    expect(query).toContain('trainingYears');
    expect(query).toContain('classInSchool');
    expect(query).toContain('classSchoolYearRangeLabel');
    expect(query).toContain('resolvedAuthorityCode');
    expect(query).toContain('authorizationPath');
  });

  it('falls back to legacy class options when backend schema has not exposed class context', async () => {
    const legacyPayload = [
      {
        authorizationPath: 'ADMIN',
        classCode: '2501',
        className: '25计算机1班',
        departmentId: 'D001',
        gradeYear: 2025,
        id: 'class-1',
        resolvedAuthorityCode: 'ADMIN',
        studentCount: 30,
      },
    ];

    executeGraphQLMock
      .mockRejectedValueOnce(
        new Error(
          'Cannot query field "classAdvisers" on type "StudentPrivateProfileClassOptionDTO".',
        ),
      )
      .mockResolvedValueOnce({
        studentPrivateProfileClassOptions: legacyPayload,
      });

    await expect(listStudentProfileFilingClassOptions()).resolves.toEqual([
      {
        ...legacyPayload[0],
        classAdvisers: [],
        classEnrollmentYear: null,
        classExpectedGraduationYear: null,
        classInSchool: null,
        classSchoolYearRangeLabel: null,
        majorId: null,
        majorName: null,
        trainingYears: null,
      },
    ]);

    expect(executeGraphQLMock).toHaveBeenCalledTimes(2);
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('classAdvisers');
    expect(executeGraphQLMock.mock.calls[1]?.[0]).not.toContain('classAdvisers');
  });

  it('loads class overview fields needed by filing status', async () => {
    const payload = {
      classCode: '2501',
      classId: 'class-1',
      className: '25计算机1班',
      studentCount: 1,
      students: [],
    };

    executeGraphQLMock.mockResolvedValueOnce({
      studentPrivateProfileClassOverview: payload,
    });

    await expect(
      getStudentProfileFilingClassOverview({
        classId: ' class-1 ',
      }),
    ).resolves.toBe(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    const variables = executeGraphQLMock.mock.calls[0]?.[1];

    expect(query).toContain('StudentProfileFilingClassOverview');
    expect(query).toContain('snapshotPresent');
    expect(query).toContain('profileCompletenessFlags');
    expect(query).toContain('attentionLevel');
    expect(query).toContain('studentStatus');
    expect(query).toContain('rosterScopeSource');
    expect(query).toContain('droppedDecisionReasonCode');
    expect(query).toContain('droppedEffectiveSemesterId');
    expect(query).toContain('droppedEffectiveSemesterLabel');
    expect(variables).toEqual({
      input: {
        classId: 'class-1',
      },
    });
  });

  it('loads supplement summary baselines for focused write-through actions', async () => {
    const payload = {
      educationResumes: [
        {
          endMonth: '2023-06',
          itemKey: 'education-row-1',
          maskedOrganization: '某中学',
          maskedReference: '李老师',
          sourceObservedAt: '2026-06-25T11:00:00.000Z',
          sourceUpdatedAt: null,
          startMonth: '2020-09',
          upstreamBaselineToken: 'education-row-baseline-1',
        },
      ],
      familyMembers: [
        {
          itemKey: 'family-row-1',
          manualOverrideActive: false,
          manualPatchFieldKeys: [],
          maskedName: '张*父',
          maskedPhone: '138****0000',
          maskedWorkplace: '某单位',
          relationshipCode: '1',
          sourceObservedAt: '2026-06-25T11:00:00.000Z',
          sourceUpdatedAt: null,
          upstreamBaselineToken: 'family-row-baseline-1',
          upstreamChangedSinceManualPatch: false,
        },
      ],
      profileCompletenessFlags: {
        educationObserved: false,
        familyObserved: false,
        personalObserved: true,
        photoObserved: true,
        recordObserved: true,
        sensitiveIdentifiersObserved: true,
      },
      sectionStatuses: [
        {
          section: 'FAMILY',
          sectionBaselineToken: 'family-baseline-1',
          sourceStatus: 'PRESENT',
        },
        {
          section: 'EDUCATION_RESUME',
          sectionBaselineToken: 'education-baseline-1',
          sourceStatus: 'MISSING',
        },
      ],
      studentId: 'S001',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      studentPrivateProfileSummary: payload,
    });

    await expect(
      getStudentProfileFilingSupplementSummary({
        studentId: ' S001 ',
      }),
    ).resolves.toBe(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('StudentProfileFilingSupplementSummary');
    expect(query).toContain('familyMembers');
    expect(query).toContain('relationshipCode');
    expect(query).toContain('maskedWorkplace');
    expect(query).toContain('educationResumes');
    expect(query).toContain('maskedOrganization');
    expect(query).toContain('sectionBaselineToken');
    expect(query).toContain('profileCompletenessFlags');
    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({
      input: {
        studentId: 'S001',
      },
    });
  });

  it('normalizes family and education supplement inputs for create-only write-through', () => {
    expect(
      normalizeStudentProfileFilingFamilySupplementInput({
        expectedSectionBaselineToken: ' family-baseline-1 ',
        member: {
          name: ' 张三父亲 ',
          phone: ' 13800000000 ',
          relationshipCode: ' 1 ',
          workplace: ' 学校 ',
        },
        studentId: ' S001 ',
        upstreamSessionToken: ' token-1 ',
      }),
    ).toEqual({
      expectedSectionBaselineToken: 'family-baseline-1',
      members: [
        {
          action: 'CREATE',
          name: '张三父亲',
          phone: '13800000000',
          relationshipCode: '1',
          workplace: '学校',
        },
      ],
      studentId: 'S001',
      upstreamSessionToken: 'token-1',
    });
    expect(
      normalizeStudentProfileFilingEducationSupplementInput({
        expectedSectionBaselineToken: ' education-baseline-1 ',
        resume: {
          endDate: ' 2024-06-30 ',
          organization: ' 初中学校 ',
          reference: ' 李老师 ',
          startDate: ' 2021-09-01 ',
        },
        studentId: ' S001 ',
        upstreamSessionToken: ' token-1 ',
      }),
    ).toEqual({
      expectedSectionBaselineToken: 'education-baseline-1',
      resumes: [
        {
          action: 'CREATE',
          endDate: '2024-06-30',
          organization: '初中学校',
          reference: '李老师',
          startDate: '2021-09-01',
        },
      ],
      studentId: 'S001',
      upstreamSessionToken: 'token-1',
    });
    expect(() =>
      normalizeStudentProfileFilingEducationSupplementInput({
        expectedSectionBaselineToken: 'education-baseline-1',
        resume: {
          endDate: '2024-06-30',
          organization: '初中学校',
          reference: '李老师',
          startDate: '2024-09-01',
        },
        studentId: 'S001',
        upstreamSessionToken: 'token-1',
      }),
    ).toThrow('开始日期不能晚于结束日期。');
  });

  it('refreshes one student through upstream session graphql', async () => {
    const payload = {
      changedSections: ['PERSONAL'],
      expiresAt: '2026-06-25T12:00:00.000Z',
      lastSyncedAt: '2026-06-25T11:00:00.000Z',
      photoByteSize: null,
      photoPresent: false,
      snapshotUpdated: true,
      sourceObservedAt: '2026-06-25T11:00:00.000Z',
      studentId: 'S001',
      success: true,
      traceId: 'trace-1',
      upstreamSessionToken: 'token-2',
      warnings: [],
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      refreshStudentPrivateProfileFromUpstream: payload,
    });

    await expect(
      refreshStudentProfileFilingStudent({
        studentId: ' S001 ',
        upstreamSessionToken: ' token-1 ',
      }),
    ).resolves.toBe(payload);
    expect(executeUpstreamSessionGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentProfileFilingRefresh'),
      {
        input: {
          studentId: 'S001',
          upstreamSessionToken: 'token-1',
        },
      },
    );
  });

  it('refreshes a class through the backend controlled class mutation', async () => {
    const payload = {
      chunkIntervalMs: 1000,
      chunkSize: 20,
      classCode: '2501',
      classId: 'class-1',
      className: '25计算机1班',
      expiresAt: '2026-06-25T12:00:00.000Z',
      failureCount: 0,
      requestedCount: 30,
      results: [],
      success: true,
      successCount: 30,
      traceId: 'trace-class',
      upstreamSessionToken: 'token-2',
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      refreshStudentPrivateProfileClassFromUpstream: payload,
    });

    await expect(
      refreshStudentProfileFilingClass({
        classId: ' class-1 ',
        upstreamSessionToken: ' token-1 ',
      }),
    ).resolves.toBe(payload);
    expect(executeUpstreamSessionGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentProfileFilingClassRefresh'),
      {
        input: {
          classId: 'class-1',
          upstreamSessionToken: 'token-1',
        },
      },
    );
    const query = executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('refreshStudentPrivateProfileClassFromUpstream');
    expect(query).toContain('chunkSize');
    expect(query).toContain('chunkIntervalMs');
  });

  it('refreshes a student batch through upstream session graphql', async () => {
    const payload = {
      expiresAt: '2026-06-25T12:00:00.000Z',
      failureCount: 0,
      requestedCount: 2,
      results: [],
      success: true,
      successCount: 2,
      traceId: 'trace-2',
      upstreamSessionToken: 'token-2',
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      refreshStudentPrivateProfilesFromUpstream: payload,
    });

    await expect(
      refreshStudentProfileFilingStudents({
        studentIds: [' S001 ', 'S002'],
        upstreamSessionToken: ' token-1 ',
      }),
    ).resolves.toBe(payload);
    expect(executeUpstreamSessionGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentProfileFilingBatchRefresh'),
      {
        input: {
          studentIds: ['S001', 'S002'],
          upstreamSessionToken: 'token-1',
        },
      },
    );
  });

  it('writes focused family and education supplements through upstream session graphql', async () => {
    const familyResult = {
      action: 'CREATE',
      changedSections: ['FAMILY'],
      expiresAt: '2026-06-25T12:00:00.000Z',
      localSnapshotRefreshed: true,
      sectionKey: 'FAMILY',
      snapshotUpdated: true,
      sourceObservedAt: '2026-06-25T11:00:00.000Z',
      studentId: 'S001',
      success: true,
      summaryRefreshFailed: false,
      traceId: 'trace-family',
      upstreamSaved: true,
      upstreamSessionToken: 'token-2',
      warningCodes: [],
    };
    const educationResult = {
      ...familyResult,
      changedSections: ['EDUCATION_RESUME'],
      sectionKey: 'EDUCATION_RESUME',
      traceId: 'trace-education',
    };

    executeUpstreamSessionGraphQLMock
      .mockResolvedValueOnce({
        writeStudentPrivateProfileFamilyToUpstream: familyResult,
      })
      .mockResolvedValueOnce({
        writeStudentPrivateProfileEducationToUpstream: educationResult,
      });

    await expect(
      writeStudentProfileFilingFamilySupplement({
        expectedSectionBaselineToken: 'family-baseline-1',
        member: {
          name: '张三父亲',
          relationshipCode: '1',
        },
        studentId: 'S001',
        upstreamSessionToken: 'token-1',
      }),
    ).resolves.toBe(familyResult);
    await expect(
      writeStudentProfileFilingEducationSupplement({
        expectedSectionBaselineToken: 'education-baseline-1',
        resume: {
          endDate: '2024-06-30',
          organization: '初中学校',
          reference: '李老师',
          startDate: '2021-09-01',
        },
        studentId: 'S001',
        upstreamSessionToken: 'token-1',
      }),
    ).resolves.toBe(educationResult);

    expect(executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0]).toContain(
      'writeStudentPrivateProfileFamilyToUpstream',
    );
    expect(executeUpstreamSessionGraphQLMock.mock.calls[0]?.[1]).toEqual({
      input: {
        expectedSectionBaselineToken: 'family-baseline-1',
        members: [
          {
            action: 'CREATE',
            name: '张三父亲',
            phone: undefined,
            relationshipCode: '1',
            workplace: undefined,
          },
        ],
        studentId: 'S001',
        upstreamSessionToken: 'token-1',
      },
    });
    expect(executeUpstreamSessionGraphQLMock.mock.calls[1]?.[0]).toContain(
      'writeStudentPrivateProfileEducationToUpstream',
    );
    expect(executeUpstreamSessionGraphQLMock.mock.calls[1]?.[1]).toEqual({
      input: {
        expectedSectionBaselineToken: 'education-baseline-1',
        resumes: [
          {
            action: 'CREATE',
            endDate: '2024-06-30',
            organization: '初中学校',
            reference: '李老师',
            startDate: '2021-09-01',
          },
        ],
        studentId: 'S001',
        upstreamSessionToken: 'token-1',
      },
    });
  });
});
