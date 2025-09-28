import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { resolve } from 'path';

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  preview: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "assistenteia.intrategica.com.br"
    ],
  },
  plugins: [react()], 
  resolve: { 
    alias: { 
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        widget: resolve(__dirname, 'src/widget.tsx'),
      },
      output: {
        // Garante que o entry point 'widget' sempre seja gerado como 'assets/widget.js'
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'widget') {
            return 'assets/widget.js';
          }
          // Outros entry points (como o 'main') continuarão com hash para cache busting
          return 'assets/[name].[hash].js';
        },
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[extname]',
      }
    }
  }
}));