// src/labs/student-evaluation-comment/types.ts

export type StudentEvaluationCommentKind = 'TERM' | 'GRADUATION';
export type StudentEvaluationCommentSource = 'MANUAL';
export type StudentEvaluationCommentWriteAction = 'UPSERT' | 'CLEAR';

export type StudentEvaluationCommentLabLoaderData = {
  canEditClassScope: boolean;
  defaultView: 'class-scope' | 'mine';
};

export type StudentEvaluationCommentRevision = {
  payloadHash: string;
  payloadVersion: number;
};

export type StudentEvaluationCommentClassOption = {
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

export type StudentEvaluationCommentTermOption = {
  isCurrent: boolean;
  label: string;
  schoolYear: number;
  semesterId: number;
  sequence: number;
  termNumber: number;
};

export type StudentEvaluationCommentWorkspaceAction = {
  action: string;
  allowed: boolean;
  reasonCode: string | null;
  reasonMessage: string | null;
};

export type StudentEvaluationCommentWorkspaceWarning = {
  code: string;
  isCurrent: boolean;
  message: string;
  schoolYear: number;
  termNumber: number;
};

export type StudentEvaluationCommentClassScopeComment = {
  content: string;
  revision: StudentEvaluationCommentRevision;
  source: StudentEvaluationCommentSource;
  updatedAt: string;
};

export type StudentEvaluationCommentClassScopeStudent = {
  comment: StudentEvaluationCommentClassScopeComment | null;
  studentId: string;
  studentName: string;
  studentStatus: string;
};

export type StudentEvaluationCommentClassScope = {
  classItem: {
    classCode: string;
    className: string;
    id: string;
  };
  scope: {
    commentKind: StudentEvaluationCommentKind;
    scopeKey: string;
    semesterId: number | null;
  };
  students: StudentEvaluationCommentClassScopeStudent[];
};

export type StudentEvaluationCommentWorkspace = {
  actions: StudentEvaluationCommentWorkspaceAction[];
  classOptions: StudentEvaluationCommentClassOption[];
  commentKind: StudentEvaluationCommentKind;
  selectedClass: StudentEvaluationCommentClassOption | null;
  selectedTerm: StudentEvaluationCommentTermOption | null;
  status: string;
  termOptions: StudentEvaluationCommentTermOption[];
  view: StudentEvaluationCommentClassScope | null;
  warnings: StudentEvaluationCommentWorkspaceWarning[];
};

export type StudentEvaluationCommentScopeInput = {
  classId: string;
  commentKind: StudentEvaluationCommentKind;
  semesterId: number | null;
};

export type StudentEvaluationCommentWriteItem = {
  action: StudentEvaluationCommentWriteAction;
  content?: string | null;
  expectedRevision: StudentEvaluationCommentRevision | null;
  studentId: string;
};

export type BatchWriteStudentEvaluationCommentsResult = {
  counts: {
    created: number;
    deleted: number;
    unchanged: number;
    updated: number;
  };
  items: Array<{
    status: 'CREATED' | 'UPDATED' | 'UNCHANGED' | 'DELETED';
    studentId: string;
  }>;
  status: 'UPDATED' | 'NO_CHANGES';
};

export type MyStudentEvaluationComments = {
  graduation: {
    content: string;
    source: StudentEvaluationCommentSource;
    updatedAt: string;
  } | null;
  studentId: string;
  terms: Array<{
    content: string;
    semesterId: number;
    source: StudentEvaluationCommentSource;
    updatedAt: string;
  }>;
};
