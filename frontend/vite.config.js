import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",                       // relative paths so the build works from S3/CloudFront
  server: { port: 5173, strictPort: true, host: "localhost" },
});
