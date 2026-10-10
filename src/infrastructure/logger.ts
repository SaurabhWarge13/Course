type LogFields = Record<string, string | number | boolean | null | undefined>;

function emit(level: 'log' | 'warn' | 'error', event: string, fields?: LogFields): void {
  if (!__DEV__) {
    return;
  }
  console[level](`[app] ${event}`, fields ?? '');
}

export const logger = {
  info: (event: string, fields?: LogFields) => emit('log', event, fields),
  warn: (event: string, fields?: LogFields) => emit('warn', event, fields),
  error: (event: string, fields?: LogFields) => emit('error', event, fields),
};

export function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
