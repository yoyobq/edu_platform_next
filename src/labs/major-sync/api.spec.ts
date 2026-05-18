// src/labs/major-sync/api.spec.ts

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
  dryRunSyncMajorsFromUpstream,
  fetchCurrentMajorSyncAccount,
  fetchMajorSyncDepartmentOptions,
  syncMajorsFromUpstream,
} from './api';

describe('major-sync api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
  });

  it('maps the current account into the major sync viewer role', async () => {
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

    await expect(fetchCurrentMajorSyncAccount()).resolves.toEqual({
      accessGroup: ['STAFF'],
      accountId: 42,
      displayName: '王老师',
      staffId: 'STAFF-001',
      viewerRole: 'studentAffairsOfficer',
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('MajorSyncCurrentAccount'),
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
      fetchMajorSyncDepartmentOptions({
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
      expect.stringContaining('MajorSyncDepartments'),
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
            departmentId: 'ORG0302',
          },
          slotCode: 'STUDENT_AFFAIRS_OFFICER',
          status: 'ACTIVE',
        },
        {
          id: 3,
          scope: {
            departmentId: 'ORG0401',
          },
          slotCode: 'ACADEMIC_OFFICER',
          status: 'ACTIVE',
        },
      ],
    });

    await expect(
      fetchMajorSyncDepartmentOptions({
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
      expect.stringContaining('MajorSyncStudentAffairsDepartmentScope'),
      {
        accountId: 42,
        limit: 500,
      },
    );
  });

  it('requests dry-run sync with normalized input and preview fields', async () => {
    const payload = {
      createdCount: 1,
      departmentId: 'ORG0302',
      dryRun: true,
      existsCount: 1,
      expiresAt: '2026-05-18T12:00:00.000Z',
      fetchedCount: 3,
      items: [
        {
          action: 'UPDATE',
          departmentId: 'ORG0302',
          majorId: 'major-001',
          majorName: '计算机游戏制作（5高级）',
          shortName: '计算机游戏制作',
          trainingLevel: '高级',
          trainingYears: 5,
        },
      ],
      previewedCount: 2,
      skippedCount: 1,
      updatedCount: 1,
      upstreamSessionToken: 'rolling-token-002',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      dryRunSyncMajorsFromUpstream: payload,
    });

    await expect(
      dryRunSyncMajorsFromUpstream({
        departmentId: ' ORG0302 ',
        upstreamSessionToken: ' rolling-token-001 ',
      }),
    ).resolves.toEqual(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('DryRunSyncMajorsFromUpstream');
    expect(query).toContain('dryRunSyncMajorsFromUpstream');
    expect(query).toContain('previewedCount');
    expect(query).toContain('updatedCount');
    expect(query).toContain('shortName');
    expect(query).toContain('trainingYears');
    expect(query).toContain('trainingLevel');
    expect(query).not.toContain('annualMajorId');
    expect(query).not.toContain('code');
    expect(query).not.toContain('value');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('DryRunSyncMajorsFromUpstream'),
      {
        input: {
          departmentId: 'ORG0302',
          upstreamSessionToken: 'rolling-token-001',
        },
      },
    );
  });

  it('requests commit sync with the new result fields', async () => {
    const payload = {
      createdCount: 1,
      departmentId: 'ORG0302',
      dryRun: false,
      existsCount: 1,
      expiresAt: '2026-05-18T12:00:00.000Z',
      fetchedCount: 3,
      items: [
        {
          action: 'UPDATED',
          departmentId: 'ORG0302',
          majorId: 'major-001',
          majorName: '计算机游戏制作（5高级）',
          shortName: '计算机游戏制作',
          trainingLevel: '高级',
          trainingYears: 5,
        },
        {
          action: 'CREATED',
          departmentId: 'ORG0302',
          majorId: 'major-002',
          majorName: '数字媒体技术',
          shortName: null,
          trainingLevel: null,
          trainingYears: null,
        },
      ],
      processedCount: 3,
      skippedCount: 0,
      updatedCount: 1,
      upstreamSessionToken: 'rolling-token-003',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      syncMajorsFromUpstream: payload,
    });

    await expect(
      syncMajorsFromUpstream({
        departmentId: ' ORG0302 ',
        upstreamSessionToken: ' rolling-token-002 ',
      }),
    ).resolves.toEqual(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('SyncMajorsFromUpstream');
    expect(query).toContain('syncMajorsFromUpstream');
    expect(query).toContain('dryRun');
    expect(query).toContain('processedCount');
    expect(query).toContain('updatedCount');
    expect(query).toContain('shortName');
    expect(query).toContain('trainingYears');
    expect(query).toContain('trainingLevel');
    expect(query).not.toContain('previewedCount');
    expect(query).not.toContain('annualMajorId');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('SyncMajorsFromUpstream'),
      {
        input: {
          departmentId: 'ORG0302',
          upstreamSessionToken: 'rolling-token-002',
        },
      },
    );
  });

  it('rejects dry-run sync without a department id or upstream token', async () => {
    await expect(
      dryRunSyncMajorsFromUpstream({
        departmentId: ' ',
        upstreamSessionToken: 'rolling-token-001',
      }),
    ).rejects.toThrow('请输入系部。');

    await expect(
      dryRunSyncMajorsFromUpstream({
        departmentId: 'ORG0302',
        upstreamSessionToken: ' ',
      }),
    ).rejects.toThrow('upstreamSessionToken 为必填。');

    expect(executeGraphQLMock).not.toHaveBeenCalled();
  });
});
