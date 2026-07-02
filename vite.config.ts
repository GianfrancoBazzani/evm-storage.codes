import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  optimizeDeps: {
    // brotli-wasm resolves its .wasm binary relative to import.meta.url at
    // runtime. Vite's dev-server dependency pre-bundling copies the module
    // into node_modules/.vite/deps/, which moves import.meta.url away from
    // the .wasm file and breaks that lookup (the dev server then serves the
    // SPA's index.html for the missing path, which fails to instantiate as
    // WebAssembly). Excluding it keeps the module served from its original
    // location, where the relative path still resolves correctly.
    exclude: ["brotli-wasm"],
  },
});
