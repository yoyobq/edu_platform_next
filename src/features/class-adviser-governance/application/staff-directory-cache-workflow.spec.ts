// src/features/class-adviser-governance/application/staff-directory-cache-workflow.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveClassAdviserGovernanceStaffDirectory } from './staff-directory-cache-workflow';

describe('class adviser governance staff directory cache workflow', () => {
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
    teachers: [{ name: '张老师', staffId: 'T1001' }],
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
    teachers: [{ name: '张老师', staffId: 'T1001' }],
    upstreamSessionToken: 'token-002',
  };

  const persistSessionFromResult = vi.fn((currentSession, result) => ({
    ...currentSession,
    expiresAt: result.expiresAt ?? currentSession.expiresAt,
    upstreamSessionToken: result.upstreamSessionToken ?? currentSession.upstreamSessionToken,
  }));
  const populateStaffDirectoryFn = vi.fn();

  beforeEach(() => {
    persistSessionFromResult.mockReset();
    populateStaffDirectoryFn.mockReset();
  });

  it('uses fresh cache without populating', async () => {
    await expect(
      resolveClassAdviserGovernanceStaffDirectory({
        currentDirectory: freshDirectory,
        persistSessionFromResult,
        populateStaffDirectoryFn,
        session,
      }),
    ).resolves.toEqual({
      didPopulate: false,
      directory: freshDirectory,
      session,
    });

    expect(populateStaffDirectoryFn).not.toHaveBeenCalled();
    expect(persistSessionFromResult).not.toHaveBeenCalled();
  });

  it('populates MISS cache when an upstream session is available', async () => {
    populateStaffDirectoryFn.mockResolvedValueOnce(populatedDirectory);

    await expect(
      resolveClassAdviserGovernanceStaffDirectory({
        currentDirectory: missDirectory,
        persistSessionFromResult,
        populateStaffDirectoryFn,
        session,
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

    expect(populateStaffDirectoryFn).toHaveBeenCalledWith({
      upstreamSessionToken: 'token-001',
    });
    expect(persistSessionFromResult).toHaveBeenCalledWith(session, populatedDirectory);
  });

  it('allows MISS cache without upstream session so manual staff id entry can continue', async () => {
    await expect(
      resolveClassAdviserGovernanceStaffDirectory({
        currentDirectory: missDirectory,
        persistSessionFromResult,
        populateStaffDirectoryFn,
        session: null,
      }),
    ).resolves.toEqual({
      didPopulate: false,
      directory: missDirectory,
      session: null,
    });

    expect(populateStaffDirectoryFn).not.toHaveBeenCalled();
  });

  it('force refreshes directory when requested', async () => {
    populateStaffDirectoryFn.mockResolvedValueOnce(populatedDirectory);

    await expect(
      resolveClassAdviserGovernanceStaffDirectory({
        forceRefresh: true,
        persistSessionFromResult,
        populateStaffDirectoryFn,
        session,
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

    expect(populateStaffDirectoryFn).toHaveBeenCalledWith({
      forceRefresh: true,
      upstreamSessionToken: 'token-001',
    });
  });
});
