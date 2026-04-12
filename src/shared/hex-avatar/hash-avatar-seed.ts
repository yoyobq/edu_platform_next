const APP_SALT = 'aigc-friendly-frontend';
const AVATAR_VERSION = 'v1';

export async function hashAvatarSeed(stableUserId: string): Promise<Uint8Array> {
  const rawSeed = `${APP_SALT}:${AVATAR_VERSION}:${stableUserId}`;
  const encoded = new TextEncoder().encode(rawSeed);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return new Uint8Array(buffer);
}
