export type VerificationIssuanceFeedback = {
  detail: string;
  message: string;
  title: string;
  type: 'staff-invite' | 'welcome-back';
} | null;

export function resolveResultMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
