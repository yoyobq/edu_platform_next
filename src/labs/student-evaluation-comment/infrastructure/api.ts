// src/labs/student-evaluation-comment/infrastructure/api.ts

import { executeGraphQL, getGraphQLEndpoint, getGraphQLRuntimeConfig } from '@/shared/graphql';

import type {
  BatchWriteStudentEvaluationCommentsResult,
  ImportStudentEvaluationCommentMaterialInput,
  MyStudentEvaluationComments,
  StudentEvaluationCommentMaterialIdentityMappingGroup,
  StudentEvaluationCommentMaterialImportResult,
  StudentEvaluationCommentMaterialImportStatus,
  StudentEvaluationCommentMaterialNotice,
  StudentEvaluationCommentMaterialPreviewRow,
  StudentEvaluationCommentMaterialSheetOption,
  StudentEvaluationCommentRevision,
  StudentEvaluationCommentScopeInput,
  StudentEvaluationCommentWorkspace,
  StudentEvaluationCommentWriteItem,
} from '../types';

const STUDENT_EVALUATION_COMMENT_MATERIAL_IMPORT_PATH =
  '/student-evaluation-comments/material-imports';
export const STUDENT_EVALUATION_COMMENT_MATERIAL_MAX_FILE_BYTES = 1024 * 1024;
export const STUDENT_EVALUATION_COMMENT_MATERIAL_MAX_MAPPINGS = 100;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`评语材料导入返回的${label}无效。`);
  }

  return value.trim();
}

function readNullableString(value: unknown, label: string) {
  if (value === null) return null;

  return readRequiredString(value, label);
}

function readNonNegativeInteger(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`评语材料导入返回的${label}无效。`);
  }

  return value;
}

function readNullablePositiveInteger(value: unknown, label: string) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`评语材料导入返回的${label}无效。`);
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
  if (!isRecord(value)) {
    throw new Error('评语材料导入问题返回结果异常。');
  }

  const sourceRows = value.sourceRows;

  return {
    code: readRequiredString(value.code, '问题代码'),
    message: readRequiredString(value.message, '问题说明'),
    ...(Array.isArray(sourceRows)
      ? {
          sourceRows: sourceRows.map((row) => readNonNegativeInteger(row, '源行号')),
        }
      : {}),
    ...(typeof value.sourceSheet === 'string' && value.sourceSheet.trim()
      ? { sourceSheet: value.sourceSheet.trim() }
      : {}),
  };
}

function normalizeMaterialNotices(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error('评语材料导入问题列表返回结果异常。');
  }

  return value.map(normalizeMaterialNotice);
}

function normalizeSheetOption(value: unknown): StudentEvaluationCommentMaterialSheetOption {
  if (!isRecord(value)) {
    throw new Error('评语材料导入工作表选项异常。');
  }
  if (value.recognitionMode !== 'HEADER' && value.recognitionMode !== 'DATA_FIRST') {
    throw new Error('评语材料导入工作表识别模式异常。');
  }

  return {
    candidateRowCount: readNonNegativeInteger(value.candidateRowCount, '候选行数'),
    recognitionMode: value.recognitionMode,
    sheetName: readRequiredString(value.sheetName, '工作表名称'),
  };
}

function normalizeMappingGroup(
  value: unknown,
): StudentEvaluationCommentMaterialIdentityMappingGroup {
  if (!isRecord(value) || !Array.isArray(value.candidates) || !Array.isArray(value.sourceRows)) {
    throw new Error('评语材料导入身份映射返回结果异常。');
  }

  return {
    candidates: value.candidates.map((candidate) => {
      if (!isRecord(candidate)) {
        throw new Error('评语材料导入候选学生返回结果异常。');
      }

      return {
        studentId: readRequiredString(candidate.studentId, '候选学生编号'),
        studentName: readRequiredString(candidate.studentName, '候选学生姓名'),
      };
    }),
    mappingKey: readRequiredString(value.mappingKey, '身份映射 key'),
    sourceRows: value.sourceRows.map((row) => readNonNegativeInteger(row, '源行号')),
    sourceStudentName: readRequiredString(value.sourceStudentName, '来源学生姓名'),
    sourceStudentNumber:
      value.sourceStudentNumber === null
        ? null
        : readRequiredString(value.sourceStudentNumber, '来源学生学号'),
  };
}

function normalizeRevision(value: unknown): StudentEvaluationCommentRevision | null {
  if (value === null) return null;
  if (!isRecord(value)) {
    throw new Error('评语材料导入 revision 返回结果异常。');
  }

  return {
    payloadHash: readRequiredString(value.payloadHash, 'payload hash'),
    payloadVersion: readNonNegativeInteger(value.payloadVersion, 'payload version'),
  };
}

function normalizePreviewRow(value: unknown): StudentEvaluationCommentMaterialPreviewRow {
  if (!isRecord(value)) {
    throw new Error('评语材料导入预览行异常。');
  }
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
    content: readRequiredString(value.content, '评语正文'),
    expectedRevision: normalizeRevision(value.expectedRevision),
    matchedBy: value.matchedBy,
    proposedAction: value.proposedAction,
    sourceRow: readNonNegativeInteger(value.sourceRow, '源行号'),
    sourceSheet: readRequiredString(value.sourceSheet, '源工作表'),
    studentId: readRequiredString(value.studentId, '学生编号'),
    studentName: readRequiredString(value.studentName, '学生姓名'),
  };
}

