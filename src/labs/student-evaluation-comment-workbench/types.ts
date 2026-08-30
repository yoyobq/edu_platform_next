// src/labs/student-evaluation-comment-workbench/types.ts

export type StudentEvaluationCommentRevision = {
  payloadHash: string;
  payloadVersion: number;
};

export type StudentEvaluationCommentKind = 'TERM' | 'GRADUATION';

export type StudentEvaluationCommentAiDraft = {
  content: string;
  draftId: string;
  expiresAt: string;
  revision: StudentEvaluationCommentRevision;
  updatedAt: string;
};

export type StudentEvaluationCommentFormalComment = {
  content: string;
  revision: StudentEvaluationCommentRevision;
  source: 'MANUAL';
  updatedAt: string;
};

export type StudentEvaluationCommentWorkbenchStudent = {
  aiDraft: StudentEvaluationCommentAiDraft | null;
  comment: StudentEvaluationCommentFormalComment | null;
  isAiDraftGenerating: boolean;
  studentId: string;
  studentName: string;
  studentStatus: string;
};

export type StudentEvaluationCommentConductGradeField = {
  conflict: 'CORRECTION_CLEANUP_PENDING' | 'UPSTREAM_CHANGED_SINCE_CORRECTION' | null;
  displayValue: string | null;
  source: 'UPSTREAM_CONFIRMED' | 'LOCAL_CORRECTION' | 'MISSING';
};

export type StudentEvaluationCommentConductBasisWorkspace = {
  view: {
    students: Array<{
      fields: { confirmedGrade: StudentEvaluationCommentConductGradeField };
      studentId: string;
    }>;
  } | null;
};

