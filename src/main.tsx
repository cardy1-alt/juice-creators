import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext';
import App from './App.tsx';
import './index.css';

// Validate required env vars at startup
if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co') {
  console.warn('[nayba] VITE_SUPABASE_URL is not set. The app will not connect to Supabase. See .env.example.');
}
if (!import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY === 'placeholder') {
  console.warn('[nayba] VITE_SUPABASE_ANON_KEY is not set. The app will not connect to Supabase. See .env.example.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
