// Tests de logging estructurado JSON (tarea 3.5)
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger, resolveLogLevel } from '../../../src/shared/logging/logger.js';

function captureLogs(): { chunks: string[]; stream: Writable } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  return { chunks, stream };
}

describe('logging estructurado (pino)', () => {
  it('emite líneas JSON válidas con nivel, mensaje y contexto', () => {
    const { chunks, stream } = captureLogs();
    const log = createLogger({ level: 'info', stream });

    log.info({ userId: 'u-1', action: 'LOGIN' }, 'usuario autenticado');
    log.warn({ attempts: 3 }, 'múltiples intentos fallidos');

    expect(chunks).toHaveLength(2);
    for (const line of chunks) {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      expect(parsed).toHaveProperty('level');
      expect(parsed).toHaveProperty('time');
    }

    const first = JSON.parse(chunks[0] as string) as Record<string, unknown>;
    expect(first['msg']).toBe('usuario autenticado');
    expect(first['userId']).toBe('u-1');
    expect(first['action']).toBe('LOGIN');

    const second = JSON.parse(chunks[1] as string) as Record<string, unknown>;
    expect(second['msg']).toBe('múltiples intentos fallidos');
    expect(second['attempts']).toBe(3);
  });

  it('respeta el nivel configurado (debug filtrado en nivel info)', () => {
    const { chunks, stream } = captureLogs();
    const log = createLogger({ level: 'info', stream });

    log.debug({ hidden: true }, 'no debe aparecer');
    log.error({ visible: true }, 'sí debe aparecer');

    expect(chunks).toHaveLength(1);
    const parsed = JSON.parse(chunks[0] as string) as Record<string, unknown>;
    expect(parsed['msg']).toBe('sí debe aparecer');
  });

  it('resuelve LOG_LEVEL desde variables de entorno con fallback info', () => {
    expect(resolveLogLevel({})).toBe('info');
    expect(resolveLogLevel({ LOG_LEVEL: 'debug' })).toBe('debug');
    expect(resolveLogLevel({ LOG_LEVEL: 'nivel-inventado' })).toBe('info');
  });
});
