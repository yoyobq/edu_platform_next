import { useEffect, useRef, useState } from 'react';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Input, type InputRef, Tag } from 'antd';

import { normalizeTagsValue } from '../lib/tags';

export function UserTagsDisplay({ value }: { value: readonly string[] | null | undefined }) {
  const normalizedValue = normalizeTagsValue(value ?? []);

  if (normalizedValue.length === 0) {
    return '—';
  }

  return (
    <Flex gap={6} wrap>
      {normalizedValue.map((tag) => (
        <Tag key={tag} color="cyan">
          {tag}
        </Tag>
      ))}
    </Flex>
  );
}

export function UserTagsEditor({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange?: (nextValue: string[]) => void;
  value?: readonly string[];
}) {
  const normalizedValue = normalizeTagsValue(value ?? []);
  const [draftValue, setDraftValue] = useState('');
  const [isInputVisible, setIsInputVisible] = useState(false);
  const inputRef = useRef<InputRef | null>(null);

  const pendingTags = normalizeTagsValue(draftValue.split(/[,\n，]+/));
  const hasPendingTags = pendingTags.length > 0;

  useEffect(() => {
    if (isInputVisible) {
      inputRef.current?.focus();
    }
  }, [isInputVisible]);

  function openInput() {
    if (disabled) {
      return;
    }

    setIsInputVisible(true);
  }

  function closeInput() {
    setDraftValue('');
    setIsInputVisible(false);
  }

  function handleAddTags() {
    if (disabled) {
      return;
    }

    if (!hasPendingTags) {
      closeInput();
      return;
    }

    onChange?.(normalizeTagsValue([...normalizedValue, ...pendingTags]));
    closeInput();
  }

  function handleRemoveTag(tagToRemove: string) {
    if (disabled) {
      return;
    }

    onChange?.(normalizedValue.filter((tag) => tag !== tagToRemove));
  }

  return (
    <Flex align="center" gap={8} wrap>
      {normalizedValue.map((tag) => (
        <Tag
          key={tag}
          style={{
            alignItems: 'center',
            display: 'inline-flex',
            gap: 2,
            marginInlineEnd: 0,
            paddingInlineEnd: 4,
          }}
        >
          {tag}
          <Button
            aria-label={`删除标签 ${tag}`}
            disabled={disabled}
            icon={<CloseOutlined />}
            onClick={() => handleRemoveTag(tag)}
            size="small"
            type="text"
            style={{
              color: 'var(--ant-color-text-secondary)',
              height: 18,
              minWidth: 18,
              paddingInline: 0,
            }}
          />
        </Tag>
      ))}
      {isInputVisible ? (
        <Input
          aria-label="标签输入"
          disabled={disabled}
          maxLength={32}
          onBlur={handleAddTags}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeInput();
            }
          }}
          onPressEnter={(event) => {
            event.preventDefault();
            handleAddTags();
          }}
          placeholder="输入标签"
          ref={inputRef}
          size="small"
          style={{ width: 140 }}
          value={draftValue}
        />
      ) : (
        <Button
          aria-label="新增标签"
          disabled={disabled}
          icon={<PlusOutlined />}
          onClick={openInput}
          shape="circle"
          size="small"
          type="dashed"
        />
      )}
    </Flex>
  );
}
