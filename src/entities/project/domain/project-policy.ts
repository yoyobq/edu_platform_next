import type { Project } from './project';

export function isProjectLive(project: Project): boolean {
  return project.status === 'live';
}
