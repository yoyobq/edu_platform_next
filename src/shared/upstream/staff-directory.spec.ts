import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import {
  populateStaffDirectory,
  readStaffDirectory,
  readVerifiedStaffIdentity,
  resolveStaffDirectoryEntries,
} from './staff-directory';

describe('staff directory shared api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
  });

  it('reads staff directory cache with the expected query shape', async () => {
    const payload = {
      cacheExpiresAt: '2026-05-01T10:30:00.000Z',
      cacheStatus: 'FRESH',
      fetchedAt: '2026-05-01T10:00:00.000Z',
      teacherCount: 1,
      teachers: [{ name: '龚晶晶', staffId: '3664' }],
    };

    executeGraphQLMock.mockResolvedValueOnce({
      staffDirectory: payload,
    });

    await expect(readStaffDirectory()).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query StaffDirectory'),
      {},
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('teacherCount');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('teachers');
  });

  it('populates staff directory cache with the current upstream session token', async () => {
    const payload = {
      cacheExpiresAt: '2026-05-01T10:30:00.000Z',
      cacheStatus: 'FRESH',
      expiresAt: '2026-05-01T12:00:00.000Z',
      fetchedAt: '2026-05-01T10:00:00.000Z',
      teacherCount: 1,
      teachers: [{ name: '龚晶晶', staffId: '3664' }],
      upstreamSessionToken: 'rolling-token-002',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      populateStaffDirectory: payload,
    });

    await expect(
      populateStaffDirectory({
        sessionToken: ' rolling-token-001 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation PopulateStaffDirectory'),
      {
        input: {
          forceRefresh: false,
          sessionToken: 'rolling-token-001',
        },
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('upstreamSessionToken');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('expiresAt');
  });

  it('resolves staff directory entries without expanding caller input beyond normalized ids', async () => {
    const payload = {
      cacheExpiresAt: '2026-05-01T10:30:00.000Z',
      cacheStatus: 'STALE',
      entries: [{ name: '龚晶晶', staffId: '3664' }],
      fetchedAt: '2026-05-01T10:00:00.000Z',
      missingStaffIds: ['3663'],
    };

    executeGraphQLMock.mockResolvedValueOnce({
      staffDirectoryEntries: payload,
    });

    await expect(resolveStaffDirectoryEntries([' 3664 ', '', ' 3663 '])).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query StaffDirectoryEntries'),
      {
        staffIds: ['3664', '3663'],
      },
    );
  });

  it('rejects staff directory entry resolution over the backend batch limit', async () => {
    await expect(
      resolveStaffDirectoryEntries(Array.from({ length: 801 }, (_, index) => String(index + 1))),
    ).rejects.toThrow('staffIds 最多支持 800 项。');

    expect(executeGraphQLMock).not.toHaveBeenCalled();
  });

  it('reads verified staff identity with the current upstream session token', async () => {
    const payload = {
      departmentName: '人工智能系',
      expiresAt: '2026-05-01T12:00:00.000Z',
      identityKind: 'STAFF',
      orgId: 'ORG0302',
      personId: '3664',
      personName: '龚晶晶',
      upstreamLoginId: 'teacher001',
      upstreamSessionToken: 'rolling-token-002',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      fetchVerifiedStaffIdentity: payload,
    });

    await expect(
      readVerifiedStaffIdentity({
        sessionToken: ' rolling-token-001 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query FetchVerifiedStaffIdentity'),
      {
        sessionToken: 'rolling-token-001',
      },
    );
  });
});
