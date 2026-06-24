import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const publicOutDir = resolve(__dirname, "../public/booking-widget");

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: publicOutDir,
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "src/main.tsx"),
      output: {
        entryFileNames: "booking-widget.js",
        assetFileNames: "booking-widget.[ext]",
      },
    },
    cssCodeSplit: false,
  },
});
