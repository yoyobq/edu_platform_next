import type { HexAvatarSpec } from './types';

const VIEWBOX_SIZE = 64;
const CENTER = VIEWBOX_SIZE / 2;
const HEX_RADIUS = 5.4;
const DEG_TO_RAD = Math.PI / 180;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function axialToPixel(q: number, r: number) {
  return {
    x: CENTER + HEX_RADIUS * Math.sqrt(3) * (q + r / 2),
    y: CENTER + HEX_RADIUS * 1.5 * r,
  };
}

function hexPointyTopPath(cx: number, cy: number, r: number) {
  const points: string[] = [];

  for (let i = 0; i < 6; i += 1) {
    const angleDeg = 60 * i - 90;
    const angleRad = angleDeg * DEG_TO_RAD;
    points.push(`${round2(cx + r * Math.cos(angleRad))},${round2(cy + r * Math.sin(angleRad))}`);
  }

  return `M${points.join('L')}Z`;
}

export function renderHexAvatarSvgV1(spec: HexAvatarSpec): string {
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" width="${VIEWBOX_SIZE}" height="${VIEWBOX_SIZE}">`,
  );
  parts.push(
    `<rect x="0" y="0" width="${VIEWBOX_SIZE}" height="${VIEWBOX_SIZE}" rx="16" fill="${spec.bg}"/>`,
  );

  const outerCells = spec.cells
    .filter((cell) => cell.enabled && cell.ring > 0)
    .sort((left, right) => right.ring - left.ring || left.key.localeCompare(right.key));

  for (const cell of outerCells) {
    const { x, y } = axialToPixel(cell.q, cell.r);
    const fill = cell.colorLayer === 'fg2' ? spec.fg2 : spec.fg;
    parts.push(`<path d="${hexPointyTopPath(x, y, HEX_RADIUS)}" fill="${fill}"/>`);
  }

  const centerCell = spec.cells.find((cell) => cell.key === '0,0');

  if (centerCell) {
    const { x, y } = axialToPixel(centerCell.q, centerCell.r);
    parts.push(`<path d="${hexPointyTopPath(x, y, HEX_RADIUS)}" fill="${spec.fg}"/>`);
  }

  parts.push('</svg>');

  return parts.join('');
}
