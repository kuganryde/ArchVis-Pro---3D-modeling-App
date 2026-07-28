import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Split heavy vendor libraries into their own chunks so the main app
      // bundle stays small and cacheable.
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three'],
            react: ['react', 'react-dom'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
    server: {
      // Optional escape hatch: set DISABLE_HMR=true to turn off HMR and file
      // watching (useful in constrained or CI environments).
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
