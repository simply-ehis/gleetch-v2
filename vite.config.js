import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import openmontageMiddleware from "./openmontage.middleware.js";
export default defineConfig({
  plugins: [react(), openmontageMiddleware()],
  // Relative base: works whether this is served from a domain root
  // (Netlify, Vercel) or a subpath (GitHub Pages project sites serve from
  // /reponame/). Safe here specifically because this is a single-page app
  // with no client-side routing/deep-linked URLs to worry about.
  base: "./",
  build: { outDir: "dist", target: "esnext" },
});