// Server URL configuration
// Set SERVER_URL environment variable at build time to override
// Example: SERVER_URL=myserver.com:2567 npm run build

declare const process: {
  env: {
    SERVER_URL: string;
  };
};

const SERVER_URL = process.env.SERVER_URL || 'localhost:2567';

// Determine protocol based on current page (for production with HTTPS)
const isSecure =
  typeof window !== 'undefined' &&
  (window as Window).location.protocol === 'https:';

const wsProtocol = isSecure ? 'wss' : 'ws';
const httpProtocol = isSecure ? 'https' : 'http';

export const config = {
  serverUrl: SERVER_URL,
  wsUrl: `${wsProtocol}://${SERVER_URL}`,
  apiUrl: `${httpProtocol}://${SERVER_URL}`,
};
