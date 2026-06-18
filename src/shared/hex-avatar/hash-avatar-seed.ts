const APP_SALT = 'aigc-friendly-frontend';
const AVATAR_VERSION = 'v1';
const HASH_BYTE_LENGTH = 32;

async function digestSha256(encoded: Uint8Array): Promise<Uint8Array | null> {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) return null;

  try {
    const buffer = await subtle.digest('SHA-256', encoded);
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

function avalancheHash(value: number) {
  let hash = value >>> 0;

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b) >>> 0;
  hash ^= hash >>> 16;

  return hash >>> 0;
}

function hashAvatarSeedFallback(encoded: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(HASH_BYTE_LENGTH);
  let state = 0x811c9dc5;

  for (let blockIndex = 0; blockIndex < HASH_BYTE_LENGTH / 4; blockIndex += 1) {
    let hash = (state ^ Math.imul(blockIndex + 1, 0x9e3779b1)) >>> 0;

    for (const byte of encoded) {
      hash ^= byte;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }

    hash = avalancheHash(hash ^ encoded.length ^ blockIndex);
    bytes[blockIndex * 4] = hash & 0xff;
    bytes[blockIndex * 4 + 1] = (hash >>> 8) & 0xff;
    bytes[blockIndex * 4 + 2] = (hash >>> 16) & 0xff;
    bytes[blockIndex * 4 + 3] = (hash >>> 24) & 0xff;
    state = hash;
  }

  return bytes;
}

export async function hashAvatarSeed(stableUserId: string): Promise<Uint8Array> {
  const rawSeed = `${APP_SALT}:${AVATAR_VERSION}:${stableUserId}`;
  const encoded = new TextEncoder().encode(rawSeed);
  return (await digestSha256(encoded)) ?? hashAvatarSeedFallback(encoded);
}
