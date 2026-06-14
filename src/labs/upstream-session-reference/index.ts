// src/labs/upstream-session-reference/index.ts

export { upstreamSessionReferenceLabAccess } from './access';

export async function loadUpstreamSessionReferenceLabRouteModule() {
  const { UpstreamSessionReferenceLabPage } = await import('./page');

  return {
    Component: UpstreamSessionReferenceLabPage,
  };
}
