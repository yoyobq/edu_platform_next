import type { NavigationItemsProvider } from '../types';

const ADMIN_NAVIGATION_ITEMS = [
  {
    allowedAccessGroups: ['ADMIN'],
    children: [
      {
        iconKey: 'TeamOutlined',
        key: '/admin/users',
        label: '用户管理',
        navMode: 'rail',
        path: '/admin/users',
        primaryAccessGroup: 'ADMIN',
        slotGroup: null,
      },
    ],
    iconKey: 'SettingOutlined',
    key: 'system-management',
    label: '系统管理',
    navMode: 'rail',
  },
] as const;

export const getAdminNavigationItems: NavigationItemsProvider = () => ADMIN_NAVIGATION_ITEMS;
