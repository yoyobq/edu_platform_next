// src/features/student-conduct-alignment/infrastructure/api.ts

import type { OperationVariables } from '@apollo/client';

import {
  executeUpstreamSessionGraphQL,
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
} from '@/shared/form-normalization';
import {
  executeGraphQL,
  getGraphQLEndpoint,
  getGraphQLRuntimeConfig,
  isGraphQLIngressError,
} from '@/shared/graphql';

export { isExpiredUpstreamSessionError, resolveUpstreamErrorMessage };

export type StudentConductGradeWorkspaceClassOption = {
  blockingReasonCode: string | null;
  blockingReasonMessage: string | null;
  classCode: string;
  className: string;
  catalogStatus: string;
  departmentId: string;
  gradeYear: number | null;
  id: string;
  majorId: string | null;
  majorName: string | null;
  trainingYears: number | null;
};

export type StudentConductGradeFieldCell = {
  conflict: boolean;
  displayValue?: string | null;
  source: string | null;
  value: number | string | null;
};

export type StudentConductGradeStudent = {
  conductSection: {
    snapshotPresent: boolean;
    sourceStatus: string;
    sourceTotal: number | null;
    warningCodes: string[];
  };
  conflictCodes: string[];
  fields: {
    confirmedGrade: StudentConductGradeFieldCell;
    estimatedGrade: StudentConductGradeFieldCell;
    score: StudentConductGradeFieldCell;
  };
  mainSnapshotPresent: boolean;
  manualPatchFieldKeys: string[];
  status: string;
  studentId: string;
  studentName: string | null;
  studentStatus: string | null;
};

export type StudentConductGradeRosterEligibilitySummary = {
  excludedAfterExitCount: number;
  excludedBeforeEntryCount: number;
  excludedNotCheckedInCount: number;
  inScopeCount: number;
  unresolvedEffectiveSemesterCount: number;
};

export type StudentConductGradeEffectiveView = {
  classCode: string;
  classId: string;
  className: string;
  rosterEligibilitySummary: StudentConductGradeRosterEligibilitySummary;
  schoolYear: string;
  sectionKey: string;
  semester: string;
  studentCount: number;
  students: StudentConductGradeStudent[];
};

export type StudentConductGradeCorrectionCleanupResult = {
  classCode: string;
  clearedFieldKeys: string[];
  remainingManualPatchFieldKeys: string[];
  schoolYear: string;
  semester: string;
  status: string;
  studentId: string;
  termKey: string;
};

export type StudentConductGradeWorkspaceInput = {
  classId?: string | null;
  semesterId?: number | null;
};

export type StudentConductGradeCorrectionCleanupInput = {
  classId: string;
  semesterId: number;
  studentId: string;
};

export type StudentConductGradeWorkspaceTermOption = {
  isCurrent: boolean;
  label: string;
  semesterId: number;
  schoolYear: number;
  sequence: number;
  termNumber: number;
};

export type StudentConductGradeWorkspaceAction = {
  action: 'PATCH_CORRECTIONS' | 'REFRESH_ALL_TERMS' | 'REFRESH_SELECTED_TERM';
  allowed: boolean;
  reasonCode: string | null;
  reasonMessage: string | null;
};

export type StudentConductGradeWorkspaceWarning = {
  code: string;
  isCurrent: boolean;
  message: string;
  schoolYear: number;
  termNumber: number;
};

export type StudentConductGradeWorkspace = {
  actions: StudentConductGradeWorkspaceAction[];
  classOptions: StudentConductGradeWorkspaceClassOption[];
  selectedClass: StudentConductGradeWorkspaceClassOption | null;
  selectedTerm: StudentConductGradeWorkspaceTermOption | null;
  status: string;
  termOptions: StudentConductGradeWorkspaceTermOption[];
  view: StudentConductGradeEffectiveView | null;
  warnings: StudentConductGradeWorkspaceWarning[];
};

export type StudentConductGradeSyncTermStatus = 'FAILED' | 'PARTIAL' | 'SKIPPED' | 'SYNCED';

export type RefreshStudentConductGradeTermResult = {
  failureCount: number;
  schoolYear: string;
  semester: string;
  status: StudentConductGradeSyncTermStatus;
  writtenStudentCount: number;
};

export type RefreshStudentConductGradeFailure = {
  reasonCode: string;
  reasonMessage: string;
  schoolYear: string | null;
  semester: string | null;
  studentNumber: string | null;
};

