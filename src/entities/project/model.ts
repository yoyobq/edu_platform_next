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
    name: '实时定价',
    summary: '向生产用户持续提供最新价格信号。',
    monthlyPrice: '$299',
    status: 'live',
    updatedAt: '2026-03-29 11:00 UTC',
  },
  {
    id: 'backfill-importer',
    name: '回补导入器',
    summary: '用于内部恢复的任务，当前保留给操作人员观察。',
    monthlyPrice: '$0',
    status: 'paused',
    updatedAt: '2026-03-28 18:30 UTC',
  },
] as const;

export function isProjectLive(project: Project): boolean {
  return project.status === 'live';
}
