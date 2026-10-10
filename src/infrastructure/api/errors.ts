import axios from 'axios';
import { isRecord } from '../../shared/guards';

export type AppErrorKind = 'network' | 'unauthorized' | 'http' | 'protocol' | 'unknown';

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly status: number | undefined;

  constructor(kind: AppErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.status = status;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function unauthorizedError(message = 'Not authorized'): AppError {
  return new AppError('unauthorized', message);
}

export function protocolError(message: string): AppError {
  return new AppError('protocol', message);
}

export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }
  if (axios.isAxiosError(error)) {
    const response = error.response;
    if (!response) {
      return new AppError('network', 'Network request failed');
    }
    if (response.status === 401) {
      return unauthorizedError();
    }
    const body: unknown = response.data;
    const message =
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : `Request failed with status ${response.status}`;
    return new AppError('http', message, response.status);
  }
  return new AppError('unknown', error instanceof Error ? error.message : 'Unexpected error');
}

export function isTransientError(error: AppError): boolean {
  if (error.kind === 'network') {
    return true;
  }
  return (
    error.kind === 'http' &&
    error.status !== undefined &&
    (error.status === 408 || error.status === 429 || error.status >= 500)
  );
}

export function toUserMessage(error: unknown): string {
  const normalized = normalizeError(error);
  switch (normalized.kind) {
    case 'network':
      return 'No internet connection. Check your network and try again.';
    case 'unauthorized':
      return 'Your session is no longer valid. Please sign in again.';
    case 'http':
      return normalized.status !== undefined && normalized.status >= 500
        ? 'The server is having trouble right now. Please try again.'
        : normalized.message;
    case 'protocol':
      return 'The server sent an unexpected response. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