export type RefreshStudentConductGradeClassResult = {
  confirmedRegistrationCount: number;
  createdCount: number;
  expiresAt: string | null;
  failureCount: number;
  failures: RefreshStudentConductGradeFailure[];
  processedRegistrationCount: number;
  requestedRegistrationCount: number;
  skippedRegistrationCount: number;
  success: boolean;
  termResults: RefreshStudentConductGradeTermResult[];
  traceId: string | null;
  unchangedCount: number;
  upstreamSessionToken: string | null;
  upstreamTotal: number;
  updatedCount: number;
  writtenStudentCount: number;
};

export type RefreshStudentConductGradeClassInput = {
  classId: string;
  scope: 'ALL_TERMS' | 'SELECTED_TERM';
  semesterId?: number | null;
  upstreamSessionToken: string;
};

export type StudentConductGradePatchFieldKey = 'confirmedGrade' | 'score';

export type PatchStudentConductGradeCorrectionStudentInput = {
  clearFieldKeys?: readonly StudentConductGradePatchFieldKey[] | null;
  confirmedGrade?: string | null;
  score?: string | null;
  studentId: string;
};

export type PatchStudentConductGradeCorrectionsInput = {
  classId: string;
  semesterId: number;
  students: readonly PatchStudentConductGradeCorrectionStudentInput[];
};

export type PatchStudentConductGradeCorrectionRowResult = {
  clearedFieldKeys: string[];
  clearedUpstreamFieldKeys: string[];
  conductSectionStatus: string;
  createdSection: boolean;
  rowIndex: number;
  skippedUpstreamFieldKeys: string[];
  status: string;
  studentId: string;
  unchangedFieldKeys: string[];
  writtenFieldKeys: string[];
};

export type PatchStudentConductGradeCorrectionsResult = {
  affectedStudents: number;
  classCode: string;
  className: string;
  clearedFieldCount: number;
  clearedUpstreamFieldCount: number;
  createdSectionCount: number;
  rowResults: PatchStudentConductGradeCorrectionRowResult[];
  schoolYear: string;
  sectionKey: string;
  semester: string;
  skippedUpstreamFieldCount: number;
  status: string;
  totalRows: number;
  unchangedFieldCount: number;
  unchangedStudentCount: number;
  writtenFieldCount: number;
  writtenStudentCount: number;
};

export type StudentConductGradePatchRowIssue = {
  code: string;
  message?: string | null;
  rowIndex: number;
  studentId?: string | null;
};

export type StudentConductGradeMaterialImportStatus =
  | 'BLOCKED'
  | 'NO_CHANGES'
  | 'READY_TO_SAVE'
  | 'WARNING_CONFIRMATION_REQUIRED';

export type StudentConductGradeMaterialImportIssue = {
  code: string;
  confirmed: boolean | null;
  fieldKey: string | null;
  message: string | null;
  schoolYear: string | null;
  semester: string | null;
  sourceFileDigest: string | null;
  sourceFileIndex: number | null;
  sourceFilename: string | null;
  sourceRow: number | null;
  sourceSheetOrTable: string | null;
  studentId: string | null;
  warningKey: string | null;
};

export type StudentConductGradeMaterialImportPreviewRow = {
  confirmedGrade: string | null;
  score: string | null;
  schoolYear: string;
  semester: string;
  studentId: string;
  studentName: string;
};

export type StudentConductGradeMaterialImportResult = {
  affectedStudents: number | null;
  blockingErrors: StudentConductGradeMaterialImportIssue[];
  classCode: string | null;
  className: string | null;
  clearedUpstreamFieldCount: number | null;
  createdSectionCount: number | null;
  emptyFieldCount: number | null;
  schoolYear: string | null;
  sectionKey: string | null;
  semester: string | null;
  previewRows: StudentConductGradeMaterialImportPreviewRow[];
  status: StudentConductGradeMaterialImportStatus;
  summary: Record<string, unknown>;
  totalFiles: number | null;
  totalParsedRows: number | null;
  totalResolvedRows: number | null;
  totalSkippedTables: number | null;
  unchangedFieldCount: number | null;
  unchangedStudentCount: number | null;
  warnings: StudentConductGradeMaterialImportIssue[];
  writtenFieldCount: number | null;
  writtenStudentCount: number | null;
};

