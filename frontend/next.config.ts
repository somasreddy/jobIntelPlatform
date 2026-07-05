import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appDir, "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceRoot,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
