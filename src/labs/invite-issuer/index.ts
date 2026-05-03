export { inviteIssuerLabAccess } from './access';

export async function loadInviteIssuerLabRouteModule() {
  const { InviteIssuerLabPage } = await import('./page');

  return {
    Component: InviteIssuerLabPage,
  };
}

export async function loadIssueMailLabRouteModule() {
  const { IssueMailLabPage } = await import('./issue-mail-page');

  return {
    Component: IssueMailLabPage,
  };
}