export type ImportStudentConductGradeMaterialsInput = {
  classCode: string;
  confirmedWarningKeys?: readonly string[] | null;
  files: readonly File[];
  schoolYear: string;
  semester: string;
};

type ConductWorkspaceResponse = {
  studentConductGradeWorkspace: {
    actions: StudentConductGradeWorkspaceAction[];
    classOptions: Array<Omit<StudentConductGradeWorkspaceClassOption, 'id'> & { classId: string }>;
    selectedClass:
      | (Omit<StudentConductGradeWorkspaceClassOption, 'id'> & { classId: string })
      | null;
    selectedTerm: StudentConductGradeWorkspaceTermOption | null;
    status: string;
    termOptions: StudentConductGradeWorkspaceTermOption[];
    view: StudentConductGradeEffectiveView | null;
    warnings: StudentConductGradeWorkspaceWarning[];
  };
};

type ConductCleanupResponse = {
  cleanupStudentConductGradeCorrection: StudentConductGradeCorrectionCleanupResult;
};

type ConductPatchResponse = {
  patchStudentConductGradeCorrections: PatchStudentConductGradeCorrectionsResult;
};

type RefreshConductClassResponse = {
  refreshStudentConductGradeClassFromUpstream: RefreshStudentConductGradeClassResult;
};

const CONDUCT_PATCH_FIELD_KEYS = ['score', 'confirmedGrade'] as const;
const CONDUCT_PATCH_FIELD_KEY_SET = new Set<string>(CONDUCT_PATCH_FIELD_KEYS);
const CONDUCT_GRADE_MATERIAL_IMPORT_PATH =
  '/student-private-profile/conduct-grade-material-imports';
export const CONDUCT_GRADE_MATERIAL_IMPORT_MAX_FILES = 5;
export const CONDUCT_GRADE_MATERIAL_IMPORT_MAX_FILE_BYTES = 200 * 1024;
const MAX_PATCH_STUDENT_ROWS = 500;
const SUPPORTED_CONDUCT_GRADE_MATERIAL_FILE_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx']);
const LEGACY_OFFICE_MATERIAL_CONVERSION_FAILED_CODE =
  'STUDENT_PRIVATE_PROFILE_SUPPLEMENT_FILE_INVALID';
const LEGACY_OFFICE_MATERIAL_CONVERSION_FAILED_MESSAGE =
  '旧版 Office 文件无法自动转换，请手工另存为 .docx / .xlsx 后重试。';
const CONDUCT_GRADE_MATERIAL_IMPORT_SUMMARY_KEYS = [
  'totalFiles',
  'totalParsedRows',
  'totalSkippedTables',
  'totalResolvedRows',
  'affectedStudents',
  'writtenStudentCount',
  'unchangedStudentCount',
  'createdSectionCount',
  'writtenFieldCount',
  'clearedUpstreamFieldCount',
  'skippedUpstreamFieldCount',
  'emptyFieldCount',
  'unchangedFieldCount',
] as const;

const CONDUCT_WORKSPACE_QUERY = `
  query StudentConductGradeGovernanceWorkspace(
    $input: StudentConductGradeWorkspaceInput!
  ) {
    studentConductGradeWorkspace(input: $input) {
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
      sectionKey
      classId
      classCode
      className
      schoolYear
      semester
      studentCount
      rosterEligibilitySummary {
        inScopeCount
        excludedAfterExitCount
        excludedBeforeEntryCount
        excludedNotCheckedInCount
        unresolvedEffectiveSemesterCount
      }
      students {
        studentId
        studentName
        studentStatus
        mainSnapshotPresent
        conductSection {
          snapshotPresent
          sourceStatus
          sourceTotal
          warningCodes
        }
        fields {
          score {
            value
            source
            conflict
          }
          estimatedGrade {
            value
            displayValue
            source
            conflict
          }
          confirmedGrade {
            value
            displayValue
            source
            conflict
          }
        }
        conflictCodes
        manualPatchFieldKeys
        status
      }
      }
    }
  }
`;

const CLEANUP_CONDUCT_MUTATION = `
  mutation StudentConductGradeGovernanceCleanup(
    $input: StudentConductGradeCorrectionCleanupInput!
  ) {
    cleanupStudentConductGradeCorrection(input: $input) {
      status
      studentId
      classCode
      schoolYear
      semester
      termKey
      clearedFieldKeys
      remainingManualPatchFieldKeys
    }
  }
`;

