export { inviteIssuerLabAccess } from './access';

export async function loadInviteIssuerLabRouteModule() {
  const { InviteIssuerLabPage } = await import('./page');

  return {
    Component: InviteIssuerLabPage,
  };
}
