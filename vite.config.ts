import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// Relative base so the built bundle works under file:// in the packaged app.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  server: {
    port: 5180
  }
})
