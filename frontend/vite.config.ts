/// <reference types="vitest" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IncomingMessage } from "node:http";
import { defineConfig, type ProxyOptions } from "vite";

// SEC-01: the backend writes a fresh token to ../.orbit-token on every start. The proxy reads it per request
// and adds it, so the browser never holds it and a restarted backend needs no frontend restart.
const TOKEN_FILE = process.env.ORBIT_TOKEN_FILE || resolve(__dirname, "..", ".orbit-token");
const readToken = () => {
  try {
    return readFileSync(TOKEN_FILE, "utf8").trim();
  } catch {
    return "";
  }
};

// Only requests made by ORBIT's own pages get the token. Another website open in the same browser can send
// requests to localhost:5173/api, but the browser labels them cross-site (Sec-Fetch-Site) or with a foreign Origin.
export const isOwnPage = (req: Pick<IncomingMessage, "headers">, port: number): boolean => {
  const site = req.headers["sec-fetch-site"];
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.origin;
  return !origin || origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`;
};

const apiProxy = (port: number): Record<string, ProxyOptions> => ({
  "/api": {
    target: "http://127.0.0.1:8000",
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq, req) => {
        proxyReq.removeHeader("x-orbit-token");
        const token = readToken();
        if (token && isOwnPage(req, port)) proxyReq.setHeader("X-Orbit-Token", token);
      });
    },
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true, proxy: apiProxy(5173) },
  preview: { port: 4173, strictPort: true, proxy: apiProxy(4173) },
  build: {
    chunkSizeWarningLimit: 1100, // the lazily loaded three.js chunk; the app itself is ~140 kB
    rollupOptions: {
      output: { manualChunks: { three: ["three", "@react-three/fiber", "@react-three/drei"] } },
    },
  },
  test: { environment: "jsdom", setupFiles: ["./tests/setup.ts"], globals: true },
});
