import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function validateEnv() {
  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.warn(`\n⚠ Missing env vars: ${missing.join(', ')}. See .env.example.\n`);
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  if (command === 'build') validateEnv();
  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
          },
        },
      },
    },
  };
});
