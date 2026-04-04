import type { ProfileCompletionInput, ProfileCompletionResult } from '../application/types';

function normalizeOptionalString(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function mapProfileCompletionInputToDTO(input: ProfileCompletionInput) {
  return {
    departmentId: normalizeOptionalString(input.departmentId),
    name: input.name.trim(),
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
