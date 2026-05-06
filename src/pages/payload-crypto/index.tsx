export async function loadPayloadCryptoRouteModule() {
  const { PayloadCryptoPage } = await import('./page');

  return {
    Component: PayloadCryptoPage,
  };
}