export type StudentEvaluationCommentClassOption = {
  blockingReasonCode: string | null;
  blockingReasonMessage: string | null;
  catalogStatus: string;
  classCode: string;
  classId: string;
  className: string;
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

export type StudentEvaluationCommentWorkbench = {
  actions: Array<{
    action: 'WRITE_COMMENTS' | 'GENERATE_AI_DRAFTS';
    allowed: boolean;
    reasonCode: string | null;
    reasonMessage: string | null;
  }>;
  classOptions: StudentEvaluationCommentClassOption[];
  commentKind: StudentEvaluationCommentKind;
  selectedClass: StudentEvaluationCommentClassOption | null;
  selectedTerm: StudentEvaluationCommentTermOption | null;
  status: string;
  termOptions: StudentEvaluationCommentTermOption[];
  view: {
    classItem: { classCode: string; className: string; id: string };
    scope: {
      commentKind: StudentEvaluationCommentKind;
      scopeKey: string;
      semesterId: number | null;
    };
    students: StudentEvaluationCommentWorkbenchStudent[];
  } | null;
  warnings: Array<{
    code: string;
    isCurrent: boolean;
    message: string;
    schoolYear: number;
    termNumber: number;
  }>;
};

export type StudentEvaluationCommentAiTone =
  | 'WARM_ENCOURAGING'
  | 'OBJECTIVE_BALANCED'
  | 'CONCISE_DIRECT';
export type StudentEvaluationCommentAiLength = 'CHARS_80_120' | 'CHARS_120_180' | 'CHARS_180_260';
export type StudentEvaluationCommentAiAddress = 'SECOND_PERSON' | 'THIRD_PERSON';
export type StudentEvaluationCommentAiScenario = 'ACADEMIC_TERM' | 'OFF_CAMPUS_INTERNSHIP';

export type GenerateStudentEvaluationCommentAiDraftsResult = {
  counts: {
    accepted: number;
    alreadyGenerating: number;
    basisMissing: number;
    draftExists: number;
    formalCommentExists: number;
    requested: number;
  };
  items: Array<{
    disposition:
      | 'ACCEPTED'
      | 'FORMAL_COMMENT_EXISTS'
      | 'DRAFT_EXISTS'
      | 'ALREADY_GENERATING'
      | 'BASIS_MISSING';
    studentId: string;
  }>;
  status: 'ACCEPTED' | 'NO_CHANGES';
};

export type StudentGraduationEvaluationCommentAiGenerationDisposition =
  | 'ACCEPTED'
  | 'FORMAL_COMMENT_EXISTS'
  | 'DRAFT_EXISTS'
  | 'ALREADY_GENERATING'
  | 'TERM_COMMENTS_INCOMPLETE'
  | 'ENTRY_BASIS_INSUFFICIENT'
  | 'BASIS_UNAVAILABLE'
  | 'BASIS_TOO_LARGE';

export type GenerateStudentGraduationEvaluationCommentAiDraftsResult = {
  counts: {
    accepted: number;
    alreadyGenerating: number;
    basisTooLarge: number;
    basisUnavailable: number;
    draftExists: number;
    entryBasisInsufficient: number;
    formalCommentExists: number;
    requested: number;
    termCommentsIncomplete: number;
  };
  items: Array<{
    basisCommentCount: number;
    disposition: StudentGraduationEvaluationCommentAiGenerationDisposition;
    studentId: string;
  }>;
  status: 'ACCEPTED' | 'NO_CHANGES';
};

export type StudentEvaluationCommentWorkbenchLoaderData = {
  currentAccount: {
    accountId: number;
    displayName: string;
    lockedUpstreamLoginUserId: string | null;
  };
};

export type StudentEvaluationCommentMaterialImportStatus =
  | 'SHEET_SELECTION_REQUIRED'
  | 'IDENTITY_MAPPING_REQUIRED'
  | 'READY_TO_SAVE'
  | 'NO_CHANGES'
  | 'BLOCKED';

export type StudentEvaluationCommentMaterialNotice = {
  code: string;
  message: string;
  sourceRows?: number[];
  sourceSheet?: string;
};

export type StudentEvaluationCommentMaterialSheetOption = {
  candidateRowCount: number;
  recognitionMode: 'HEADER' | 'DATA_FIRST';
  sheetName: string;
};

export type StudentEvaluationCommentMaterialIdentityMappingInput = {
  mappingKey: string;
  studentId: string;
};

export type StudentEvaluationCommentMaterialIdentityMappingGroup = {
  candidates: Array<{
    studentId: string;
    studentName: string;
  }>;
  mappingKey: string;
  sourceRows: number[];
  sourceStudentName: string;
  sourceStudentNumber: string | null;
};

export type StudentEvaluationCommentMaterialPreviewRow = {
  content: string;
  expectedRevision: StudentEvaluationCommentRevision | null;
  matchedBy:
    | 'STUDENT_ID'
    | 'UPSTREAM_ID'
    | 'NON_CANONICAL_ID_AND_UNIQUE_NAME'
    | 'UNIQUE_NAME'
    | 'MANUAL';
  proposedAction: 'CREATE' | 'UPDATE';
  sourceRow: number;
  sourceSheet: string;
  studentId: string;
  studentName: string;
};

export type StudentEvaluationCommentMaterialImportResult = {
  blockingErrors: StudentEvaluationCommentMaterialNotice[];
  classId: string;
  className: string;
  commentKind: 'TERM';
  identityMappingGroups: StudentEvaluationCommentMaterialIdentityMappingGroup[];
  previewRows: StudentEvaluationCommentMaterialPreviewRow[];
  selectedSheet: string | null;
  semesterId: number;
  sheetOptions: StudentEvaluationCommentMaterialSheetOption[];
  status: StudentEvaluationCommentMaterialImportStatus;
  summary: {
    blankCommentCount: number;
    createCount: number;
    matchedRows: number;
    parsedRows: number;
    unchangedCount: number;
    updateCount: number;
  };
  warnings: StudentEvaluationCommentMaterialNotice[];
};

export type ImportStudentEvaluationCommentMaterialInput = {
  classId: string;
  file: File;
  identityMappings?: readonly StudentEvaluationCommentMaterialIdentityMappingInput[];
  selectedSheet?: string;
  semesterId: number;
};

export type RefreshStudentEvaluationCommentBasisResult = {
  expiresAt: string | null;
  failureCount: number;
  upstreamSessionToken: string | null;
  writtenStudentCount: number;
};

export type RefreshStudentEvaluationCommentCourseBasisResult = {
  expiresAt: string | null;
  failedStudentCount: number;
  studentCount: number;
  upstreamSessionToken: string | null;
};
