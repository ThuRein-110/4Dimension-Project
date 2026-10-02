import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { fs: { deny: ['**/.env','**/.env.*','**/*.{crt,pem,key}','**/.git/**','**/.local/**','**/.cache/**','**/*.[mM][oO][vV]','**/*.[mM][pP]4','**/*.[mM]4[vV]','**/*.[wW][eE][bB][mM]'] } },
  build: { outDir: 'dist/web' },
});
