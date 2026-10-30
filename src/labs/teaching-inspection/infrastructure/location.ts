// src/labs/teaching-inspection/infrastructure/location.ts
import { kinds } from '../model';
export function readLocation(params: URLSearchParams) {
  const type = kinds.find((item) => item.key === params.get('kind')) ?? kinds[0];
  const positive = (value: string | null) =>
    value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
      ? Number(value)
      : undefined;
  return {
    type,
    section: params.get('view') === 'dates' || !params.has('kind') ? 'dates' : 'checks',
    resourceKey: params.get('resource') || undefined,
    semesterId: positive(params.get('semester')),
    page: positive(params.get('page')) ?? 1,
    departmentId:
      params.get('department') === 'all' ? null : params.get('department')?.trim() || undefined,
    timeGroup: ['FULL', 'FIRST', 'SECOND', 'CUSTOM'].includes(params.get('timeGroup') ?? '')
      ? params.get('timeGroup')!
      : undefined,
    round: [1, 2, 3].includes(Number(params.get('round')))
      ? Number(params.get('round'))
      : undefined,
    teacherId: params.get('teacher')?.trim() || undefined,
    keyword: params.get('keyword')?.trim() || undefined,
  };
}
export function writeLocation(value: ReturnType<typeof readLocation>) {
  const params = new URLSearchParams(
    value.section === 'dates' ? { view: 'dates' } : { kind: value.type.key },
  );
  if (value.resourceKey) params.set('resource', value.resourceKey);
  if (value.semesterId) params.set('semester', String(value.semesterId));
  if (value.departmentId !== undefined) params.set('department', value.departmentId ?? 'all');
  if (value.timeGroup) params.set('timeGroup', value.timeGroup);
  if (value.round) params.set('round', String(value.round));
  if (value.teacherId) params.set('teacher', value.teacherId);
  if (value.keyword) params.set('keyword', value.keyword);
  if (value.page > 1) params.set('page', String(value.page));
  return params;
}