const PATCH_CONDUCT_CORRECTIONS_MUTATION = `
  mutation StudentConductGradeGovernancePatchCorrections(
    $input: PatchStudentConductGradeCorrectionsInput!
  ) {
    patchStudentConductGradeCorrections(input: $input) {
      sectionKey
      classCode
      className
      schoolYear
      semester
      status
      totalRows
      affectedStudents
      writtenStudentCount
      unchangedStudentCount
      createdSectionCount
      writtenFieldCount
      clearedFieldCount
      clearedUpstreamFieldCount
      skippedUpstreamFieldCount
      unchangedFieldCount
      rowResults {
        rowIndex
        studentId
        conductSectionStatus
        status
        createdSection
        writtenFieldKeys
        clearedFieldKeys
        clearedUpstreamFieldKeys
        skippedUpstreamFieldKeys
        unchangedFieldKeys
      }
    }
  }
`;

const REFRESH_CONDUCT_CLASS_MUTATION = `
  mutation StudentConductGradeGovernanceRefreshClass(
    $input: RefreshStudentConductGradeClassFromUpstreamInput!
  ) {
    refreshStudentConductGradeClassFromUpstream(input: $input) {
      success
      requestedRegistrationCount
      upstreamTotal
      confirmedRegistrationCount
      processedRegistrationCount
      skippedRegistrationCount
      writtenStudentCount
      createdCount
      updatedCount
      unchangedCount
      failureCount
      failures {
        schoolYear
        semester
        studentNumber
        reasonCode
        reasonMessage
      }
      upstreamSessionToken
      expiresAt
      traceId
      termResults {
        schoolYear
        semester
        status
        writtenStudentCount
        failureCount
      }
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

function compactInput<TValue extends Record<string, unknown>>(input: TValue) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<TValue>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readRestEnvelopeMessage(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  const error = payload.error;

  if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return null;
}

function readRestEnvelopeErrorCode(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  const error = payload.error;

  if (isRecord(error) && typeof error.code === 'string' && error.code.trim()) {
    return error.code.trim();
  }

  return null;
}

function resolveRestEnvelopeErrorMessage(payload: unknown, fallback: string): string;
function resolveRestEnvelopeErrorMessage(payload: unknown, fallback?: string): string | null;
function resolveRestEnvelopeErrorMessage(payload: unknown, fallback?: string) {
  if (readRestEnvelopeErrorCode(payload) === LEGACY_OFFICE_MATERIAL_CONVERSION_FAILED_CODE) {
    return LEGACY_OFFICE_MATERIAL_CONVERSION_FAILED_MESSAGE;
  }

  return readRestEnvelopeMessage(payload) ?? fallback ?? null;
}

async function readRestFailureMessage(response: Response) {
  const contentType = response.headers.get('Content-Type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      return resolveRestEnvelopeErrorMessage(await response.json());
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();

    return text.trim() || null;
  } catch {
    return null;
  }
}

function buildAuthorizationHeaders() {
  const accessToken = getGraphQLRuntimeConfig().getAccessToken?.() ?? null;

  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

function normalizeMaterialImportStatus(status: unknown): StudentConductGradeMaterialImportStatus {
  if (
    status === 'BLOCKED' ||
    status === 'NO_CHANGES' ||
    status === 'READY_TO_SAVE' ||
    status === 'WARNING_CONFIRMATION_REQUIRED'
  ) {
    return status;
  }

  throw new Error('操行材料导入返回状态异常。');
}

function normalizeOptionalStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeOptionalNumberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeOptionalBooleanValue(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function buildMaterialImportSummary(value: Record<string, unknown>) {
  if (isRecord(value.summary)) {
    return value.summary;
  }

  return Object.fromEntries(
    CONDUCT_GRADE_MATERIAL_IMPORT_SUMMARY_KEYS.map((key) => [key, value[key]]).filter(
      ([, item]) => item !== undefined && item !== null,
    ),
  );
}

function normalizeMaterialImportIssue(value: unknown): StudentConductGradeMaterialImportIssue {
  if (!isRecord(value) || typeof value.code !== 'string' || !value.code.trim()) {
    throw new Error('操行材料导入问题返回结果异常。');
  }

  return {
    code: value.code.trim(),
    confirmed: normalizeOptionalBooleanValue(value.confirmed),
    fieldKey: normalizeOptionalStringValue(value.fieldKey),
    message: normalizeOptionalStringValue(value.message),
    schoolYear: normalizeOptionalStringValue(value.schoolYear),
    semester: normalizeOptionalStringValue(value.semester),
    sourceFileDigest: normalizeOptionalStringValue(value.sourceFileDigest),
    sourceFileIndex: normalizeOptionalNumberValue(value.sourceFileIndex),
    sourceFilename: normalizeOptionalStringValue(value.sourceFilename),
    sourceRow: normalizeOptionalNumberValue(value.sourceRow),
    sourceSheetOrTable: normalizeOptionalStringValue(value.sourceSheetOrTable),
    studentId: normalizeOptionalStringValue(value.studentId),
    warningKey: normalizeOptionalStringValue(value.warningKey),
  };
}

function normalizeMaterialImportIssues(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((issue) => normalizeMaterialImportIssue(issue));
}

function normalizeMaterialImportPreviewRow(
  value: unknown,
): StudentConductGradeMaterialImportPreviewRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const studentId = normalizeOptionalStringValue(value.studentId);
  const studentName = normalizeOptionalStringValue(value.studentName);
  const schoolYear = normalizeOptionalStringValue(value.schoolYear);
  const semester = normalizeOptionalStringValue(value.semester);

  if (!studentId || !studentName || !schoolYear || !semester) {
    return null;
  }

  return {
    confirmedGrade: normalizeOptionalStringValue(value.confirmedGrade),
    score: normalizeOptionalStringValue(value.score),
    schoolYear,
    semester,
    studentId,
    studentName,
  };
}

function normalizeMaterialImportPreviewRows(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => normalizeMaterialImportPreviewRow(row))
    .filter((row): row is StudentConductGradeMaterialImportPreviewRow => Boolean(row));
}

function assertMaterialImportResult(value: unknown): StudentConductGradeMaterialImportResult {
  if (!isRecord(value)) {
    throw new Error('操行材料导入返回结果异常。');
  }

  return {
    affectedStudents: normalizeOptionalNumberValue(value.affectedStudents),
    blockingErrors: normalizeMaterialImportIssues(value.blockingErrors),
    classCode: normalizeOptionalStringValue(value.classCode),
    className: normalizeOptionalStringValue(value.className),
    clearedUpstreamFieldCount: normalizeOptionalNumberValue(value.clearedUpstreamFieldCount),
    createdSectionCount: normalizeOptionalNumberValue(value.createdSectionCount),
    emptyFieldCount: normalizeOptionalNumberValue(value.emptyFieldCount),
    schoolYear: normalizeOptionalStringValue(value.schoolYear),
    sectionKey: normalizeOptionalStringValue(value.sectionKey),
    semester: normalizeOptionalStringValue(value.semester),
    previewRows: normalizeMaterialImportPreviewRows(value.previewRows),
    status: normalizeMaterialImportStatus(value.status),
    summary: buildMaterialImportSummary(value),
    totalFiles: normalizeOptionalNumberValue(value.totalFiles),
    totalParsedRows: normalizeOptionalNumberValue(value.totalParsedRows),
    totalResolvedRows: normalizeOptionalNumberValue(value.totalResolvedRows),
    totalSkippedTables: normalizeOptionalNumberValue(value.totalSkippedTables),
    unchangedFieldCount: normalizeOptionalNumberValue(value.unchangedFieldCount),
    unchangedStudentCount: normalizeOptionalNumberValue(value.unchangedStudentCount),
    warnings: normalizeMaterialImportIssues(value.warnings),
    writtenFieldCount: normalizeOptionalNumberValue(value.writtenFieldCount),
    writtenStudentCount: normalizeOptionalNumberValue(value.writtenStudentCount),
  };
}

async function parseMaterialImportResponse(response: Response) {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error('操行材料导入返回结果异常。');
  }

  if (!response.ok) {
    throw new Error(resolveRestEnvelopeErrorMessage(payload, '操行材料导入失败。'));
  }

  if (isRecord(payload) && 'data' in payload) {
    return assertMaterialImportResult(payload.data);
  }

  return assertMaterialImportResult(payload);
}

function getFileExtension(fileName: string) {
  return fileName.split('.').pop()?.trim().toLowerCase() ?? '';
}

function normalizeConductGradeMaterialFiles(files: readonly File[]) {
  if (files.length === 0) {
    throw new Error('请选择需要导入的操行材料。');
  }

  if (files.length > CONDUCT_GRADE_MATERIAL_IMPORT_MAX_FILES) {
    throw new Error(`单次最多导入 ${CONDUCT_GRADE_MATERIAL_IMPORT_MAX_FILES} 个操行材料文件。`);
  }

  return files.map((file) => {
    const extension = getFileExtension(file.name);

    if (!SUPPORTED_CONDUCT_GRADE_MATERIAL_FILE_EXTENSIONS.has(extension)) {
      throw new Error('操行材料仅支持 .doc、.docx、.xls、.xlsx。');
    }

    if (file.size > CONDUCT_GRADE_MATERIAL_IMPORT_MAX_FILE_BYTES) {
      throw new Error('操行材料单文件大小不能超过 200KB。');
    }

    return file;
  });
}

function normalizeConfirmedWarningKeys(confirmedWarningKeys: readonly string[] | null | undefined) {
  const keys = confirmedWarningKeys?.map((key) => key.trim()).filter((key) => key.length > 0) ?? [];

  return Array.from(new Set(keys));
}

function createMaterialImportFormData(
  input: ReturnType<typeof normalizeImportStudentConductGradeMaterialsInput>,
) {
  const formData = new FormData();

  formData.append('classCode', input.classCode);
  formData.append('schoolYear', input.schoolYear);
  formData.append('semester', input.semester);

  if (input.confirmedWarningKeys.length > 0) {
    formData.append('confirmedWarningKeys', JSON.stringify(input.confirmedWarningKeys));
  }

  input.files.forEach((file) => {
    formData.append('files', file);
  });

  return formData;
}

function normalizeConductPatchFieldKey(fieldKey: unknown): StudentConductGradePatchFieldKey {
  if (typeof fieldKey !== 'string' || !CONDUCT_PATCH_FIELD_KEY_SET.has(fieldKey)) {
    throw new Error('操行补录清除字段只支持 score、confirmedGrade。');
  }

  return fieldKey as StudentConductGradePatchFieldKey;
}

function normalizeConductPatchFieldKeys(
  fieldKeys: readonly StudentConductGradePatchFieldKey[] | null | undefined,
) {
  if (!fieldKeys?.length) {
    return undefined;
  }

  return Array.from(new Set(fieldKeys.map((fieldKey) => normalizeConductPatchFieldKey(fieldKey))));
}

function normalizeConductPatchStudent(student: PatchStudentConductGradeCorrectionStudentInput) {
  const studentId = normalizeRequiredTextValue(student.studentId, { label: '学生' });
  const score = normalizeOptionalTextValue(student.score, 'to_undefined');
  const confirmedGrade = normalizeOptionalTextValue(student.confirmedGrade, 'to_undefined');
  const clearFieldKeys = normalizeConductPatchFieldKeys(student.clearFieldKeys);

  for (const fieldKey of clearFieldKeys ?? []) {
    if (fieldKey === 'score' && score !== undefined) {
      throw new Error('同一个操行字段不能同时补录和清除。');
    }

    if (fieldKey === 'confirmedGrade' && confirmedGrade !== undefined) {
      throw new Error('同一个操行字段不能同时补录和清除。');
    }
  }

  const normalizedStudent = compactInput({
    clearFieldKeys,
    confirmedGrade,
    score,
    studentId,
  });

  if (!score && !confirmedGrade && !clearFieldKeys?.length) {
    throw new Error('每个学生至少需要一个操行补录或清除操作。');
  }

  return normalizedStudent;
}

export function normalizeConductWorkspaceInput(input: StudentConductGradeWorkspaceInput) {
  return compactInput({
    classId: normalizeOptionalTextValue(input.classId, 'to_undefined'),
    semesterId: normalizeOptionalPositiveInteger(input.semesterId, 'semesterId'),
  });
}

export function normalizeConductCleanupInput(input: StudentConductGradeCorrectionCleanupInput) {
  return {
    classId: normalizeRequiredTextValue(input.classId, { label: '班级' }),
    semesterId: normalizeRequiredPositiveInteger(input.semesterId, 'semesterId'),
    studentId: normalizeRequiredTextValue(input.studentId, { label: '学生' }),
  };
}

export function normalizePatchStudentConductGradeCorrectionsInput(
  input: PatchStudentConductGradeCorrectionsInput,
) {
  if (input.students.length === 0) {
    throw new Error('请至少选择一名需要补录操行的学生。');
  }

  if (input.students.length > MAX_PATCH_STUDENT_ROWS) {
    throw new Error(`单次操行补录最多提交 ${MAX_PATCH_STUDENT_ROWS} 名学生。`);
  }

  return {
    classId: normalizeRequiredTextValue(input.classId, { label: '班级' }),
    semesterId: normalizeRequiredPositiveInteger(input.semesterId, 'semesterId'),
    students: input.students.map((student) => normalizeConductPatchStudent(student)),
  };
}

export function normalizeImportStudentConductGradeMaterialsInput(
  input: ImportStudentConductGradeMaterialsInput,
) {
  return {
    classCode: normalizeRequiredTextValue(input.classCode, { label: '班级代码' }),
    confirmedWarningKeys: normalizeConfirmedWarningKeys(input.confirmedWarningKeys),
    files: normalizeConductGradeMaterialFiles(input.files),
    schoolYear: normalizeRequiredTextValue(input.schoolYear, { label: '学年' }),
    semester: normalizeRequiredTextValue(input.semester, { label: '学期' }),
  };
}

export function resolveStudentConductGradeMaterialImportUrl(
  graphQLEndpoint = getGraphQLEndpoint(),
) {
  return new URL(CONDUCT_GRADE_MATERIAL_IMPORT_PATH, graphQLEndpoint).toString();
}

export function normalizeRefreshConductClassInput(input: RefreshStudentConductGradeClassInput) {
  const semesterId = normalizeOptionalPositiveInteger(input.semesterId, 'semesterId');
  if (input.scope === 'SELECTED_TERM' && semesterId === undefined) {
    throw new Error('同步所选学期时必须提供 semesterId。');
  }
  if (input.scope === 'ALL_TERMS' && semesterId !== undefined) {
    throw new Error('同步全部学期时不得提供 semesterId。');
  }

  return compactInput({
    classId: normalizeRequiredTextValue(input.classId, { label: '班级' }),
    scope: input.scope,
    semesterId,
    upstreamSessionToken: normalizeRequiredTextValue(input.upstreamSessionToken, {
      label: 'upstream session token',
    }),
  });
}

function normalizeRequiredPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} 必须是正整数。`);
  }
  return value;
}

