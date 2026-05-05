import { type ReactNode, useMemo } from 'react';
import { Card, Typography } from 'antd';

import './decorated-page-header.css';

type DecoratedPageHeaderCurve = {
  d: string;
  opacity: number;
  strokeWidth: number;
};

export type DecoratedPageHeaderProps = {
  aside?: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  eyebrowAsHeading?: boolean;
  icon?: ReactNode;
  iconPlacement?: 'eyebrow' | 'title';
  title: ReactNode;
  titleLevel?: 1 | 2 | 3 | 4 | 5;
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function buildTopEdgeCurve(): DecoratedPageHeaderCurve {
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

function buildRightEdgeCurve(): DecoratedPageHeaderCurve {
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

function buildDecoratedPageHeaderCurves() {
  const curveCount = Math.random() > 0.5 ? 4 : 3;

  return Array.from({ length: curveCount }, () =>
    Math.random() > 0.46 ? buildRightEdgeCurve() : buildTopEdgeCurve(),
  );
}

function DecoratedPageHeaderDecor() {
  const curves = useMemo(() => buildDecoratedPageHeaderCurves(), []);

  return (
    <svg
      aria-hidden="true"
      className="decorated-page-header-decor"
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

function DecoratedPageHeaderIcon({ icon }: { icon: ReactNode }) {
  return (
    <span className="decorated-page-header-icon" aria-hidden="true">
      {icon}
    </span>
  );
}

export function DecoratedPageHeader({
  aside,
  badge,
  description,
  eyebrow,
  eyebrowAsHeading = false,
  icon,
  iconPlacement = 'title',
  title,
  titleLevel = 1,
}: DecoratedPageHeaderProps) {
  return (
    <Card styles={{ body: { padding: 0 } }}>
      <div className="decorated-page-header">
        <DecoratedPageHeaderDecor />
        <div className="decorated-page-header-main">
          {eyebrow || badge ? (
            <div className="decorated-page-header-eyebrow-row">
              {icon && iconPlacement === 'eyebrow' ? <DecoratedPageHeaderIcon icon={icon} /> : null}
              {eyebrow ? (
                eyebrowAsHeading ? (
                  <h1 className="decorated-page-header-eyebrow">{eyebrow}</h1>
                ) : (
                  <span className="decorated-page-header-eyebrow">{eyebrow}</span>
                )
              ) : null}
              {badge ? <span className="decorated-page-header-badge">{badge}</span> : null}
            </div>
          ) : null}
          <div className="decorated-page-header-title-row">
            {icon && iconPlacement === 'title' ? <DecoratedPageHeaderIcon icon={icon} /> : null}
            <Typography.Title level={titleLevel} style={{ marginBottom: 0 }}>
              {title}
            </Typography.Title>
          </div>
          {description ? (
            <div className="decorated-page-header-description">
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {description}
              </Typography.Paragraph>
            </div>
          ) : null}
        </div>
        {aside ? <div className="decorated-page-header-aside">{aside}</div> : null}
      </div>
    </Card>
  );
}
