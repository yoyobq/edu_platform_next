import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveLectureJournalStaffDirectory } from './staff-directory-cache-workflow';

describe('academic-teaching-log staff directory cache workflow', () => {
  const session = {
    accountId: 1,
    expiresAt: '2026-05-01T12:00:00.000Z',
    upstreamLoginId: 'admin001',
    upstreamSessionToken: 'token-001',
    version: 2 as const,
  };

  const freshDirectory = {
    cacheExpiresAt: '2026-05-01T10:30:00.000Z',
    cacheStatus: 'FRESH' as const,
    fetchedAt: '2026-05-01T10:00:00.000Z',
    teacherCount: 1,
    teachers: [{ name: '龚晶晶', staffId: '3664' }],
  };

  const missDirectory = {
    cacheExpiresAt: null,
    cacheStatus: 'MISS' as const,
    fetchedAt: null,
    teacherCount: 0,
    teachers: [],
  };

  const populatedDirectory = {
    cacheExpiresAt: '2026-05-01T10:30:00.000Z',
    cacheStatus: 'FRESH' as const,
    expiresAt: '2026-05-01T12:30:00.000Z',
    fetchedAt: '2026-05-01T10:00:00.000Z',
    teacherCount: 1,
    teachers: [{ name: '龚晶晶', staffId: '3664' }],
    upstreamSessionToken: 'token-002',
  };

  const persistSessionFromResult = vi.fn((currentSession, result) => ({
    ...currentSession,
    expiresAt: result.expiresAt ?? currentSession.expiresAt,
    upstreamSessionToken: result.upstreamSessionToken ?? currentSession.upstreamSessionToken,
  }));
  const populateStaffDirectoryFn = vi.fn();
  const readStaffDirectoryFn = vi.fn();

  beforeEach(() => {
    persistSessionFromResult.mockReset();
    populateStaffDirectoryFn.mockReset();
    readStaffDirectoryFn.mockReset();
  });

  it('uses fresh or stale cache for admins without populating', async () => {
    await expect(
      resolveLectureJournalStaffDirectory({
        currentDirectory: freshDirectory,
        persistSessionFromResult,
        populateStaffDirectoryFn,
        readStaffDirectoryFn,
        session,
        viewerRole: 'admin',
      }),
    ).resolves.toEqual({
      didPopulate: false,
      directory: freshDirectory,
      session,
    });

    expect(readStaffDirectoryFn).not.toHaveBeenCalled();
    expect(populateStaffDirectoryFn).not.toHaveBeenCalled();
    expect(persistSessionFromResult).not.toHaveBeenCalled();
  });

  it('auto populates admin MISS cache with an existing token and persists rolling token', async () => {
    readStaffDirectoryFn.mockResolvedValueOnce(missDirectory);
    populateStaffDirectoryFn.mockResolvedValueOnce(populatedDirectory);

    await expect(
      resolveLectureJournalStaffDirectory({
        persistSessionFromResult,
        populateStaffDirectoryFn,
        readStaffDirectoryFn,
        session,
        viewerRole: 'admin',
      }),
    ).resolves.toEqual({
      didPopulate: true,
      directory: populatedDirectory,
      session: {
        ...session,
        expiresAt: '2026-05-01T12:30:00.000Z',
        upstreamSessionToken: 'token-002',
      },
    });

    expect(readStaffDirectoryFn).toHaveBeenCalledTimes(1);
    expect(populateStaffDirectoryFn).toHaveBeenCalledWith({
      sessionToken: 'token-001',
    });
    expect(persistSessionFromResult).toHaveBeenCalledWith(session, populatedDirectory);
  });

  it('does not prompt or populate when admin cache is MISS but there is no token', async () => {
    readStaffDirectoryFn.mockResolvedValueOnce(missDirectory);

    await expect(
      resolveLectureJournalStaffDirectory({
        persistSessionFromResult,
        populateStaffDirectoryFn,
        readStaffDirectoryFn,
        session: null,
        viewerRole: 'admin',
      }),
    ).resolves.toEqual({
      didPopulate: false,
      directory: missDirectory,
      session: null,
    });

    expect(populateStaffDirectoryFn).not.toHaveBeenCalled();
    expect(persistSessionFromResult).not.toHaveBeenCalled();
  });

  it('skips populate for staff users even after login', async () => {
    await expect(
      resolveLectureJournalStaffDirectory({
        currentDirectory: missDirectory,
        persistSessionFromResult,
        populateStaffDirectoryFn,
        readStaffDirectoryFn,
        session,
        viewerRole: 'staff',
      }),
    ).resolves.toEqual({
      didPopulate: false,
      directory: missDirectory,
      session,
    });

    expect(readStaffDirectoryFn).not.toHaveBeenCalled();
    expect(populateStaffDirectoryFn).not.toHaveBeenCalled();
    expect(persistSessionFromResult).not.toHaveBeenCalled();
  });

  it('propagates populate failures for the page to surface as directory-only errors', async () => {
    readStaffDirectoryFn.mockResolvedValueOnce(missDirectory);
    populateStaffDirectoryFn.mockRejectedValueOnce(new Error('populate failed'));

    await expect(
      resolveLectureJournalStaffDirectory({
        persistSessionFromResult,
        populateStaffDirectoryFn,
        readStaffDirectoryFn,
        session,
        viewerRole: 'admin',
      }),
    ).rejects.toThrow('populate failed');

    expect(persistSessionFromResult).not.toHaveBeenCalled();
  });
});
