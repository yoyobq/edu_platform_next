import type { ColorFamily, HexAvatarSpec, HexAvatarSymmetryAxis, HexCell } from './types';

const COLOR_FAMILIES: ColorFamily[] = [
  { name: 'cyan', baseHue: 192 },
  { name: 'blue', baseHue: 222 },
  { name: 'violet', baseHue: 266 },
  { name: 'coral', baseHue: 18 },
  { name: 'emerald', baseHue: 146 },
  { name: 'rose', baseHue: 338 },
];

const HUE_OFFSETS = [-8, 0, 8] as const;
const RING_1_MIN_ENABLED = 3;
const RING_2_MIN_ENABLED = 4;

function cellKey(q: number, r: number) {
  return `${q},${r}`;
}

function getHexDistance(q: number, r: number) {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
}

function toPoint(q: number, r: number) {
  return {
    x: Math.sqrt(3) * (q + r / 2),
    y: 1.5 * r,
  };
}

function getClockwiseOrderValue(cell: Pick<HexCell, 'q' | 'r'>) {
  const { x, y } = toPoint(cell.q, cell.r);
  const startAngle = -Math.PI / 2;
  const rawAngle = Math.atan2(y, x);
  return (rawAngle - startAngle + Math.PI * 2) % (Math.PI * 2);
}

function buildRingCells(radius: 1 | 2): HexCell[] {
  const cells: HexCell[] = [];

  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      if (getHexDistance(q, r) !== radius) {
        continue;
      }

      cells.push({
        colorLayer: 'fg',
        enabled: false,
        key: cellKey(q, r),
        q,
        r,
        ring: radius,
      });
    }
  }

  return cells.sort((left, right) => getClockwiseOrderValue(left) - getClockwiseOrderValue(right));
}

const RING_1_TEMPLATE = buildRingCells(1);
const RING_2_TEMPLATE = buildRingCells(2);

function cloneCells(template: readonly HexCell[]) {
  return template.map((cell) => ({ ...cell }));
}

function readBit(hashBytes: Uint8Array, bitIndex: number) {
  const byteIndex = Math.floor(bitIndex / 8) % hashBytes.length;
  const bitOffset = bitIndex % 8;
  return ((hashBytes[byteIndex] >> bitOffset) & 1) === 1;
}

function reflectAcrossVerticalAxis(cell: Pick<HexCell, 'q' | 'r'>) {
  return {
    q: -cell.q - cell.r,
    r: cell.r,
  };
}

function reflectAcrossHorizontalAxis(cell: Pick<HexCell, 'q' | 'r'>) {
  return {
    q: cell.q + cell.r,
    r: -cell.r,
  };
}

function reflectCell(cell: Pick<HexCell, 'q' | 'r'>, axis: HexAvatarSymmetryAxis) {
  return axis === 'vertical' ? reflectAcrossVerticalAxis(cell) : reflectAcrossHorizontalAxis(cell);
}

type CellGroup = {
  cells: HexCell[];
  key: string;
  ring: HexCell['ring'];
};

function buildCellGroups(cells: HexCell[], axis: HexAvatarSymmetryAxis): CellGroup[] {
  const cellMap = new Map(cells.map((cell) => [cell.key, cell]));
  const visited = new Set<string>();
  const groups: CellGroup[] = [];

  for (const cell of cells) {
    if (visited.has(cell.key)) {
      continue;
    }

    const reflectedPoint = reflectCell(cell, axis);
    const reflectedCell = cellMap.get(cellKey(reflectedPoint.q, reflectedPoint.r));

    if (!reflectedCell) {
      visited.add(cell.key);
      groups.push({
        cells: [cell],
        key: cell.key,
        ring: cell.ring,
      });
      continue;
    }

    const groupCells =
      reflectedCell.key === cell.key
        ? [cell]
        : [cell, reflectedCell].sort((left, right) => left.key.localeCompare(right.key));

    for (const member of groupCells) {
      visited.add(member.key);
    }

    groups.push({
      cells: groupCells,
      key: groupCells.map((member) => member.key).join('|'),
      ring: cell.ring,
    });
  }

  return groups.sort((left, right) => {
    if (left.cells.length !== right.cells.length) {
      return left.cells.length - right.cells.length;
    }

    const leftAngle = getClockwiseOrderValue(left.cells[0]);
    const rightAngle = getClockwiseOrderValue(right.cells[0]);

    return leftAngle - rightAngle;
  });
}

