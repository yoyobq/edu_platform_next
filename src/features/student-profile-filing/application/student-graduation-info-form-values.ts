// src/features/student-profile-filing/application/student-graduation-info-form-values.ts
import type { GraduationInfo } from '../infrastructure/student-graduation-info-api';

export function buildStudentGraduationInfoFormValues(
  info: GraduationInfo,
  currentYear: number | null,
): Record<string, string> {
  const graduationField = info.fields.find((field) => field.field === 'ACTUAL_GRADUATION_DATE');
  const graduationDate = graduationField?.value ?? graduationField?.localValue;
  const graduationYear = graduationDate?.match(/^(\d{4})-\d{2}-\d{2}$/)?.[1] ?? currentYear;
  const defaults: Record<string, string> =
    currentYear === null
      ? {}
      : {
          ACTUAL_GRADUATION_DATE: `${currentYear}-06-30`,
          INTERNSHIP_START_DATE: `${graduationYear}-01-16`,
          INTERNSHIP_END_DATE: `${graduationYear}-06-30`,
          DESTINATION: '就业',
          VOCATIONAL_SKILL_TYPE: vocationalSkillTypeFromTrainingLevel(info.trainingLevel),
        };

  return Object.fromEntries(
    info.fields.map((field) => [
      field.field,
      field.localValue ??
        (info.canEdit && info.mainSnapshotPresent && field.canSet && !field.value
          ? (defaults[field.field] ?? '')
          : ''),
    ]),
  );
}

function vocationalSkillTypeFromTrainingLevel(trainingLevel: string | null): string {
  const level = trainingLevel?.trim().replace(/班$/, '') ?? '';
  const types: Record<string, string> = {
    初级: '初级工',
    初级工: '初级工',
    中级: '中级工',
    中级工: '中级工',
    高级: '高级工',
    高级工: '高级工',
    技师: '技师',
    高级技师: '高级技师',
  };
  return types[level] ?? '';
}
