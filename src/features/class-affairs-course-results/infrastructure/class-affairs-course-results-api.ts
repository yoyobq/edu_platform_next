// src/features/class-affairs-course-results/infrastructure/class-affairs-course-results-api.ts

import type { OperationVariables } from '@apollo/client';

import {
  executeUpstreamSessionGraphQL,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { executeGraphQL } from '@/shared/graphql';

export { resolveUpstreamErrorMessage };

export type ManagedCourseResultsStudentStatus =
  | 'PRE_REGISTERED'
  | 'NOT_CHECKED_IN'
  | 'ENROLLED'
  | 'OFF_CAMPUS_INTERNSHIP'
  | 'SUSPENDED'
  | 'GRADUATED'
  | 'DROPPED';

export type ManagedCourseResultsDisplayDecisionOutcome = 'INCLUDE' | 'EXCLUDE';
export type ManagedCourseResultsDisplayReasonCode =
  | 'DROPPED_CONFIRMED'
  | 'NOT_CHECKED_IN_CONFIRMED'
  | 'TRANSFERRED_OUT_CONFIRMED'
  | 'TRANSFERRED_IN_CONFIRMED'
  | 'RETAINED_GRADE_CONFIRMED'
  | 'REENROLLED_CONFIRMED'
  | 'UPSTREAM_ROSTER_ERROR_CONFIRMED'
  | 'CLASS_MEMBERSHIP_CORRECTION';

export type ClassCourseGradeClassOption = {
  blockingReasonCode: string | null;
  blockingReasonMessage: string | null;
  catalogStatus: string;
  classCode: string;
  classId: string;
  className: string;
  departmentId: string;
  gradeYear: number | null;
  majorId: string | null;
  majorName: string | null;
  trainingYears: number | null;
};

export type ClassCourseGradeTermOption = {
  isCurrent: boolean;
  label: string;
  schoolYear: number;
  semesterId: number;
  sequence: number;
  termNumber: number;
};

export type ClassCourseGradeAction = {
  action: 'REFRESH_SELECTED_TERM' | 'REFRESH_ALL_TERMS';
  allowed: boolean;
  reasonCode: string | null;
  reasonMessage: string | null;
};

export type ClassCourseGradeWarning = {
  code: string;
  isCurrent: boolean;
  message: string;
  schoolYear: number;
  termNumber: number;
};

export type ManagedCourseResultRecord = {
  attendExamType: string | null;
  courseDivide: string | null;
  courseId: string | null;
  courseName: string | null;
  courseNature: string | null;
  isPass: number | null;
  periodicFinalTotalScore: string | null;
  schoolYear: string | null;
  semester: string | null;
  teacherName: string | null;
  totalScore: string | null;
};

export type ClassCourseGradeCourseColumn = {
  courseId: string | null;
  courseName: string | null;
  key: string;
  teacherName: string | null;
  title: string;
};

export type ClassCourseGradeStudentRow = {
  cells: Array<{
    courseKey: string;
    results: ManagedCourseResultRecord[];
  }>;
  decisionOutcome: ManagedCourseResultsDisplayDecisionOutcome | null;
  decisionReasonCode: ManagedCourseResultsDisplayReasonCode | null;
  effectiveSemesterId: number | null;
  includedInTermRoster: boolean;
  rosterEligibilityStatus: string;
  snapshotFetchedAt: string | null;
  specialReasonMessage: string | null;
  studentId: string;
  studentName: string;
  studentStatus: ManagedCourseResultsStudentStatus;
};

export type ClassCourseGradeMatrix = {
  courseColumns: ClassCourseGradeCourseColumn[];
  studentRows: ClassCourseGradeStudentRow[];
};

export type ClassCourseGradeWorkspaceView = {
  classCode: string;
  classId: string;
  className: string;
  includedRosterCount: number;
  regularMatrix: ClassCourseGradeMatrix;
  regularStudentCount: number;
  resultRowCount: number;
  rosterCandidateCount: number;
  schoolYear: number;
  semesterId: number;
  specialMatrix: ClassCourseGradeMatrix;
  specialStudentCount: number;
  termNumber: number;
};

export type ClassCourseGradeWorkspace = {
  actions: ClassCourseGradeAction[];
  classOptions: ClassCourseGradeClassOption[];
  selectedClass: ClassCourseGradeClassOption | null;
  selectedTerm: ClassCourseGradeTermOption | null;
  status: string;
  termOptions: ClassCourseGradeTermOption[];
  view: ClassCourseGradeWorkspaceView | null;
  warnings: ClassCourseGradeWarning[];
};

export type RefreshClassCourseGradesResult = {
  classCode: string;
  classId: string;
  expiresAt: string | null;
  failedStudentCount: number;
  failures: Array<{
    message: string;
    studentNumber: string;
  }>;
  rowCount: number;
  scope: 'SELECTED_TERM' | 'ALL_TERMS';
  semesterId: number | null;
  sessionStrategy: string | null;
  status: 'REFRESHED' | 'PARTIAL';
  studentCount: number;
  upstreamFetchedStudentCount: number;
  upstreamSessionToken: string | null;
};

const CLASS_COURSE_GRADE_WORKSPACE_QUERY = `
  query ClassCourseGradeWorkspace($input: ClassCourseGradeWorkspaceInput!) {
    classCourseGradeWorkspace(input: $input) {
      status
      classOptions {
        classId
        classCode
        className
        departmentId
        gradeYear
        majorId
        majorName
        trainingYears
        catalogStatus
        blockingReasonCode
        blockingReasonMessage
      }
      selectedClass {
        classId
        classCode
        className
        departmentId
        gradeYear
        majorId
        majorName
        trainingYears
        catalogStatus
        blockingReasonCode
        blockingReasonMessage
      }
      termOptions {
        semesterId
        schoolYear
        termNumber
        sequence
        label
        isCurrent
      }
      selectedTerm {
        semesterId
        schoolYear
        termNumber
        sequence
        label
        isCurrent
      }
      actions {
        action
        allowed
        reasonCode
        reasonMessage
      }
      warnings {
        code
        message
        schoolYear
        termNumber
        isCurrent
      }
      view {
        classId
        classCode
        className
        semesterId
        schoolYear
        termNumber
        rosterCandidateCount
        includedRosterCount
        regularStudentCount
        specialStudentCount
        resultRowCount
        regularMatrix {
          courseColumns { key courseId courseName teacherName title }
          studentRows {
            studentId
            studentName
            studentStatus
            includedInTermRoster
            rosterEligibilityStatus
            decisionOutcome
            decisionReasonCode
            effectiveSemesterId
            specialReasonMessage
            snapshotFetchedAt
            cells {
              courseKey
              results {
                schoolYear semester courseId courseName teacherName totalScore isPass
                courseNature courseDivide attendExamType periodicFinalTotalScore
              }
            }
          }
        }
        specialMatrix {
          courseColumns { key courseId courseName teacherName title }
          studentRows {
            studentId
            studentName
            studentStatus
            includedInTermRoster
            rosterEligibilityStatus
            decisionOutcome
            decisionReasonCode
            effectiveSemesterId
            specialReasonMessage
            snapshotFetchedAt
            cells {
              courseKey
              results {
                schoolYear semester courseId courseName teacherName totalScore isPass
                courseNature courseDivide attendExamType periodicFinalTotalScore
              }
            }
          }
        }
      }
    }
  }
`;

const REFRESH_CLASS_COURSE_GRADES_MUTATION = `
  mutation RefreshClassCourseGrades($input: RefreshClassCourseGradesInput!) {
    refreshClassCourseGrades(input: $input) {
      status
      classId
      classCode
      semesterId
      scope
      studentCount
      rowCount
      failedStudentCount
      upstreamFetchedStudentCount
      upstreamSessionToken
      expiresAt
      sessionStrategy
      failures { studentNumber message }
    }
  }
`;

export async function getClassCourseGradeWorkspace(input: {
  classId?: string | null;
  semesterId?: number | null;
}) {
  const response = await executeGraphQL<
    { classCourseGradeWorkspace: ClassCourseGradeWorkspace },
    { input: typeof input }
  >(CLASS_COURSE_GRADE_WORKSPACE_QUERY, { input });

  return response.classCourseGradeWorkspace;
}

export async function refreshClassCourseGrades(input: {
  classId: string;
  scope: 'SELECTED_TERM' | 'ALL_TERMS';
  semesterId?: number | null;
  upstreamSessionToken: string;
}) {
  const variables = {
    input: {
      classId: input.classId,
      scope: input.scope,
      semesterId: input.scope === 'SELECTED_TERM' ? input.semesterId : undefined,
      sessionToken: input.upstreamSessionToken,
    },
  };
  const response = await executeUpstreamSessionGraphQL<
    { refreshClassCourseGrades: RefreshClassCourseGradesResult },
    OperationVariables & typeof variables
  >(REFRESH_CLASS_COURSE_GRADES_MUTATION, variables);

  return response.refreshClassCourseGrades;
}
