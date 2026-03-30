// src/entities/project/domain/project.ts

export type ProjectStatus = 'live' | 'paused';

export type Project = {
  id: string;
  name: string;
  summary: string;
  monthlyPrice: string;
  status: ProjectStatus;
  updatedAt: string;
};
