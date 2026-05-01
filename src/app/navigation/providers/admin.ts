import { canAccessPayloadCrypto } from '@/features/payload-crypto';

import type { NavigationItemsProvider } from '../types';

const USER_MANAGEMENT_NAVIGATION_ITEM = {
  iconKey: 'TeamOutlined',
  key: '/admin/users',
  label: '用户管理',
  navMode: 'rail',
  path: '/admin/users',
  primaryAccessGroup: 'ADMIN',
  slotGroup: null,
} as const;

const PAYLOAD_CRYPTO_NAVIGATION_ITEM = {
  iconKey: 'LockOutlined',
  key: '/system/payload-crypto',
  label: '载荷加解密',
  navMode: 'rail',
  path: '/system/payload-crypto',
  primaryAccessGroup: 'ADMIN',
  slotGroup: null,
} as const;

export const getAdminNavigationItems: NavigationItemsProvider = (filter) => {
  const children = [
    USER_MANAGEMENT_NAVIGATION_ITEM,
    ...(canAccessPayloadCrypto({
      accountId: filter.accountId,
      userInfo: {
        accessGroup: filter.accessGroup,
      },
    })
      ? [PAYLOAD_CRYPTO_NAVIGATION_ITEM]
      : []),
  ];

  return [
    {
      allowedAccessGroups: ['ADMIN'],
      children,
      iconKey: 'SettingOutlined',
      key: 'system-management',
      label: '系统管理',
      navMode: 'rail',
    },
  ];
};
