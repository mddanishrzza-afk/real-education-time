import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Arena previews are served from a per-session e2b.app host. Allowing only
  // that dev-host family keeps Next.js client bundles/HMR available in preview.
  allowedDevOrigins: ["**.e2b.app"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
