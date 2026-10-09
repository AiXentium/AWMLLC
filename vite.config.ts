import { resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// The MCP plugin's configResolved hook is wrapped for Windows path normalization.
// Typed precisely instead of `any`: Vite's Plugin configResolved hook shape.
const mcp = mcpPlugin() as unknown as Plugin;

if (process.platform === "win32" && mcp.configResolved) {
  const originalConfigResolved = mcp.configResolved;

  mcp.configResolved = async function (config: ResolvedConfig) {
    const normalizedConfig = {
      ...config,
      root: resolve(config.root),
    };

    if (typeof originalConfigResolved === "function") {
      return originalConfigResolved.call(this, normalizedConfig);
    }

    if (originalConfigResolved && typeof originalConfigResolved.handler === "function") {
      return originalConfigResolved.handler.call(this, normalizedConfig);
    }
  };
}

export default defineConfig({
  plugins: [mcp],
  nitro: {
    preset: "cloudflare-module",
    cloudflare: { nodeCompat: true, deployConfig: false },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
