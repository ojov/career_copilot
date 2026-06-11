import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse pulls in pdfjs-dist, which loads a worker file at runtime.
  // Bundling it with Turbopack breaks the worker path, so keep it external.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
