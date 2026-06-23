// src/labs/student-private-profile/api.spec.ts

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
  compareStudentPrivateProfileFields,
  getStudentPrivateProfileSummary,
  listStudentPrivateProfileClassOptions,
  listStudentPrivateProfileClassStudentOptions,
  normalizeCompareStudentPrivateProfileFieldsInput,
  normalizeListClassStudentOptionsInput,
  normalizePatchStudentPrivateProfileFieldsInput,
  patchStudentPrivateProfileFields,
  refreshStudentPrivateProfileFromUpstream,
} from './api';

describe('student-private-profile lab api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    executeUpstreamSessionGraphQLMock.mockReset();
  });

  it('loads summary with the documented query shape', async () => {
    const summary = {
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
});
