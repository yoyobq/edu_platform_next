// src/features/teaching-inspection/application/contracts.ts
import type { Target } from '@/entities/teaching-inspection';
export type PrepareInput = Target & {
  round: number;
  checkDate: string;
  scheduleVersion: number;
  clientRequestId: string;
  retryOfOperationId?: string;
};
