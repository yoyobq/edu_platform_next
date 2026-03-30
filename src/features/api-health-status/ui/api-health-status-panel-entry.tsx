// src/features/api-health-status/ui/api-health-status-panel-entry.tsx

import { useMemo } from 'react';

import type { ApiHealthCheckPort } from '../application/get-api-health-statuses';
import { runApiHealthCheck } from '../infrastructure/run-api-health-check';

import { ApiHealthStatusPanel } from './api-health-status-panel';

export function ApiHealthStatusPanelEntry() {
  const healthCheckPort = useMemo<ApiHealthCheckPort>(
    () => ({
      runCheck: runApiHealthCheck,
    }),
    [],
  );

  return <ApiHealthStatusPanel healthCheckPort={healthCheckPort} />;
}
