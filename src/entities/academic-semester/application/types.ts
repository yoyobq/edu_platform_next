// src/entities/academic-semester/application/types.ts

export type AcademicSemesterRecord = {
  createdAt: string;
  endDate: string;
  examStartDate: string;
  firstTeachingDate: string;
  id: number;
  isCurrent: boolean;
  isVisible: boolean;
  name: string;
  schoolYear: number;
  sortOrder: number;
  startDate: string;
  termNumber: number;
  updatedAt: string;
};
