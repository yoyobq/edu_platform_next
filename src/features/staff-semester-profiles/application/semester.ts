// src/features/staff-semester-profiles/application/semester.ts
import {
  type AcademicSemesterRecord,
  pickAcademicSemesterId,
  sortAcademicSemestersForDisplay,
} from '@/entities/academic-semester';

export function sortSemesters(records: AcademicSemesterRecord[]) {
  return sortAcademicSemestersForDisplay(records);
}

export function pickNextSemesterId(
  records: AcademicSemesterRecord[],
  currentSelection: number | null,
) {
  return pickAcademicSemesterId(records, currentSelection);
}
