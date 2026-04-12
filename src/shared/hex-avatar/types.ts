export type HexAvatarSymmetryAxis = 'horizontal' | 'vertical';

export interface HexCell {
  colorLayer: 'fg' | 'fg2';
  enabled: boolean;
  key: string;
  q: number;
  r: number;
  ring: 0 | 1 | 2;
}

export interface HexAvatarSpec {
  axis: HexAvatarSymmetryAxis;
  bg: string;
  cells: HexCell[];
  fg: string;
  fg2: string;
  hue: number;
}

export interface ColorFamily {
  name: string;
  baseHue: number;
}