function applyGroupActivation(
  groups: CellGroup[],
  hashBytes: Uint8Array,
  activationBitOffset: number,
  colorBitOffset: number,
) {
  groups.forEach((group, index) => {
    const enabled = readBit(hashBytes, activationBitOffset + index);
    const colorLayer = readBit(hashBytes, colorBitOffset + index)
      ? ('fg2' as const)
      : ('fg' as const);

    for (const cell of group.cells) {
      cell.enabled = enabled;
      cell.colorLayer = colorLayer;
    }
  });
}

function enableMinimumGroups(groups: CellGroup[], minimumEnabledCells: number) {
  let enabledCells = groups
    .filter((group) => group.cells.some((cell) => cell.enabled))
    .reduce((count, group) => count + group.cells.length, 0);

  if (enabledCells >= minimumEnabledCells) {
    return;
  }

  for (const group of groups) {
    if (enabledCells >= minimumEnabledCells) {
      break;
    }

    const alreadyEnabled = group.cells.some((cell) => cell.enabled);

    if (alreadyEnabled) {
      continue;
    }

    for (const cell of group.cells) {
      cell.enabled = true;
    }

    enabledCells += group.cells.length;
  }
}

function capFg2Usage(groups: CellGroup[]) {
  const enabledGroups = groups.filter((group) => group.cells.some((cell) => cell.enabled));
  const enabledCells = enabledGroups.flatMap((group) => group.cells);
  const maxFg2 = Math.floor(enabledCells.length / 2);
  const fg2Groups = enabledGroups.filter((group) =>
    group.cells.some((cell) => cell.colorLayer === 'fg2'),
  );

  const fg2CellCount = fg2Groups.reduce((count, group) => count + group.cells.length, 0);

  if (fg2CellCount <= maxFg2) {
    return;
  }

  const demotionOrder = [...fg2Groups].sort((left, right) => {
    if (right.ring !== left.ring) {
      return right.ring - left.ring;
    }

    if (right.cells.length !== left.cells.length) {
      return right.cells.length - left.cells.length;
    }

    const rightPoint = toPoint(right.cells[0].q, right.cells[0].r);
    const leftPoint = toPoint(left.cells[0].q, left.cells[0].r);
    const rightMagnitude = Math.abs(rightPoint.x) + Math.abs(rightPoint.y);
    const leftMagnitude = Math.abs(leftPoint.x) + Math.abs(leftPoint.y);

    if (rightMagnitude !== leftMagnitude) {
      return rightMagnitude - leftMagnitude;
    }

    return left.key.localeCompare(right.key);
  });

  let fg2Count = fg2CellCount;

  for (const group of demotionOrder) {
    if (fg2Count <= maxFg2) {
      break;
    }

    for (const cell of group.cells) {
      cell.colorLayer = 'fg';
    }

    fg2Count -= group.cells.length;
  }
}

export function buildHexAvatarSpecV1(hashBytes: Uint8Array): HexAvatarSpec {
  const axis: HexAvatarSymmetryAxis = (hashBytes[14] & 1) === 1 ? 'vertical' : 'horizontal';
  const familyIndex = hashBytes[0] % COLOR_FAMILIES.length;
  const family = COLOR_FAMILIES[familyIndex];

  const offsetIndex = hashBytes[13] % HUE_OFFSETS.length;
  const hue = family.baseHue + HUE_OFFSETS[offsetIndex];

  const fg = `hsl(${hue}, 68%, 50%)`;
  const fg2 = `hsl(${hue}, 60%, 62%)`;
  const bg = `hsl(${hue}, 42%, 92%)`;

  const ring1Cells = cloneCells(RING_1_TEMPLATE);
  const ring2Cells = cloneCells(RING_2_TEMPLATE);
  const ring1Groups = buildCellGroups(ring1Cells, axis);
  const ring2Groups = buildCellGroups(ring2Cells, axis);

  applyGroupActivation(ring1Groups, hashBytes, 0, 18);
  applyGroupActivation(ring2Groups, hashBytes, 6, 24);

  enableMinimumGroups(ring1Groups, RING_1_MIN_ENABLED);
  enableMinimumGroups(ring2Groups, RING_2_MIN_ENABLED);

  const outerCells = [...ring1Cells, ...ring2Cells];
  capFg2Usage([...ring1Groups, ...ring2Groups]);

  return {
    axis,
    bg,
    cells: [
      {
        colorLayer: 'fg',
        enabled: true,
        key: '0,0',
        q: 0,
        r: 0,
        ring: 0,
      },
      ...outerCells,
    ],
    fg,
    fg2,
    hue,
  };
}
