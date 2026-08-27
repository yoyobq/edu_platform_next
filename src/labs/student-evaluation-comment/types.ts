// src/labs/student-evaluation-comment/types.ts

export type StudentEvaluationCommentKind = 'TERM' | 'GRADUATION';
export type StudentEvaluationCommentSource = 'MANUAL';
export type StudentEvaluationCommentWriteAction = 'UPSERT' | 'CLEAR';
export type StudentEvaluationCommentAiTone =
  | 'WARM_ENCOURAGING'
  | 'OBJECTIVE_BALANCED'
  | 'CONCISE_DIRECT';
export type StudentEvaluationCommentAiLength = 'CHARS_80_120' | 'CHARS_120_180' | 'CHARS_180_260';
export type StudentEvaluationCommentAiAddress = 'SECOND_PERSON' | 'THIRD_PERSON';
export type StudentEvaluationCommentAiScenario = 'ACADEMIC_TERM' | 'OFF_CAMPUS_INTERNSHIP';
export type StudentEvaluationCommentAiGenerationDisposition =
  | 'ACCEPTED'
  | 'FORMAL_COMMENT_EXISTS'
  | 'DRAFT_EXISTS'
  | 'ALREADY_GENERATING'
  | 'BASIS_MISSING';

export type StudentEvaluationCommentLabLoaderData = {
  canEditClassScope: boolean;
  currentAccount: {
    accountId: number;
    displayName: string;
    lockedUpstreamLoginUserId: string | null;
  };
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
  action: 'WRITE_COMMENTS' | 'GENERATE_AI_DRAFTS';
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

export type StudentEvaluationCommentAiDraft = {
  content: string;
  draftId: string;
  expiresAt: string;
  revision: StudentEvaluationCommentRevision;
  updatedAt: string;
};

export type StudentEvaluationCommentClassScopeStudent = {
  aiDraft: StudentEvaluationCommentAiDraft | null;
  comment: StudentEvaluationCommentClassScopeComment | null;
  isAiDraftGenerating: boolean;
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

export type StudentEvaluationCommentAiDraftScopeInput = {
  classId: string;
  semesterId: number;
};

export type StudentEvaluationCommentAiGenerationOptions = {
  address: StudentEvaluationCommentAiAddress;
  length: StudentEvaluationCommentAiLength;
  tone: StudentEvaluationCommentAiTone;
};

export type GenerateStudentEvaluationCommentAiDraftsInput =
  StudentEvaluationCommentAiDraftScopeInput &
    StudentEvaluationCommentAiGenerationOptions & {
      scenario: StudentEvaluationCommentAiScenario;
      studentIds: string[];
      styleExampleStudentIds: string[];
    };

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
    disposition: StudentEvaluationCommentAiGenerationDisposition;
    studentId: string;
  }>;
  status: 'ACCEPTED' | 'NO_CHANGES';
};

export type StudentEvaluationCommentAiDraftMutationItem = {
  draftId: string;
  expectedRevision: StudentEvaluationCommentRevision;
};

export type SaveStudentEvaluationCommentAiDraftInput = StudentEvaluationCommentAiDraftScopeInput &
  StudentEvaluationCommentAiDraftMutationItem & {
    content: string;
  };

export type SaveStudentEvaluationCommentAiDraftResult = {
  draft: StudentEvaluationCommentAiDraft;
  status: 'SAVED';
};

export type DiscardStudentEvaluationCommentAiDraftsResult = {
  discardedCount: number;
  status: 'DISCARDED';
};

export type ConfirmStudentEvaluationCommentAiDraftsResult = {
  confirmedCount: number;
  status: 'CONFIRMED';
};

export type RefreshStudentEvaluationCommentAiBasisInput = {
  classId: string;
  semesterId: number;
  upstreamSessionToken: string;
};

export type RefreshStudentEvaluationCommentAiBasisResult = {
  confirmedRegistrationCount: number;
  createdCount: number;
  expiresAt: string | null;
  failureCount: number;
  processedRegistrationCount: number;
  requestedRegistrationCount: number;
  skippedRegistrationCount: number;
  success: boolean;
  traceId: string | null;
  unchangedCount: number;
  updatedCount: number;
  upstreamSessionToken: string | null;
  upstreamTotal: number;
  writtenStudentCount: number;
};

export type RefreshStudentEvaluationCommentCourseBasisResult = {
  classCode: string;
  classId: string;
  expiresAt: string | null;
  failedStudentCount: number;
  rowCount: number;
  scope: 'SELECTED_TERM';
  semesterId: number;
  status: 'REFRESHED' | 'PARTIAL';
  studentCount: number;
  upstreamFetchedStudentCount: number;
  upstreamSessionToken: string | null;
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
  commentKind: StudentEvaluationCommentKind;
  identityMappingGroups: StudentEvaluationCommentMaterialIdentityMappingGroup[];
  previewRows: StudentEvaluationCommentMaterialPreviewRow[];
  selectedSheet: string | null;
  semesterId: number | null;
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
  commentKind: StudentEvaluationCommentKind;
  file: File;
  identityMappings?: readonly StudentEvaluationCommentMaterialIdentityMappingInput[];
  selectedSheet?: string;
  semesterId: number | null;
};
