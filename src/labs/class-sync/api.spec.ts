// src/labs/class-sync/api.spec.ts

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
  dryRunSyncClassesFromUpstream,
  dryRunSyncClassesFromUpstreamDirectory,
  fetchClassSyncDepartmentOptions,
  fetchCurrentClassSyncAccount,
  syncClassesFromUpstream,
} from './api';

describe('class-sync api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
  });

  it('maps the current account into the class sync viewer role', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      me: {
        accountId: 42,
        identity: {
          __typename: 'StaffType',
          id: 'STAFF-001',
        },
        userInfo: {
          accessGroup: ['STAFF'],
          nickname: '王老师',
        },
      },
    });

    await expect(fetchCurrentClassSyncAccount()).resolves.toEqual({
      accessGroup: ['STAFF'],
      accountId: 42,
      displayName: '王老师',
      staffId: 'STAFF-001',
      viewerRole: 'studentAffairsOfficer',
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('ClassSyncCurrentAccount'),
      {},
    );
  });

  it('loads enabled departments for admin viewers', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      departments: [
        {
          departmentName: '信息工程系',
          id: 'ORG0302',
          isEnabled: true,
          shortName: '信息',
        },
        {
          departmentName: '停用系部',
          id: 'ORG9999',
          isEnabled: false,
          shortName: null,
        },
      ],
    });

    await expect(
      fetchClassSyncDepartmentOptions({
        accountId: 1,
        viewerRole: 'admin',
      }),
    ).resolves.toEqual([
      {
        departmentName: '信息工程系',
        id: 'ORG0302',
        isEnabled: true,
        label: '信息工程系 (信息)',
        shortName: '信息',
      },
    ]);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('ClassSyncDepartments'),
      {
        limit: 500,
      },
    );
  });

  it('scopes department options to active student affairs posts', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      departments: [
        {
          departmentName: '信息工程系',
          id: 'ORG0302',
          isEnabled: true,
          shortName: null,
        },
      ],
      staffCurrentSlotPosts: [
        {
          id: 1,
          scope: {
            departmentId: 'ORG0302',
          },
          slotCode: 'STUDENT_AFFAIRS_OFFICER',
          status: 'ACTIVE',
        },
        {
          id: 2,
          scope: {
            departmentId: 'ORG0401',
          },
          slotCode: 'ACADEMIC_OFFICER',
          status: 'ACTIVE',
        },
      ],
    });

    await expect(
      fetchClassSyncDepartmentOptions({
        accountId: 42,
        viewerRole: 'studentAffairsOfficer',
      }),
    ).resolves.toEqual([
      {
        departmentName: '信息工程系',
        id: 'ORG0302',
        isEnabled: true,
        label: '信息工程系',
        shortName: null,
      },
    ]);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('ClassSyncStudentAffairsDepartmentScope'),
      {
        accountId: 42,
        limit: 500,
      },
    );
  });

  it('requests class list dry-run with normalized input and major context fields', async () => {
    const payload = {
      conflictCount: 1,
      createdCount: 1,
      departmentId: 'ORG0302',
      dryRun: true,
      existsCount: 1,
      expiresAt: '2026-05-19T12:00:00.000Z',
      fetchedCount: 4,
      items: [
        {
          action: 'CREATE',
          classId: '1031501',
          className: '信息1501班',
          conflictReason: null,
          departmentId: 'ORG0302',
          gradeYear: 2015,
          majorId: 'M0302001',
          majorName: '计算机网络应用',
          sortOrder: 15,
        },
        {
          action: 'SKIPPED_INVALID_UPSTREAM_GRADE',
          classId: '103AB01',
          className: '信息AB01班',
          conflictReason: 'INVALID_UPSTREAM_GRADE',
          departmentId: 'ORG0302',
          gradeYear: null,
          majorId: null,
          majorName: '计算机网络应用',
          sortOrder: null,
        },
      ],
      previewedCount: 3,
      skippedCount: 1,
      updatedCount: 1,
      upstreamSessionToken: 'rolling-token-002',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      dryRunSyncClassesFromUpstream: payload,
    });

    await expect(
      dryRunSyncClassesFromUpstream({
        departmentId: ' ORG0302 ',
        upstreamSessionToken: ' rolling-token-001 ',
      }),
    ).resolves.toEqual(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('DryRunSyncClassesFromUpstream');
    expect(query).toContain('dryRunSyncClassesFromUpstream');
    expect(query).toContain('previewedCount');
    expect(query).toContain('conflictCount');
    expect(query).toContain('classId');
    expect(query).toContain('majorId');
    expect(query).toContain('majorName');
    expect(query).toContain('gradeYear');
    expect(query).toContain('sortOrder');
    expect(query).toContain('conflictReason');
    expect(query).not.toContain('DryRunSyncClassesFromAnnualMajorClassList');
    expect(query).not.toContain('dryRunSyncClassesFromUpstreamDirectory');
    expect(query).not.toContain('annualMajorId');
    expect(query).not.toContain('classCode');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('DryRunSyncClassesFromUpstream'),
      {
        input: {
          departmentId: 'ORG0302',
          upstreamSessionToken: 'rolling-token-001',
        },
      },
    );
  });

  it('requests class directory dry-run with normalized input and preview fields', async () => {
    const payload = {
      conflictCount: 1,
      createdCount: 1,
      departmentId: 'ORG0302',
      dryRun: true,
      existsCount: 1,
      expiresAt: '2026-05-19T12:00:00.000Z',
      fetchedCount: 4,
      items: [
        {
          action: 'CREATE',
          classId: '1031501',
          className: '信息1501班',
          conflictReason: null,
          departmentId: 'ORG0302',
          gradeYear: 2015,
          majorId: '103',
          majorName: null,
          sortOrder: 15,
        },
        {
          action: 'CONFLICT',
          classId: '1031502',
          className: '信息1502班',
          conflictReason: 'classId 已被其他专业占用。',
          departmentId: 'ORG0302',
          gradeYear: 2015,
          majorId: null,
          majorName: null,
          sortOrder: 15,
        },
      ],
      previewedCount: 3,
      skippedCount: 1,
      updatedCount: 1,
      upstreamSessionToken: 'rolling-token-002',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      dryRunSyncClassesFromUpstreamDirectory: payload,
    });

    await expect(
      dryRunSyncClassesFromUpstreamDirectory({
        departmentId: ' ORG0302 ',
        upstreamSessionToken: ' rolling-token-001 ',
      }),
    ).resolves.toEqual(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('DryRunSyncClassesFromUpstreamDirectory');
    expect(query).toContain('dryRunSyncClassesFromUpstreamDirectory');
    expect(query).toContain('previewedCount');
    expect(query).toContain('conflictCount');
    expect(query).toContain('classId');
    expect(query).toContain('majorId');
    expect(query).toContain('majorName');
    expect(query).toContain('gradeYear');
    expect(query).toContain('sortOrder');
    expect(query).toContain('conflictReason');
    expect(query).not.toContain('DryRunSyncClassesFromAnnualMajorClassList');
    expect(query).not.toContain('annualMajorId');
    expect(query).not.toContain('classCode');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('DryRunSyncClassesFromUpstreamDirectory'),
      {
        input: {
          departmentId: 'ORG0302',
          upstreamSessionToken: 'rolling-token-001',
        },
      },
    );
  });

  it('requests class commit sync with normalized input and processed fields', async () => {
    const payload = {
      conflictCount: 1,
      createdCount: 1,
      departmentId: 'ORG0302',
      dryRun: false,
      existsCount: 1,
      expiresAt: '2026-05-19T12:00:00.000Z',
      fetchedCount: 4,
      items: [
        {
          action: 'CREATED',
          classId: '1031501',
          className: '信息1501班',
          conflictReason: null,
          departmentId: 'ORG0302',
          gradeYear: 2015,
          majorId: null,
          sortOrder: 15,
        },
        {
          action: 'CONFLICT',
          classId: '1031502',
          className: '信息1502班',
          conflictReason: 'classId 已被其他专业占用。',
          departmentId: 'ORG0302',
          gradeYear: 2015,
          majorId: null,
          sortOrder: 15,
        },
      ],
      processedCount: 3,
      skippedCount: 1,
      updatedCount: 1,
      upstreamSessionToken: 'rolling-token-003',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      syncClassesFromUpstream: payload,
    });

    await expect(
      syncClassesFromUpstream({
        departmentId: ' ORG0302 ',
        upstreamSessionToken: ' rolling-token-002 ',
      }),
    ).resolves.toEqual(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('SyncClassesFromUpstream');
    expect(query).toContain('syncClassesFromUpstream');
    expect(query).toContain('processedCount');
    expect(query).toContain('conflictCount');
    expect(query).toContain('classId');
    expect(query).toContain('gradeYear');
    expect(query).toContain('sortOrder');
    expect(query).toContain('conflictReason');
    expect(query).not.toContain('previewedCount');
    expect(query).not.toContain('annualMajorId');
    expect(query).not.toContain('classCode');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('SyncClassesFromUpstream'),
      {
        input: {
          departmentId: 'ORG0302',
          upstreamSessionToken: 'rolling-token-002',
        },
      },
    );
  });

  it('rejects class dry-run without a department id or upstream token', async () => {
    await expect(
      dryRunSyncClassesFromUpstream({
        departmentId: ' ',
        upstreamSessionToken: 'rolling-token-001',
      }),
    ).rejects.toThrow('请输入系部。');

    await expect(
      dryRunSyncClassesFromUpstream({
        departmentId: 'ORG0302',
        upstreamSessionToken: ' ',
      }),
    ).rejects.toThrow('upstreamSessionToken 为必填。');

    expect(executeGraphQLMock).not.toHaveBeenCalled();
  });
});