function normalizeOptionalPositiveInteger(
  value: number | null | undefined,
  label: string,
): number | undefined {
  return value === undefined || value === null
    ? undefined
    : normalizeRequiredPositiveInteger(value, label);
}

export function readStudentConductGradePatchRowIssues(
  error: unknown,
): StudentConductGradePatchRowIssue[] {
  if (!isGraphQLIngressError(error)) {
    return [];
  }

  return (
    error.graphqlErrors?.flatMap((graphqlError): StudentConductGradePatchRowIssue[] => {
      const extensions = graphqlError.extensions as Record<string, unknown> | undefined;
      const details = extensions?.details;
      const rowIssues = isRecord(details) ? details.rowIssues : undefined;

      if (!Array.isArray(rowIssues)) {
        return [];
      }

      const parsedRowIssues: StudentConductGradePatchRowIssue[] = [];

      rowIssues.forEach((rowIssue) => {
        if (!isRecord(rowIssue)) {
          return;
        }

        const rowIndex = rowIssue.rowIndex;
        const code = rowIssue.code;

        if (typeof rowIndex !== 'number' || !Number.isInteger(rowIndex)) {
          return;
        }

        if (typeof code !== 'string' || !code.trim()) {
          return;
        }

        parsedRowIssues.push({
          code: code.trim(),
          message: typeof rowIssue.message === 'string' ? rowIssue.message : null,
          rowIndex,
          studentId: typeof rowIssue.studentId === 'string' ? rowIssue.studentId : null,
        });
      });

      return parsedRowIssues;
    }) ?? []
  );
}