function assertMaterialImportResult(value: unknown): StudentEvaluationCommentMaterialImportResult {
  if (!isRecord(value) || !isRecord(value.summary)) {
    throw new Error('评语材料导入返回结果异常。');
  }
  if (value.commentKind !== 'TERM' && value.commentKind !== 'GRADUATION') {
    throw new Error('评语材料导入类型异常。');
  }
  if (
    !Array.isArray(value.sheetOptions) ||
    !Array.isArray(value.identityMappingGroups) ||
    !Array.isArray(value.previewRows)
  ) {
    throw new Error('评语材料导入列表返回结果异常。');
  }

  return {
    blockingErrors: normalizeMaterialNotices(value.blockingErrors),
    classId: readRequiredString(value.classId, '班级编号'),
    className: readRequiredString(value.className, '班级名称'),
    commentKind: value.commentKind,
    identityMappingGroups: value.identityMappingGroups.map(normalizeMappingGroup),
    previewRows: value.previewRows.map(normalizePreviewRow),
    selectedSheet: readNullableString(value.selectedSheet, '选中工作表'),
    semesterId: readNullablePositiveInteger(value.semesterId, '学期编号'),
    sheetOptions: value.sheetOptions.map(normalizeSheetOption),
    status: normalizeMaterialImportStatus(value.status),
    summary: {
      blankCommentCount: readNonNegativeInteger(value.summary.blankCommentCount, '空白评语数'),
      createCount: readNonNegativeInteger(value.summary.createCount, '新建数'),
      matchedRows: readNonNegativeInteger(value.summary.matchedRows, '匹配行数'),
      parsedRows: readNonNegativeInteger(value.summary.parsedRows, '解析行数'),
      unchangedCount: readNonNegativeInteger(value.summary.unchangedCount, '不变数'),
      updateCount: readNonNegativeInteger(value.summary.updateCount, '更新数'),
    },
    warnings: normalizeMaterialNotices(value.warnings),
  };
}

function readRestErrorMessage(payload: unknown) {
  if (!isRecord(payload)) return null;
  if (isRecord(payload.error) && typeof payload.error.message === 'string') {
    return payload.error.message.trim() || null;
  }
  if (typeof payload.errorMessage === 'string') {
    return payload.errorMessage.trim() || null;
  }

  return null;
}

async function readRestFailureMessage(response: Response) {
  try {
    return readRestErrorMessage(await response.json());
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

  if (!response.ok) {
    throw new Error(readRestErrorMessage(payload) ?? '评语材料导入失败。');
  }
  if (!isRecord(payload) || !('data' in payload)) {
    throw new Error('评语材料导入返回结果异常。');
  }

  return assertMaterialImportResult(payload.data);
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
  if (
    input.commentKind === 'TERM' &&
    (!Number.isSafeInteger(input.semesterId) || (input.semesterId ?? 0) < 1)
  ) {
    throw new Error('学期评语必须选择有效学期。');
  }
  if (input.commentKind === 'GRADUATION' && input.semesterId !== null) {
    throw new Error('毕业评语不得携带学期。');
  }

  const identityMappings = input.identityMappings ?? [];
  if (identityMappings.length > STUDENT_EVALUATION_COMMENT_MATERIAL_MAX_MAPPINGS) {
    throw new Error('评语材料身份映射最多 100 项。');
  }

  return {
    classId,
    commentKind: input.commentKind,
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
  formData.append('commentKind', input.commentKind);
  if (input.semesterId !== null) formData.append('semesterId', String(input.semesterId));
  if (input.selectedSheet) formData.append('selectedSheet', input.selectedSheet);
  if (input.identityMappings.length > 0) {
    formData.append('identityMappings', JSON.stringify(input.identityMappings));
  }
  formData.append('file', input.file);

  return formData;
}

function buildAuthorizationHeaders() {
  const accessToken = getGraphQLRuntimeConfig().getAccessToken?.() ?? null;

  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

export function resolveStudentEvaluationCommentMaterialImportUrl(
  graphQLEndpoint = getGraphQLEndpoint(),
) {
  return new URL(STUDENT_EVALUATION_COMMENT_MATERIAL_IMPORT_PATH, graphQLEndpoint).toString();
}

export async function importStudentEvaluationCommentMaterial(
  input: ImportStudentEvaluationCommentMaterialInput,
) {
  const normalizedInput = normalizeMaterialImportInput(input);
  const runtimeConfig = getGraphQLRuntimeConfig();
  const dispatchImport = () =>
    fetch(resolveStudentEvaluationCommentMaterialImportUrl(), {
      body: createMaterialImportFormData(normalizedInput),
      headers: buildAuthorizationHeaders(),
      method: 'POST',
    });

  let response = await dispatchImport();

  if (response.status === 401 && !runtimeConfig.refreshSession) {
    runtimeConfig.onAuthFailure?.();
    throw new Error((await readRestFailureMessage(response)) ?? '登录状态已失效，请重新登录。');
  }

  if (response.status === 401 && runtimeConfig.refreshSession) {
    try {
      await runtimeConfig.refreshSession();
      response = await dispatchImport();
    } catch {
      runtimeConfig.onAuthFailure?.();
      throw new Error('登录状态已失效，请重新登录。');
    }

    if (response.status === 401) {
      runtimeConfig.onAuthFailure?.();
    }
  }

  return await parseMaterialImportResponse(response);
}
