// src/features/class-work-context/infrastructure/navigation.ts
import type { ClassGovernanceTarget, ClassWorkScope } from '@/entities/class-work-context';

export const CARD_PATH = '/labs/student-registration-cards';
const GOVERNANCE_PATHS: Record<ClassGovernanceTarget, string> = {
  profile: '/class-affairs/student-profile-filing',
  conduct: '/class-affairs/student-conduct-alignment',
  results: '/class-affairs/course-results-summary',
  comments: '/class-affairs/student-evaluation-comments',
};
export function isClassWorkPath(path: string) {
  return path === CARD_PATH || Object.values(GOVERNANCE_PATHS).includes(path);
}
export function readClassWorkScope(search: string): ClassWorkScope {
  const params = new URLSearchParams(search);
  const term = params.get('semesterId');
  const semesterId = term && /^\d+$/.test(term) ? Number(term) : undefined;
  return {
    classId: params.get('classId')?.trim() || undefined,
    studentId: params.get('studentId')?.trim() || undefined,
    semesterId: semesterId && Number.isSafeInteger(semesterId) ? semesterId : undefined,
    commentKind: params.get('commentKind') === 'GRADUATION' ? 'GRADUATION' : undefined,
    inspect: params.get('inspect') === '1',
  };
}
export function classWorkSearch(scope: ClassWorkScope): string {
  const params = new URLSearchParams();
  if (scope.classId) params.set('classId', scope.classId);
  if (scope.semesterId) params.set('semesterId', String(scope.semesterId));
  if (scope.studentId) params.set('studentId', scope.studentId);
  if (scope.commentKind) params.set('commentKind', scope.commentKind);
  if (scope.inspect) params.set('inspect', '1');
  return params.toString() ? `?${params}` : '';
}
export function readInspectionReturn(search: string): string | null {
  const raw = new URLSearchParams(search).get('returnTo');
  if (!raw || !raw.startsWith(`${CARD_PATH}?`)) return null;
  // Rebuild the permitted route and known fields; never navigate to arbitrary return URLs.
  const scope = readClassWorkScope(raw.slice(CARD_PATH.length));
  return scope.classId && scope.studentId
    ? `${CARD_PATH}${classWorkSearch({ ...scope, inspect: true })}`
    : null;
}
export function buildGovernancePath(target: ClassGovernanceTarget, scope: ClassWorkScope) {
  const params = new URLSearchParams(classWorkSearch(scope));
  params.set(
    'returnTo',
    `${CARD_PATH}${classWorkSearch({ classId: scope.classId, studentId: scope.studentId, inspect: true })}`,
  );
  return `${GOVERNANCE_PATHS[target]}?${params}`;
}
