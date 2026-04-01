export { payloadCryptoLabAccess } from './access';

export async function loadPayloadCryptoLabRouteModule() {
  const { PayloadCryptoLabPage } = await import('./page.tsx');

  return {
    Component: PayloadCryptoLabPage,
  };
}
