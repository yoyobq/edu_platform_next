export { changeLoginEmailLabAccess } from './access';

export async function loadChangeLoginEmailLabRouteModule() {
  const { ChangeLoginEmailLabPage } = await import('./page');

  return {
    Component: ChangeLoginEmailLabPage,
  };
}