export function resolveStudentConductGradePatchErrorMessage(error: unknown, fallback: string) {
  if (isGraphQLIngressError(error)) {
    const firstError = error.graphqlErrors?.[0];
    const extensions = (firstError?.extensions as Record<string, unknown> | undefined) || {};

    if (typeof extensions.errorMessage === 'string' && extensions.errorMessage.trim()) {
      return extensions.errorMessage;
    }

    if (
      typeof firstError?.message === 'string' &&
      firstError.message.trim() &&
      firstError.message !== extensions.code &&
      firstError.message !== extensions.errorCode
    ) {
      return firstError.message;
    }

    return error.userMessage;
  }

  return error instanceof Error ? error.message : fallback;
}

export async function fetchStudentConductGradeWorkspace(input: StudentConductGradeWorkspaceInput) {
  const response = await requestGraphQL<
    ConductWorkspaceResponse,
    {
      input: ReturnType<typeof normalizeConductWorkspaceInput>;
    }
  >(CONDUCT_WORKSPACE_QUERY, {
    input: normalizeConductWorkspaceInput(input),
  });

  return normalizeConductWorkspace(response.studentConductGradeWorkspace);
}

export async function cleanupStudentConductGradeCorrection(
  input: StudentConductGradeCorrectionCleanupInput,
) {
  const response = await requestGraphQL<
    ConductCleanupResponse,
    {
      input: ReturnType<typeof normalizeConductCleanupInput>;
    }
  >(CLEANUP_CONDUCT_MUTATION, {
    input: normalizeConductCleanupInput(input),
  });

  return response.cleanupStudentConductGradeCorrection;
}

