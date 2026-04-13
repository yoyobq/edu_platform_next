import type { NavigationItemsProvider } from '../types';

const HOME_NAVIGATION_ITEMS = [
  {
    iconKey: 'HomeOutlined',
    key: '/',
    label: '首页',
    navMode: 'rail',
    path: '/',
    primaryAccessGroup: 'ADMIN',
    allowedAccessGroups: ['ADMIN', 'GUEST'],
    slotGroup: null,
    localEntry: {
      description: '返回当前默认工作台首页，查看状态概览、主动作入口与最近上下文。',
      keywords: ['home', 'index', '默认工作台', '状态概览', '首页'],
    },
  },
] as const;

export const getHomeNavigationItems: NavigationItemsProvider = () => HOME_NAVIGATION_ITEMS;
