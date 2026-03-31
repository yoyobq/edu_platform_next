import type { PublicAuthPorts } from './ports';

export async function requestPasswordReset(
  ports: PublicAuthPorts,
  input: { email: string },
): Promise<void> {
  await ports.api.requestPasswordReset(input);
}
