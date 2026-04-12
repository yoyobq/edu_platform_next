import { describe, expect, it, vi } from 'vitest';

import {
  isAdminUserDetailIdentityHintAllowed,
  updateAdminUserDetailAccountSection,
} from './update-admin-user-detail-sections';

describe('updateAdminUserDetailAccountSection', () => {
  it('rejects ADMIN identityHint when accessGroup does not include ADMIN', async () => {
    const port = {
      updateAccountSection: vi.fn(),
    };

    await expect(
      updateAdminUserDetailAccountSection(port, {
        accessGroup: ['STAFF'],
        accountId: 1001,
        identityHint: 'ADMIN',
        status: 'ACTIVE',
      }),
    ).rejects.toThrow('当前访问组不含 ADMIN，身份提示不能设为 ADMIN。');

    expect(port.updateAccountSection).not.toHaveBeenCalled();
  });

  it('forwards allowed identityHint updates to the port', async () => {
    const port = {
      updateAccountSection: vi.fn().mockResolvedValue({
        account: {
          identityHint: 'ADMIN',
          status: 'ACTIVE',
          updatedAt: '2026-04-12T00:00:00.000Z',
        },
        isUpdated: true,
      }),
    };

    await expect(
      updateAdminUserDetailAccountSection(port, {
        accessGroup: ['ADMIN', 'STAFF'],
        accountId: 1001,
        identityHint: 'ADMIN',
        status: 'ACTIVE',
      }),
    ).resolves.toEqual({
      account: {
        identityHint: 'ADMIN',
        status: 'ACTIVE',
        updatedAt: '2026-04-12T00:00:00.000Z',
      },
      isUpdated: true,
    });

    expect(port.updateAccountSection).toHaveBeenCalledWith({
      accountId: 1001,
      identityHint: 'ADMIN',
      status: 'ACTIVE',
    });
  });
});

describe('isAdminUserDetailIdentityHintAllowed', () => {
  it('allows STAFF and STUDENT without ADMIN accessGroup', () => {
    expect(isAdminUserDetailIdentityHintAllowed(['STAFF'], 'STAFF')).toBe(true);
    expect(isAdminUserDetailIdentityHintAllowed(['GUEST'], 'STUDENT')).toBe(true);
  });
});
