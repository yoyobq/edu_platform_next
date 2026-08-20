import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clearStoreMock, markExplicitLogoutMock, runLogoutMock } = vi.hoisted(() => ({
  clearStoreMock: vi.fn<() => Promise<void>>(),
  markExplicitLogoutMock: vi.fn(),
  runLogoutMock: vi.fn<() => Promise<void>>(),
}));

vi.mock('@/shared/graphql', () => ({
  getGraphQLClient: () => ({ clearStore: clearStoreMock }),
}));

vi.mock('./application/logout', () => ({
  clearLocalAuthSession: vi.fn(),
  logout: runLogoutMock,
  revokeAuthSessionBestEffort: vi.fn(),
}));

vi.mock('./infrastructure/auth-api', () => ({ authApi: {} }));
vi.mock('./infrastructure/auth-storage', () => ({ authStorage: {} }));
vi.mock('./infrastructure/explicit-logout-redirect', () => ({
  consumeExplicitLogoutRedirectHome: vi.fn(),
  markExplicitLogoutRedirectHome: markExplicitLogoutMock,
}));
vi.mock('./ui/login-form', () => ({ LoginForm: vi.fn() }));

import { logout } from './index';

describe('auth feature logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runLogoutMock.mockResolvedValue(undefined);
    clearStoreMock.mockResolvedValue(undefined);
  });

  it('marks explicit logout, clears the local session, and disposes the Apollo cache', async () => {
    await expect(logout()).resolves.toBeUndefined();

    expect(markExplicitLogoutMock).toHaveBeenCalledTimes(1);
    expect(runLogoutMock).toHaveBeenCalledTimes(1);
    expect(clearStoreMock).toHaveBeenCalledTimes(1);
  });

  it('does not fail explicit logout when Apollo cache disposal fails', async () => {
    clearStoreMock.mockRejectedValueOnce(new Error('cache disposal failed'));

    await expect(logout()).resolves.toBeUndefined();

    expect(runLogoutMock).toHaveBeenCalledTimes(1);
    expect(clearStoreMock).toHaveBeenCalledTimes(1);
  });
});
