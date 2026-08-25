// src/labs/student-evaluation-comment-workbench/infrastructure/api.ts

import { executeUpstreamSessionGraphQL } from '@/entities/upstream-session';

import { executeGraphQL, getGraphQLEndpoint, getGraphQLRuntimeConfig } from '@/shared/graphql';

import type {
  GenerateStudentEvaluationCommentAiDraftsResult,
  ImportStudentEvaluationCommentMaterialInput,
  RefreshStudentEvaluationCommentBasisResult,
  RefreshStudentEvaluationCommentCourseBasisResult,
  StudentEvaluationCommentAiAddress,
  StudentEvaluationCommentAiDraft,
  StudentEvaluationCommentAiLength,
  StudentEvaluationCommentAiTone,
  StudentEvaluationCommentMaterialIdentityMappingGroup,
  StudentEvaluationCommentMaterialImportResult,
  StudentEvaluationCommentMaterialImportStatus,
  StudentEvaluationCommentMaterialNotice,
  StudentEvaluationCommentMaterialPreviewRow,
  StudentEvaluationCommentMaterialSheetOption,
  StudentEvaluationCommentRevision,
  StudentEvaluationCommentWorkbench,
} from '../types';

const STUDENT_EVALUATION_COMMENT_MATERIAL_IMPORT_PATH =
  '/student-evaluation-comments/material-imports';
export const STUDENT_EVALUATION_COMMENT_MATERIAL_MAX_FILE_BYTES = 1024 * 1024;
export const STUDENT_EVALUATION_COMMENT_MATERIAL_MAX_MAPPINGS = 100;

const WORKSPACE_QUERY = `
  query StudentEvaluationCommentProductWorkbench(
    $input: StudentEvaluationCommentWorkspaceInput!
  ) {
    studentEvaluationCommentWorkspace(input: $input) {
      status
      commentKind
      classOptions {
        classId
        classCode
        className
        catalogStatus
        blockingReasonCode
        blockingReasonMessage
      }
      selectedClass {
        classId
        classCode
        className
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
          aiDraft {
            draftId
            content
            revision {
              payloadHash
              payloadVersion
            }
            expiresAt
            updatedAt
          }
          isAiDraftGenerating
        }
      }
    }
  }
`;

const GENERATE_AI_DRAFTS_MUTATION = `
  mutation GenerateStudentEvaluationCommentProductDrafts(
    $input: GenerateStudentEvaluationCommentAiDraftsInput!
  ) {
    generateStudentEvaluationCommentAiDrafts(input: $input) {
      status
      counts {
        requested
        accepted
        formalCommentExists
        draftExists
        alreadyGenerating
        basisMissing
      }
      items {
        studentId
        disposition
      }
    }
  }
`;

const SAVE_AI_DRAFT_MUTATION = `
  mutation SaveStudentEvaluationCommentProductDraft(
    $input: SaveStudentEvaluationCommentAiDraftInput!
  ) {
    saveStudentEvaluationCommentAiDraft(input: $input) {
      status
      draft {
        draftId
        content
        revision {
          payloadHash
          payloadVersion
        }
        expiresAt
        updatedAt
      }
    }
  }
`;

const DISCARD_AI_DRAFTS_MUTATION = `
  mutation DiscardStudentEvaluationCommentProductDrafts(
    $input: DiscardStudentEvaluationCommentAiDraftsInput!
  ) {
    discardStudentEvaluationCommentAiDrafts(input: $input) {
      status
      discardedCount
    }
  }
`;

const CONFIRM_AI_DRAFTS_MUTATION = `
  mutation ConfirmStudentEvaluationCommentProductDrafts(
    $input: ConfirmStudentEvaluationCommentAiDraftsInput!
  ) {
    confirmStudentEvaluationCommentAiDrafts(input: $input) {
      status
      confirmedCount
    }
  }
`;

const WRITE_COMMENTS_MUTATION = `
  mutation WriteStudentEvaluationCommentProductComments(
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
    }
  }
`;

const REFRESH_CONDUCT_BASIS_MUTATION = `
  mutation RefreshStudentEvaluationCommentProductConductBasis(
    $input: RefreshStudentConductGradeClassFromUpstreamInput!
  ) {
    refreshStudentConductGradeClassFromUpstream(input: $input) {
      writtenStudentCount
      failureCount
      upstreamSessionToken
      expiresAt
    }
  }
`;

const REFRESH_COURSE_BASIS_MUTATION = `
  mutation RefreshStudentEvaluationCommentProductCourseBasis(
    $input: RefreshClassCourseGradesInput!
  ) {
    refreshClassCourseGrades(input: $input) {
      studentCount
      failedStudentCount
      upstreamSessionToken
      expiresAt
    }
  }
`;

