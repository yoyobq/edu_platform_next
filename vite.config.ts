import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, 'env');
  const env = loadEnv(mode, envDir, '');

  const devServerHost = env.DEV_SERVER_HOST || 'localhost';
  const devServerPort = Number.parseInt(env.DEV_SERVER_PORT || '5173', 10);
  const devServerStrictPort = env.DEV_SERVER_STRICT_PORT === 'true';

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: devServerHost,
      port: devServerPort,
      strictPort: devServerStrictPort,
    },
  };
});
