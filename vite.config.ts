import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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
  plugins: [dyadComponentTagger(), react()], 
  resolve: { 
    alias: { 
      "@": path.resolve(__dirname, "./src"),
      // Adding aliases to ensure a single instance of React is used
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
    }, 
  }, 
}));