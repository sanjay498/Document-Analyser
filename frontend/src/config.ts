// Centralized application configuration
export const Config = {
  googleClientId:
    (import.meta as any).env?.GOOGLE_CLIENT_ID ||
    (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
    '',
  apiBaseUrl: '/api',
};
