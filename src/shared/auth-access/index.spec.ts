import { describe, expect, it } from 'vitest';

import { AUTH_ACCESS_GROUPS, isAuthAccessGroup } from './index';

describe('auth access primitives', () => {
  it('recognizes known auth access groups', () => {
    expect(AUTH_ACCESS_GROUPS).toEqual(['ADMIN', 'GUEST', 'REGISTRANT', 'STAFF', 'STUDENT']);
    expect(isAuthAccessGroup('ADMIN')).toBe(true);
    expect(isAuthAccessGroup('STAFF')).toBe(true);
    expect(isAuthAccessGroup('UNKNOWN')).toBe(false);
  });
});
