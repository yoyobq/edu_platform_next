export { accountSwitchLabAccess } from './access';

export async function loadAccountSwitchLabRouteModule() {
  const { AccountSwitchLabPage } = await import('./page');

  return {
    Component: AccountSwitchLabPage,
  };
}
