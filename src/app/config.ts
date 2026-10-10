export const config = {
  useMockApi: true,
  apiBaseUrl: 'https://api.learningdashboard.example',
  requestTimeoutMs: 10_000,
  mockLatencyMs: 600,
  mockAccessTokenTtlMs: 60_000,
  keychainServiceId: 'com.courseapp.session',
} as const;