export function getStudentEvaluationCommentProductWorkbench(input: {
  classId?: string;
  semesterId?: number;
}) {
  return executeGraphQL<
    { studentEvaluationCommentWorkspace: StudentEvaluationCommentWorkbench },
    { input: { classId?: string; commentKind: 'TERM'; semesterId?: number } }
  >(WORKSPACE_QUERY, { input: { ...input, commentKind: 'TERM' } }).then(
    (response) => response.studentEvaluationCommentWorkspace,
  );
}

export function generateStudentEvaluationCommentProductDrafts(input: {
  address: StudentEvaluationCommentAiAddress;
  classId: string;
  length: StudentEvaluationCommentAiLength;
  semesterId: number;
  studentIds: string[];
  styleExampleStudentIds: string[];
  tone: StudentEvaluationCommentAiTone;
}) {
  return executeGraphQL<
    { generateStudentEvaluationCommentAiDrafts: GenerateStudentEvaluationCommentAiDraftsResult },
    { input: typeof input }
  >(GENERATE_AI_DRAFTS_MUTATION, { input }).then(
    (response) => response.generateStudentEvaluationCommentAiDrafts,
  );
}

export function saveStudentEvaluationCommentProductDraft(input: {
  classId: string;
  content: string;
  draftId: string;
  expectedRevision: StudentEvaluationCommentRevision;
  semesterId: number;
}) {
  const mutationInput = {
    classId: input.classId,
    content: input.content,
    draftId: input.draftId,
    expectedRevision: toRevisionInput(input.expectedRevision),
    semesterId: input.semesterId,
  };
  return executeGraphQL<
    { saveStudentEvaluationCommentAiDraft: { draft: StudentEvaluationCommentAiDraft } },
    { input: typeof mutationInput }
  >(SAVE_AI_DRAFT_MUTATION, { input: mutationInput }).then(
    (response) => response.saveStudentEvaluationCommentAiDraft.draft,
  );
}

export function discardStudentEvaluationCommentProductDrafts(input: {
  classId: string;
  items: Array<{ draftId: string; expectedRevision: StudentEvaluationCommentRevision }>;
  semesterId: number;
}) {
  const mutationInput = {
    classId: input.classId,
    items: input.items.map(toDraftMutationItemInput),
    semesterId: input.semesterId,
  };
  return executeGraphQL<
    { discardStudentEvaluationCommentAiDrafts: { discardedCount: number } },
    { input: typeof mutationInput }
  >(DISCARD_AI_DRAFTS_MUTATION, { input: mutationInput }).then(
    (response) => response.discardStudentEvaluationCommentAiDrafts,
  );
}

export function confirmStudentEvaluationCommentProductDrafts(input: {
  classId: string;
  items: Array<{ draftId: string; expectedRevision: StudentEvaluationCommentRevision }>;
  semesterId: number;
}) {
  const mutationInput = {
    classId: input.classId,
    items: input.items.map(toDraftMutationItemInput),
    semesterId: input.semesterId,
  };
  return executeGraphQL<
    { confirmStudentEvaluationCommentAiDrafts: { confirmedCount: number } },
    { input: typeof mutationInput }
  >(CONFIRM_AI_DRAFTS_MUTATION, { input: mutationInput }).then(
    (response) => response.confirmStudentEvaluationCommentAiDrafts,
  );
}

export function writeStudentEvaluationCommentProductComment(input: {
  classId: string;
  content: string;
  expectedRevision: StudentEvaluationCommentRevision | null;
  semesterId: number;
  studentId: string;
}) {
  return writeStudentEvaluationCommentProductComments({
    classId: input.classId,
    items: [
      {
        content: input.content,
        expectedRevision: input.expectedRevision,
        studentId: input.studentId,
      },
    ],
    semesterId: input.semesterId,
  });
}

export function writeStudentEvaluationCommentProductComments(input: {
  classId: string;
  items: Array<{
    content: string;
    expectedRevision: StudentEvaluationCommentRevision | null;
    studentId: string;
  }>;
  semesterId: number;
}) {
  const mutationInput = {
    classId: input.classId,
    commentKind: 'TERM' as const,
    items: input.items.map((item) => ({
      action: 'UPSERT' as const,
      content: item.content,
      expectedRevision: item.expectedRevision ? toRevisionInput(item.expectedRevision) : null,
      studentId: item.studentId,
    })),
    semesterId: input.semesterId,
  };
  return executeGraphQL<
    {
      batchWriteStudentEvaluationComments: {
        counts: { created: number; deleted: number; unchanged: number; updated: number };
        status: 'UPDATED' | 'NO_CHANGES';
      };
    },
    { input: typeof mutationInput }
  >(WRITE_COMMENTS_MUTATION, { input: mutationInput }).then(
    (response) => response.batchWriteStudentEvaluationComments,
  );
}

