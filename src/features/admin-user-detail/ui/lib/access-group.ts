import type { AuthAccessGroup } from '@/shared/auth-access';

export const EDITABLE_ACCESS_GROUPS = [
  'ADMIN',
  'STAFF',
  'GUEST',
] as const satisfies readonly AuthAccessGroup[];

export function hasLockedAccessGroup(accessGroup: readonly AuthAccessGroup[]) {
  return accessGroup.includes('REGISTRANT');
}

export function normalizeAccessGroupValue(accessGroup: readonly AuthAccessGroup[]) {
  return Array.from(new Set(accessGroup));
}

export function toggleEditableAccessGroup(
  currentValue: readonly AuthAccessGroup[],
  targetValue: (typeof EDITABLE_ACCESS_GROUPS)[number],
) {
  const nextValueSet = new Set(currentValue);
  const hasTargetValue = nextValueSet.has(targetValue);

  if (hasTargetValue) {
    nextValueSet.delete(targetValue);
    return normalizeAccessGroupValue(Array.from(nextValueSet));
  }

  if (targetValue === 'GUEST') {
    nextValueSet.delete('ADMIN');
    nextValueSet.delete('STAFF');
    nextValueSet.add('GUEST');
    return normalizeAccessGroupValue(Array.from(nextValueSet));
  }

  nextValueSet.delete('GUEST');
  nextValueSet.add(targetValue);

  return normalizeAccessGroupValue(Array.from(nextValueSet));
}
