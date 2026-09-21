// src/features/class-adviser-governance/application/row-action-policy.ts

import type { ClassAdviserGovernanceClass } from './types';

export type ClassAdviserGovernanceRowAction = 'ASSIGN' | 'END' | 'READ_ONLY';

export function resolveClassAdviserGovernanceRowAction(
  record: Pick<ClassAdviserGovernanceClass, 'activeAdvisers' | 'canAssign' | 'canManage'>,
): ClassAdviserGovernanceRowAction {
  if (!record.canManage) {
    return 'READ_ONLY';
  }

  if (record.activeAdvisers.length > 0) {
    return 'END';
  }

  return record.canAssign ? 'ASSIGN' : 'READ_ONLY';
}
