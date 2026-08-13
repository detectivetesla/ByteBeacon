import { startServer } from './server.js';
import { createApp } from './app.js';

export { createApp, startServer };

if (process.env.NODE_ENV !== 'test') {
  startServer().catch(() => {
    // Handled in startServer
  });
}
