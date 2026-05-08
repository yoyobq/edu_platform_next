import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
} from '@/shared/form-normalization';

import type { ProfileCompletionInput, ProfileCompletionResult } from '../application/types';

function normalizeOptionalString(value: string | null | undefined) {
  return normalizeOptionalTextValue(value, 'to_null');
}

export function mapProfileCompletionInputToDTO(input: ProfileCompletionInput) {
  return {
    departmentId:
      input.targetIdentity === 'STAFF' ? normalizeOptionalString(input.departmentId) : null,
    name: normalizeRequiredTextValue(input.name, { label: '姓名' }),
    nickname: normalizeOptionalString(input.nickname),
    phone: normalizeOptionalString(input.phone),
    targetIdentity: input.targetIdentity,
  };
}

export function mapCompleteMyProfileResult(value: unknown): ProfileCompletionResult {
  const parsedValue =
    value && typeof value === 'object' && 'success' in value
      ? (value as { success?: unknown })
      : null;

  return {
    success: parsedValue?.success === true,
  };
}
