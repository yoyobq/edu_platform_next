export type ProjectStatus = 'live' | 'paused';

export type Project = {
  id: string;
  name: string;
  summary: string;
  monthlyPrice: string;
  status: ProjectStatus;
  updatedAt: string;
};

export const demoProjects: readonly Project[] = [
  {
    id: 'realtime-pricing',
    name: 'Realtime Pricing',
    summary: 'Serving current pricing signals to production users.',
    monthlyPrice: '$299',
    status: 'live',
    updatedAt: '2026-03-29 11:00 UTC',
  },
  {
    id: 'backfill-importer',
    name: 'Backfill Importer',
    summary: 'Internal recovery job kept visible for operator review.',
    monthlyPrice: '$0',
    status: 'paused',
    updatedAt: '2026-03-28 18:30 UTC',
  },
] as const;

export function isProjectLive(project: Project): boolean {
  return project.status === 'live';
}
