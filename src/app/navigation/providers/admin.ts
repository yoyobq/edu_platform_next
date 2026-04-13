import type { NavigationItemsProvider } from '../types';

const ADMIN_NAVIGATION_ITEMS = [
  {
    iconKey: 'TeamOutlined',
    key: '/admin/users',
    label: '用户管理',
    navMode: 'rail',
    path: '/admin/users',
    primaryAccessGroup: 'ADMIN',
    slotGroup: null,
  },
] as const;

export const getAdminNavigationItems: NavigationItemsProvider = () => ADMIN_NAVIGATION_ITEMS;