export function refreshStudentEvaluationCommentProductConductBasis(input: {
  classId: string;
  semesterId: number;
  upstreamSessionToken: string;
}) {
  const mutationInput = {
    classId: input.classId,
    scope: 'SELECTED_TERM' as const,
    semesterId: input.semesterId,
    upstreamSessionToken: input.upstreamSessionToken,
  };
  return executeUpstreamSessionGraphQL<
    { refreshStudentConductGradeClassFromUpstream: RefreshStudentEvaluationCommentBasisResult },
    { input: typeof mutationInput }
  >(REFRESH_CONDUCT_BASIS_MUTATION, { input: mutationInput }).then(
    (response) => response.refreshStudentConductGradeClassFromUpstream,
  );
}

export function refreshStudentEvaluationCommentProductCourseBasis(input: {
  classId: string;
  semesterId: number;
  upstreamSessionToken: string;
}) {
  const mutationInput = {
    classId: input.classId,
    scope: 'SELECTED_TERM' as const,
    semesterId: input.semesterId,
    sessionToken: input.upstreamSessionToken,
  };
  return executeUpstreamSessionGraphQL<
    { refreshClassCourseGrades: RefreshStudentEvaluationCommentCourseBasisResult },
    { input: typeof mutationInput }
  >(REFRESH_COURSE_BASIS_MUTATION, { input: mutationInput }).then(
    (response) => response.refreshClassCourseGrades,
  );
}

function isMaterialRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readMaterialString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`评语材料导入返回的${label}无效。`);
  }

  return value.trim();
}

function readMaterialCount(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`评语材料导入返回的${label}无效。`);
  }

  return value;
}

function readMaterialSemesterId(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error('评语材料导入返回的学期编号无效。');
  }

  return value;
}

function normalizeMaterialImportStatus(
  value: unknown,
): StudentEvaluationCommentMaterialImportStatus {
  if (
    value === 'SHEET_SELECTION_REQUIRED' ||
    value === 'IDENTITY_MAPPING_REQUIRED' ||
    value === 'READY_TO_SAVE' ||
    value === 'NO_CHANGES' ||
    value === 'BLOCKED'
  ) {
    return value;
  }

  throw new Error('评语材料导入返回状态异常。');
}

function normalizeMaterialNotice(value: unknown): StudentEvaluationCommentMaterialNotice {
  if (!isMaterialRecord(value)) throw new Error('评语材料导入问题返回结果异常。');

  return {
    code: readMaterialString(value.code, '问题代码'),
    message: readMaterialString(value.message, '问题说明'),
    ...(Array.isArray(value.sourceRows)
      ? { sourceRows: value.sourceRows.map((row) => readMaterialCount(row, '源行号')) }
      : {}),
    ...(typeof value.sourceSheet === 'string' && value.sourceSheet.trim()
      ? { sourceSheet: value.sourceSheet.trim() }
      : {}),
  };
}

function normalizeMaterialNotices(value: unknown) {
  if (!Array.isArray(value)) throw new Error('评语材料导入问题列表返回结果异常。');

  return value.map(normalizeMaterialNotice);
}

function normalizeMaterialSheetOption(value: unknown): StudentEvaluationCommentMaterialSheetOption {
  if (!isMaterialRecord(value)) throw new Error('评语材料导入工作表选项异常。');
  if (value.recognitionMode !== 'HEADER' && value.recognitionMode !== 'DATA_FIRST') {
    throw new Error('评语材料导入工作表识别模式异常。');
  }

  return {
    candidateRowCount: readMaterialCount(value.candidateRowCount, '候选行数'),
    recognitionMode: value.recognitionMode,
    sheetName: readMaterialString(value.sheetName, '工作表名称'),
  };
}

