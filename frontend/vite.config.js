import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, as chamadas a /api são repassadas para o backend (porta 3333),
// então frontend e backend funcionam juntos sem configuração de CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_PROXY_API || 'http://localhost:3333', changeOrigin: true },
    },
  },
});
