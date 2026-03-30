export async function loadSandboxPlaygroundRouteModule() {
  const { SandboxPlaygroundPage } = await import('./page');

  return {
    Component: SandboxPlaygroundPage,
  };
}
