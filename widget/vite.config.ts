import { copyFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const publicOutDir = resolve(__dirname, "../public/booking-widget");
const extensionAssetsDir = resolve(
  __dirname,
  "../extensions/booking-widget/assets",
);

function copyWidgetAssets(): Plugin {
  const copy = () => {
    mkdirSync(extensionAssetsDir, { recursive: true });
    copyFileSync(
      resolve(publicOutDir, "booking-widget.js"),
      resolve(extensionAssetsDir, "booking-widget.js"),
    );
    copyFileSync(
      resolve(publicOutDir, "booking-widget.css"),
      resolve(extensionAssetsDir, "booking-widget.css"),
    );
  };

  return {
    name: "copy-widget-assets",
    writeBundle() {
      copy();
    },
  };
}

export default defineConfig({
  plugins: [react(), copyWidgetAssets()],
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
