// src/features/class-work-context/infrastructure/api.ts
import type { ClassWorkOption } from '@/entities/class-work-context';

import { executeGraphQL } from '@/shared/graphql';

export async function listWorkClasses(): Promise<ClassWorkOption[]> {
  const data = await executeGraphQL<
    { studentPrivateProfileClassOptions: ClassWorkOption[] },
    Record<string, never>
  >('query ClassWorkOptions { studentPrivateProfileClassOptions { id className classCode } }', {});
  return data.studentPrivateProfileClassOptions;
}
