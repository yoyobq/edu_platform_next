export const projectFixtures = {
  live: {
    id: 'realtime-pricing',
    name: '实时定价',
    status: '已上线',
  },
  paused: {
    id: 'backfill-importer',
    name: '回补导入器',
    status: '已暂停',
  },
} as const;
