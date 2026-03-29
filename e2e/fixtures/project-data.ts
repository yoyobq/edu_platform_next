export const projectFixtures = {
  live: {
    id: 'realtime-pricing',
    name: 'Realtime Pricing',
    status: 'LIVE',
  },
  paused: {
    id: 'backfill-importer',
    name: 'Backfill Importer',
    status: 'PAUSED',
  },
} as const;
