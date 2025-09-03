import { defineConfig } from "vite";
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
  plugins: [react()], 
  resolve: { 
    alias: { 
      "@": path.resolve(__dirname, "./src"), 
    }, 
  }, 
}));