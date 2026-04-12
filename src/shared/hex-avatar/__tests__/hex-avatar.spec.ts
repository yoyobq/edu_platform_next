import { describe, expect, it } from 'vitest';

import { buildHexAvatarSpecV1 } from '../build-hex-avatar-spec';
import { renderHexAvatarSvgV1 } from '../render-hex-avatar-svg';
import type { HexAvatarSymmetryAxis, HexCell } from '../types';

function makeHashBytes(overrides: Record<number, number> = {}) {
  const bytes = new Uint8Array(32);

  for (const [index, value] of Object.entries(overrides)) {
    bytes[Number(index)] = value;
  }

  return bytes;
}

function makeHashFromBits({
  activationBits = [],
  axisByte = 0,
  colorBits = [],
  hueByte = 1,
  familyByte = 0,
}: {
  activationBits?: number[];
  axisByte?: number;
  colorBits?: number[];
  familyByte?: number;
  hueByte?: number;
} = {}) {
  const bytes = new Uint8Array(32);
  bytes[0] = familyByte;
  bytes[13] = hueByte;
  bytes[14] = axisByte;

  for (const bitIndex of activationBits) {
    const byteIndex = Math.floor(bitIndex / 8);
    const bitOffset = bitIndex % 8;
    bytes[byteIndex] |= 1 << bitOffset;
  }

  for (const bitIndex of colorBits) {
    const actualBitIndex = 18 + bitIndex;
    const byteIndex = Math.floor(actualBitIndex / 8);
    const bitOffset = actualBitIndex % 8;
    bytes[byteIndex] |= 1 << bitOffset;
  }

  return bytes;
}

function getEnabledCells(hashBytes: Uint8Array) {
  return buildHexAvatarSpecV1(hashBytes).cells.filter((cell) => cell.enabled);
}

function findCell(hashBytes: Uint8Array, q: number, r: number) {
  return buildHexAvatarSpecV1(hashBytes).cells.find((cell) => cell.q === q && cell.r === r);
}

function reflectCell(cell: Pick<HexCell, 'q' | 'r'>, axis: HexAvatarSymmetryAxis) {
  if (axis === 'vertical') {
    return {
      q: -cell.q - cell.r,
      r: cell.r,
    };
  }

  return {
    q: cell.q + cell.r,
    r: -cell.r,
  };
}

