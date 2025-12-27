import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/vscode-mcp-acs-testing/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  resolve: {
    // Ensure we don't traverse up beyond this directory
    preserveSymlinks: false,
  },
});
