// src/features/student-evaluation-comment/infrastructure/links.ts

export function buildConductAlignmentPath(input: { classId: string; semesterId: number | null }) {
  const params = new URLSearchParams();
  if (input.classId) params.set('classId', input.classId);
  if (input.semesterId !== null) params.set('semesterId', String(input.semesterId));
  return `/class-affairs/student-conduct-alignment?${params.toString()}`;
}
