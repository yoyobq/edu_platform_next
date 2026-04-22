import type { NavigationItemsProvider } from '../types';

export const getSandboxNavigationItems: NavigationItemsProvider = (filter) => {
  if (filter.appEnv !== 'dev' && filter.appEnv !== 'test') {
    return [];
  }

  return [
    {
      allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
      children: [
        {
          iconKey: 'CodeOutlined',
          key: '/sandbox/playground',
          label: '沙盒演练场',
          navMode: 'rail',
          path: '/sandbox/playground',
          primaryAccessGroup: 'ADMIN',
          slotGroup: null,
          localEntry: {
            description: '进入自由原型试验区，适合快速试错和页面试玩。',
            keywords: ['sandbox', '演练场', '原型', '试玩', '试验区', '沙盒'],
          },
        },
      ],
      iconKey: 'ExperimentOutlined',
      key: 'labs',
      label: 'Labs',
      navMode: 'rail',
    },
  ];
};
