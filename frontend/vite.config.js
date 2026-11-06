import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Preserva Host para a validação de mesma origem no login/logout da API.
  server: { proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } } },
});
