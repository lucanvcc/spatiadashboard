import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker deployment (copies only the minimal runtime)
  output: "standalone",
};

export default nextConfig;
