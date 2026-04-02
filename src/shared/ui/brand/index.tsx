import { Flex, Typography } from 'antd';

type BrandLockupVariant = 'header' | 'public-entry';

export function BrandLockup({ variant }: { variant: BrandLockupVariant }) {
  const isHeader = variant === 'header';

  return (
    <Flex align="center" gap={12}>
      {isHeader ? (
        <img
          alt=""
          aria-hidden="true"
          src="/logo.svg"
          style={{ display: 'block', height: 24, width: 'auto', flexShrink: 0 }}
        />
      ) : (
        <img
          alt=""
          aria-hidden="true"
          src="/logo.svg"
          style={{ display: 'block', height: 32, width: 'auto', flexShrink: 0 }}
        />
      )}

      <Flex vertical gap={2}>
        <Typography.Text
          type="secondary"
          style={
            isHeader
              ? { fontSize: 'var(--ant-font-size)', lineHeight: 1.2, marginBottom: 0 }
              : { fontSize: 'var(--ant-font-size-sm)', letterSpacing: '0.04em' }
          }
        >
          aigc-friendly-frontend
        </Typography.Text>
        {isHeader ? (
          <Typography.Text type="secondary">主内容优先，入口协作增强。</Typography.Text>
        ) : null}
      </Flex>
    </Flex>
  );
}
