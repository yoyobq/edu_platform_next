export { myProfileLabAccess } from './access';

export async function loadMyProfileLabRouteModule() {
  const { MyProfileLabPage } = await import('./page');

  return {
    Component: MyProfileLabPage,
  };
}
