import type { OperationVariables } from '@apollo/client';

import { executeGraphQL } from './request';

export type SharedAcademicSemesterRecord = {
  createdAt: string;
  endDate: string;
  examStartDate: string;
  firstTeachingDate: string;
  id: number;
  isCurrent: boolean;
  name: string;
  schoolYear: number;
  startDate: string;
  termNumber: number;
  updatedAt: string;
};

export type RequestAcademicSemestersInput = {
  isCurrent?: boolean;
  limit?: number;
  schoolYear?: number;
  termNumber?: number;
};

const ACADEMIC_SEMESTER_FIELDS = `
  createdAt
  endDate
  examStartDate
  firstTeachingDate
  id
  isCurrent
  name
  schoolYear
  startDate
  termNumber
  updatedAt
`;

const LIST_ACADEMIC_SEMESTERS_QUERY = `
  query AcademicSemesters($isCurrent: Boolean, $limit: Int, $schoolYear: Int, $termNumber: Int) {
    academicSemesters(
      isCurrent: $isCurrent
      limit: $limit
      schoolYear: $schoolYear
      termNumber: $termNumber
    ) {
      ${ACADEMIC_SEMESTER_FIELDS}
    }
  }
`;

export async function requestAcademicSemesters(input: RequestAcademicSemestersInput = {}) {
  const response = await executeGraphQL<
    { academicSemesters: SharedAcademicSemesterRecord[] },
    RequestAcademicSemestersInput
  >(LIST_ACADEMIC_SEMESTERS_QUERY, input as OperationVariables & RequestAcademicSemestersInput);

  return response.academicSemesters;
}
