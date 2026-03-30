// src/features/project-catalog/application/get-visible-projects.ts

import { isProjectLive, type Project } from '@/entities/project';

import type { ProjectCatalogRepository } from './ports';

type GetVisibleProjectsOptions = {
  showOnlyLive: boolean;
};

export function getVisibleProjects(
  repository: ProjectCatalogRepository,
  options: GetVisibleProjectsOptions,
): readonly Project[] {
  const projects = repository.listProjects();

  if (!options.showOnlyLive) {
    return projects;
  }

  return projects.filter((project) => isProjectLive(project));
}
