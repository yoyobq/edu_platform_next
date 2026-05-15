// src/features/academic-workload/application/teaching-class-format.ts
const TEACHING_CLASS_SEPARATOR_PATTERN = /[,，、;；]/u;

export function splitAcademicWorkloadTeachingClassNames(value: string | null | undefined) {
  return (value ?? '')
    .split(TEACHING_CLASS_SEPARATOR_PATTERN)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatAcademicWorkloadTeachingClassMultiline(
  value: string | null | undefined,
  fallback = '-',
) {
  const teachingClassNames = splitAcademicWorkloadTeachingClassNames(value);

  return teachingClassNames.length > 0 ? teachingClassNames.join('\n') : fallback;
}
