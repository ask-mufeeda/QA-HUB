import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const clientRoot = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = resolve(clientRoot, "..");

function clientHistoryFallback() {
  return {
    name: "qa-hub-client-history-fallback",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (!request.url) {
          next();
          return;
        }

        const requestUrl = new URL(request.url, "http://localhost");
        if (
          requestUrl.pathname.startsWith("/client/") &&
          !/\.[^/]+$/.test(requestUrl.pathname)
        ) {
          request.url = `/client/index.html${requestUrl.search}`;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command }) => {
  const isBuild = command === "build";

  return {
    root: isBuild ? clientRoot : workspaceRoot,
    envDir: clientRoot,
    base: "./",
    cacheDir: resolve(clientRoot, "node_modules/.vite"),
    publicDir: resolve(clientRoot, "public"),
    plugins: [react(), tailwindcss(), clientHistoryFallback()],
    optimizeDeps: {
      entries: [resolve(clientRoot, "index.html")],
    },
    server: {
      open: "/client/",
    },
    build: {
      outDir: resolve(clientRoot, "dist"),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(clientRoot, "index.html"),
      },
    },
  };
});