describe('buildHexAvatarSpecV1', () => {
  it('同一输入重复生成一致', () => {
    const hash = makeHashBytes({ 0: 42, 1: 0xff, 2: 0x01, 13: 77 });
    const spec1 = buildHexAvatarSpecV1(hash);
    const spec2 = buildHexAvatarSpecV1(hash);
    expect(spec1).toStrictEqual(spec2);
  });

  it('不同输入产生不同 SVG', () => {
    const hashA = makeHashBytes({ 0: 10, 1: 0xff, 2: 0x01, 13: 1 });
    const hashB = makeHashBytes({ 0: 11, 1: 0x01, 2: 0xff, 13: 2 });
    const svgA = renderHexAvatarSvgV1(buildHexAvatarSpecV1(hashA));
    const svgB = renderHexAvatarSvgV1(buildHexAvatarSpecV1(hashB));
    expect(svgA).not.toBe(svgB);
  });

  it('规格包含中心 + 6 个一环 + 12 个二环，共 19 个位点', () => {
    const spec = buildHexAvatarSpecV1(makeHashBytes({ 0: 0, 13: 1 }));
    expect(spec.cells).toHaveLength(19);
    expect(spec.cells.filter((cell) => cell.ring === 0)).toHaveLength(1);
    expect(spec.cells.filter((cell) => cell.ring === 1)).toHaveLength(6);
    expect(spec.cells.filter((cell) => cell.ring === 2)).toHaveLength(12);
  });

  describe('hue bucket 全覆盖', () => {
    const expectedFamilyBaseHues = [192, 222, 266, 18, 146, 338];

    for (let familyIndex = 0; familyIndex < 6; familyIndex += 1) {
      it(`family index ${familyIndex} → baseHue ${expectedFamilyBaseHues[familyIndex]}`, () => {
        const byte0 = familyIndex;
        const hash = makeHashBytes({ 0: byte0, 13: 1 });
        const spec = buildHexAvatarSpecV1(hash);
        expect(spec.hue).toBe(expectedFamilyBaseHues[familyIndex] + 0);
      });
    }

    it('hue offset -8 档位', () => {
      const spec = buildHexAvatarSpecV1(makeHashBytes({ 0: 0, 13: 0 }));
      expect(spec.hue).toBe(192 - 8);
    });

    it('hue offset 0 档位', () => {
      const spec = buildHexAvatarSpecV1(makeHashBytes({ 0: 0, 13: 1 }));
      expect(spec.hue).toBe(192 + 0);
    });

    it('hue offset +8 档位', () => {
      const spec = buildHexAvatarSpecV1(makeHashBytes({ 0: 0, 13: 2 }));
      expect(spec.hue).toBe(192 + 8);
    });
  });

  it('中心 hex 始终启用', () => {
    const center = findCell(makeHashBytes({ 0: 0, 13: 1 }), 0, 0);
    expect(center?.enabled).toBe(true);
  });

  it('一环至少启用 3 个，二环至少启用 4 个', () => {
    const enabledCells = getEnabledCells(makeHashBytes({ 0: 0, 13: 1 }));
    expect(enabledCells.filter((cell) => cell.ring === 1).length).toBeGreaterThanOrEqual(3);
    expect(enabledCells.filter((cell) => cell.ring === 2).length).toBeGreaterThanOrEqual(4);
  });

  it('根据 byte14 选择水平或垂直对称轴', () => {
    const horizontalSpec = buildHexAvatarSpecV1(makeHashFromBits({ axisByte: 0 }));
    const verticalSpec = buildHexAvatarSpecV1(makeHashFromBits({ axisByte: 1 }));
    expect(horizontalSpec.axis).toBe('horizontal');
    expect(verticalSpec.axis).toBe('vertical');
  });

  it('fg2 数量不超过已启用外围单元的一半', () => {
    const hash = makeHashFromBits({
      activationBits: Array.from({ length: 18 }, (_, index) => index),
      colorBits: Array.from({ length: 18 }, (_, index) => index),
    });
    const spec = buildHexAvatarSpecV1(hash);
    const outerEnabledCells = spec.cells.filter((cell) => cell.enabled && cell.ring > 0);
    const fg2Count = outerEnabledCells.filter((cell) => cell.colorLayer === 'fg2').length;
    expect(fg2Count).toBeLessThanOrEqual(Math.floor(outerEnabledCells.length / 2));
  });

  it('启用图案沿选定轴保持镜像对称，颜色层也一致', () => {
    const hashes = [
      makeHashFromBits({
        activationBits: [0, 2, 4, 6, 8, 10, 12],
        axisByte: 0,
        colorBits: [1, 3, 5, 7, 9],
      }),
      makeHashFromBits({
        activationBits: [1, 3, 5, 7, 9, 11, 13],
        axisByte: 1,
        colorBits: [0, 2, 4, 6, 8],
      }),
    ];

    for (const hash of hashes) {
      const spec = buildHexAvatarSpecV1(hash);
      const enabledCells = spec.cells.filter((cell) => cell.enabled && cell.ring > 0);

      for (const cell of enabledCells) {
        const reflectedPoint = reflectCell(cell, spec.axis);
        const reflectedCell = spec.cells.find(
          (candidate) => candidate.q === reflectedPoint.q && candidate.r === reflectedPoint.r,
        );

        expect(reflectedCell?.enabled).toBe(true);
        expect(reflectedCell?.colorLayer).toBe(cell.colorLayer);
      }
    }
  });
});

describe('renderHexAvatarSvgV1', () => {
  it('输出合法 SVG 字符串', () => {
    const hash = makeHashFromBits({
      activationBits: [0, 3, 7, 11, 15],
      hueByte: 2,
      familyByte: 3,
    });
    const spec = buildHexAvatarSpecV1(hash);
    const svg = renderHexAvatarSvgV1(spec);

    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('<rect');
    expect(svg).toContain('rx="16"');
  });

  it('渲染结果至少包含中心 + 一环下限 + 二环下限', () => {
    const svg = renderHexAvatarSvgV1(buildHexAvatarSpecV1(makeHashBytes({ 0: 0, 13: 1 })));
    const pathCount = (svg.match(/<path/g) ?? []).length;
    expect(pathCount).toBeGreaterThanOrEqual(8);
  });

  it('同一 spec 渲染结果完全一致', () => {
    const hash = makeHashBytes({ 0: 5, 1: 0xff, 2: 0x33, 13: 0 });
    const spec = buildHexAvatarSpecV1(hash);
    const svg1 = renderHexAvatarSvgV1(spec);
    const svg2 = renderHexAvatarSvgV1(spec);
    expect(svg1).toBe(svg2);
  });

  it('snapshot: 确定性输出', () => {
    const hash = makeHashBytes({
      0: 42,
      1: 0b10110101,
      2: 0b01001110,
      3: 0b11010011,
      4: 0b10100010,
      5: 0b01110001,
      6: 0b11001100,
      7: 0b00100011,
      8: 0b10010101,
      9: 0b01101010,
      10: 0b11110001,
      11: 0b00011100,
      12: 0b10101011,
      13: 0b01010110,
    });
    const svg = renderHexAvatarSvgV1(buildHexAvatarSpecV1(hash));
    expect(svg).toMatchSnapshot();
  });
});
