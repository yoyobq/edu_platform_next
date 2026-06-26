// src/labs/admin-class-adviser-governance/index.ts

export { adminClassAdviserGovernanceLabAccess } from './access';

export async function loadAdminClassAdviserGovernanceLabRouteModule() {
  const { AdminClassAdviserGovernanceLabPage } = await import('./page');

  return {
    Component: AdminClassAdviserGovernanceLabPage,
  };
}
