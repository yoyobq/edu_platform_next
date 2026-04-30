import { describe, expect, it } from 'vitest';

import { hasRollingUpstreamSessionResult } from './upstream-session-rolling';

describe('upstream session rolling policy', () => {
  it('accepts results with both upstream token and expiresAt', () => {
    expect(
      hasRollingUpstreamSessionResult({
        expiresAt: '2026-04-30T13:00:00.000Z',
        upstreamSessionToken: 'token-002',
      }),
    ).toBe(true);
  });

  it('ignores partial rolling session results', () => {
    expect(
      hasRollingUpstreamSessionResult({
        expiresAt: null,
        upstreamSessionToken: 'token-002',
      }),
    ).toBe(false);
    expect(
      hasRollingUpstreamSessionResult({
        expiresAt: '2026-04-30T13:00:00.000Z',
        upstreamSessionToken: null,
      }),
    ).toBe(false);
  });
});
