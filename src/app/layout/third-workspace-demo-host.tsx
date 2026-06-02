// src/app/layout/third-workspace-demo-host.tsx

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';

import {
  getThirdWorkspaceDemoArtifactById,
  readThirdWorkspaceDemoArtifactId,
  ThirdWorkspaceDemoCanvas,
  withThirdWorkspaceDemo,
} from '@/shared/third-workspace-demo';

const THIRD_WORKSPACE_ROOT_SELECTOR = '[data-layout-layer="third-workspace-root"]';
const THIRD_WORKSPACE_MOUNT_SELECTOR = '[data-workspace-mount="artifacts-canvas"]';

export function ThirdWorkspaceDemoHost() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDemoRoute = location.pathname === '/labs/demo';
  const mountNode =
    typeof document !== 'undefined'
      ? document.querySelector<HTMLElement>(THIRD_WORKSPACE_MOUNT_SELECTOR)
      : null;
  const artifact = isDemoRoute
    ? getThirdWorkspaceDemoArtifactById(readThirdWorkspaceDemoArtifactId(location.search))
    : null;
  const isOpen = Boolean(artifact);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const rootNode = document.querySelector<HTMLElement>(THIRD_WORKSPACE_ROOT_SELECTOR);

    if (!rootNode) {
      return;
    }

    rootNode.dataset.workspaceState = isOpen ? 'open' : 'closed';
    rootNode.setAttribute('aria-hidden', isOpen ? 'false' : 'true');

    return () => {
      rootNode.dataset.workspaceState = 'closed';
      rootNode.setAttribute('aria-hidden', 'true');
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        navigate(
          {
            pathname: location.pathname,
            search: withThirdWorkspaceDemo(location.search, null),
          },
          { replace: false },
        );
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, location.pathname, location.search, navigate]);

  if (!artifact || !mountNode) {
    return null;
  }

  return createPortal(
    <ThirdWorkspaceDemoCanvas
      artifact={artifact}
      onClose={() => {
        navigate(
          {
            pathname: location.pathname,
            search: withThirdWorkspaceDemo(location.search, null),
          },
          { replace: false },
        );
      }}
    />,
    mountNode,
  );
}
