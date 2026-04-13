import type { NavigationItemsProvider } from '../types';

const ERROR_NAVIGATION_ITEMS = [
  {
    iconKey: 'WarningOutlined',
    key: '/errors/preview',
    label: '异常预览',
    navMode: 'rail',
    path: '/errors/preview',
    primaryAccessGroup: 'ADMIN',
    allowedAccessGroups: ['ADMIN', 'GUEST'],
    slotGroup: null,
    localEntry: {
      description: '预览系统内各类异常状态页面，检查 403 / 404 / 500 与路由崩溃的展示效果。',
      keywords: ['error', '异常', '异常页', '异常预览', '403', '404', '500', 'crash', '预览'],
    },
  },
] as const;

export const getErrorNavigationItems: NavigationItemsProvider = () => ERROR_NAVIGATION_ITEMS;
