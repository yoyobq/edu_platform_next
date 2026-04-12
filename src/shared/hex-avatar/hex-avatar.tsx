import { Avatar } from 'antd';
import type { CSSProperties } from 'react';

import { useHexAvatar } from './use-hex-avatar';

export interface HexAvatarProps {
  accountId: number | string | null | undefined;
  avatarUrl?: string | null;
  size?: number;
  style?: CSSProperties;
}

export function HexAvatar({ accountId, avatarUrl, size, style }: HexAvatarProps) {
  const { svgDataUri } = useHexAvatar(accountId);

  const src = avatarUrl || svgDataUri || undefined;

  return <Avatar size={size} src={src} style={style} />;
}
