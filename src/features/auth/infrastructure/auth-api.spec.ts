// src/features/auth/infrastructure/auth-api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import { authApi } from './auth-api';

describe('authApi logout', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
  });

  it('sends Logout mutation with the current access token and disables auth retry', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      logout: {
        success: true,
      },
    });

    await expect(authApi.logout({ accessToken: 'current-access-token' })).resolves.toBeUndefined();

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation Logout'),
      {},
      expect.objectContaining({
        accessToken: 'current-access-token',
        allowAuthRetry: false,
      }),
    );
    expect(executeGraphQLMock.mock.calls[0]?.[2]?.authMode).toBeUndefined();
  });

  it('rejects when backend reports unsuccessful logout', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      logout: {
        success: false,
      },
    });

    await expect(authApi.logout({ accessToken: 'current-access-token' })).rejects.toThrow(
      '退出登录未成功。',
    );
  });
});
