// src/labs/student-roster-membership-reconciliation/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
}));

vi.mock('@/entities/upstream-session', () => ({
  isExpiredUpstreamSessionError: vi.fn(() => false),
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import {
  commitStudentRosterMembershipReconciliation,
  dryRunReconcileStudentRosterMembership,
  fetchPreviousClassAdviserClasses,
} from './api';

describe('student roster membership reconciliation api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
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

    executeGraphQLMock.mockResolvedValueOnce({
      fetchPreviousClassAdviserClasses: payload,
    });

    await expect(
      fetchPreviousClassAdviserClasses({
        sessionToken: ' {"token":"current"} ',
      }),
    ).resolves.toEqual(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    const variables = executeGraphQLMock.mock.calls[0]?.[1];

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentRosterMembershipPreviousClassAdviserClasses'),
      {
        sessionToken: '{"token":"current"}',
      },
      {
        authMode: 'none',
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

    executeGraphQLMock.mockResolvedValueOnce({
      dryRunReconcileStudentRosterMembership: payload,
    });

    await expect(
      dryRunReconcileStudentRosterMembership({
        classCode: ' 1031301 ',
        upstreamSessionToken: ' {"token":"current"} ',
      }),
    ).resolves.toEqual(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    const variables = executeGraphQLMock.mock.calls[0]?.[1];

    expect(query).toContain('DryRunReconcileStudentRosterMembershipInput');
    expect(query).toContain('StudentRosterMembershipResultFields');
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

    executeGraphQLMock.mockResolvedValueOnce({
      commitStudentRosterMembershipReconciliation: payload,
    });

    await expect(
      commitStudentRosterMembershipReconciliation({
        classCode: ' 1031301 ',
        confirmations: [
          {
            decisionOutcome: 'EXCLUDE',
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

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    const variables = executeGraphQLMock.mock.calls[0]?.[1];

    expect(query).not.toContain('classListCodes');
    expect(query).not.toContain('departmentIds');
    expect(variables).toEqual({
      input: {
        classCode: '1031301',
        confirmations: [
          {
            decisionOutcome: 'EXCLUDE',
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
