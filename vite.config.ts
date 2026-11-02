import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, ".", "").VITE_BASE_PATH || "/",
  plugins: [react()],
  server: { host: "127.0.0.1" },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ["maplibre-gl"],
          motion: ["framer-motion"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
}));
