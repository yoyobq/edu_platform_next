import { spawn } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';

const host = process.env.PLAYWRIGHT_HOST || '::1';
const port = process.env.PLAYWRIGHT_PORT || '42173';
const viteCliPath = path.resolve(process.cwd(), 'node_modules/vite/bin/vite.js');
let shuttingDown = false;

function formatBaseURL(hostname, portNumber) {
  const normalizedHost = hostname.includes(':') ? `[${hostname}]` : hostname;
  return `http://${normalizedHost}:${portNumber}`;
}

console.log(`[E2E Server] bootstrap: starting Vite on ${formatBaseURL(host, port)}`);

const viteProcess = spawn(
  process.execPath,
  [viteCliPath, '--host', host, '--port', port, '--strictPort'],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

viteProcess.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
});

viteProcess.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});

viteProcess.once('exit', (code, signal) => {
  if (signal) {
    if (!shuttingDown) {
      process.stderr.write(`[E2E Server] vite exited from signal ${signal}\n`);
      process.exit(1);
      return;
    }

    process.exit(0);
    return;
  }

  process.exit(code ?? 0);
});

const shutdown = (signal) => {
  shuttingDown = true;
  process.stdout.write(`[E2E Server] shutdown: forwarding ${signal} to Vite\n`);

  if (!viteProcess.killed) {
    viteProcess.kill(signal);
  }
};

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
