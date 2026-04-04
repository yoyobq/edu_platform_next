export const routes = {
  forgotPassword: '/forgot-password',
  home: '/',
  invite: (inviteType = 'workspace', verificationCode = 'invite-code-001') =>
    `/invite/${inviteType}/${verificationCode}`,
  labsDemo: '/labs/demo',
  login: '/login',
  magicLink: (verificationCode = 'magic-link-001') => `/magic-link/${verificationCode}`,
  resetPassword: (verificationCode = 'reset-password-001') => `/reset-password/${verificationCode}`,
  resetPasswordWithTokenQuery: (verificationCode = 'reset-password-001') =>
    `/reset-password?token=${verificationCode}`,
  sandboxPlayground: '/sandbox/playground',
  verifyEmail: (verificationCode = 'verify-email-001') => `/verify/email/${verificationCode}`,
  welcome: '/welcome',
} as const;
