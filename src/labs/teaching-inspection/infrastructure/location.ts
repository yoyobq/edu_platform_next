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
    semesterId: positive(params.get('semester')),
    page: positive(params.get('page')) ?? 1,
    teacherId: params.get('teacher')?.trim() || undefined,
    keyword: params.get('keyword')?.trim() || undefined,
  };
}
export function writeLocation(value: ReturnType<typeof readLocation>) {
  const params = new URLSearchParams({ kind: value.type.key });
  if (value.semesterId) params.set('semester', String(value.semesterId));
  if (value.teacherId) params.set('teacher', value.teacherId);
  if (value.keyword) params.set('keyword', value.keyword);
  if (value.page > 1) params.set('page', String(value.page));
  return params;
}
