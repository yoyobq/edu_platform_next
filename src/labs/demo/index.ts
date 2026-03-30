export { demoLabAccess } from './access';

export async function loadDemoLabRouteModule() {
  const { DemoLabPage } = await import('./page');

  return {
    Component: DemoLabPage,
  };
}
