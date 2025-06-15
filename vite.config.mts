import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "out",
    sourcemap: true,
    lib: {
      entry: "./src/extension.ts",
    },
    rollupOptions: {
      external: ["vscode", "node:child_process", "child_process"],
      input: {
        extension: path.resolve(__dirname, "src/extension.ts"),
      },
      output: [
        {
          format: "cjs",
          entryFileNames: "[name].js",
        },
        {
          format: "es",
          entryFileNames: "[name].[format].js",
        },
      ],
    },
  },
  define: {
    "process.env": process.env,
  },
});
