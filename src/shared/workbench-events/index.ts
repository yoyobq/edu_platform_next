export const ENTRY_SIDECAR_OPEN_EVENT = 'workbench:open-entry-sidecar';

export function requestOpenEntrySidecar() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(ENTRY_SIDECAR_OPEN_EVENT));
}
