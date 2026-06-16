// src/features/student-roster-membership-reconciliation/infrastructure/api.spec.ts

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
  claimClassAdviserForRosterSync,
  commitUpstreamStudentRosterReconciliation,
  dryRunReconcileUpstreamStudentRoster,
  fetchPreviousClassAdviserClasses,
  fetchRosterMembershipDepartmentOptions,
  listLocalClassOptions,
  requestAcademicSemesters,
} from './api';

describe('student roster membership reconciliation api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    executeUpstreamSessionGraphQLMock.mockReset();
  });

  it('loads previous class adviser classes without site JWT auth mode', async () => {
    const payload = {
      classes: [
        {
          code: '1031301',
          image: '',
          name: '信息1301班',
          text: '信息1301班',
          value: '1031301',
        },
      ],
      count: 1,
      expiresAt: '2026-06-03T12:00:00.000Z',
      upstreamSessionToken: '{"token":"rolling"}',
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      fetchPreviousClassAdviserClasses: payload,
    });

    await expect(
      fetchPreviousClassAdviserClasses({
        upstreamSessionToken: ' {"token":"current"} ',
      }),
    ).resolves.toEqual(payload);

    const query = executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0] as string;
    const variables = executeUpstreamSessionGraphQLMock.mock.calls[0]?.[1];

    expect(executeUpstreamSessionGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentRosterMembershipPreviousClassAdviserClasses'),
      {
        sessionToken: '{"token":"current"}',
      },
    );
    expect(query).toContain('fetchPreviousClassAdviserClasses');
    expect(query).not.toContain('fetchClassDirectory');
    expect(query).not.toContain('departmentId');
    expect(query).not.toContain('schoolYear');
    expect(query).not.toContain('semester');
    expect(query).not.toContain('annualMajorId');
    expect(variables).toEqual({
      sessionToken: '{"token":"current"}',
    });
  });

  it('loads enabled departments for local class filters', async () => {
    const payload = [
      {
        departmentName: '信息工程系',
        id: 'D001',
        isEnabled: true,
        shortName: '信工',
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      departments: payload,
    });

    await expect(fetchRosterMembershipDepartmentOptions()).resolves.toEqual(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    const variables = executeGraphQLMock.mock.calls[0]?.[1];

    expect(query).toContain('StudentRosterMembershipDepartments');
    expect(query).toContain('departments(isEnabled: $isEnabled, limit: $limit)');
    expect(variables).toEqual({
      isEnabled: true,
      limit: 500,
    });
  });

  it('lists local class options with normalized filters', async () => {
    const payload = [
      {
        classCode: '1021904',
        className: '信息1904班',
        departmentId: 'D001',
        gradeYear: 2019,
        id: 'class-1',
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      listLocalClassOptions: payload,
    });

    await expect(
      listLocalClassOptions({
        departmentId: ' D001 ',
        keyword: ' 1904 ',
      }),
    ).resolves.toEqual(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    const variables = executeGraphQLMock.mock.calls[0]?.[1];

    expect(query).toContain('StudentRosterMembershipLocalClassOptions');
    expect(query).toContain('ListLocalClassOptionsInput');
    expect(query).toContain('listLocalClassOptions');
    expect(query).toContain('classCode');
    expect(query).toContain('className');
    expect(variables).toEqual({
      input: {
        departmentId: 'D001',
        keyword: '1904',
      },
    });
  });

  it('loads all academic semesters for roster decision effective semester selectors', async () => {
    const payload = [
      {
        createdAt: '2026-04-01T00:00:00.000Z',
        endDate: '2026-07-10',
        examStartDate: '2026-06-22',
        firstTeachingDate: '2026-02-20',
        id: 3,
        isCurrent: true,
        isVisible: false,
        name: '2025-2026 第二学期',
        schoolYear: 2025,
        sortOrder: 10,
        startDate: '2026-02-17',
        termNumber: 2,
        updatedAt: '2026-04-02T00:00:00.000Z',
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      academicSemesters: payload,
    });

    await expect(requestAcademicSemesters()).resolves.toEqual(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    const variables = executeGraphQLMock.mock.calls[0]?.[1];

    expect(query).toContain('StudentRosterMembershipAcademicSemesters');
    expect(query).toContain('academicSemesters(limit: $limit)');
    expect(query).toContain('isVisible');
    expect(query).not.toContain('isVisible: $isVisible');
    expect(variables).toEqual({
      limit: 500,
    });
  });

  it('dry-runs the single-class reconciliation without deleted range fields', async () => {
    const payload = {
      autoAppliedCount: 1,
      classCode: '1031301',
      className: '信息1301班',
      committed: false,
      confirmationRequiredCount: 0,
      createdDecisionCount: 0,
      createdMembershipCount: 0,
      differenceCount: 0,
      dryRun: true,
      endedDecisionCount: 0,
      endedMembershipCount: 0,
      expiresAt: '2026-06-03T12:00:00.000Z',
      fetchedCount: 1,
      items: [],
      requiresReconfirm: false,
      sessionStrategy: 'REUSED',
      suppressedCount: 0,
      touchedMembershipCount: 0,
      traceId: 'trace-001',
      unprocessableCount: 0,
      upstreamSessionToken: '{"token":"rolling"}',
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      dryRunReconcileUpstreamStudentRoster: payload,
    });

    await expect(
      dryRunReconcileUpstreamStudentRoster({
        classCode: ' 1031301 ',
        upstreamSessionToken: ' {"token":"current"} ',
      }),
    ).resolves.toEqual(payload);

    const query = executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0] as string;
    const variables = executeUpstreamSessionGraphQLMock.mock.calls[0]?.[1];

    expect(query).toContain('DryRunReconcileUpstreamStudentRosterInput');
    expect(query).toContain('UpstreamStudentRosterReconciliationResultFields');
    expect(query).toContain('dryRunReconcileUpstreamStudentRoster');
    expect(query).toContain('activeDecisionEffectiveSemesterId');
    expect(query).toContain('activeDecisionReasonCode');
    expect(query).toContain('inferredAdmissionYear');
    expect(query).toContain('inferredOriginalClassCode');
    expect(query).not.toContain('dryRunReconcileStudentRosterMembership');
    expect(query).not.toContain('classListCodes');
    expect(query).not.toContain('departmentIds');
    expect(variables).toEqual({
      input: {
        classCode: '1031301',
        upstreamSessionToken: '{"token":"current"}',
      },
    });
    expect(JSON.stringify(variables)).not.toContain('classListCodes');
    expect(JSON.stringify(variables)).not.toContain('departmentIds');
  });

  it('claims class adviser authority before roster sync with normalized input', async () => {
    const payload = {
      changed: true,
      claimed: true,
      classCode: '1031301',
      className: '信息1301班',
      expiresAt: '2026-06-03T12:00:00.000Z',
      fetchedCount: 42,
      reason: 'CLAIMED',
      upstreamSessionToken: '{"token":"rolling"}',
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      claimClassAdviserForRosterSync: payload,
    });

    await expect(
      claimClassAdviserForRosterSync({
        classCode: ' 1031301 ',
        upstreamSessionToken: ' {"token":"current"} ',
      }),
    ).resolves.toEqual(payload);

    const query = executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0] as string;
    const variables = executeUpstreamSessionGraphQLMock.mock.calls[0]?.[1];

    expect(query).toContain('ClaimClassAdviserForRosterSyncInput');
    expect(query).toContain('claimClassAdviserForRosterSync');
    expect(variables).toEqual({
      input: {
        classCode: '1031301',
        upstreamSessionToken: '{"token":"current"}',
      },
    });
  });

  it('commits confirmations and end decisions without dry-run item details', async () => {
    const payload = {
      autoAppliedCount: 1,
      classCode: '1031301',
      className: '信息1301班',
      committed: true,
      confirmationRequiredCount: 1,
      createdDecisionCount: 1,
      createdMembershipCount: 0,
      differenceCount: 1,
      dryRun: false,
      endedDecisionCount: 1,
      endedMembershipCount: 1,
      expiresAt: '2026-06-03T12:00:00.000Z',
      fetchedCount: 1,
      items: [],
      requiresReconfirm: false,
      sessionStrategy: 'REUSED',
      suppressedCount: 0,
      touchedMembershipCount: 0,
      traceId: 'trace-002',
      unprocessableCount: 0,
      upstreamSessionToken: '{"token":"rolling"}',
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      commitUpstreamStudentRosterReconciliation: payload,
    });

    await expect(
      commitUpstreamStudentRosterReconciliation({
        classCode: ' 1031301 ',
        confirmations: [
          {
            decisionOutcome: 'EXCLUDE',
            effectiveSemesterId: 3,
            reasonCode: 'TRANSFERRED_OUT_CONFIRMED',
            reasonText: ' 确认已转出 ',
            studentId: ' 20240001 ',
          },
        ],
        endDecisions: [
          {
            decisionId: ' 12 ',
            endReason: ' ',
          },
        ],
        upstreamSessionToken: ' {"token":"current"} ',
      }),
    ).resolves.toEqual(payload);

    const query = executeUpstreamSessionGraphQLMock.mock.calls[0]?.[0] as string;
    const variables = executeUpstreamSessionGraphQLMock.mock.calls[0]?.[1];

    expect(query).toContain('CommitUpstreamStudentRosterReconciliationInput');
    expect(query).toContain('commitUpstreamStudentRosterReconciliation');
    expect(query).not.toContain('commitStudentRosterMembershipReconciliation');
    expect(query).not.toContain('classListCodes');
    expect(query).not.toContain('departmentIds');
    expect(variables).toEqual({
      input: {
        classCode: '1031301',
        confirmations: [
          {
            decisionOutcome: 'EXCLUDE',
            effectiveSemesterId: 3,
            reasonCode: 'TRANSFERRED_OUT_CONFIRMED',
            reasonText: '确认已转出',
            studentId: '20240001',
          },
        ],
        endDecisions: [
          {
            decisionId: '12',
            endReason: undefined,
          },
        ],
        upstreamSessionToken: '{"token":"current"}',
      },
    });
    expect(JSON.stringify(variables)).not.toContain('items');
    expect(JSON.stringify(variables)).not.toContain('classListCodes');
    expect(JSON.stringify(variables)).not.toContain('departmentIds');
  });
});