export async function patchStudentConductGradeCorrections(
  input: PatchStudentConductGradeCorrectionsInput,
) {
  const response = await requestGraphQL<
    ConductPatchResponse,
    {
      input: ReturnType<typeof normalizePatchStudentConductGradeCorrectionsInput>;
    }
  >(PATCH_CONDUCT_CORRECTIONS_MUTATION, {
    input: normalizePatchStudentConductGradeCorrectionsInput(input),
  });

  return response.patchStudentConductGradeCorrections;
}

export async function importStudentConductGradeMaterials(
  input: ImportStudentConductGradeMaterialsInput,
) {
  const normalizedInput = normalizeImportStudentConductGradeMaterialsInput(input);
  const runtimeConfig = getGraphQLRuntimeConfig();
  const dispatchImport = () =>
    fetch(resolveStudentConductGradeMaterialImportUrl(), {
      body: createMaterialImportFormData(normalizedInput),
      headers: buildAuthorizationHeaders(),
      method: 'POST',
    });

  let response = await dispatchImport();

  if (response.status === 401 && !runtimeConfig.refreshSession) {
    runtimeConfig.onAuthFailure?.();
    throw new Error(
      (await readRestFailureMessage(response)) ?? '登录状态已失效，请重新登录后再导入操行材料。',
    );
  }

  if (response.status === 401 && runtimeConfig.refreshSession) {
    try {
      await runtimeConfig.refreshSession();
      response = await dispatchImport();
    } catch {
      runtimeConfig.onAuthFailure?.();
      throw new Error('登录状态已失效，请重新登录后再导入操行材料。');
    }

    if (response.status === 401) {
      runtimeConfig.onAuthFailure?.();
      throw new Error(
        (await readRestFailureMessage(response)) ?? '登录状态已失效，请重新登录后再导入操行材料。',
      );
    }
  }

  return await parseMaterialImportResponse(response);
}

export async function refreshStudentConductGradeClassFromUpstream(
  input: RefreshStudentConductGradeClassInput,
) {
  const response = await executeUpstreamSessionGraphQL<
    RefreshConductClassResponse,
    {
      input: ReturnType<typeof normalizeRefreshConductClassInput>;
    }
  >(REFRESH_CONDUCT_CLASS_MUTATION, {
    input: normalizeRefreshConductClassInput(input),
  });

  return response.refreshStudentConductGradeClassFromUpstream;
}

function normalizeConductWorkspace(
  workspace: ConductWorkspaceResponse['studentConductGradeWorkspace'],
): StudentConductGradeWorkspace {
  return {
    ...workspace,
    classOptions: workspace.classOptions.map(normalizeWorkspaceClassOption),
    selectedClass: workspace.selectedClass
      ? normalizeWorkspaceClassOption(workspace.selectedClass)
      : null,
    termOptions: workspace.termOptions,
    selectedTerm: workspace.selectedTerm,
  };
}

function normalizeWorkspaceClassOption(
  option: ConductWorkspaceResponse['studentConductGradeWorkspace']['classOptions'][number],
): StudentConductGradeWorkspaceClassOption {
  return {
    ...option,
    id: option.classId,
  };
}
