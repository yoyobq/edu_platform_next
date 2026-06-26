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
  listStudentProfileFilingClassOptions,
  normalizeStudentProfileFilingBatchRefreshInput,
  normalizeStudentProfileFilingClassOverviewInput,
  normalizeStudentProfileFilingClassRefreshInput,
  normalizeStudentProfileFilingRefreshInput,
  refreshStudentProfileFilingClass,
  refreshStudentProfileFilingStudent,
  refreshStudentProfileFilingStudents,
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
        classCode: '2501',
        className: '25计算机1班',
        departmentId: 'D001',
        gradeYear: 2025,
        id: 'class-1',
        resolvedAuthorityCode: 'ADMIN',
        studentCount: 30,
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      studentPrivateProfileClassOptions: payload,
    });

    await expect(listStudentProfileFilingClassOptions()).resolves.toBe(payload);
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentProfileFilingClassOptions'),
      {
        input: {},
      },
    );
    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('studentPrivateProfileClassOptions');
    expect(query).toContain('resolvedAuthorityCode');
    expect(query).toContain('authorizationPath');
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
    expect(variables).toEqual({
      input: {
        classId: 'class-1',
      },
    });
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
});
