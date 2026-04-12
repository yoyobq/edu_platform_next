import { Flex, Typography } from 'antd';

export function BilingualLabel({
  compact = false,
  title,
  subtitle,
}: {
  compact?: boolean;
  title: string;
  subtitle: string;
}) {
  return (
    <Flex align="center" gap={8} wrap="wrap">
      <Typography.Text
        type="secondary"
        style={compact ? { fontSize: 12, lineHeight: 1.2 } : { fontWeight: 500 }}
      >
        {title}
      </Typography.Text>
      <Typography.Text
        type="secondary"
        style={{
          fontSize: compact ? 11 : 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          lineHeight: 1.2,
          opacity: 0.6,
        }}
      >
        {subtitle}
      </Typography.Text>
    </Flex>
  );
}
