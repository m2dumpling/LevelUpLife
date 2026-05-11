import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 是原生模块，不能被打包进客户端
  serverExternalPackages: ["better-sqlite3"],
  // standalone 输出模式，用于 Docker 最小化部署 (1C 1G VPS 友好)
  output: "standalone",
};

export default nextConfig;
