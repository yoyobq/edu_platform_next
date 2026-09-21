// src/features/class-adviser-governance/application/row-action-policy.spec.ts

import { describe, expect, it } from 'vitest';

import { resolveClassAdviserGovernanceRowAction } from './row-action-policy';

describe('class adviser governance row action policy', () => {
  it('shows assign for manageable missing classes', () => {
    expect(
      resolveClassAdviserGovernanceRowAction({
        activeAdvisers: [],
        canAssign: true,
        canManage: true,
      }),
    ).toBe('ASSIGN');
  });

  it('shows end for manageable classes with an active adviser', () => {
    expect(
      resolveClassAdviserGovernanceRowAction({
        activeAdvisers: [{} as never],
        canAssign: false,
        canManage: true,
      }),
    ).toBe('END');
  });

  it('keeps academic officer rows read only regardless of adviser state', () => {
    expect(
      resolveClassAdviserGovernanceRowAction({
        activeAdvisers: [],
        canAssign: false,
        canManage: false,
      }),
    ).toBe('READ_ONLY');
    expect(
      resolveClassAdviserGovernanceRowAction({
        activeAdvisers: [{} as never],
        canAssign: false,
        canManage: false,
      }),
    ).toBe('READ_ONLY');
  });
});
