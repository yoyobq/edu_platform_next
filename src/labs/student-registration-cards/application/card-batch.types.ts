// src/labs/student-registration-cards/application/card-batch.types.ts
export type BatchStudent = { studentId: string; studentName: string };

export type BatchDocument = {
  token: string;
  fileName: string | null;
  expiresAtMs: number;
};

export type BatchGeneration =
  | { kind: 'generated'; warnings: string[]; document: BatchDocument }
  | { kind: 'blocked'; warnings: string[]; reasons: string[] };

export interface CardBatchOperations {
  generate(studentId: string): Promise<BatchGeneration>;
  fetch(document: BatchDocument): Promise<Uint8Array>;
}

export class BatchSessionExpiredError extends Error {}
