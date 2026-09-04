import { describe, expect, it } from 'vitest';

import { validateAccountPassword } from './account-password-validation';

describe('public auth account password validation', () => {
  it.each(['Invite!234', 'Abcd1234!', '教师Invite2026'])(
    'accepts valid password %s',
    (password) => {
      expect(validateAccountPassword(password)).toBeNull();
    },
  );

  it.each([
    [' short1!', '密码首尾不能包含空格。'],
    ['short1!', '密码长度至少为 8 位。'],
    ['abcdefgh', '密码至少需要包含字母、数字、符号中的 2 种字符。'],
    ['Password123!', '密码包含常见的弱密码片段，请更换更复杂的密码。'],
    ['Invite111!', '密码不能包含连续 3 个相同字符。'],
  ])('rejects invalid password %s', (password, message) => {
    expect(validateAccountPassword(password)).toBe(message);
  });

  it('rejects passwords longer than 128 characters', () => {
    expect(validateAccountPassword(`Invite1!${'x'.repeat(121)}`)).toBe('密码长度不能超过 128 位。');
  });
});
