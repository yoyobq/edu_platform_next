// src/labs/student-registration-cards/infrastructure/api.ts
import { executeGraphQL, getGraphQLEndpoint, getGraphQLRuntimeConfig } from '@/shared/graphql';

export type ClassOption = { id: string; className: string; classCode: string };
export type StudentOption = { studentId: string; studentName: string };
export type CardPreflight = {
  studentId: string;
  canGenerate: boolean;
  status: string;
  issueCodes: string[];
  warningCodes: string[];
  missingSections: string[];
  scoreOverflows: {
    sequence: number;
    availableCount: number;
    displayedCount: number;
    omittedCount: number;
  }[];
  termMaterialReadiness: {
    status: string;
    terms: {
      semesterId: number;
      sequence: number;
      label: string;
      evaluationCommentStatus: string;
      conductGradeStatus: string;
    }[];
  };
};
export type GeneratedCard = CardPreflight & {
  downloadToken: string | null;
  fileName: string | null;
  expiresAt: string | null;
};
const CARD_FIELDS = `studentId canGenerate status issueCodes warningCodes missingSections
 scoreOverflows { sequence availableCount displayedCount omittedCount }
 termMaterialReadiness { status terms { semesterId sequence label evaluationCommentStatus conductGradeStatus } }`;
const TEMPLATE = 'STUDENT_REGISTRATION_CARD_FULL_EXPORT';

export async function listClasses() {
  const data = await executeGraphQL<
    { studentPrivateProfileClassOptions: ClassOption[] },
    Record<string, never>
  >('query CardLabClasses { studentPrivateProfileClassOptions { id className classCode } }', {});
  return data.studentPrivateProfileClassOptions;
}
export async function listStudents(classId: string) {
  const data = await executeGraphQL<
    { studentPrivateProfileClassStudentOptions: StudentOption[] },
    { input: { classId: string } }
  >(
    'query CardLabStudents($input: StudentPrivateProfileClassStudentOptionsInput!) { studentPrivateProfileClassStudentOptions(input: $input) { studentId studentName } }',
    { input: { classId } },
  );
  return data.studentPrivateProfileClassStudentOptions;
}
export async function preflightCard(studentId: string) {
  const data = await executeGraphQL<
    { studentRegistrationCardGenerationPreflight: CardPreflight },
    { input: { studentId: string; templateCode: string } }
  >(
    `query CardLabPreflight($input: StudentRegistrationCardGenerationInput!) { studentRegistrationCardGenerationPreflight(input: $input) { ${CARD_FIELDS} } }`,
    { input: { studentId, templateCode: TEMPLATE } },
  );
  return data.studentRegistrationCardGenerationPreflight;
}
export async function generateCard(studentId: string) {
  const data = await executeGraphQL<
    { generateStudentRegistrationCardDocument: GeneratedCard },
    { input: { studentId: string; templateCode: string } }
  >(
    `mutation CardLabGenerate($input: StudentRegistrationCardGenerationInput!) { generateStudentRegistrationCardDocument(input: $input) { ${CARD_FIELDS} downloadToken fileName expiresAt } }`,
    { input: { studentId, templateCode: TEMPLATE } },
  );
  return data.generateStudentRegistrationCardDocument;
}
export async function downloadCard(card: GeneratedCard) {
  if (!card.downloadToken) throw new Error('文档不可下载');
  const url = new URL(
    `/student-private-profile/registration-card-documents/${encodeURIComponent(card.downloadToken)}`,
    getGraphQLEndpoint(),
  );
  const runtime = getGraphQLRuntimeConfig();
  const request = () => {
    const token = runtime.getAccessToken?.();
    return fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  };
  let response = await request();
  if (response.status === 401 && runtime.refreshSession) {
    try {
      await runtime.refreshSession();
      response = await request();
    } catch {
      runtime.onAuthFailure?.();
      throw new Error('登录已失效');
    }
  }
  if (response.status === 401) runtime.onAuthFailure?.();
  if (!response.ok) throw new Error('文档已失效或无权下载，请重新预检并生成');
  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = card.fileName ?? '学籍卡.docx';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
