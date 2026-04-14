export { upstreamSessionDemoLabAccess } from './access';

export async function loadUpstreamSessionDemoLabRouteModule() {
  const { UpstreamSessionDemoLabPage } = await import('./page');

  return {
    Component: UpstreamSessionDemoLabPage,
  };
}
