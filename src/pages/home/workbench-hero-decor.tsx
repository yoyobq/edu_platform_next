import { useMemo } from 'react';

type WorkbenchHeroDecorCurve = {
  d: string;
  opacity: number;
  strokeWidth: number;
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function buildTopEdgeCurve(): WorkbenchHeroDecorCurve {
  const startX = randomBetween(52, 96);
  const endX = randomBetween(28, 72);
  const endY = randomBetween(42, 96);

  return {
    d: [
      `M ${startX.toFixed(1)} -4`,
      `C ${(startX - randomBetween(8, 24)).toFixed(1)} ${randomBetween(8, 28).toFixed(1)}`,
      `${(endX + randomBetween(16, 36)).toFixed(1)} ${(endY - randomBetween(18, 34)).toFixed(1)}`,
      `${endX.toFixed(1)} ${endY.toFixed(1)}`,
    ].join(' '),
    opacity: randomBetween(0.2, 0.34),
    strokeWidth: randomBetween(0.45, 0.85),
  };
}

function buildRightEdgeCurve(): WorkbenchHeroDecorCurve {
  const startY = randomBetween(4, 88);
  const endX = randomBetween(30, 74);
  const endY = randomBetween(18, 94);

  return {
    d: [
      `M 104 ${startY.toFixed(1)}`,
      `C ${randomBetween(80, 96).toFixed(1)} ${(startY + randomBetween(-16, 18)).toFixed(1)}`,
      `${(endX + randomBetween(18, 38)).toFixed(1)} ${(endY + randomBetween(-24, 24)).toFixed(1)}`,
      `${endX.toFixed(1)} ${endY.toFixed(1)}`,
    ].join(' '),
    opacity: randomBetween(0.18, 0.32),
    strokeWidth: randomBetween(0.45, 0.9),
  };
}

function buildWorkbenchHeroDecorCurves() {
  const curveCount = Math.random() > 0.5 ? 4 : 3;

  return Array.from({ length: curveCount }, () =>
    Math.random() > 0.46 ? buildRightEdgeCurve() : buildTopEdgeCurve(),
  );
}

export function WorkbenchHeroDecor() {
  const curves = useMemo(() => buildWorkbenchHeroDecorCurves(), []);

  return (
    <svg
      aria-hidden="true"
      className="home-workbench-hero-decor"
      focusable="false"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {curves.map((curve, index) => (
        <path
          d={curve.d}
          key={`${index}-${curve.d}`}
          opacity={curve.opacity}
          strokeWidth={curve.strokeWidth}
        />
      ))}
    </svg>
  );
}
