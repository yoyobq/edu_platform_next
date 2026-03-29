import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value === 'true';
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isNaN(parsedValue) ? fallback : parsedValue;
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, 'env');
  const env = loadEnv(mode, envDir, '');

  const devServerHost = env.DEV_SERVER_HOST || 'localhost';
  const devServerPort = parseInteger(env.DEV_SERVER_PORT, 5173);
  const devServerStrictPort = parseBoolean(env.DEV_SERVER_STRICT_PORT, false);
  const buildOutDir = env.BUILD_OUT_DIR || 'dist';
  const buildSourcemap = parseBoolean(env.BUILD_SOURCEMAP, false);
  const buildChunkWarningLimit = parseInteger(env.BUILD_CHUNK_WARNING_LIMIT, 500);

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
    build: {
      outDir: buildOutDir,
      sourcemap: buildSourcemap,
      chunkSizeWarningLimit: buildChunkWarningLimit,
    },
  };
});
