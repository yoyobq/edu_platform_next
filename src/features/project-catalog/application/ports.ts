// src/features/project-catalog/application/ports.ts

import type { Project } from '@/entities/project';

export type ProjectCatalogRepository = {
  listProjects: () => readonly Project[];
};
