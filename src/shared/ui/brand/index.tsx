import { Flex, Typography } from 'antd';

type BrandLockupVariant = 'header' | 'public-entry';

export function BrandLockup({
  compact = false,
  logoSize,
  logoSlotSize,
  variant,
}: {
  compact?: boolean;
  logoSize?: number;
  logoSlotSize?: number;
  variant: BrandLockupVariant;
}) {
  const isHeader = variant === 'header';
  const resolvedLogoSize = logoSize ?? (isHeader ? 24 : 32);
  const logoImage = (
    <img
      alt=""
      aria-hidden="true"
      src="/logo.svg"
      style={{ display: 'block', height: resolvedLogoSize, width: 'auto', flexShrink: 0 }}
    />
  );

  return (
    <Flex align="center" gap={12} style={isHeader ? { flexShrink: 0 } : undefined}>
      {logoSlotSize ? (
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center justify-center"
          style={{ height: logoSlotSize, width: logoSlotSize }}
        >
          {logoImage}
        </span>
      ) : (
        logoImage
      )}

      {compact ? null : (
        <Flex
          vertical
          gap={2}
          style={isHeader ? { flexShrink: 0, minWidth: 'max-content' } : undefined}
        >
          <Typography.Text
            style={
              isHeader
                ? {
                    color: 'var(--ant-color-text)',
                    fontSize: 'var(--ant-font-size-lg)',
                    fontWeight: 600,
                    lineHeight: 1.2,
                    marginBottom: 0,
                    whiteSpace: 'nowrap',
                  }
                : {
                    color: 'var(--ant-color-text)',
                    fontSize: 'var(--ant-font-size-heading-4)',
                    fontWeight: 600,
                    lineHeight: 1.2,
                    marginBottom: 0,
                    whiteSpace: 'nowrap',
                  }
            }
          >
            {isHeader ? 'EDU MATE' : '智教随行'}
          </Typography.Text>
        </Flex>
      )}
    </Flex>
  );
}
