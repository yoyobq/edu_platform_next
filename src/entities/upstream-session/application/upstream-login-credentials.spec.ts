import { describe, expect, it } from 'vitest';

import {
  buildUpstreamLoginCredentialsInitialValues,
  canUseRememberedUpstreamLoginCredentials,
  canUseStoredUpstreamSessionForLockedUser,
} from './upstream-login-credentials';

describe('buildUpstreamLoginCredentialsInitialValues', () => {
  it('does not reuse a remembered password when locked staff id differs', () => {
    expect(
      buildUpstreamLoginCredentialsInitialValues({
        lockedUserId: 'staff-002',
        rememberedCredentials: {
          password: 'alice-password',
          rememberCredentials: true,
          userId: 'staff-001',
        },
      }),
    ).toEqual({
      password: '',
      rememberCredentials: false,
      userId: 'staff-002',
    });
  });

  it('reuses remembered credentials when locked staff id matches', () => {
    expect(
      buildUpstreamLoginCredentialsInitialValues({
        lockedUserId: 'staff-001',
        rememberedCredentials: {
          password: 'alice-password',
          rememberCredentials: true,
          userId: 'staff-001',
        },
      }),
    ).toEqual({
      password: 'alice-password',
      rememberCredentials: true,
      userId: 'staff-001',
    });
  });

  it('reports remembered credentials as unusable when locked staff id differs', () => {
    expect(
      canUseRememberedUpstreamLoginCredentials({
        lockedUserId: 'staff-002',
        rememberedCredentials: {
          password: 'alice-password',
          rememberCredentials: true,
          userId: 'staff-001',
        },
      }),
    ).toBe(false);
  });

  it('reports remembered credentials as usable without a locked staff id', () => {
    expect(
      canUseRememberedUpstreamLoginCredentials({
        rememberedCredentials: {
          password: 'alice-password',
          rememberCredentials: true,
          userId: 'staff-001',
        },
      }),
    ).toBe(true);
  });

  it('rejects stored upstream sessions when locked staff id differs', () => {
    expect(
      canUseStoredUpstreamSessionForLockedUser({
        lockedUserId: 'staff-002',
        session: {
          upstreamLoginId: 'staff-001',
        },
      }),
    ).toBe(false);
  });

  it('accepts stored upstream sessions when locked staff id matches', () => {
    expect(
      canUseStoredUpstreamSessionForLockedUser({
        lockedUserId: 'staff-001',
        session: {
          upstreamLoginId: 'staff-001',
        },
      }),
    ).toBe(true);
  });
});
