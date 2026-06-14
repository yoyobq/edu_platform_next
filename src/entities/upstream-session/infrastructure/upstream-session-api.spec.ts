import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import { requestUpstreamLoginSession, requestUpstreamSessionRefresh } from './upstream-session-api';

describe('upstream-session api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
  });

  it('requests an upstream login session', async () => {
    const payload = {
      expiresAt: '2026-04-30T13:00:00.000Z',
      upstreamSessionToken: 'token-002',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      loginUpstreamSession: payload,
    });

    await expect(
      requestUpstreamLoginSession({
        password: 'secret',
        userId: 'teacher001',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('LoginUpstreamSession'),
      {
        input: {
          password: 'secret',
          userId: 'teacher001',
        },
      },
      {
        allowAuthRetry: false,
      },
    );
  });

  it('refreshes the current upstream session with the opaque token', async () => {
    const payload = {
      expiresAt: '2026-04-30T13:30:00.000Z',
      upstreamSessionToken: 'token-003',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      refreshUpstreamSession: payload,
    });

    await expect(
      requestUpstreamSessionRefresh({
        sessionToken: 'token-002',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('RefreshUpstreamSession'),
      {
        input: {
          sessionToken: 'token-002',
        },
      },
      {
        allowAuthRetry: false,
      },
    );
  });
});
