import type { AuthAccessGroup } from '@/features/auth';

import type { NavigationItemsProvider } from '../types';

function hasAdminNavigationAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  return input.accessGroup?.includes('ADMIN') ?? false;
}

export function hasPayloadCryptoNavigationAccess(input: {
  accountId?: number;
  accessGroup?: readonly AuthAccessGroup[];
}) {
  const isSpecificAdmin = input.accountId === 1 || input.accountId === 2;
  const hasAdminAccess = hasAdminNavigationAccess({
    accessGroup: input.accessGroup,
  });

  return isSpecificAdmin && hasAdminAccess;
}

export const getLabsNavigationItems: NavigationItemsProvider = (filter) => {
  const children = [
    ...(hasPayloadCryptoNavigationAccess({
      accountId: filter.accountId,
      accessGroup: filter.accessGroup,
    })
      ? [
          {
            iconKey: 'LockOutlined',
            key: '/labs/payload-crypto',
            label: '载荷加解密',
            navMode: 'rail' as const,
            path: '/labs/payload-crypto',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
        ]
      : []),
    {
      iconKey: 'SendOutlined',
      key: '/labs/invite-issuer',
      label: '邀请管理',
      navMode: 'rail' as const,
      path: '/labs/invite-issuer',
      primaryAccessGroup: 'ADMIN' as const,
      slotGroup: null,
    },
  ];

  if (children.length === 0) {
    return [];
  }

  return [
    {
      children,
      iconKey: 'ExperimentOutlined',
      key: 'labs',
      label: 'Labs',
      navMode: 'rail',
      path: '/labs',
      primaryAccessGroup: 'ADMIN',
      slotGroup: null,
    },
  ];
};
