import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from './contexts/AuthContext';
import { initObservability } from './lib/observability';
import App from './App.tsx';
import './index.css';

// Initialize Sentry (no-op if VITE_SENTRY_DSN not set)
initObservability();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <Analytics />
    </AuthProvider>
  </StrictMode>
);
