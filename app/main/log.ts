import { app } from 'electron';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

type Level = 'debug' | 'info' | 'warn' | 'error';

const CONSOLE: Record<Level, (msg: string) => void> = {
  debug: () => {},
  info: (m) => console.log(m),
  warn: (m) => console.warn(m),
  error: (m) => console.error(m)
};

function write(level: Level, message: string) {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}\n`;
  try {
    const dir = join(app.getPath('userData'), 'logs');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'app.log'), line);
  } catch {
    /* logging must never take the app down */
  }
  CONSOLE[level](`[${level}] ${message}`);
}

export const log = {
  debug: (m: string) => write('debug', m),
  info: (m: string) => write('info', m),
  warn: (m: string) => write('warn', m),
  error: (m: string) => write('error', m)
};
