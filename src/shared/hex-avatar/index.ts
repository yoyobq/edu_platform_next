export { buildHexAvatarSpecV1 } from './build-hex-avatar-spec';
export { hashAvatarSeed } from './hash-avatar-seed';
export type { HexAvatarProps } from './hex-avatar';
export { HexAvatar } from './hex-avatar';
export { renderHexAvatarSvgV1 } from './render-hex-avatar-svg';
export type { ColorFamily, HexAvatarSpec, HexAvatarSymmetryAxis, HexCell } from './types';
export { useHexAvatar } from './use-hex-avatar';

import { buildHexAvatarSpecV1 } from './build-hex-avatar-spec';
import { hashAvatarSeed } from './hash-avatar-seed';
import { renderHexAvatarSvgV1 } from './render-hex-avatar-svg';

export async function generateHexAvatarSvg(stableUserId: string): Promise<string> {
  const hashBytes = await hashAvatarSeed(stableUserId);
  const spec = buildHexAvatarSpecV1(hashBytes);
  return renderHexAvatarSvgV1(spec);
}
