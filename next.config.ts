import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Minimal loader to read the shared repo-root .env without extra deps.
const envPath = path.resolve(__dirname, "..", ".env");
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

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