function normalizeMaterialMappingGroup(
  value: unknown,
): StudentEvaluationCommentMaterialIdentityMappingGroup {
  if (
    !isMaterialRecord(value) ||
    !Array.isArray(value.candidates) ||
    !Array.isArray(value.sourceRows)
  ) {
    throw new Error('评语材料导入身份映射返回结果异常。');
  }

  return {
    candidates: value.candidates.map((candidate) => {
      if (!isMaterialRecord(candidate)) {
        throw new Error('评语材料导入候选学生返回结果异常。');
      }

      return {
        studentId: readMaterialString(candidate.studentId, '候选学生编号'),
        studentName: readMaterialString(candidate.studentName, '候选学生姓名'),
      };
    }),
    mappingKey: readMaterialString(value.mappingKey, '身份映射 key'),
    sourceRows: value.sourceRows.map((row) => readMaterialCount(row, '源行号')),
    sourceStudentName: readMaterialString(value.sourceStudentName, '来源学生姓名'),
    sourceStudentNumber:
      value.sourceStudentNumber === null
        ? null
        : readMaterialString(value.sourceStudentNumber, '来源学生学号'),
  };
}

function normalizeMaterialRevision(value: unknown): StudentEvaluationCommentRevision | null {
  if (value === null) return null;
  if (!isMaterialRecord(value)) throw new Error('评语材料导入 revision 返回结果异常。');

  return {
    payloadHash: readMaterialString(value.payloadHash, 'payload hash'),
    payloadVersion: readMaterialCount(value.payloadVersion, 'payload version'),
  };
}

function normalizeMaterialPreviewRow(value: unknown): StudentEvaluationCommentMaterialPreviewRow {
  if (!isMaterialRecord(value)) throw new Error('评语材料导入预览行异常。');
  if (value.proposedAction !== 'CREATE' && value.proposedAction !== 'UPDATE') {
    throw new Error('评语材料导入预览动作异常。');
  }
  if (
    value.matchedBy !== 'STUDENT_ID' &&
    value.matchedBy !== 'UPSTREAM_ID' &&
    value.matchedBy !== 'NON_CANONICAL_ID_AND_UNIQUE_NAME' &&
    value.matchedBy !== 'UNIQUE_NAME' &&
    value.matchedBy !== 'MANUAL'
  ) {
    throw new Error('评语材料导入身份匹配方式异常。');
  }

  return {
    content: readMaterialString(value.content, '评语正文'),
    expectedRevision: normalizeMaterialRevision(value.expectedRevision),
    matchedBy: value.matchedBy,
    proposedAction: value.proposedAction,
    sourceRow: readMaterialCount(value.sourceRow, '源行号'),
    sourceSheet: readMaterialString(value.sourceSheet, '源工作表'),
    studentId: readMaterialString(value.studentId, '学生编号'),
    studentName: readMaterialString(value.studentName, '学生姓名'),
  };
}

function normalizeMaterialImportResult(
  value: unknown,
): StudentEvaluationCommentMaterialImportResult {
  if (!isMaterialRecord(value) || !isMaterialRecord(value.summary)) {
    throw new Error('评语材料导入返回结果异常。');
  }
  if (value.commentKind !== 'TERM') throw new Error('评语材料导入类型异常。');
  if (
    !Array.isArray(value.sheetOptions) ||
    !Array.isArray(value.identityMappingGroups) ||
    !Array.isArray(value.previewRows)
  ) {
    throw new Error('评语材料导入列表返回结果异常。');
  }

  return {
    blockingErrors: normalizeMaterialNotices(value.blockingErrors),
    classId: readMaterialString(value.classId, '班级编号'),
    className: readMaterialString(value.className, '班级名称'),
    commentKind: value.commentKind,
    identityMappingGroups: value.identityMappingGroups.map(normalizeMaterialMappingGroup),
    previewRows: value.previewRows.map(normalizeMaterialPreviewRow),
    selectedSheet:
      value.selectedSheet === null ? null : readMaterialString(value.selectedSheet, '选中工作表'),
    semesterId: readMaterialSemesterId(value.semesterId),
    sheetOptions: value.sheetOptions.map(normalizeMaterialSheetOption),
    status: normalizeMaterialImportStatus(value.status),
    summary: {
      blankCommentCount: readMaterialCount(value.summary.blankCommentCount, '空白评语数'),
      createCount: readMaterialCount(value.summary.createCount, '新建数'),
      matchedRows: readMaterialCount(value.summary.matchedRows, '匹配行数'),
      parsedRows: readMaterialCount(value.summary.parsedRows, '解析行数'),
      unchangedCount: readMaterialCount(value.summary.unchangedCount, '不变数'),
      updateCount: readMaterialCount(value.summary.updateCount, '更新数'),
    },
    warnings: normalizeMaterialNotices(value.warnings),
  };
}

function readMaterialRestError(payload: unknown) {
  if (!isMaterialRecord(payload)) return null;
  if (isMaterialRecord(payload.error) && typeof payload.error.message === 'string') {
    return payload.error.message.trim() || null;
  }
  if (typeof payload.errorMessage === 'string') return payload.errorMessage.trim() || null;

  return null;
}

