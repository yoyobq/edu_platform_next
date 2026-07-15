// src/app/lib/collaboration-url.spec.ts

import { describe, expect, it } from 'vitest';

import { readCollaborationAvailability, withCollaborationSearch } from './collaboration-url';

describe('collaboration url', () => {
  it('reads only supported collaboration availability values', () => {
    expect(readCollaborationAvailability('?availability=readonly')).toBe('readonly');
    expect(readCollaborationAvailability('?availability=offline')).toBeNull();
    expect(readCollaborationAvailability('?debug=1')).toBeNull();
  });

  it('keeps valid app-level availability search across stable links', () => {
    expect(
      withCollaborationSearch(
        '/admin/users',
        '?availability=degraded&workspaceDemo=artifact-release-brief&debug=1',
      ),
    ).toBe('/admin/users?availability=degraded');
  });

  it('drops unknown search params and invalid availability values', () => {
    expect(withCollaborationSearch('/admin/users', '?availability=offline')).toBe('/admin/users');
    expect(withCollaborationSearch('/admin/users', '?workspaceDemo=artifact-release-brief')).toBe(
      '/admin/users',
    );
  });
});
