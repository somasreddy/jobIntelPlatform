import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // output: "export",
  // basePath for GitHub Pages: /repo-name
  // Change "job-intelligence-platform" to your actual GitHub repo name
  basePath: isProd ? "/job-intelligence-platform" : "",
  assetPrefix: isProd ? "/job-intelligence-platform/" : "",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
