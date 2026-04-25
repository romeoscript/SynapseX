import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@ethy-arena/shared"],
};

export default nextConfig;
