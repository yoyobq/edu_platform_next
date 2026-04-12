import { type CSSProperties } from 'react';
import { Flex, Tag } from 'antd';

import type { AuthAccessGroup } from '@/shared/auth-access';

import {
  EDITABLE_ACCESS_GROUPS,
  normalizeAccessGroupValue,
  toggleEditableAccessGroup,
} from '../lib/access-group';

function getAccessGroupTagTone(
  accessGroup: (typeof EDITABLE_ACCESS_GROUPS)[number],
  checked: boolean,
) {
  if (!checked) {
    return {
      backgroundColor: '#f5f5f5',
      borderColor: '#d9d9d9',
      color: '#8c8c8c',
    } satisfies CSSProperties;
  }

  switch (accessGroup) {
    case 'ADMIN':
      return {
        backgroundColor: '#fff1f0',
        borderColor: '#ffb3b3',
        color: '#b42318',
      } satisfies CSSProperties;
    case 'STAFF':
      return {
        backgroundColor: '#e6f4ff',
        borderColor: '#91caff',
        color: '#0958d9',
      } satisfies CSSProperties;
    case 'GUEST':
    default:
      return {
        backgroundColor: '#f6ffed',
        borderColor: '#b7eb8f',
        color: '#389e0d',
      } satisfies CSSProperties;
  }
}

export function AccessGroupTagGroup({
  disabled = false,
  onToggle,
  value,
}: {
  disabled?: boolean;
  onToggle?: (nextValue: AuthAccessGroup[]) => void;
  value: readonly AuthAccessGroup[];
}) {
  const normalizedValue = normalizeAccessGroupValue(value);

  return (
    <Flex gap={8} wrap>
      {EDITABLE_ACCESS_GROUPS.map((accessGroup) => {
        const checked = normalizedValue.includes(accessGroup);
        const toneStyle = getAccessGroupTagTone(accessGroup, checked);

        return (
          <Tag.CheckableTag
            key={accessGroup}
            aria-pressed={checked}
            checked={checked}
            data-testid={`access-group-tag-${accessGroup}`}
            onChange={() => {
              if (disabled) {
                return;
              }

              onToggle?.(toggleEditableAccessGroup(normalizedValue, accessGroup));
            }}
            style={{
              ...toneStyle,
              borderWidth: 1,
              borderStyle: 'solid',
              cursor: onToggle && !disabled ? 'pointer' : 'default',
              marginInlineEnd: 0,
              opacity: disabled ? 0.72 : 1,
              userSelect: 'none',
            }}
          >
            {accessGroup}
          </Tag.CheckableTag>
        );
      })}
    </Flex>
  );
}

export function AccessGroupDisplayTags({ value }: { value: readonly AuthAccessGroup[] }) {
  if (value.length === 0) {
    return '—';
  }

  return (
    <Flex gap={4} wrap>
      {value.map((accessGroup) => (
        <Tag key={accessGroup} color={accessGroup === 'REGISTRANT' ? 'gold' : 'blue'}>
          {accessGroup}
        </Tag>
      ))}
    </Flex>
  );
}
