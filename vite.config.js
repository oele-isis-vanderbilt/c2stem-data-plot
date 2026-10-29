import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Older syntax so hosts on older bundlers (e.g. Vue CLI / webpack 5) can parse it
    target: "es2019",
    lib: {
      entry: "src/index.js",
      formats: ["es"],
      fileName: () => "data-plot.js",
    },
    rollupOptions: {
      // The host installs these; they are not bundled
      external: [/^lit/, /^chart\.js/],
    },
  },
  test: {
    environment: "node",
  },
});
