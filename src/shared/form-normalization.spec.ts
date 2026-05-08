import { describe, expect, it } from 'vitest';

import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
  normalizeTextListValue,
} from './form-normalization';

describe('form-normalization', () => {
  it('normalizes optional text by explicit empty policy', () => {
    expect(normalizeOptionalTextValue(' value ', 'to_null')).toBe('value');
    expect(normalizeOptionalTextValue('   ', 'to_null')).toBeNull();
    expect(normalizeOptionalTextValue(null, 'to_undefined')).toBeUndefined();
    expect(normalizeOptionalTextValue('   ', 'keep_empty_string')).toBe('');
  });

  it('normalizes required text and rejects empty values', () => {
    expect(normalizeRequiredTextValue(' name ')).toBe('name');
    expect(() => normalizeRequiredTextValue(' ', { label: '名称' })).toThrow('请输入名称。');
  });

  it('normalizes text lists with stable dedupe order', () => {
    expect(
      normalizeTextListValue([' alpha ', '', 'beta', 'alpha ', ' beta '], {
        dedupe: true,
        emptyItemPolicy: 'filter',
      }),
    ).toEqual(['alpha', 'beta']);
  });
});