async function readMaterialFailureMessage(response: Response) {
  try {
    return readMaterialRestError(await response.json());
  } catch {
    return null;
  }
}

async function parseMaterialImportResponse(response: Response) {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error('评语材料导入返回结果异常。');
  }

  if (!response.ok) throw new Error(readMaterialRestError(payload) ?? '评语材料导入失败。');
  if (!isMaterialRecord(payload) || !('data' in payload)) {
    throw new Error('评语材料导入返回结果异常。');
  }

  return normalizeMaterialImportResult(payload.data);
}

function normalizeMaterialImportInput(input: ImportStudentEvaluationCommentMaterialInput) {
  const classId = input.classId.trim();
  if (!classId) throw new Error('请选择评语班级。');
  if (!input.file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('评语材料只支持 .xlsx 文件。');
  }
  if (input.file.size < 1 || input.file.size > STUDENT_EVALUATION_COMMENT_MATERIAL_MAX_FILE_BYTES) {
    throw new Error('评语 Excel 文件大小必须在 1 MiB 以内。');
  }
  if (!Number.isSafeInteger(input.semesterId) || input.semesterId < 1) {
    throw new Error('学期评语必须选择有效学期。');
  }

  const identityMappings = input.identityMappings ?? [];
  if (identityMappings.length > STUDENT_EVALUATION_COMMENT_MATERIAL_MAX_MAPPINGS) {
    throw new Error('评语材料身份映射最多 100 项。');
  }

  return {
    classId,
    file: input.file,
    identityMappings: identityMappings.map((mapping) => {
      const mappingKey = mapping.mappingKey.trim();
      const studentId = mapping.studentId.trim();
      if (!/^[a-f0-9]{64}$/.test(mappingKey) || !studentId) {
        throw new Error('评语材料身份映射格式无效。');
      }
      return { mappingKey, studentId };
    }),
    selectedSheet: input.selectedSheet?.trim() || null,
    semesterId: input.semesterId,
  };
}

function createMaterialImportFormData(input: ReturnType<typeof normalizeMaterialImportInput>) {
  const formData = new FormData();

  formData.append('classId', input.classId);
  formData.append('commentKind', 'TERM');
  formData.append('semesterId', String(input.semesterId));
  if (input.selectedSheet) formData.append('selectedSheet', input.selectedSheet);
  if (input.identityMappings.length > 0) {
    formData.append('identityMappings', JSON.stringify(input.identityMappings));
  }
  formData.append('file', input.file);

  return formData;
}

function buildMaterialAuthorizationHeaders() {
  const accessToken = getGraphQLRuntimeConfig().getAccessToken?.() ?? null;

  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

export function resolveStudentEvaluationCommentProductMaterialImportUrl(
  graphQLEndpoint = getGraphQLEndpoint(),
) {
  return new URL(STUDENT_EVALUATION_COMMENT_MATERIAL_IMPORT_PATH, graphQLEndpoint).toString();
}

export async function importStudentEvaluationCommentProductMaterial(
  input: ImportStudentEvaluationCommentMaterialInput,
) {
  const normalizedInput = normalizeMaterialImportInput(input);
  const runtimeConfig = getGraphQLRuntimeConfig();
  const dispatchImport = () =>
    fetch(resolveStudentEvaluationCommentProductMaterialImportUrl(), {
      body: createMaterialImportFormData(normalizedInput),
      headers: buildMaterialAuthorizationHeaders(),
      method: 'POST',
    });

  let response = await dispatchImport();

  if (response.status === 401 && !runtimeConfig.refreshSession) {
    runtimeConfig.onAuthFailure?.();
    throw new Error((await readMaterialFailureMessage(response)) ?? '登录状态已失效，请重新登录。');
  }

  if (response.status === 401 && runtimeConfig.refreshSession) {
    try {
      await runtimeConfig.refreshSession();
      response = await dispatchImport();
    } catch {
      runtimeConfig.onAuthFailure?.();
      throw new Error('登录状态已失效，请重新登录。');
    }

    if (response.status === 401) runtimeConfig.onAuthFailure?.();
  }

  return await parseMaterialImportResponse(response);
}

function toDraftMutationItemInput(input: {
  draftId: string;
  expectedRevision: StudentEvaluationCommentRevision;
}) {
  return {
    draftId: input.draftId,
    expectedRevision: toRevisionInput(input.expectedRevision),
  };
}

function toRevisionInput(revision: StudentEvaluationCommentRevision) {
  return {
    payloadHash: revision.payloadHash,
    payloadVersion: revision.payloadVersion,
  };
}
