import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Prioritize the actual process environment variable (from Docker ARG/ENV) if available
  const apiKey = process.env.API_KEY || env.API_KEY;
  
  return {
    plugins: [react()],
    define: {
      // This exposes the API_KEY from the build environment to the browser code
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
  };
});