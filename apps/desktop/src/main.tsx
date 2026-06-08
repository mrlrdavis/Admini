import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import '@admini/ui/styles.css';
import '@admini/workspace/styles.css';
import './styles.css';
import { App } from './App';
import { ReloadPrompt } from './ReloadPrompt';
import { scrubSentryText } from '@admini/privacy';
import { PWAProvider } from '@admini/pwa';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? 'preview',
    release: 'admini-desktop@0.1.0',
    beforeSend(event) {
      if (event.message) event.message = scrubSentryText(event.message);
      return event;
    }
  });
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PWAProvider>
      <App />
      <ReloadPrompt />
    </PWAProvider>
  </React.StrictMode>
);