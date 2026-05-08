export { integratedPlanCorrectionsLabAccess } from './access';

export async function loadIntegratedPlanCorrectionsLabRouteModule() {
  const { IntegratedPlanCorrectionsLabPage } = await import('./page');

  return {
    Component: IntegratedPlanCorrectionsLabPage,
  };
}
