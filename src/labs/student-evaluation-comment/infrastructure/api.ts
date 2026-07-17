// src/labs/student-evaluation-comment/infrastructure/api.ts

import { executeGraphQL } from '@/shared/graphql';

import type {
  BatchWriteStudentEvaluationCommentsResult,
  MyStudentEvaluationComments,
  StudentEvaluationCommentScopeInput,
  StudentEvaluationCommentWorkspace,
  StudentEvaluationCommentWriteItem,
} from '../types';

const STUDENT_EVALUATION_COMMENT_WORKSPACE_QUERY = `
  query StudentEvaluationCommentWorkspace($input: StudentEvaluationCommentWorkspaceInput!) {
    studentEvaluationCommentWorkspace(input: $input) {
      status
      commentKind
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

export async function getStudentEvaluationCommentWorkspace(input: {
  classId?: string | null;
  commentKind: StudentEvaluationCommentWorkspace['commentKind'];
  semesterId?: number | null;
}) {
  const response = await executeGraphQL<
    { studentEvaluationCommentWorkspace: StudentEvaluationCommentWorkspace },
    { input: typeof input }
  >(STUDENT_EVALUATION_COMMENT_WORKSPACE_QUERY, { input });

  return response.studentEvaluationCommentWorkspace;
}

/*
 * Mutations deliberately return only their write summary. The caller reloads the
 * workspace so selections, action governance and revisions remain one snapshot.
 */
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
