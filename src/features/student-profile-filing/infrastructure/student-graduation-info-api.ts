// src/features/student-profile-filing/infrastructure/student-graduation-info-api.ts
import { executeGraphQL } from '@/shared/graphql';

export type GraduationField = {
  field: string;
  value: string | null;
  localValue: string | null;
  source: string;
  canSet: boolean;
  warningCodes: string[];
};
export type GraduationInfo = {
  studentId: string;
  revision: string;
  fields: GraduationField[];
  expectedGraduationYear: number | null;
  updatedAt: string | null;
  canEdit: boolean;
  mainSnapshotPresent: boolean;
};
export type GraduationPatch = { field: string; action: 'SET' | 'CLEAR'; value?: string };
const FIELDS = `studentId revision expectedGraduationYear updatedAt canEdit mainSnapshotPresent
  fields { field value localValue source canSet warningCodes }`;

export async function readGraduationInfo(studentId: string): Promise<GraduationInfo> {
  const data = await executeGraphQL<
    { studentPrivateProfileGraduationInfo: GraduationInfo },
    { input: { studentId: string } }
  >(
    `query FilingGraduationInfo($input: StudentGraduationInfoInput!) { studentPrivateProfileGraduationInfo(input: $input) { ${FIELDS} } }`,
    { input: { studentId } },
  );
  return data.studentPrivateProfileGraduationInfo;
}

export async function patchGraduationInfo(input: {
  studentId: string;
  expectedRevision: string;
  fields: GraduationPatch[];
}): Promise<GraduationInfo> {
  const data = await executeGraphQL<
    { patchStudentPrivateProfileGraduationInfo: GraduationInfo },
    { input: typeof input }
  >(
    `mutation FilingPatchGraduationInfo($input: PatchStudentGraduationInfoInput!) { patchStudentPrivateProfileGraduationInfo(input: $input) { ${FIELDS} } }`,
    { input },
  );
  return data.patchStudentPrivateProfileGraduationInfo;
}
