import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Load shared repo-root .env for local development.
// On Vercel, env vars are injected by the platform — this is a no-op.
const envPath = path.resolve(process.cwd(), "..", ".env");
try {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;
      const [key, ...rest] = trimmed.split("=");
      const val = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    });
  }
} catch {
  // Silently skip — env vars should come from the hosting platform in production.
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
