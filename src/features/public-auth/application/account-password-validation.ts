const commonWeakPasswordFragments = [
  '12345678',
  '123456789',
  '1234567890',
  '87654321',
  'qwerty123',
  'qwertyui',
  'asdfghjk',
  'zxcvbnm123',
  'qwer1234',
  'asdf1234',
  'password',
  'password123',
  'admin123',
  'root123',
  'user123',
  'test123',
  'welcome123',
  'login123',
  'aaaaaaaa',
  '11111111',
  '00000000',
] as const;

const passwordSymbolPattern = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;

function hasThreeRepeatingCharacters(value: string): boolean {
  for (let index = 0; index <= value.length - 3; index += 1) {
    if (value[index] === value[index + 1] && value[index] === value[index + 2]) {
      return true;
    }
  }

  return false;
}

export function validateAccountPassword(password: string): string | null {
  const normalizedPassword = password.normalize('NFKC');

  if (normalizedPassword !== normalizedPassword.trim()) {
    return '密码首尾不能包含空格。';
  }

  if (normalizedPassword.length < 8) {
    return '密码长度至少为 8 位。';
  }

  if (normalizedPassword.length > 128) {
    return '密码长度不能超过 128 位。';
  }

  const characterGroupCount = [
    /\p{L}/u.test(normalizedPassword),
    /\d/.test(normalizedPassword),
    passwordSymbolPattern.test(normalizedPassword),
  ].filter(Boolean).length;

  if (characterGroupCount < 2) {
    return '密码至少需要包含字母、数字、符号中的 2 种字符。';
  }

  const lowerPassword = normalizedPassword.toLowerCase();
  if (commonWeakPasswordFragments.some((fragment) => lowerPassword.includes(fragment))) {
    return '密码包含常见的弱密码片段，请更换更复杂的密码。';
  }

  if (hasThreeRepeatingCharacters(normalizedPassword)) {
    return '密码不能包含连续 3 个相同字符。';
  }

  return null;
}
