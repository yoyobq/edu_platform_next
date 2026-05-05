import type { NavigationItemsProvider } from '../types';

const HOME_ALLOWED_ACCESS_GROUPS = ['ADMIN', 'GUEST', 'REGISTRANT', 'STAFF', 'STUDENT'] as const;

const HOME_NAVIGATION_ITEMS = [
  {
    iconKey: 'HomeOutlined',
    key: '/',
    label: '首页',
    navMode: 'rail',
    path: '/',
    primaryAccessGroup: 'ADMIN',
    allowedAccessGroups: HOME_ALLOWED_ACCESS_GROUPS,
    slotGroup: null,
    localEntry: {
      description: '返回我的工作台首页，查看当前可用工作内容。',
      keywords: ['home', 'index', '我的工作台', '周课表', '首页'],
    },
  },
] as const;

export const getHomeNavigationItems: NavigationItemsProvider = () => HOME_NAVIGATION_ITEMS;
