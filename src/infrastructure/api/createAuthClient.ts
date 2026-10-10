import axios, { type AxiosInstance } from 'axios';
import { normalizeError } from './errors';

export type HttpClientOptions = {
  baseUrl: string;
  timeoutMs: number;
};

export function createAuthClient(options: HttpClientOptions): AxiosInstance {
  const client = axios.create({ baseURL: options.baseUrl, timeout: options.timeoutMs });
  client.interceptors.response.use(
    response => response,
    error => Promise.reject(normalizeError(error)),
  );
  return client;
}
