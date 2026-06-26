// src/labs/student-conduct-grade-governance/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, executeUpstreamSessionGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  executeUpstreamSessionGraphQLMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

vi.mock('@/entities/upstream-session', () => ({
  executeUpstreamSessionGraphQL: executeUpstreamSessionGraphQLMock,
  isExpiredUpstreamSessionError: vi.fn(),
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

import {
  cleanupStudentConductGradeCorrection,
  fetchStudentConductGradeEffectiveView,
  fetchStudentPrivateProfileClassOverview,
  listStudentPrivateProfileClassOptions,
  normalizeConductCleanupInput,
  normalizeConductViewInput,
  normalizeRefreshConductClassInput,
  refreshStudentConductGradeClassFromUpstream,
} from './api';

describe('student-conduct-grade-governance api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    executeUpstreamSessionGraphQLMock.mockReset();
  });

  it('normalizes conduct view and cleanup inputs', () => {
    expect(
      normalizeConductViewInput({
        classCode: ' 2501 ',
        schoolYear: ' 2025 ',
        semester: ' 1 ',
      }),
    ).toEqual({
      classCode: '2501',
      schoolYear: '2025',
      semester: '1',
    });

    expect(
      normalizeConductCleanupInput({
        classCode: ' 2501 ',
        schoolYear: ' 2025 ',
        semester: ' 1 ',
        studentId: ' stu-1 ',
      }),
    ).toEqual({
      classCode: '2501',
      schoolYear: '2025',
      semester: '1',
      studentId: 'stu-1',
    });
  });

  it('normalizes conduct upstream refresh scope and rejects semester-only input', () => {
    expect(
      normalizeRefreshConductClassInput({
        classCode: ' 2501 ',
        upstreamSessionToken: ' token-1 ',
      }),
    ).toEqual({
      classCode: '2501',
      schoolYear: undefined,
      semester: undefined,
      upstreamSessionToken: 'token-1',
    });

    expect(
      normalizeRefreshConductClassInput({
        classCode: '2501',
        schoolYear: ' 2025 ',
        upstreamSessionToken: ' token-1 ',
      }),
    ).toEqual({
      classCode: '2501',
      schoolYear: '2025',
      semester: undefined,
      upstreamSessionToken: 'token-1',
    });

    expect(() =>
      normalizeRefreshConductClassInput({
        classCode: '2501',
        semester: ' 2 ',
        upstreamSessionToken: ' token-1 ',
      }),
    ).toThrow('同步指定学期时必须同时提供学年。');
  });

  it('loads class options through the private profile class option contract', async () => {
    const payload = [
      {
        authorizationPath: 'CLASS_ADVISER',
        classCode: '2501',
        className: '25计算机1班',
        id: 'class-1',
        resolvedAuthorityCode: 'CLASS_ADVISER',
        studentCount: 42,
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      studentPrivateProfileClassOptions: payload,
    });

    await expect(listStudentPrivateProfileClassOptions()).resolves.toBe(payload);
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentConductGradeGovernanceClassOptions'),
      {
        input: {},
      },
    );
  });

  it('loads class overview with snapshot and upstream id signals', async () => {
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
      fetchStudentPrivateProfileClassOverview({
        classId: ' class-1 ',
      }),
    ).resolves.toBe(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('snapshotPresent');
    expect(query).toContain('upstreamIdPresent');
    expect(query).toContain('attentionLevel');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentConductGradeGovernanceClassOverview'),
      {
        input: {
          classId: 'class-1',
        },
      },
    );
  });

  it('loads conduct effective view with field source and conflict metadata', async () => {
    const payload = {
      classCode: '2501',
      classId: 'class-1',
      className: '25计算机1班',
      schoolYear: '2025',
      sectionKey: 'CONDUCT_GRADE',
      semester: '1',
      studentCount: 0,
      students: [],
      summary: {
        correctionCleanupPendingCount: 0,
        localCorrectionCount: 0,
        missingCount: 0,
        upstreamChangedSinceCorrectionCount: 0,
        upstreamConfirmedCount: 0,
      },
    };

    executeGraphQLMock.mockResolvedValueOnce({
      studentConductGradeEffectiveView: payload,
    });

    await expect(
      fetchStudentConductGradeEffectiveView({
        classCode: '2501',
        schoolYear: '2025',
        semester: '1',
      }),
    ).resolves.toBe(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('studentConductGradeEffectiveView');
    expect(query).toContain('manualPatchFieldKeys');
    expect(query).toContain('conflictCodes');
    expect(query).toContain('confirmedGrade');
    expect(query).toContain('displayValue');
    expect(query).toMatch(/score\s*\{\s*value\s+source\s+conflict\s*\}/);
    expect(query).toContain('correctionCleanupPendingCount');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentConductGradeGovernanceEffectiveView'),
      {
        input: {
          classCode: '2501',
          schoolYear: '2025',
          semester: '1',
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
        classCode: ' 2501 ',
        schoolYear: ' 2025 ',
        semester: ' 1 ',
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
          classCode: '2501',
          schoolYear: '2025',
          semester: '1',
          studentId: 'stu-1',
        },
      },
    );
  });

  it('refreshes conduct grade snapshots through upstream session graphql', async () => {
    const payload = {
      confirmedRegistrationCount: 1,
      createdCount: 40,
      expiresAt: '2026-06-26T10:00:00.000Z',
      failureCount: 0,
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
        classCode: ' 2501 ',
        schoolYear: ' 2025 ',
        semester: ' 2 ',
        upstreamSessionToken: ' token-1 ',
      }),
    ).resolves.toBe(payload);

    const query = executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('refreshStudentConductGradeClassFromUpstream');
    expect(query).toContain('requestedRegistrationCount');
    expect(query).toContain('writtenStudentCount');
    expect(query).toContain('termResults');
    expect(query).toContain('upstreamSessionToken');
    expect(query).not.toContain('requestedCount');
    expect(query).not.toContain('successCount');
    expect(executeUpstreamSessionGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentConductGradeGovernanceRefreshClass'),
      {
        input: {
          classCode: '2501',
          schoolYear: '2025',
          semester: '2',
          upstreamSessionToken: 'token-1',
        },
      },
    );
  });
});
