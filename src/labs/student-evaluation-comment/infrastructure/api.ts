// src/labs/student-evaluation-comment/infrastructure/api.ts

import { executeGraphQL } from '@/shared/graphql';

import type {
  BatchWriteStudentEvaluationCommentsResult,
  MyStudentEvaluationComments,
  StudentEvaluationCommentClassOption,
  StudentEvaluationCommentClassOptionSource,
  StudentEvaluationCommentClassScope,
  StudentEvaluationCommentScopeInput,
  StudentEvaluationCommentSemester,
  StudentEvaluationCommentWriteItem,
} from '../types';

const LIST_LOCAL_CLASS_OPTIONS_QUERY = `
  query StudentEvaluationCommentLocalClassOptions($input: ListLocalClassOptionsInput) {
    listLocalClassOptions(input: $input) {
      id
      departmentId
      classCode
      className
      gradeYear
    }
  }
`;

const LIST_MY_MANAGED_CLASSES_QUERY = `
  query StudentEvaluationCommentMyManagedClasses {
    myManagedClasses {
      id
      departmentId
      classCode
      className
      gradeYear
    }
  }
`;

const LIST_ACADEMIC_SEMESTERS_QUERY = `
  query StudentEvaluationCommentAcademicSemesters($limit: Int) {
    academicSemesters(limit: $limit) {
      id
      isCurrent
      isVisible
      name
      schoolYear
      sortOrder
      termNumber
    }
  }
`;

const STUDENT_EVALUATION_COMMENT_CLASS_SCOPE_QUERY = `
  query StudentEvaluationCommentClassScope(
    $input: StudentEvaluationCommentClassScopeInput!
  ) {
    studentEvaluationCommentClassScope(input: $input) {
      classItem {
        id
        classCode
        className
      }
      scope {
        scopeKey
        commentKind
        semesterId
      }
      students {
        studentId
        studentName
        studentStatus
        comment {
          content
          revision {
            payloadHash
            payloadVersion
          }
          source
          updatedAt
        }
      }
    }
  }
`;

const BATCH_WRITE_STUDENT_EVALUATION_COMMENTS_MUTATION = `
  mutation BatchWriteStudentEvaluationComments(
    $input: BatchWriteStudentEvaluationCommentsInput!
  ) {
    batchWriteStudentEvaluationComments(input: $input) {
      status
      counts {
        created
        updated
        unchanged
        deleted
      }
      items {
        studentId
        status
      }
    }
  }
`;

const MY_STUDENT_EVALUATION_COMMENTS_QUERY = `
  query MyStudentEvaluationComments {
    myStudentEvaluationComments {
      studentId
      terms {
        semesterId
        content
        source
        updatedAt
      }
      graduation {
        content
        source
        updatedAt
      }
    }
  }
`;

export async function listStudentEvaluationCommentClassOptions(
  source: StudentEvaluationCommentClassOptionSource,
  keyword?: string,
) {
  if (source === 'MANUAL') {
    return [];
  }

  if (source === 'MANAGED') {
    const response = await executeGraphQL<
      { myManagedClasses: StudentEvaluationCommentClassOption[] },
      Record<string, never>
    >(LIST_MY_MANAGED_CLASSES_QUERY, {});

    return response.myManagedClasses;
  }

  const response = await executeGraphQL<
    { listLocalClassOptions: StudentEvaluationCommentClassOption[] },
    { input: { keyword: string | null } }
  >(LIST_LOCAL_CLASS_OPTIONS_QUERY, {
    input: {
      keyword: keyword?.trim() || null,
    },
  });

  return response.listLocalClassOptions;
}

export async function listStudentEvaluationCommentSemesters() {
  const response = await executeGraphQL<
    { academicSemesters: StudentEvaluationCommentSemester[] },
    { limit: number }
  >(LIST_ACADEMIC_SEMESTERS_QUERY, { limit: 500 });

  return response.academicSemesters;
}

export async function getStudentEvaluationCommentClassScope(
  input: StudentEvaluationCommentScopeInput,
) {
  const response = await executeGraphQL<
    { studentEvaluationCommentClassScope: StudentEvaluationCommentClassScope },
    { input: StudentEvaluationCommentScopeInput }
  >(STUDENT_EVALUATION_COMMENT_CLASS_SCOPE_QUERY, { input });

  return response.studentEvaluationCommentClassScope;
}

export async function batchWriteStudentEvaluationComments(input: {
  items: StudentEvaluationCommentWriteItem[];
  scope: StudentEvaluationCommentScopeInput;
}) {
  const response = await executeGraphQL<
    { batchWriteStudentEvaluationComments: BatchWriteStudentEvaluationCommentsResult },
    {
      input: StudentEvaluationCommentScopeInput & {
        items: StudentEvaluationCommentWriteItem[];
      };
    }
  >(BATCH_WRITE_STUDENT_EVALUATION_COMMENTS_MUTATION, {
    input: {
      ...input.scope,
      items: input.items,
    },
  });

  return response.batchWriteStudentEvaluationComments;
}

export async function getMyStudentEvaluationComments() {
  const response = await executeGraphQL<
    { myStudentEvaluationComments: MyStudentEvaluationComments },
    Record<string, never>
  >(MY_STUDENT_EVALUATION_COMMENTS_QUERY, {});

  return response.myStudentEvaluationComments;
}
