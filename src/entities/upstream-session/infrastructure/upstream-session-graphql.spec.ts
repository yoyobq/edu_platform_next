// src/entities/upstream-session/infrastructure/upstream-session-graphql.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import { executeUpstreamSessionGraphQL } from './upstream-session-graphql';

describe('executeUpstreamSessionGraphQL', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
  });

  it('keeps site auth refresh but prevents upstream auth retry from forcing local logout', async () => {
    executeGraphQLMock.mockResolvedValueOnce({ ok: true });

    await expect(
      executeUpstreamSessionGraphQL(
        'query UpstreamProxy($sessionToken: String!) { upstream(sessionToken: $sessionToken) }',
        {
          sessionToken: 'upstream-token-001',
        },
      ),
    ).resolves.toEqual({ ok: true });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('UpstreamProxy'),
      {
        sessionToken: 'upstream-token-001',
      },
      {
        logoutOnRetryAuthFailure: false,
      },
    );
  });

  it('preserves explicit request options while keeping the upstream logout boundary', async () => {
    executeGraphQLMock.mockResolvedValueOnce({ ok: true });

    await executeUpstreamSessionGraphQL(
      'query PublicUpstreamProxy { upstream }',
      {},
      {
        authMode: 'none',
        fetchPolicy: 'no-cache',
      },
    );

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('PublicUpstreamProxy'),
      {},
      {
        authMode: 'none',
        fetchPolicy: 'no-cache',
        logoutOnRetryAuthFailure: false,
      },
    );
  });
});
